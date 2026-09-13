// =========================
// tpBankSystem.js
// ระบบ Teleport แบบขอ-ยอมรับ ระหว่างผู้เล่น มีระยะเวลาหมดอายุคำขอ และ
// คิดค่าใช้จ่ายตามระยะทาง + ค่าธรรมเนียมข้ามมิติ
//
// === MIGRATED to scripts/ui/ framework ===
// ไฟล์นี้ไม่สร้าง ActionFormData / ModalFormData ตรง ๆ อีกต่อไป
// ทุกหน้าจอผ่าน UIFramework.js, การนำทางผ่าน NavigationManager.js,
// ทุกสตริงผ่าน t() — ตรรกะการคิดราคา/หักเงิน/หมดเวลาคำขอ ไม่ถูกแก้ไข
// จากเดิม ยกเว้นบัคเดียวที่แก้ไว้ด้านล่าง (bugfix: cross-dimension
// distanceCost ใน openTpConfirmUI)
//
// BUGFIX: เดิม distanceCost คำนวณจาก Euclidean distance ของพิกัดสองผู้เล่น
// เสมอ แม้ข้ามมิติกัน (เช่น Overworld/Nether) ซึ่งพิกัดของสองมิติไม่มี
// ความสัมพันธ์กันจริง ทำให้ราคาผิดเพี้ยน (ถูกเกินไปถ้าพิกัดใกล้กันโดยบังเอิญ
// หรือแพงเกินไปถ้าพิกัดห่างกันมาก) ตอนนี้ข้ามมิติจะไม่คำนวณ distanceCost
// จากพิกัดเลย คิดแค่ CROSS_DIMENSION_COST (ราคาคงที่) เท่านั้น —
// เดียวกันมิติยังคงคิดตามระยะทางจริงเหมือนเดิมทุกประการ
//
// พฤติกรรมที่เปลี่ยนจากของเดิม (ตามกฎ design system ใหม่ — ไม่กระทบ
// ตัวเลขเงิน/ระยะทาง/เวลาหมดอายุใด ๆ):
// - เดิมหน้าเลือกผู้เล่น + หน้ายืนยัน ไม่มีปุ่ม "กลับ" เลย ปิดฟอร์ม (X) =
//   จบการทำงานทันที ตอนนี้มีปุ่ม "กลับ" มาตรฐานของ framework (เหมือนที่
//   ทำใน economy.js / shopSystem.js) — กด "ยกเลิก" ในหน้ายืนยันตอนนี้
//   ย้อนกลับไปหน้าเลือกผู้เล่นแทนที่จะปิดเมนูเงียบ ๆ
// - หน้า "รับคำขอ TP" (openReceiveUI) ยังคงเป็นฟอร์มที่ผุดขึ้นมาเองฝั่ง
//   target ไม่ผูกกับสแตกเมนูของ target เลย (เหมือนเดิมทุกประการ) เพราะ
//   ไม่ใช่สิ่งที่ target นำทางเข้ามาเอง — ไม่เรียก NavigationManager
//   ใด ๆ ในฟังก์ชันนี้
//
// FEATURE: TP CHANNEL (นับถอยหลังก่อนวาป)
// เดิม acceptTp() หักเงินแล้ววาปทันทีในติ๊กเดียวกัน ตอนนี้หลังหักเงิน
// จะเข้าสถานะ "นับถอยหลัง" TP_CHANNEL_SECONDS วินาที (ค่าเริ่มต้น 12 —
// แก้ที่ ECONOMY_CONFIG.TELEPORT.CHANNEL_SECONDS) ก่อนจะวาปจริง ระหว่างนี้
// ผู้ส่งต้อง "ยืนนิ่ง" (ขยับได้ไม่เกิน CHANNEL_MOVE_THRESHOLD_BLOCKS บล็อก,
// ห้ามเปลี่ยนมิติ) และห้ามโดนโจมตี — ถ้าเงื่อนไขไม่ผ่าน ยกเลิกทันทีและ
// คืนเงินเต็มจำนวน มีได้แค่ 1 channel ต่อผู้เล่นหนึ่งคนพร้อมกัน (กันหักเงิน
// ซ้อน) ดู activeChannels / startTpChannel() / cancelChannel() /
// finishTeleport() ด้านล่าง — เป็นสถานะแยกจาก tpRequests (คำขอที่ยังไม่ถูก
// ตอบรับ) โดยสิ้นเชิง
//
// hasPendingTpRequest() / acceptTp() ถูก export ให้ registerCommands.js
// เรียกจาก /prakan:tpaccept ได้ — ยอมรับคำขอทางแชทได้แม้พลาดฟอร์มที่เด้ง
// มาตอนคำขอมาถึงไปแล้ว (openReceiveUI เด้งฟอร์มได้แค่ครั้งเดียว) ตรรกะ
// เดียวกันทุกประการ ไม่มีการเขียนซ้ำ
//
// FEATURE: ปฏิเสธคำขอ TP อัตโนมัติตอนเป้าหมายกำลังต่อสู้อยู่
// เช็คใน openTpConfirmUI (จุดเดียวกับที่เช็ค tpDisabled) — ถ้าเป้าหมาย
// โดนโจมตี/กำลังโจมตีใครไปไม่เกิน COMBAT_BLOCK_DURATION_SECONDS วินาที
// ที่แล้ว (ค่าเริ่มต้น 10 วิ) คำขอจะถูกปฏิเสธทันทีตั้งแต่ก่อนฟอร์มยืนยัน
// เปิดขึ้นด้วยซ้ำ — ไม่มี tpRequests/openReceiveUI ใด ๆ ถูกสร้างขึ้นมา
// กวนใจ ผู้เล่นปิดฟีเจอร์นี้เองได้ผ่านปุ่มในเมนู TP (ดู
// isCombatBlockEnabled() / toggleCombatBlock() / combatUntilTick ด้านล่าง)
// =========================

import { world, system } from "@minecraft/server";
import { createListMenu } from "../ui/framework/UIFramework";
import { showConfirm } from "../core/confirmDialog";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { t } from "../ui/locale/index";
import { getMoney, setMoney, depositToBank, withdrawFromBank } from "../core/economyUtils";
import { showError, showInfo, showActionBar } from "../core/messageUtils";
import { isValidPlayer, isSameDimension, distanceBetween } from "../core/playerUtils";
import { TICKS_PER_SECOND } from "../core/constants";
import { ECONOMY_CONFIG } from "../config/economyConfig";
import { safeAsync } from "../core/asyncUtils";
import { subscribeSafe } from "../core/eventGuard";

/* =========================
   CONFIG
   ค่าราคาต่อบล็อก/ค่าข้ามมิติ/เวลาหมดอายุคำขอ/เวลานับถอยหลังก่อนวาป
   ย้ายไปอยู่ config/economyConfig.js (ECONOMY_CONFIG.TELEPORT) แล้ว —
   แก้ค่าที่นั่นจุดเดียว ไม่ต้องแก้ไฟล์นี้
========================= */
const COST_PER_BLOCK = ECONOMY_CONFIG.TELEPORT.COST_PER_BLOCK;
const CROSS_DIMENSION_COST = ECONOMY_CONFIG.TELEPORT.CROSS_DIMENSION_COST;
const TP_REQUEST_TIMEOUT = TICKS_PER_SECOND * ECONOMY_CONFIG.TELEPORT.REQUEST_TIMEOUT_SECONDS; // 30 วินาที

// เวลานับถอยหลัง "ยืนนิ่งก่อนวาป" หลังผู้รับกดยอมรับ (ดูหมายเหตุระบบ
// channel ด้านล่าง) — ค่าเริ่มต้น 12 วินาทีตาม CHANNEL_SECONDS
const TP_CHANNEL_SECONDS = ECONOMY_CONFIG.TELEPORT.CHANNEL_SECONDS;
const TP_CHANNEL_TOTAL_TICKS = TICKS_PER_SECOND * TP_CHANNEL_SECONDS;
const TP_CHANNEL_MOVE_THRESHOLD = ECONOMY_CONFIG.TELEPORT.CHANNEL_MOVE_THRESHOLD_BLOCKS;
// ความถี่เช็คขยับตัว/ความถูกต้อง ระหว่างนับถอยหลัง (ทุก 4 tick = 0.2 วิ) —
// ถี่กว่า 1 วินาทีที่ใช้อัปเดตข้อความ actionbar เพื่อให้ตรวจจับการขยับตัว
// ได้ไวขึ้น ไม่ต้องรอครบวินาทีถึงจะรู้ว่าโดนยกเลิก
const TP_CHANNEL_CHECK_INTERVAL_TICKS = 4;

// ระยะเวลาที่ผู้เล่นถือว่า "กำลังต่อสู้อยู่" หลังโดนโจมตี/โจมตีใครไปล่าสุด
// (นับใหม่ทุกครั้งที่มีการต่อสู้เกิดขึ้นอีก — ดู entityHurt subscription
// ด้านล่าง) ระหว่างนี้จะถูกปฏิเสธคำขอ TP อัตโนมัติถ้าไม่ได้ปิดฟีเจอร์นี้ไว้
const TP_COMBAT_BLOCK_DURATION_TICKS = TICKS_PER_SECOND * ECONOMY_CONFIG.TELEPORT.COMBAT_BLOCK_DURATION_SECONDS;

/* =========================
   TP REQUEST STORE
========================= */
const tpRequests = new Map();

/* =========================
   TP CHANNEL STORE (นับถอยหลังก่อนวาปจริง)
   key = sender.id -> { targetId, targetName, cost, startLocation,
   startDimensionId, intervalId } — มีได้แค่ 1 channel ต่อผู้ส่งหนึ่งคน
   ในเวลาเดียวกัน (กันหักเงินซ้อน/วาปซ้อน)
========================= */
const activeChannels = new Map();

/* =========================
   COMBAT TRACKING (ปิดรับคำขอ TP อัตโนมัติชั่วคราวตอนกำลังต่อสู้)
   key = player.id -> tick ที่ถือว่า "ยังต่อสู้อยู่" จนถึงตอนนั้น (นับใหม่
   ทุกครั้งที่ต่อสู้อีก) ไม่ผูกกับ dynamic property เพราะเป็นสถานะชั่วคราว
   ล้วน ๆ ไม่ต้องอยู่ข้ามการรีสตาร์ทเซิร์ฟเวอร์
========================= */
const combatUntilTick = new Map();

subscribeSafe(["playerLeave"], ({ playerId }) => {
  try {
    tpRequests.delete(playerId);
    const channel = activeChannels.get(playerId);
    if (channel) {
      system.clearRun(channel.intervalId);
      activeChannels.delete(playerId);
    }
    combatUntilTick.delete(playerId);
    for (const [targetId, req] of tpRequests) {
      if (req.senderId === playerId) tpRequests.delete(targetId);
    }
  } catch (error) {
    console.warn("[TpBankSystem] playerLeave handler error:", error);
  }
});

function markInCombat(entityId) {
  combatUntilTick.set(entityId, system.currentTick + TP_COMBAT_BLOCK_DURATION_TICKS);
}

function isInCombat(entityId) {
  const until = combatUntilTick.get(entityId);
  return typeof until === "number" && system.currentTick < until;
}

// เปิด/ปิดฟีเจอร์นี้ต่อผู้เล่น — เก็บเป็น "ปิด" (Disabled) ไม่ใช่ "เปิด"
// เพื่อให้ undefined (ยังไม่เคยตั้งค่า) แปลว่า "เปิดใช้งานป้องกัน" เป็นค่า
// default เหมือนกับรูปแบบของ tpDisabled ด้านล่าง
function isCombatBlockEnabled(player) {
  return Database.get(player, "tpCombatBlockDisabled") !== true;
}

function toggleCombatBlock(player) {
  const disabled = Database.get(player, "tpCombatBlockDisabled") === true;
  Database.set(player, "tpCombatBlockDisabled", !disabled);

  const msg = !disabled ? t("tp.combatBlockDisabledMessage") : t("tp.commitBlockEnabledMessage");
  showActionBar(player, msg, "tpBank");
  player.playSound("random.orb");
}

// ทุกครั้งที่มีการต่อสู้เกิดขึ้นในโลก (ใครโดนตี หรือใครตีใคร) — ทำเครื่องหมาย
// "กำลังต่อสู้อยู่" ให้ทั้งฝ่ายที่โดนตีและฝ่ายที่ตี (ถ้าเป็นผู้เล่นทั้งคู่) —
// ครอบคลุมทั้ง "ถูกโจมตี" (โดน mob/ผู้เล่นอื่นตี) และ "กำลังต่อสู้อยู่"
// (กำลังไล่ตีมอนสเตอร์/ผู้เล่นอื่นอยู่) ตามที่ฟีเจอร์นี้ตั้งใจจะครอบคลุม —
// เช็คเฉพาะ entity ที่เป็นผู้เล่นเท่านั้น กัน Map บวมจาก id ของมอนสเตอร์ที่
// ไม่มีวันถูกใช้งาน (ไม่มีใครเช็ค isInCombat() ของมอนสเตอร์)
subscribeSafe(["entityHurt"], ({ hurtEntity, damageSource }) => {
  try {
    if (hurtEntity?.typeId === "minecraft:player") markInCombat(hurtEntity.id);

    const attacker = damageSource?.damagingEntity;
    if (attacker?.typeId === "minecraft:player") markInCombat(attacker.id);
  } catch (error) {
    console.warn("[TpBankSystem] entityHurt (combat mark) handler error:", error);
  }
});

// ยกเลิก channel ที่กำลังนับถอยหลังอยู่ — คืนเงินเต็มจำนวนให้ผู้ส่งเสมอ
// (channel ถูกสร้างหลังหักเงินไปแล้วตอนกดยอมรับ ดู acceptTp())
export const cancelChannel = safeAsync(async (sender, reasonMessageKey, notifyTargetKey) => {
  const channel = activeChannels.get(sender.id);
  if (!channel) return;

  system.clearRun(channel.intervalId);
  activeChannels.delete(sender.id);

  if (isValidPlayer(sender)) {
    setMoney(sender, getMoney(sender) + channel.cost);
    // คืนเงินให้ผู้ส่ง -> ถอนจากธนาคารกลางเท่ากัน (ดู depositToBank ตอน
    // หักเงินใน acceptTp() ที่ทำให้เกิด channel นี้)
    withdrawFromBank(channel.cost);
    showError(sender, t(reasonMessageKey));
    sender.playSound("note.bass");
  }

  if (notifyTargetKey) {
    const target = findOnlinePlayerById(channel.targetId);
    if (target?.isValid) showInfo(target, t(notifyTargetKey, { sender: sender.name ?? "?" }));
  }
}

// โดนโจมตี = ยกเลิก channel ทันที (ลงทะเบียนครั้งเดียวตอนโหลดโมดูล ไม่ผูก
// กับ channel ใดโดยเฉพาะ — เช็คจาก activeChannels ว่าผู้ที่โดนตีกำลัง
// channel อยู่ไหมทุกครั้งที่มีเหตุการณ์โดนตีเกิดขึ้นในโลก)
subscribeSafe(["entityHurt"], ({ hurtEntity }) => {
  try {
    if (!hurtEntity || !activeChannels.has(hurtEntity.id)) return;
    cancelChannel(hurtEntity, "tp.channelCancelledDamagedActionBar", "tp.channelCancelledNotifyTarget");
  } catch (error) {
    console.warn("[TpBankSystem] entityHurt (channel cancel) handler error:", error);
  }
});

// เริ่มนับถอยหลังก่อนวาปจริง — เรียกหลังหักเงินแล้วเท่านั้น (acceptTp())
// ผู้ส่งต้องยืนนิ่งในมิติเดิม ไม่โดนตี จนครบ TP_CHANNEL_SECONDS ถึงจะวาป
function startTpChannel(sender, target, cost) {
  const startLocation = { ...sender.location };
  const startDimensionId = sender.dimension.id;
  let elapsedTicks = 0;

  const channel = {
    targetId: target.id,
    targetName: target.name,
    cost,
    startLocation,
    startDimensionId,
    intervalId: undefined
  };
  activeChannels.set(sender.id, channel);

  // เรียกผ่าน system.run() เสมอ — ป้องกันไว้ก่อนเผื่อในอนาคตมีจุดเรียก
  // startTpChannel() (ผ่าน acceptTp()) ตรง ๆ จาก execute() ของ custom
  // command โดยไม่ได้ห่อ system.run() ไว้ก่อน (ตอนนี้ /prakan:tpaccept ห่อ
  // ไว้ถูกต้องอยู่แล้ว แต่ native function อย่าง setActionBar() เรียกตรง ๆ
  // ใน restricted execution mode ไม่ได้ — ดูปัญหาเดียวกันที่เจอใน
  // homeSystem.js startHomeChannel())
  system.run(() => {
    showActionBar(sender, t("tp.channelTickActionBar", { seconds: TP_CHANNEL_SECONDS }), "tpBank");
    showInfo(target, t("tp.channelStartMessageTarget", { sender: sender.name, seconds: TP_CHANNEL_SECONDS }));
  });

  channel.intervalId = system.runInterval(() => {
    elapsedTicks += TP_CHANNEL_CHECK_INTERVAL_TICKS;

    // ผู้ส่งออกจากเกมกลางคัน — คืนเงินไม่ได้ (หา entity ไม่เจอแล้ว) แค่
    // เคลียร์สถานะกันค้าง
    if (!isValidPlayer(sender)) {
      system.clearRun(channel.intervalId);
      activeChannels.delete(sender.id);
      return;
    }

    // เป้าหมายออกจากเกมกลางคัน — ยกเลิก + คืนเงินให้ผู้ส่ง
    if (!world.getPlayers().some(p => p.id === target.id)) {
      cancelChannel(sender, "tp.channelCancelledTargetGoneActionBar", null);
      return;
    }

    // ขยับตัวเกิน threshold หรือเปลี่ยนมิติ = ยกเลิก
    const moved = sender.dimension.id !== startDimensionId ||
      distanceBetween(sender.location, startLocation) > TP_CHANNEL_MOVE_THRESHOLD;
    if (moved) {
      cancelChannel(sender, "tp.channelCancelledMovedActionBar", "tp.channelCancelledNotifyTarget");
      return;
    }

    // อัปเดตข้อความนับถอยหลังทุก ๆ 1 วินาทีเต็ม
    if (elapsedTicks % TICKS_PER_SECOND === 0) {
      const secondsLeft = TP_CHANNEL_SECONDS - elapsedTicks / TICKS_PER_SECOND;
      if (secondsLeft > 0) {
        showActionBar(sender, t("tp.channelTickActionBar", { seconds: secondsLeft }), "tpBank");
      }
    }

    if (elapsedTicks >= TP_CHANNEL_TOTAL_TICKS) {
      system.clearRun(channel.intervalId);
      activeChannels.delete(sender.id);
      finishTeleport(sender, target, cost);
    }
  }, TP_CHANNEL_CHECK_INTERVAL_TICKS);
}

// วาปจริง — เรียกตอนนับถอยหลังครบ TP_CHANNEL_SECONDS เท่านั้น (ตรรกะ/
// ข้อความเดียวกับที่ acceptTp() เคยทำตรง ๆ ก่อนมีระบบ channel)
function finishTeleport(sender, target, cost) {
  if (!isValidPlayer(sender)) return;

  // เป้าหมายหายไปพอดีในช่วงวินาทีสุดท้าย (ผ่านเช็คระหว่างทางมาแล้วแต่
  // หลุดออกไปก่อนติ๊กสุดท้ายจริง ๆ) — คืนเงินให้ผู้ส่งเช่นกัน
  if (!isValidPlayer(target) || !world.getPlayers().some(p => p.id === target.id)) {
    setMoney(sender, getMoney(sender) + cost);
    // คืนเงินให้ผู้ส่ง -> ถอนจากธนาคารกลางเท่ากัน เหมือน cancelChannel()
    withdrawFromBank(cost);
    showError(sender, t("tp.channelCancelledTargetGoneActionBar"));
    return;
  }

  sender.teleport(target.location, {
    dimension: target.dimension
  });

  sender.playSound("random.orb");
  target.playSound("random.orb");

  showActionBar(sender, t("tp.successActionBarSender"), "tpBank");
  showActionBar(target, t("tp.successActionBarTarget", { sender: sender.name }), "tpBank");
}

/* =========================
   EXPORT MAIN UI
========================= */
export const openTpUI = safeAsync(async (player) => {
  if (!player?.isValid) return;

  const players = world.getPlayers().filter(p => p.id !== player.id);
  const money = getMoney(player);
  const isDisabled = Database.get(player, "tpDisabled");
  const isCombatBlockOff = !isCombatBlockEnabled(player);

  const items = [
    ...players.map(p => ({
      id: p.id,
      labelKey: "tp.playerButton",
      labelVars: { name: p.name },
      icon: "textures/items/ender_pearl"
    })),
    {
      id: "__toggle__",
      labelKey: isDisabled ? "tp.toggleOffButton" : "tp.toggleOnButton",
      icon: isDisabled ? "textures/ui/cancel" : "textures/ui/confirm"
    },
    {
      id: "__toggleCombat__",
      labelKey: isCombatBlockOff ? "tp.toggleCombatOffButton" : "tp.toggleCombatOnButton",
      icon: isCombatBlockOff ? "textures/ui/cancel" : "textures/ui/confirm"
    }
  ];

  return createListMenu(player, {
    titleKey: "tp.mainTitle",
    bodyKey: "tp.mainBody",
    bodyVars: { balance: money.toLocaleString() },
    menuGroup: "tpMenu",
    items,
    onSelect: (item) => {
      if (item.id === "__toggle__") {
        toggleTp(player);
        // เดิม: เลือกปุ่มนี้แล้วฟอร์มปิดไปเฉย ๆ ไม่วาดเมนูนี้ใหม่ —
        // เคลียร์สแตกที่ mainUi.js push ไว้ก่อนเรียกเข้ามา กันไม่ให้ค้าง
        return NavigationManager.close(player);
      }

      // ปุ่มเปิด/ปิด "ปฏิเสธคำขอ TP อัตโนมัติตอนกำลังต่อสู้" — พฤติกรรม
      // ปิดเมนูหลังกดเหมือนปุ่ม __toggle__ ด้านบนทุกประการ เพื่อความสม่ำเสมอ
      if (item.id === "__toggleCombat__") {
        toggleCombatBlock(player);
        return NavigationManager.close(player);
      }

      const target = players.find(p => p.id === item.id);
      if (!target) return NavigationManager.back(player);

      NavigationManager.push(player, () => openTpUI(player));
      return openTpConfirmUI(player, target);
    }
  });
}

/* =========================
   TOGGLE TP RECEIVE
========================= */
function toggleTp(player) {
    const state = Database.get(player, "tpDisabled");
    Database.set(player, "tpDisabled", !state);

  const msg = !state ? t("tp.toggleDisabledMessage") : t("tp.toggleEnabledMessage");
  showActionBar(player, msg, "tpBank");
  player.playSound("random.orb");
}

/* =========================
   CONFIRM + BREAKDOWN
========================= */
export const openTpConfirmUI = safeAsync(async (sender, target) => {
  if (!sender?.isValid) return;

  if (target.getDynamicProperty("tpDisabled")) {
    showError(sender, t("tp.targetDisabledMessage"));
    return NavigationManager.close(sender);
  }

  // เป้าหมายกำลังต่อสู้อยู่ (โดนตี/กำลังตีใครไม่เกิน
  // COMBAT_BLOCK_DURATION_SECONDS วินาทีที่แล้ว) และไม่ได้ปิดฟีเจอร์นี้ไว้
  // — ปฏิเสธคำขอตั้งแต่จุดนี้ ไม่ให้ฟอร์มยืนยันแม้แต่เปิดขึ้นมา (กันคำขอ
  // ไปสร้างสถานะ tpRequests + เด้งฟอร์ม openReceiveUI ไปกวนใจตอนกำลังสู้อยู่)
  if (isInCombat(target.id) && isCombatBlockEnabled(target)) {
    showError(sender, t("tp.targetInCombatMessage"));
    return NavigationManager.close(sender);
  }

  const crossDim = !isSameDimension(sender, target);

  // ข้ามมิติ: พิกัดของสองมิติไม่มีความสัมพันธ์กันจริง (เช่น Overworld/Nether
  // อัตราส่วน 8:1) ดังนั้นไม่คำนวณ distanceCost จากพิกัดเลยในกรณีนี้ —
  // คิดราคาคงที่ (CROSS_DIMENSION_COST) อย่างเดียว ไม่รวม distanceCost
  // เดียวกันมิติ: คงพฤติกรรมเดิม คิดตามระยะทางจริง ไม่มีค่าข้ามมิติ
  const distance = crossDim ? null : Math.floor(distanceBetween(sender.location, target.location));
  const distanceCost = crossDim ? 0 : distance * COST_PER_BLOCK;
  const crossCost = crossDim ? CROSS_DIMENSION_COST : 0;
  const total = distanceCost + crossCost;

  return showConfirm({
    player: sender,
    titleKey: "tp.confirmTitle",
    bodyKey: "tp.confirmBody",
    bodyVars: {
      target: target.name,
      // แสดงบรรทัดระยะทาง/ค่าเดินทางเฉพาะเดียวกันมิติ (ระยะทางข้ามมิติไม่มี
      // ความหมาย จึงไม่แสดงเลยแทนที่จะโชว์เลขที่คำนวณมาผิด ๆ)
      distanceLine: crossDim ? "" : t("tp.distanceLine", {
        distance: distance.toLocaleString(),
        cost: distanceCost.toLocaleString()
      }),
      // บรรทัดค่าข้ามมิติแสดงเฉพาะข้ามมิติจริง เหมือนเงื่อนไขเดิม —
      // ประกอบสตริงล่วงหน้าแล้วแทรกเป็นตัวแปรเดียวใน bodyKey หลัก
      crossDimLine: crossDim ? t("tp.crossDimLine", { cost: CROSS_DIMENSION_COST.toLocaleString() }) : "",
      total: total.toLocaleString()
    },
    confirmKey: "tp.confirmSend",
    cancelKey: "tp.confirmCancel",
    onCancel: () => NavigationManager.back(sender),
    onConfirm: () => {
      // ผู้ส่งกำลังนับถอยหลังรอวาปจากคำขอก่อนหน้าอยู่ — ห้ามส่งคำขอใหม่ซ้อน
      // (กันหักเงินซ้อน/สถานะ channel ชนกัน)
      if (activeChannels.has(sender.id)) {
        showActionBar(sender, t("tp.alreadyChannelingActionBar"), "tpBank");
        sender.playSound("note.bass");
        return NavigationManager.close(sender);
      }

      if (getMoney(sender) < total) {
        showActionBar(sender, t("tp.insufficientFundsActionBar"), "tpBank");
        sender.playSound("note.bass");
        return NavigationManager.close(sender);
      }

      return sendTpRequest(sender, target, total);
    }
  });
}

/* =========================
   SEND REQUEST
========================= */
function sendTpRequest(sender, target, cost) {
  const requestTime = system.currentTick;

  tpRequests.set(target.id, {
    senderId: sender.id,
    senderName: sender.name,
    cost,
    time: requestTime
  });

  showActionBar(sender, t("tp.requestSentActionBar", { target: target.name }), "tpBank");
  sender.playSound("random.pop");

  // แจ้งเตือนฝั่งผู้รับแบบเด่นๆ
  showInfo(target, t("tp.requestReceivedMessage", { sender: sender.name }));
  showActionBar(target, t("tp.requestReceivedActionBar"), "tpBank");
  target.playSound("random.levelup");

  // หมดเวลาอัตโนมัติถ้าไม่มีใครกดยอมรับ/ปฏิเสธภายในเวลาที่กำหนด
  system.runTimeout(() => {
    const pending = tpRequests.get(target.id);
    // เช็ค time ให้ตรงกันเผื่อคำขอถูกจัดการ หรือถูกคำขอใหม่ทับไปแล้ว
    if (!pending || pending.time !== requestTime) return;

    tpRequests.delete(target.id);

    const stillSender = findOnlinePlayerById(sender.id);
    const stillTarget = findOnlinePlayerById(target.id);

    if (stillSender) showError(stillSender, t("tp.requestTimeoutSender", { target: target.name }));
    if (stillTarget) showError(stillTarget, t("tp.requestTimeoutTarget", { sender: sender.name }));
  }, TP_REQUEST_TIMEOUT);

  openReceiveUI(target);

  // ฝั่งผู้ส่งทำรายการเสร็จสมบูรณ์ (ส่งคำขอแล้ว) — เคลียร์สแตกที่ push
  // ไว้ (openTpUI) กันไม่ให้ค้างข้ามไปปนกับเมนูอื่นในเซสชันถัดไป
  NavigationManager.close(sender);
}

/* =========================
   RECEIVE UI
========================= */
export const openReceiveUI = safeAsync(async (target) => {
  if (!target?.isValid) return;

  const req = tpRequests.get(target.id);
  if (!req) return;

  // กันไว้เผื่อคำขอหมดเวลาไปแล้วแต่ UI ยังเปิดค้างอยู่
  if (system.currentTick - req.time > TP_REQUEST_TIMEOUT) {
    tpRequests.delete(target.id);
    return;
  }

  return showConfirm({
    player: target,
    titleKey: "tp.receiveTitle",
    bodyKey: "tp.receiveBody",
    bodyVars: { sender: req.senderName, cost: req.cost.toLocaleString() },
    confirmKey: "tp.receiveAccept",
    cancelKey: "tp.receiveReject",
    onCancel: () => rejectTp(target),
    onConfirm: () => acceptTp(target)
  });
}

function rejectTp(target) {
  const req = tpRequests.get(target.id);
  if (!req) return;

    const sender = findOnlinePlayerById(req.senderId);
  if (sender) showError(sender, t("tp.rejectedMessage", { target: target.name }));
  tpRequests.delete(target.id);
}

/* =========================
   ACCEPT TP
========================= */
// ใช้เช็คก่อนเรียก acceptTp() จากที่อื่น (เช่นคำสั่งแชท /prakan:tpaccept)
// ว่ามีคำขอค้างอยู่จริงไหม ก่อนจะแจ้ง error ที่เหมาะสมกว่าปล่อยให้
// acceptTp() เงียบ ๆ ไม่ทำอะไร
export function hasPendingTpRequest(target) {
  return tpRequests.has(target?.id);
}

export function acceptTp(target) {
  const req = tpRequests.get(target.id);
  if (!req) return;

  if (system.currentTick - req.time > TP_REQUEST_TIMEOUT) {
    tpRequests.delete(target.id);
    showError(target, t("tp.requestExpiredMessage"));
    return;
  }

    const sender = findOnlinePlayerById(req.senderId);
  if (!sender) {
    showError(target, t("tp.senderGoneMessage"));
    tpRequests.delete(target.id);
    return;
  }

  // ผู้ส่งมีคำขออื่นที่กำลังนับถอยหลังรอวาปอยู่แล้ว (เผื่อกรณีเปิดเมนูส่ง
  // คำขอที่สองจากอีก client/เซสชันแทรกเข้ามาได้ทัน ก่อนเช็คใน
  // openTpConfirmUI จะทัน) — ปฏิเสธคำขอนี้แทน ไม่หักเงินซ้อน
  if (activeChannels.has(sender.id)) {
    showError(target, t("tp.senderBusyMessage"));
    tpRequests.delete(target.id);
    return;
  }

  const currentMoney = getMoney(sender);
  if (currentMoney < req.cost) {
    showError(sender, t("tp.senderInsufficientMessage"));
    showError(target, t("tp.cancelledInsufficientMessage"));
    tpRequests.delete(target.id);
    return;
  }

  // หักเงิน
  setMoney(sender, currentMoney - req.cost);
  // ค่าเดินทาง TP เข้าธนาคารกลาง — ถ้ายกเลิก channel ระหว่างทาง cancelChannel()/
  // finishTeleport() (กรณีเป้าหมายหาย) จะ withdrawFromBank() คืนให้เท่ากันเสมอ
  depositToBank(req.cost);
  tpRequests.delete(target.id);

  // เริ่มนับถอยหลัง TP_CHANNEL_SECONDS วินาที ก่อนวาปจริง — ผู้ส่งต้องยืน
  // นิ่ง ไม่โดนตี ไม่งั้นยกเลิก+คืนเงิน (ดู startTpChannel() ด้านบน)
  startTpChannel(sender, target, req.cost);
}

/* =========================
   MONEY / UTILS
   (getMoney/setMoney มาจาก economyUtils.js ที่เดียว — ดู import ด้านบน
   isSameDimension/distanceBetween มาจาก playerUtils.js — เดิม
   calcDistance(a, b) ของไฟล์นี้เอง (รับ entity) ถูกย้ายไปเป็น
   distanceBetween(locationA, locationB) ที่นั่นแล้ว — สูตรเดิมทุกประการ)
========================= */
