// =========================
// homeSystem.js
// ระบบ "บ้าน" ส่วนตัวของผู้เล่น — ตั้งจุดวาปได้เอง (ตั้งชื่อได้หลายบ้าน
// ตามจำนวนสูงสุดที่ตั้งไว้ใน ECONOMY_CONFIG.HOME.MAX_HOMES) แล้ววาปกลับ
// ทีหลังได้จากทุกที่ ทุกมิติ — ใช้คู่กับ commands/homeCommands.js
// (/prakan:sethome, /prakan:home, /prakan:delhome, /prakan:homes)
//
// เก็บข้อมูลแบบเดียวกับที่ playerMarket.js เก็บ watchlist ต่อผู้เล่น — JSON
// สตริงใน dynamic property ของตัว player เอง (ไม่ใช่ world) เพราะข้อมูล
// เป็นของผู้เล่นคนนั้นล้วน ๆ ไม่มีใครอื่นต้องอ่าน/แก้ได้
//   key -> { x, y, z, dimensionId }
//
// ค่าใช้จ่ายตอนตั้งบ้าน "ใหม่" (ไม่คิดตอนย้ายบ้านชื่อเดิม) และจำนวนบ้าน
// สูงสุด อ่านจาก config/economyConfig.js (ECONOMY_CONFIG.HOME) จุดเดียว —
// แก้ค่าที่นั่น ไม่ต้องแก้ไฟล์นี้
//
// ค่าใช้จ่ายตอน "วาปไปบ้าน" (teleportHome) ใช้สูตรเดียวกับระบบ TP ขอ-ยอมรับ
// ระหว่างผู้เล่น (บล็อก x ราคา/บล็อก ในมิติเดียวกัน, ราคาคงที่ข้ามมิติ) แต่
// อ่านค่าจาก ECONOMY_CONFIG.HOME.COST_PER_BLOCK / CROSS_DIMENSION_COST ของ
// ตัวเอง — แยกจาก ECONOMY_CONFIG.TELEPORT เพื่อให้ปรับราคาเฉพาะระบบบ้านได้
// อิสระ ไม่กระทบราคา /prakan:tpa
//
// FEATURE: HOME CHANNEL (นับถอยหลังก่อนวาป)
// เดิม teleportHome() หักเงินแล้ววาปทันทีในติ๊กเดียวกัน ตอนนี้หลังหักเงิน
// จะเข้าสถานะ "นับถอยหลัง" ECONOMY_CONFIG.HOME.CHANNEL_SECONDS วินาที
// (ค่าเริ่มต้น 20) ก่อนจะวาปจริง — หลักการเดียวกับ TP CHANNEL ใน
// tpBankSystem.js ทุกประการ: ต้อง "ยืนนิ่ง" (ขยับได้ไม่เกิน
// CHANNEL_MOVE_THRESHOLD_BLOCKS บล็อก, ห้ามเปลี่ยนมิติ) และห้ามโดนโจมตี —
// ถ้าเงื่อนไขไม่ผ่าน ยกเลิกทันทีและคืนเงินเต็มจำนวน มีได้แค่ 1 channel
// ต่อผู้เล่นหนึ่งคนพร้อมกัน (กันหักเงินซ้อน) ดู activeHomeChannels /
// startHomeChannel() / cancelHomeChannel() / finishHomeTeleport() ด้านล่าง
// =========================

import { world, system } from "@minecraft/server";
import { getMoney, setMoney, removeMoney, depositToBank, withdrawFromBank } from "../core/economyUtils";
import { isValidPlayer, distanceBetween } from "../core/playerUtils";
import { showActionBar, showError, showSuccess } from "../core/messageUtils";
import { createListMenu, createAmountPrompt } from "../ui/framework/UIFramework";
import { showConfirm } from "../core/confirmDialog";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { t } from "../ui/locale/index";
import { TICKS_PER_SECOND } from "../core/constants";
import { ECONOMY_CONFIG } from "../config/economyConfig";
// Phase 3B: แจ้งระบบเควส (systems/quests/reportApi.js) ตอน "วาปกลับบ้าน" สำเร็จ
// จริง (ไม่มี world event ให้ฟังตรง ๆ) — เหมือน reportItemSold() ที่
// shopSystem.js เรียกใช้งานอยู่แล้ว ไม่มี Circular Import (questSystem.js
// ไม่ import กลับมาที่ไฟล์นี้เลย)
import { reportHomeTeleport } from "./questSystem";
import { subscribeSafe } from "../core/eventGuard";

const HOME_DYNAMIC_PROPERTY_KEY = "prakan_homes";
const DEFAULT_HOME_NAME = "home";
const MAX_NAME_LENGTH = 16;

/* =========================
   COMMAND COOLDOWN
   คูลดาวน์ร่วมกันของ setHome/teleportHome/deleteHome (ใช้คำสั่งไหนก็ติด
   คูลดาวน์คำสั่งอื่นด้วย) — สถานะชั่วคราวล้วน ๆ ไม่ผูกกับ dynamic property
   เหมือนกับ combatUntilTick ใน tpBankSystem.js (ไม่ต้องอยู่ข้ามการรีสตาร์ท
   เซิร์ฟเวอร์) key = player.id -> tick ล่าสุดที่ใช้คำสั่งกลุ่มนี้
========================= */
const HOME_COMMAND_COOLDOWN_TICKS = TICKS_PER_SECOND * ECONOMY_CONFIG.HOME.COMMAND_COOLDOWN_SECONDS;
const lastCommandTick = new Map();

// เช็คว่าผู้เล่นยังติดคูลดาวน์คำสั่งกลุ่มบ้านอยู่ไหม — คืนวินาทีที่เหลือ
// (ปัดขึ้น) ถ้ายังติดอยู่
function checkCommandCooldown(player) {
  if (HOME_COMMAND_COOLDOWN_TICKS <= 0) return { ok: true };

  const last = lastCommandTick.get(player.id);
  if (typeof last !== "number") return { ok: true };

  const elapsed = system.currentTick - last;
  if (elapsed >= HOME_COMMAND_COOLDOWN_TICKS) return { ok: true };

  const secondsLeft = Math.ceil((HOME_COMMAND_COOLDOWN_TICKS - elapsed) / TICKS_PER_SECOND);
  return { ok: false, secondsLeft };
}

subscribeSafe(["playerLeave"], ({ playerId }) => {
  try {
    lastCommandTick.delete(playerId);
    const channel = activeHomeChannels.get(playerId);
    if (channel) {
      system.clearRun(channel.intervalId);
      activeHomeChannels.delete(playerId);
    }
  } catch (error) {
    console.warn("[HomeSystem] playerLeave handler error:", error);
  }
});

function markCommandUsed(player) {
  lastCommandTick.set(player.id, system.currentTick);
}

/* =========================
   HOME CHANNEL (นับถอยหลังก่อนวาปจริง)
   หลักการเดียวกับ TP CHANNEL ใน tpBankSystem.js — หักเงินก่อน แล้วเข้า
   สถานะนับถอยหลัง HOME_CHANNEL_SECONDS วินาที ก่อนวาปจริง ระหว่างนี้ต้อง
   ยืนนิ่ง (ขยับได้ไม่เกิน HOME_CHANNEL_MOVE_THRESHOLD บล็อก, ห้ามเปลี่ยน
   มิติ) และห้ามโดนโจมตี — ผิดเงื่อนไขไหนยกเลิกทันที คืนเงินเต็มจำนวน
   มีได้แค่ 1 channel ต่อผู้เล่นหนึ่งคนพร้อมกัน (กันหักเงินซ้อน/วาปซ้อน)
   key = player.id -> { home, name, cost, startLocation,
   startDimensionId, intervalId }
========================= */
const HOME_CHANNEL_SECONDS = ECONOMY_CONFIG.HOME.CHANNEL_SECONDS;
const HOME_CHANNEL_TOTAL_TICKS = TICKS_PER_SECOND * HOME_CHANNEL_SECONDS;
const HOME_CHANNEL_MOVE_THRESHOLD = ECONOMY_CONFIG.HOME.CHANNEL_MOVE_THRESHOLD_BLOCKS;
// ความถี่เช็คขยับตัว/ความถูกต้อง ระหว่างนับถอยหลัง (ทุก 4 tick = 0.2 วิ) —
// เดียวกับ tpBankSystem.js
const HOME_CHANNEL_CHECK_INTERVAL_TICKS = 4;

const activeHomeChannels = new Map();

// โดนโจมตี = ยกเลิก channel ทันที (เดียวกับหลักการใน tpBankSystem.js)
subscribeSafe(["entityHurt"], ({ hurtEntity }) => {
  try {
    if (!hurtEntity || !activeHomeChannels.has(hurtEntity.id)) return;
    cancelHomeChannel(hurtEntity, "home.channelCancelledDamagedActionBar");
  } catch (error) {
    console.warn("[HomeSystem] entityHurt handler error:", error);
  }
});

// ยกเลิก channel ที่กำลังนับถอยหลังอยู่ — คืนเงินค่าเดินทางเต็มจำนวนถ้ามี
// การหักไปแล้ว (channel ถูกสร้างหลังหักเงินไปแล้วเสมอ ดู teleportHome())
function cancelHomeChannel(player, reasonMessageKey) {
  const channel = activeHomeChannels.get(player.id);
  if (!channel) return;

  system.clearRun(channel.intervalId);
  activeHomeChannels.delete(player.id);

  if (isValidPlayer(player)) {
    if (channel.cost > 0) {
      setMoney(player, getMoney(player) + channel.cost);
      // คืนเงินให้ผู้เล่น -> ต้องถอนออกจากธนาคารกลางเท่ากัน ไม่งั้นเงินซ้ำ
      // (ผู้เล่นได้คืน + ธนาคารยังนับว่าได้รับไปแล้วจากตอนหักตอนเริ่ม channel)
      withdrawFromBank(channel.cost);
    }
    showError(player, t(reasonMessageKey));
    player.playSound("note.bass");
  }
}

// ใช้เช็คว่าผู้เล่นกำลังนับถอยหลังรอวาปบ้านอยู่ไหม (เช่นกันสั่ง
// /prakan:home ซ้อนระหว่างรอ)
export function hasActiveHomeChannel(player) {
  return activeHomeChannels.has(player?.id);
}

// จำนวนวินาทีที่เหลือของ channel ที่กำลังนับถอยหลังอยู่ (ปัดขึ้น) — คืน
// null ถ้าไม่มี channel ค้างอยู่ ใช้บอกผู้เล่นว่าต้องรออีกกี่วิเวลาสั่งซ้อน
// (ดู reason: "channeling" ใน teleportHome())
export function getHomeChannelSecondsLeft(player) {
  const channel = activeHomeChannels.get(player?.id);
  if (!channel) return null;

  const elapsedTicks = system.currentTick - channel.startTick;
  return Math.max(0, Math.ceil((HOME_CHANNEL_TOTAL_TICKS - elapsedTicks) / TICKS_PER_SECOND));
}

// เริ่มนับถอยหลังก่อนวาปจริง — เรียกหลังหักเงินแล้วเท่านั้น (teleportHome())
function startHomeChannel(player, home, name, cost) {
  const startLocation = { ...player.location };
  const startDimensionId = player.dimension.id;
  const startTick = system.currentTick;
  let elapsedTicks = 0;

  const channel = { home, name, cost, startLocation, startDimensionId, startTick, intervalId: undefined };
  activeHomeChannels.set(player.id, channel);

  // เรียกผ่าน system.run() เสมอ — เผื่อ startHomeChannel() ถูกเรียกจาก
  // execute() ของ custom command ตรง ๆ (เช่น /prakan:home) ซึ่งทำงานใน
  // restricted execution mode: native function อย่าง setActionBar() เรียก
  // ตรง ๆ ไม่ได้ในโหมดนี้ ต้องเลื่อนไป tick ถัดไปก่อนเสมอ (ถ้าเรียกจาก
  // ปุ่มเมนู/UI callback ที่ไม่ถูกจำกัดอยู่แล้ว การเลื่อนแบบนี้ไม่กระทบ
  // พฤติกรรมเดิม — ยังคงแสดงข้อความในติ๊กถัดไปเหมือนเดิม)
  system.run(() => {
    showActionBar(player, t("home.channelTickActionBar", { seconds: HOME_CHANNEL_SECONDS }), "home");
  });

  channel.intervalId = system.runInterval(() => {
    elapsedTicks += HOME_CHANNEL_CHECK_INTERVAL_TICKS;

    // ผู้เล่นออกจากเกมกลางคัน — คืนเงินไม่ได้ (หา entity ไม่เจอแล้ว) แค่
    // เคลียร์สถานะกันค้าง
    if (!isValidPlayer(player)) {
      system.clearRun(channel.intervalId);
      activeHomeChannels.delete(player.id);
      return;
    }

    // ขยับตัวเกิน threshold หรือเปลี่ยนมิติ = ยกเลิก
    const moved = player.dimension.id !== startDimensionId ||
      distanceBetween(player.location, startLocation) > HOME_CHANNEL_MOVE_THRESHOLD;
    if (moved) {
      cancelHomeChannel(player, "home.channelCancelledMovedActionBar");
      return;
    }

    // อัปเดตข้อความนับถอยหลังทุก ๆ 1 วินาทีเต็ม
    if (elapsedTicks % TICKS_PER_SECOND === 0) {
      const secondsLeft = HOME_CHANNEL_SECONDS - elapsedTicks / TICKS_PER_SECOND;
      if (secondsLeft > 0) {
        showActionBar(player, t("home.channelTickActionBar", { seconds: secondsLeft }), "home");
      }
    }

    if (elapsedTicks >= HOME_CHANNEL_TOTAL_TICKS) {
      system.clearRun(channel.intervalId);
      activeHomeChannels.delete(player.id);
      finishHomeTeleport(player, home, name, cost);
    }
  }, HOME_CHANNEL_CHECK_INTERVAL_TICKS);
}

// วาปจริง — เรียกตอนนับถอยหลังครบ HOME_CHANNEL_SECONDS เท่านั้น
function finishHomeTeleport(player, home, name, cost) {
  if (!isValidPlayer(player)) return;

  const dimension = world.getDimension(home.dimensionId);
  player.teleport({ x: home.x, y: home.y, z: home.z }, { dimension });

  player.playSound("random.orb");
  showActionBar(player, t("home.teleportSuccessActionBar", { name, cost: cost.toLocaleString() }), "home");

  // Phase 3B: แจ้งระบบเควส (home_teleport) — เรียกตรงนี้เท่านั้น (หลัง
  // player.teleport() สำเร็จจริง) ไม่ใช่ใน teleportHome() ด้านล่างที่แค่
  // เริ่ม Channel นับถอยหลัง เพราะ Channel อาจถูกยกเลิกกลางคันได้
  // (ขยับตัว/เปลี่ยนมิติ/หลุดออกจากเกม — ดู cancelHomeChannel()) ซึ่งจะไม่มี
  // การวาปเกิดขึ้นจริง ถ้านับที่ teleportHome() จะนับ Teleport ที่ยกเลิกไป
  // แล้วด้วย ผิดสเปค "Do not count failed teleports"
  reportHomeTeleport(player);
}

/* =========================
   STORAGE
========================= */
function getHomes(player) {
  const raw = player.getDynamicProperty(HOME_DYNAMIC_PROPERTY_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveHomes(player, homes) {
  player.setDynamicProperty(HOME_DYNAMIC_PROPERTY_KEY, JSON.stringify(homes));
}

// ตัดช่องว่างหน้า-หลัง จำกัดความยาว และคืนชื่อ default ("home") ถ้าผู้เล่น
// ไม่ได้ระบุชื่อมา (พารามิเตอร์ homeName เป็น optional ในทุกคำสั่ง)
export function normalizeHomeName(rawName) {
  const trimmed = typeof rawName === "string" ? rawName.trim() : "";
  if (!trimmed) return DEFAULT_HOME_NAME;
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

/* =========================
   QUERY
========================= */
// รายชื่อบ้านทั้งหมดของผู้เล่น (เรียงตามลำดับที่ตั้งไว้)
export function listHomeNames(player) {
  return Object.keys(getHomes(player));
}

export function getHomeCount(player) {
  return Object.keys(getHomes(player)).length;
}

/* =========================
   SET HOME
========================= */
/**
 * ตั้งบ้านที่ตำแหน่งปัจจุบันของผู้เล่น
 * @returns {{ ok: true, name: string, isNew: boolean } |
 *           { ok: false, name: string, reason: "limit" | "funds" } |
 *           { ok: false, name: string, reason: "cooldown", secondsLeft: number }}
 */
export function setHome(player, rawName) {
  const name = normalizeHomeName(rawName);

  const cooldown = checkCommandCooldown(player);
  if (!cooldown.ok) return { ok: false, name, reason: "cooldown", secondsLeft: cooldown.secondsLeft };

  const homes = getHomes(player);
  const isNew = !(name in homes);

  // จำกัดจำนวนบ้านเฉพาะตอนจะ "เพิ่ม" บ้านใหม่ — ย้ายบ้านชื่อเดิมที่มีอยู่
  // แล้วไม่นับ ไม่ติดลิมิตนี้
  if (isNew && Object.keys(homes).length >= ECONOMY_CONFIG.HOME.MAX_HOMES) {
    return { ok: false, name, reason: "limit" };
  }

  // คิดเงินเฉพาะตอนเพิ่มบ้านใหม่เช่นกัน (ย้ายบ้านเดิมฟรีเสมอ ไม่ว่า
  // SET_HOME_COST จะตั้งไว้เท่าไหร่ก็ตาม)
  const cost = ECONOMY_CONFIG.HOME.SET_HOME_COST;
  if (isNew && cost > 0) {
    if (!removeMoney(player, cost)) {
      return { ok: false, name, reason: "funds" };
    }
    // ค่าตั้งบ้านใหม่ เข้าธนาคารกลางเหมือนภาษีค่าโอน/ตลาด
    depositToBank(cost);
  }

  homes[name] = {
    x: player.location.x,
    y: player.location.y,
    z: player.location.z,
    dimensionId: player.dimension.id,
  };
  saveHomes(player, homes);
  markCommandUsed(player);

  return { ok: true, name, isNew };
}

/* =========================
   DELETE HOME
========================= */
/**
 * @returns {{ ok: true, name: string } |
 *           { ok: false, name: string, reason: "notFound" } |
 *           { ok: false, name: string, reason: "cooldown", secondsLeft: number }}
 */
export function deleteHome(player, rawName) {
  const name = normalizeHomeName(rawName);

  const cooldown = checkCommandCooldown(player);
  if (!cooldown.ok) return { ok: false, name, reason: "cooldown", secondsLeft: cooldown.secondsLeft };

  const homes = getHomes(player);

  if (!(name in homes)) return { ok: false, name, reason: "notFound" };

  delete homes[name];
  saveHomes(player, homes);
  markCommandUsed(player);
  return { ok: true, name };
}

/* =========================
   TELEPORT HOME
========================= */
/**
 * วาปผู้เล่นไปยังบ้านที่ระบุ (ข้ามมิติได้ด้วย) — คิดเงินตามระยะทางแบบ
 * เดียวกับระบบ TP ขอ-ยอมรับ (ดูหมายเหตุหัวไฟล์): เดียวกันมิติคิดตามระยะทาง
 * จริง (ECONOMY_CONFIG.HOME.COST_PER_BLOCK ต่อบล็อก) ข้ามมิติคิดราคาคงที่
 * (ECONOMY_CONFIG.HOME.CROSS_DIMENSION_COST) ไม่คิดตามระยะทาง — เหตุผล
 * เดียวกับ bugfix ใน tpBankSystem.js: พิกัดของสองมิติไม่มีความสัมพันธ์กัน
 * จริง (เช่น Overworld/Nether อัตราส่วน 8:1) จึงไม่คำนวณระยะทางจากพิกัด
 * ข้ามมิติเลย
 *
 * ต่างจาก /prakan:tpa ตรงที่ไม่ต้องขอ-ยอมรับกับผู้เล่นอื่น (เป็นจุดวาปของ
 * ตัวเองอยู่แล้ว) แต่ยังคงมีเวลานับถอยหลัง/ยืนนิ่งก่อนวาปเหมือนกัน (ดู
 * "HOME CHANNEL" ด้านบน) — หักเงินทันทีในติ๊กเดียวกัน แล้วเข้าสถานะนับ
 * ถอยหลัง HOME_CHANNEL_SECONDS วินาทีก่อนจะวาปจริง (ดู startHomeChannel())
 *
 * @returns {{ ok: true, name: string, cost: number, distance: number|null, channeling: true } |
 *           { ok: false, name: string, reason: "notFound" } |
 *           { ok: false, name: string, reason: "channeling", secondsLeft: number } |
 *           { ok: false, name: string, reason: "cooldown", secondsLeft: number } |
 *           { ok: false, name: string, reason: "funds", cost: number, distance: number|null }}
 */
export function teleportHome(player, rawName) {
  const name = normalizeHomeName(rawName);
  const homes = getHomes(player);
  const home = homes[name];

  if (!home || !isValidPlayer(player)) return { ok: false, name, reason: "notFound" };

  // กำลังนับถอยหลังรอวาปบ้านจากคำสั่งก่อนหน้าอยู่แล้ว — ห้ามสั่งซ้อน (กัน
  // หักเงินซ้อน/สถานะ channel ชนกัน) เหมือนหลักการใน tpBankSystem.js
  if (activeHomeChannels.has(player.id)) {
    return { ok: false, name, reason: "channeling", secondsLeft: getHomeChannelSecondsLeft(player) };
  }

  const cooldown = checkCommandCooldown(player);
  if (!cooldown.ok) return { ok: false, name, reason: "cooldown", secondsLeft: cooldown.secondsLeft };

  // สูตรราคาเดียวกับ previewHomeTeleportCost() เป๊ะ ๆ (ดูฟังก์ชันนั้น
  // ด้านล่างสำหรับหน้ายืนยัน) — คำนวณตรงนี้แยกอีกรอบแทนที่จะเรียกมันตรง ๆ
  // เพราะ getHomes(player) ถูกอ่านไปแล้วด้านบน ไม่อยากอ่าน dynamic property
  // ซ้ำสองครั้งในคำสั่งเดียว
  const crossDim = player.dimension.id !== home.dimensionId;
  const distance = crossDim ? null : Math.floor(distanceBetween(player.location, home));
  const cost = crossDim
    ? ECONOMY_CONFIG.HOME.CROSS_DIMENSION_COST
    : distance * ECONOMY_CONFIG.HOME.COST_PER_BLOCK;

  if (cost > 0 && getMoney(player) < cost) {
    return { ok: false, name, reason: "funds", cost, distance };
  }

  if (cost > 0) {
    removeMoney(player, cost);
    // ค่าเดินทางกลับบ้าน เข้าธนาคารกลาง — ถ้ายกเลิก channel ระหว่างทาง
    // cancelHomeChannel() จะ withdrawFromBank() คืนให้เท่ากันเสมอ
    depositToBank(cost);
  }
  markCommandUsed(player);

  startHomeChannel(player, home, name, cost);

  return { ok: true, name, cost, distance, channeling: true };
}

/* =========================
   TELEPORT HOME — COST PREVIEW
   คำนวณค่าเดินทาง/ระยะทางล่วงหน้า "โดยไม่หักเงินจริง" ใช้แสดงสรุปในหน้า
   ยืนยันก่อนกดวาป (ดู openHomeDetailUI() ด้านล่าง) — สูตรเดียวกับที่
   teleportHome() ใช้จริงทุกประการ แยกออกมาเป็นฟังก์ชันของตัวเองเพื่อไม่ให้
   ต้องหักเงินก่อนถึงจะรู้ราคา (ต่างจาก tpBankSystem.js ที่คำนวณราคาตรงจุด
   เปิดฟอร์มยืนยันอยู่แล้วเพราะไม่มี state คั่นกลางแบบ setHome/teleportHome)
   @returns {{ ok: true, name: string, crossDim: boolean, distance: number|null, cost: number } |
   *          { ok: false, name: string, reason: "notFound" }}
========================= */
export function previewHomeTeleportCost(player, rawName) {
  const name = normalizeHomeName(rawName);
  const homes = getHomes(player);
  const home = homes[name];

  if (!home || !isValidPlayer(player)) return { ok: false, name, reason: "notFound" };

  const crossDim = player.dimension.id !== home.dimensionId;
  const distance = crossDim ? null : Math.floor(distanceBetween(player.location, home));
  const cost = crossDim
    ? ECONOMY_CONFIG.HOME.CROSS_DIMENSION_COST
    : distance * ECONOMY_CONFIG.HOME.COST_PER_BLOCK;

  return { ok: true, name, crossDim, distance, cost };
}

/* =========================
   UI (เมนู "บ้าน" ในเมนูหลัก — ดู mainUi.js กรณี item.id === "home")
   ตรรกะ/การหักเงิน/คูลดาวน์ทั้งหมดยังอยู่ที่ setHome()/teleportHome()/
   deleteHome() ด้านบนเหมือนเดิมทุกประการ — เมนูพวกนี้มีหน้าที่แค่แปลผล
   ลัพธ์เป็นหน้าจอ/ข้อความให้ผู้เล่นเห็น (เหมือน homeCommands.js ฝั่งคำสั่ง
   แชท) ตามสถาปัตยกรรมเดียวกับ openTpUI() ใน tpBankSystem.js
========================= */

// หน้าหลัก — รายชื่อบ้านทั้งหมด + ปุ่มตั้งบ้านใหม่
export async function openHomeUI(player) {
  if (!player?.isValid) return;

  const names = listHomeNames(player);
  const count = names.length;
  const max = ECONOMY_CONFIG.HOME.MAX_HOMES;

  const items = [
    ...names.map((name) => ({
      id: `home:${name}`,
      labelKey: "home.uiHomeButton",
      labelVars: { name },
      icon: "textures/items/bed_red"
    })),
    {
      id: "__setHome__",
      labelKey: "home.uiSetHomeButton",
      icon: "textures/ui/color_plus"
    }
  ];

  return createListMenu(player, {
    titleKey: "home.uiTitle",
    bodyKey: "home.uiBody",
    bodyVars: { count, max },
    menuGroup: "homeMenu",
    items,
    onSelect: (item) => {
      if (item.id === "__setHome__") {
        NavigationManager.push(player, () => openHomeUI(player));
        return openSetHomeUI(player);
      }

      const name = String(item.id).slice("home:".length);
      NavigationManager.push(player, () => openHomeUI(player));
      return openHomeDetailUI(player, name);
    }
  });
}

// หน้าตั้งบ้านใหม่ — ถามชื่อผ่าน text prompt (เว้นว่างได้ = ใช้ชื่อ default
// "home" เหมือน /prakan:sethome ไม่ใส่พารามิเตอร์)
function openSetHomeUI(player) {
  return createAmountPrompt(player, {
    titleKey: "home.uiSetHomeTitle",
    promptKey: "home.uiSetHomePrompt",
    placeholder: DEFAULT_HOME_NAME,
    onSubmit: (value) => {
      const result = setHome(player, value);

      if (!result.ok) {
        if (result.reason === "cooldown") {
          showError(player, t("home.commandCooldown", { seconds: result.secondsLeft }));
        } else if (result.reason === "limit") {
          showError(player, t("home.setLimitReached", { max: ECONOMY_CONFIG.HOME.MAX_HOMES }));
        } else if (result.reason === "funds") {
          showError(player, t("home.setInsufficientFunds", {
            cost: ECONOMY_CONFIG.HOME.SET_HOME_COST.toLocaleString(),
          }));
        }
        return NavigationManager.back(player);
      }

      showSuccess(player, t(result.isNew ? "home.setSuccessNew" : "home.setSuccessOverwrite", { name: result.name }));
      player.playSound("random.orb");
      return NavigationManager.back(player);
    },
    onCancel: () => NavigationManager.back(player)
  });
}

// หน้ารายละเอียดบ้านที่เลือก — "วาปไปบ้านนี้" หรือ "ลบบ้านนี้"
function openHomeDetailUI(player, name) {
  return createListMenu(player, {
    titleKey: "home.uiDetailTitle",
    titleVars: { name },
    bodyKey: "home.uiDetailBody",
    menuGroup: "homeDetailMenu",
    items: [
      { id: "__go__", labelKey: "home.uiGoButton", icon: "textures/items/ender_pearl" },
      { id: "__delete__", labelKey: "home.uiDeleteButton", icon: "textures/ui/cancel" }
    ],
    onSelect: (item) => {
      if (item.id === "__go__") {
        const preview = previewHomeTeleportCost(player, name);

        if (!preview.ok) {
          showError(player, t("home.notFound", { name: preview.name }));
          return NavigationManager.close(player);
        }

        return showConfirm({
          player,
          titleKey: "home.teleportConfirmTitle",
          bodyKey: "home.teleportConfirmBody",
          bodyVars: {
            name: preview.name,
            // เหมือน openTpConfirmUI() ใน tpBankSystem.js — แสดงบรรทัดระยะทาง
            // เฉพาะเดียวกันมิติ (ระยะทางข้ามมิติไม่มีความหมาย)
            distanceLine: preview.crossDim ? "" : t("home.teleportDistanceLine", {
              distance: preview.distance.toLocaleString(),
              cost: preview.cost.toLocaleString()
            }),
            crossDimLine: preview.crossDim ? t("home.teleportCrossDimLine", {
              cost: preview.cost.toLocaleString()
            }) : "",
            total: preview.cost.toLocaleString()
          },
          confirmKey: "home.teleportConfirmGo",
          cancelKey: "home.teleportConfirmCancel",
          onCancel: () => NavigationManager.back(player),
          onConfirm: () => {
            const result = teleportHome(player, name);

            if (!result.ok) {
              if (result.reason === "funds") {
                showError(player, t("home.teleportInsufficientFunds", { cost: result.cost.toLocaleString() }));
              } else if (result.reason === "channeling") {
                showActionBar(player, t("home.alreadyChannelingActionBar", { seconds: result.secondsLeft }), "home");
              } else if (result.reason === "cooldown") {
                showError(player, t("home.commandCooldown", { seconds: result.secondsLeft }));
              } else {
                showError(player, t("home.notFound", { name: result.name }));
              }
              return NavigationManager.close(player);
            }

            // เริ่มนับถอยหลังแล้ว — ปิดเมนูทันที (ข้อความนับถอยหลัง/สำเร็จ/
            // ถูกยกเลิก แจ้งต่อจากนี้ผ่าน action bar โดย homeSystem.js เอง)
            return NavigationManager.close(player);
          }
        });
      }

      if (item.id === "__delete__") {
        return showConfirm({
          player,
          titleKey: "home.deleteConfirmTitle",
          bodyKey: "home.deleteConfirmBody",
          bodyVars: { name },
          onCancel: () => NavigationManager.back(player),
          onConfirm: () => {
            const result = deleteHome(player, name);

            if (!result.ok) {
              if (result.reason === "cooldown") {
                showError(player, t("home.commandCooldown", { seconds: result.secondsLeft }));
              } else {
                showError(player, t("home.notFound", { name: result.name }));
              }
              return NavigationManager.close(player);
            }

            showSuccess(player, t("home.deleteSuccess", { name: result.name }));
            player.playSound("random.orb");
            return NavigationManager.close(player);
          }
        });
      }
    }
  });
}
