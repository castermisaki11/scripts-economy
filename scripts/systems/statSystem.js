// =========================
// statSystem.js
// ระบบจัดสรรแต้มสเตตัส (RPG Stat Allocation) — ผู้เล่นกดปุ่ม "ซื้อแต้ม"
// ในเมนูเพื่อใช้เงิน (money, ดู core/economyUtils.js) แลกแต้มสเตตัส
// โดยตรง (หักเงินทันทีตอนกด ไม่ใช่แจกอัตโนมัติตามยอดเงิน/เลเวล) นำแต้ม
// ไปลงในสเตตัสย่อย 6 ตัว ผ่านเมนู "สเตตัส"
// (ปุ่มในเมนูหลัก mainUi.js + คำสั่ง /prakan:stats — สองทางเข้าคู่ขนาน
// ไม่ได้แทนที่กัน เหมือนความสัมพันธ์ /prakan:job กับปุ่ม "อาชีพ" ในเมนูหลัก)
//
// สเตตัสย่อยลงแต้มแยกอิสระจากกัน (คนละแต้ม) ไม่รวมกันเหมือนเดิม:
//   STR  -> strAtk (ATK dmg%), strProj (ธนู/ปืน dmg%), strCritDmg (ดาเมจคริ%)
//   AGI  -> agiSpd (SPD%), agiCrit (คริ%), agiEvasion (หลบ%), agiParry (แพร์รี่%)
//   VIT  -> vitHp (HP flat), vitRed (ลดดาเมจ%), vitBlock (บล็อก%)
//
// strCritDmg/agiEvasion/agiParry/vitBlock เพิ่มเข้ามาแทนโบนัส
// criticalDamage/evasionChance/parryChance/blockChance ที่เดิมมาจาก item
// lore เท่านั้น (ระบบ reforge เดิมถูกลบไปแล้ว) — ดู config/statConfig.js
//
// ทำตามสถาปัตยกรรมเดียวกับระบบอื่นที่ migrate แล้ว (jobSystem.js,
// uiSettings.js, economy.js):
// - ไม่สร้าง ActionFormData / MessageFormData ตรง ๆ (ใช้ createListMenu
//   จาก UIFramework.js และ showConfirm จาก confirmDialog.js เท่านั้น)
// - ทุกสตริงผ่าน t() จาก locale/index.js (คีย์ "stats.*" ใน locale/th.js)
// - feedback ทางแชท (สำเร็จ/ผิดพลาด) ผ่าน core/messageUtils.js เสมอ
// - Dynamic Property (คีย์ "rpg:*") อ่าน/เขียนผ่าน core/statUtils.js
//   จุดเดียว ไม่อ่าน/เขียนตรงในไฟล์นี้ — ให้ระบบอื่นในอนาคต (สูตรดาเมจ/
//   ความเร็ว) import getStatBonuses() จากที่นั่นไปใช้ได้โดยไม่ต้องพึ่งไฟล์นี้
//
// เมนูปุ่ม +1 และปุ่ม "รีเซ็ต" ไม่ใช่การเปลี่ยน "หน้าจอ" (เหมือน
// ui/settings/uiSettings.js ตอนเลื่อนลำดับเมนู) แค่แก้ค่าแล้ววาดเมนูเดิมซ้ำ
// ในที่ — จึงเรียก openStatUI(player) ซ้ำตรง ๆ แทนที่จะ NavigationManager.push()
// ทุกครั้งที่กด (เหมือน showReorderScreen() เรียกตัวเองซ้ำใน uiSettings.js)
// ส่วนการเข้า/ออกเมนูนี้จากเมนูหลัก ให้ผู้เรียก (mainUi.js /
// commands/statCommands.js) push ก่อนเข้าเหมือนโมดูลอื่นที่ migrate แล้ว
// =========================

import { world, system, EntityComponentTypes } from "@minecraft/server";
import { createListMenu, createAmountPrompt } from "../ui/framework/UIFramework";
import { showConfirm } from "../core/confirmDialog";
import { t } from "../ui/locale/index";
import { showSuccess, showError, showInfo } from "../core/messageUtils";
import { STAT_CONFIG } from "../config/statConfig";
import { expToNext } from "../core/levelUtils";
import {
  getStrAtk, getStrProj, getAgiSpd, getAgiCrit, getVitHp, getVitRed,
  getStrCritDmg, getAgiEvasion, getAgiParry, getVitBlock,
  getStrLifesteal, getVitThorn, getVitRegen, getAgiJump, getStrExecute,
  getPoints, isStatInitialized,
  setStrAtk, setStrProj, setAgiSpd, setAgiCrit, setVitHp, setVitRed,
  setStrCritDmg, setAgiEvasion, setAgiParry, setVitBlock,
  setStrLifesteal, setVitThorn, setVitRegen, setAgiJump, setStrExecute,
  setPoints, markStatInitialized,
  getStatBonuses, getLevel, getExp, getPlayerClass, setPlayerClass,
  STAT_GROUP
} from "../core/statUtils";
import { getMoney, removeMoney, depositToBank } from "../core/economyUtils";
import { ICONS } from "../config/uiConfig";
import { grantBuff, revokeBuff } from "../core/buffManager";
import { playJobLevelUp } from "../core/soundUtils";
import { subscribeSafe } from "../core/eventGuard";
import { getAffinityBonuses, getAffinityLevels } from "./affinitySystem";

/* =========================
   INIT
========================= */

function initializePlayer(player) {
  if (isStatInitialized(player)) return;
  setStrAtk(player, 0);
  setStrProj(player, 0);
  setAgiSpd(player, 0);
  setAgiCrit(player, 0);
  setVitHp(player, 0);
  setVitRed(player, 0);
  setStrCritDmg(player, 0);
  setAgiEvasion(player, 0);
  setAgiParry(player, 0);
  setVitBlock(player, 0);
  setStrLifesteal(player, 0);
  setVitThorn(player, 0);
  setVitRegen(player, 0);
  setAgiJump(player, 0);
  setStrExecute(player, 0);
  setPoints(player, STAT_CONFIG.STARTING_POINTS);
  markStatInitialized(player);
  showSuccess(player, t("stats.welcome", { points: STAT_CONFIG.STARTING_POINTS }));
}

/* =========================
   CAP STATS FOR NEW LIMITS (v1.4.20) — nerf ฟีเจอร์ลง 75%
   Reset ผู้เล่นที่ลงแต้มเกินเพดานใหม่ คืนแต้มส่วนที่เกินให้
========================= */
function capStatsForNewLimits(player) {
  let refunded = 0;

  for (const [statKey, handler] of Object.entries(SUB_STAT_HANDLERS)) {
    const display = STAT_DISPLAY[statKey];
    if (!display || display.max == null) continue;
    const currentPoints = handler.get(player);
    const maxPoints = Math.ceil(display.max / display.perPoint);
    if (currentPoints > maxPoints) {
      refunded += (currentPoints - maxPoints);
      handler.set(player, maxPoints);
    }
  }

  if (refunded > 0) {
    setPoints(player, getPoints(player) + refunded);
    applyMaxHealthBonus(player);
    applyRegenBonus(player);
    applyJumpBoostBonus(player);
    // Revoke execute buff ถ้า strExecute ถูก cap (HP threshold อาจเปลี่ยน)
    revokeBuff(player, "strength", "stat:str");
  }
}

/* =========================
   VIT-HP -> MAX HEALTH (ผ่าน health_boost effect)
   health_boost เพิ่มเลือดทีละ 4 HP ต่อ amplifier level (นับจาก 0) — ไม่มี
   API ปรับ max health ตรง ๆ ใน Script API จึงต้องผูกกับ effect นี้แทน
========================= */

function applyMaxHealthBonus(player) {
  const vitHp = getVitHp(player);
  const bonuses = getAffinityBonuses(player);
  const affinityVitBonus = bonuses.affinityVitBonus ?? 0;
  const baseHp = Math.min(vitHp * STAT_CONFIG.VIT_HP.MAX_HEALTH_PER_POINT, STAT_CONFIG.VIT_HP.MAX_PERCENT);
  const bonusHp = baseHp + affinityVitBonus;

  // ให้/ยกเลิกผ่านระบบกลาง (core/buffManager.js) แทน player.addEffect()/
  // removeEffect() ตรง ๆ — removeEffect ตรง ๆ แบบเดิมจะเคลียร์ health_boost
  // ทั้งก้อนบน entity ทิ้งรวมถึงส่วนที่มาจากแหล่งภายนอก (addon อื่น) ไปด้วย
  // ซึ่งไม่ใช่พฤติกรรมที่ต้องการอีกต่อไปเมื่อผูกกับระบบกลางแล้ว — revokeBuff
  // จะลบเฉพาะส่วนของ sourceId "stat:vit" เท่านั้น
  if (bonusHp >= 4) {
    // amplifier ดิบ (0-based) เดิมของไฟล์นี้ ต้อง +1 ก่อนส่งเข้า grantBuff
    // ซึ่งรับหน่วย level (เริ่มที่ 1)
    const amplifier = Math.max(0, Math.floor(bonusHp / 4) - 1);
    grantBuff(player, "health_boost", amplifier + 1, STAT_CONFIG.HEALTH_BOOST_DURATION_TICKS, "stat:vit", true);
  } else {
    revokeBuff(player, "health_boost", "stat:vit");
  }
}

/* =========================
   VIT-REGEN (v1.4.15) — regeneration effect
   amplifier ดิบ = floor(points / 2) - 1 (ต้อง >= 4 แต้มจึงมี amplifier)
   MAX 5 แต้ม = amplifier 1 (nerf v1.4.20 + เพิ่มเติม)
============================ */
function applyRegenBonus(player) {
  const points = getVitRegen(player);
  if (points >= 4) {
    const amplifier = Math.max(0, Math.floor(points / 2) - 1);
    grantBuff(player, "regeneration", amplifier + 1, STAT_CONFIG.VIT_REGEN.REGEN_DURATION_TICKS, "stat:vit", true);
  } else {
    revokeBuff(player, "regeneration", "stat:vit");
  }
}

/* =========================
   AGI-JUMP (v1.4.15) — jump_boost effect
   amplifier = floor(points * 0.125) → MAX 5 แต้ม = amplifier 5 = +2.5 บล็อก (nerf v1.4.20)
   1 แต้ม = 0.5 amplifier (floor → ต้องลง 2 แต้มจึงเห็นผล)
============================ */
function applyJumpBoostBonus(player) {
  const points = getAgiJump(player);
  const amplifier = Math.floor(points * STAT_CONFIG.AGI_JUMP.JUMP_BOOST_PER_POINT);
  if (amplifier > 0) {
    grantBuff(player, "jump_boost", amplifier, STAT_CONFIG.AGI_JUMP.JUMP_DURATION_TICKS, "stat:agi", true);
  } else {
    revokeBuff(player, "jump_boost", "stat:agi");
  }
}

/* =========================
   STR-EXECUTE (v1.4.15) — strength effect เมื่อ HP <= threshold
   amplifier = floor(points / 2) → MAX 30 แต้ม = amplifier 15
   เช็ค HP ใน runInterval เพราะ apply ตามสถานการณ์ ไม่ใช่ static
============================ */
function applyExecuteBonus(player) {
  const points = getStrExecute(player);
  if (points <= 0) return false;
  const amplifier = Math.max(0, Math.floor(points / STAT_CONFIG.STR_EXECUTE.EXECUTE_AMPLIFIER_DIVISOR));
  if (amplifier > 0) {
    grantBuff(player, "strength", amplifier, STAT_CONFIG.STR_EXECUTE.EXECUTE_DURATION_TICKS, "stat:str", true);
    return true;
  }
  return false;
}

/* =========================
   SPEND / RESET
========================= */

const SUB_STAT_HANDLERS = {
  strAtk: { get: getStrAtk, set: setStrAtk },
  strProj: { get: getStrProj, set: setStrProj },
  agiSpd: { get: getAgiSpd, set: setAgiSpd },
  agiCrit: { get: getAgiCrit, set: setAgiCrit },
  vitHp: { get: getVitHp, set: setVitHp },
  vitRed: { get: getVitRed, set: setVitRed },
  strCritDmg: { get: getStrCritDmg, set: setStrCritDmg },
  agiEvasion: { get: getAgiEvasion, set: setAgiEvasion },
  agiParry: { get: getAgiParry, set: setAgiParry },
  vitBlock: { get: getVitBlock, set: setVitBlock },
  strLifesteal: { get: getStrLifesteal, set: setStrLifesteal },
  vitThorn: { get: getVitThorn, set: setVitThorn },
  vitRegen: { get: getVitRegen, set: setVitRegen },
  agiJump: { get: getAgiJump, set: setAgiJump },
  strExecute: { get: getStrExecute, set: setStrExecute }
};

// เพดานสเตตัส (v1.4.0: ทุก % สเตตัสมี MAX_PERCENT ใน statConfig.js) —
// อ่านจาก STAT_DISPLAY.max โดยตรง (แหล่งเดียวกับที่ getStatBonuses() clamp)
function isStatAtCap(statKey, currentValue) {
  const display = STAT_DISPLAY[statKey];
  if (!display || display.max == null) return false;
  return currentValue * display.perPoint >= display.max;
}

// ป้ายชื่อ + ค่าต่อแต้ม (จาก config/statConfig.js ตรง ๆ ไม่ hardcode ซ้ำ) —
// ใช้คำนวณ "ค่าปัจจุบัน -> ค่าหลังลงแต้ม" ในหน้ายืนยัน confirmSpendPoint()
// เท่านั้น ไม่ใช่แหล่งความจริงของโบนัส (ยังคงเป็น getStatBonuses() ใน
// statUtils.js เหมือนเดิม) unit " HP" มีช่องว่างนำหน้าเพราะ VIT-เลือด
// เป็นค่า flat ไม่ใช่ % เหมือนตัวอื่น
const STAT_DISPLAY = {
  strAtk: { nameKey: "stats.nameStrAtk", perPoint: STAT_CONFIG.STR_ATK.ATTACK_DAMAGE_PER_POINT, unit: "%", max: STAT_CONFIG.STR_ATK.MAX_PERCENT },
  strProj: { nameKey: "stats.nameStrProj", perPoint: STAT_CONFIG.STR_PROJ.PROJECTILE_DAMAGE_PER_POINT, unit: "%", max: STAT_CONFIG.STR_PROJ.MAX_PERCENT },
  strCritDmg: { nameKey: "stats.nameStrCritDmg", perPoint: STAT_CONFIG.STR_CRITDMG.CRITICAL_DAMAGE_PER_POINT, unit: "%", max: STAT_CONFIG.STR_CRITDMG.MAX_PERCENT },
  agiSpd: { nameKey: "stats.nameAgiSpd", perPoint: STAT_CONFIG.AGI_SPD.MOVEMENT_SPEED_PER_POINT, unit: "%", max: STAT_CONFIG.AGI_SPD.MAX_PERCENT },
  agiCrit: { nameKey: "stats.nameAgiCrit", perPoint: STAT_CONFIG.AGI_CRIT.CRITICAL_CHANCE_PER_POINT, unit: "%", max: STAT_CONFIG.AGI_CRIT.MAX_PERCENT },
  agiEvasion: { nameKey: "stats.nameAgiEvasion", perPoint: STAT_CONFIG.AGI_EVASION.EVASION_CHANCE_PER_POINT, unit: "%", max: STAT_CONFIG.AGI_EVASION.MAX_PERCENT },
  agiParry: { nameKey: "stats.nameAgiParry", perPoint: STAT_CONFIG.AGI_PARRY.PARRY_CHANCE_PER_POINT, unit: "%", max: STAT_CONFIG.AGI_PARRY.MAX_PERCENT },
  vitHp: { nameKey: "stats.nameVitHp", perPoint: STAT_CONFIG.VIT_HP.MAX_HEALTH_PER_POINT, unit: " HP", max: STAT_CONFIG.VIT_HP.MAX_PERCENT },
  vitRed: { nameKey: "stats.nameVitRed", perPoint: STAT_CONFIG.VIT_RED.DAMAGE_REDUCTION_PER_POINT, unit: "%", max: STAT_CONFIG.VIT_RED.MAX_PERCENT },
  vitBlock: { nameKey: "stats.nameVitBlock", perPoint: STAT_CONFIG.VIT_BLOCK.BLOCK_CHANCE_PER_POINT, unit: "%", max: STAT_CONFIG.VIT_BLOCK.MAX_PERCENT },
  strLifesteal: { nameKey: "stats.nameStrLifesteal", perPoint: STAT_CONFIG.STR_LIFESTEAL.LIFESTEAL_PER_POINT, unit: "%", max: STAT_CONFIG.STR_LIFESTEAL.MAX_PERCENT },
  vitThorn: { nameKey: "stats.nameVitThorn", perPoint: STAT_CONFIG.VIT_THORN.THORN_PER_POINT, unit: "%", max: STAT_CONFIG.VIT_THORN.MAX_PERCENT },
  vitRegen: { nameKey: "stats.nameVitRegen", perPoint: STAT_CONFIG.VIT_REGEN.HEALTH_PER_POINT, unit: " HP/2s", max: STAT_CONFIG.VIT_REGEN.MAX_PERCENT },
  agiJump: { nameKey: "stats.nameAgiJump", perPoint: STAT_CONFIG.AGI_JUMP.JUMP_BOOST_PER_POINT, unit: "%", max: STAT_CONFIG.AGI_JUMP.MAX_PERCENT },
  strExecute: { nameKey: "stats.nameStrExecute", perPoint: STAT_CONFIG.STR_EXECUTE.EXECUTE_PER_POINT, unit: "%", max: STAT_CONFIG.STR_EXECUTE.MAX_PERCENT }
};

// ปัดเศษ 2 ตำแหน่งกันเลขทศนิยมเพี้ยนจาก floating point (เช่น 0.1 + 0.2)
function round2(value) {
  return Math.round(value * 100) / 100;
}

// คำอธิบาย effect จริงของสเตตัสย่อย — คีย์ locale รูปแบบ "stats.info" + ชื่อ
// statKey ตัวอักษรแรกพิมพ์ใหญ่ (เช่น statKey "strAtk" -> "stats.infoStrAtk"
// ตรงกับรูปแบบเดียวกับ nameKey "stats.nameStrAtk") ใช้ทั้งในหน้ายืนยันลงแต้ม
// (confirmSpendPoint) และโชว์ทันทีตอนกดเข้าเมนูสเตตัส (openStatActionMenu)
// t() คืน key ตรง ๆ เมื่อไม่พบคำแปล เช็ค !== key เพื่อรู้ว่ามี locale จริง
function getStatInfo(statKey) {
  const infoKey = `stats.info${statKey.charAt(0).toUpperCase()}${statKey.slice(1)}`;
  const info = t(infoKey);
  return info !== infoKey ? info : "";
}

// v1.4.24: ความคืบหน้าลงแต้มเทียบเพดาน (MAX_PERCENT) ของสเตตัสย่อย — คำนวณ
// จากค่าดิบ "ก่อน" คูณโบนัสคลาส (สอดคล้องกับ isStatAtCap()) เพื่อให้บาร์
// เต็ม 100% พอดีตอนถึงเพดานจริง ไม่ผันตามคลาสที่เลือก
function getCapProgress(statKey, points) {
  const display = STAT_DISPLAY[statKey];
  if (!display || display.max == null) return null;
  const raw = round2(points * display.perPoint);
  const clamped = Math.min(raw, display.max);
  const percent = display.max > 0 ? Math.min(100, Math.round((clamped / display.max) * 100)) : 0;
  return { clamped, max: display.max, percent };
}

// ป้ายเปอร์เซ็นต์แบบสั้น ใช้ในเมนูภาพรวม (stats.body) — โชว์ข้าง ๆ ตัวเลข
// สเตตัสแต่ละบรรทัด สีเปลี่ยนตามความใกล้เพดาน (เขียว < 70% / เหลือง < 100%
// / แดง = เต็มเพดานแล้ว) unit " HP" (vitHp) โชว์เป็น HP แทน % ให้ตรงหน่วยจริง
function capBadge(statKey, points) {
  const info = getCapProgress(statKey, points);
  if (!info) return "";
  const unitLabel = STAT_DISPLAY[statKey].unit === " HP" ? " HP" : "%";
  const color = info.percent >= 100 ? "§c" : info.percent >= 70 ? "§e" : "§8";
  return `${color}[${info.clamped}/${info.max}${unitLabel}]`;
}

// บาร์ความคืบหน้าแบบเต็ม (10 ช่อง) ใช้ในเมนูรายละเอียดสเตตัสย่อย
// (openStatActionMenu) ซึ่งมีพื้นที่มากกว่าเมนูภาพรวม
function capBar(statKey, points) {
  const info = getCapProgress(statKey, points);
  if (!info) return "";
  const segments = 10;
  const filled = Math.round((info.percent / 100) * segments);
  const bar = "§a" + "■".repeat(filled) + "§8" + "■".repeat(segments - filled);
  return `${bar} §7${info.percent}% §8(${info.clamped}/${info.max}${STAT_DISPLAY[statKey].unit === " HP" ? " HP" : "%"})`;
}

function bonusForPoints(player, statKey, points) {
  const display = STAT_DISPLAY[statKey];
  const raw = points * display.perPoint;
  const clamped = display.max != null ? Math.min(raw, display.max) : raw;
  const classId = getPlayerClass(player);
  const group = STAT_GROUP[statKey];
  const mult = classId && STAT_CONFIG.CLASS.CLASSES[classId]?.groups.includes(group) ? STAT_CONFIG.CLASS.MULTIPLIER_VALUE : 1;
  let bonus = clamped * mult;
  if (classId) {
    const perks = STAT_CONFIG.CLASS.PERKS[classId] ?? {};
    if (statKey === "strLifesteal") bonus += perks.lifestealChanceBonus ?? 0;
    else if (statKey === "vitThorn") bonus += perks.thornPercentBonus ?? 0;
    else if (statKey === "agiCrit") bonus += perks.criticalChanceBonusPercent ?? 0;
  }
  return round2(bonus);
}

function getSpendablePointLimit(player, statKey, currentPoints) {
  const display = STAT_DISPLAY[statKey];
  if (!display) return 0;

  let limit = getPoints(player);
  if (display.max != null) {
    const remainingToCap = Math.max(0, Math.ceil(display.max / display.perPoint - currentPoints));
    limit = Math.min(limit, remainingToCap);
  }
  return limit;
}

// เปิดช่องให้ระบุจำนวนแต้มที่จะลงในสเตตัสย่อยที่เลือก แล้วแสดงค่าจริงก่อน/หลัง
// ลงแต้มทั้งหมดในหน้ายืนยัน (คำนวณจาก STAT_DISPLAY ด้านบน ไม่ hardcode)
function promptSpendPoint(player, statKey) {
  const handler = SUB_STAT_HANDLERS[statKey];
  const display = STAT_DISPLAY[statKey];
  if (!handler || !display) return;

  const currentPoints = handler.get(player);
  const maxSpendable = getSpendablePointLimit(player, statKey, currentPoints);
  if (maxSpendable <= 0) {
    showError(player, t(getPoints(player) <= 0 ? "stats.notEnoughPoints" : "stats.statAtMax"));
    return;
  }

  return createAmountPrompt(player, {
    titleKey: "stats.spendAmountTitle",
    promptKey: "stats.spendAmountPrompt",
    promptVars: { name: t(display.nameKey), max: maxSpendable },
    placeholder: String(maxSpendable),
    onCancel: () => openStatUI(player),
    onSubmit: (value) => {
      const amount = Math.floor(Number(value));
      const latestLimit = getSpendablePointLimit(player, statKey, handler.get(player));
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > latestLimit) {
        showError(player, t("stats.invalidSpendAmount"));
        return openStatUI(player);
      }
      return confirmSpendPoint(player, statKey, amount);
    }
  });
}

function confirmSpendPoint(player, statKey, amount) {
  const handler = SUB_STAT_HANDLERS[statKey];
  const display = STAT_DISPLAY[statKey];
  if (!handler || !display) return;

  const currentPoints = handler.get(player);
  const maxSpendable = getSpendablePointLimit(player, statKey, currentPoints);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > maxSpendable) {
    showError(player, t(maxSpendable <= 0 ? "stats.statAtMax" : "stats.invalidSpendAmount"));
    return;
  }

  const current = bonusForPoints(player, statKey, currentPoints);
  const next = bonusForPoints(player, statKey, currentPoints + amount);

  // v1.4.16: inject info text (คำอธิบาย effect จริง) เข้า spendConfirmBody
  const info = getStatInfo(statKey);

  return showConfirm({
    player,
    titleKey: "stats.spendConfirmTitle",
    bodyKey: "stats.spendConfirmBody",
    bodyVars: {
      name: t(display.nameKey),
      amount,
      current,
      next,
      diff: round2(next - current),
      unit: display.unit,
      info
    },
    // เหมือน confirmReset() — เปิดจากในตัวเมนูสเตตัสเอง
    // ไม่ได้ push สแตกใหม่ ทั้งยืนยัน/ยกเลิกจึงกลับไปที่เมนูสเตตัสเดิมเสมอ
    onCancel: () => openStatUI(player),
    onConfirm: () => {
      spendPoint(player, statKey, amount);
      return openStatUI(player);
    }
  });
}

function spendPoint(player, statKey, amount) {
  const points = getPoints(player);
  const handler = SUB_STAT_HANDLERS[statKey];
  if (!handler) return;

  const spendAmount = Math.floor(Number(amount));
  const maxSpendable = getSpendablePointLimit(player, statKey, handler.get(player));
  if (!Number.isSafeInteger(spendAmount) || spendAmount < 1 || spendAmount > maxSpendable) {
    showError(player, t(maxSpendable <= 0 ? "stats.statAtMax" : "stats.invalidSpendAmount"));
    return;
  }

  setPoints(player, points - spendAmount);
  handler.set(player, handler.get(player) + spendAmount);
  if (statKey === "vitHp") applyMaxHealthBonus(player);
  else if (statKey === "vitRegen") applyRegenBonus(player);
  else if (statKey === "agiJump") applyJumpBoostBonus(player);
  // strExecute apply ใน runInterval (ขึ้นกับ HP)

  // แจ้งเตือนเมื่อ stat ถึงเพดาน (v1.5.1)
  const display = STAT_DISPLAY[statKey];
  if (display && display.max != null) {
    const newVal = handler.get(player);
    const raw = newVal * display.perPoint;
    if (raw >= display.max) {
      showInfo(player, t("stats.reachedCap", { name: t(display.nameKey) }));
    }
  }
}

function resetPoints(player) {
  let total = 0;
  for (const key of Object.keys(SUB_STAT_HANDLERS)) {
    const handler = SUB_STAT_HANDLERS[key];
    total += handler.get(player);
    handler.set(player, 0);
  }
  setPoints(player, getPoints(player) + total);
  applyMaxHealthBonus(player);
  revokeBuff(player, "regeneration", "stat:vit");
  revokeBuff(player, "jump_boost", "stat:agi");
  revokeBuff(player, "strength", "stat:str");
  showSuccess(player, t("stats.resetSuccess"));
}

// รีเซ็ตสเตตัสย่อยแค่ตัวเดียว (v1.4.24) — คืนแต้มเฉพาะที่ลงในสเตตัสนี้
// ต่างจาก resetPoints() ที่รีเซ็ตทุกตัวพร้อมกัน — ต้อง revoke/re-apply
// buff เฉพาะของสเตตัสนั้น (ถ้ามี) เหมือนกับ resetPoints() ทำ แต่แยกทีละตัว
function resetSingleStat(player, statKey) {
  const handler = SUB_STAT_HANDLERS[statKey];
  if (!handler) return;

  const amount = handler.get(player);
  if (amount <= 0) {
    showError(player, t("stats.statNotSet"));
    return;
  }

  handler.set(player, 0);
  setPoints(player, getPoints(player) + amount);

  if (statKey === "vitHp") applyMaxHealthBonus(player);
  else if (statKey === "vitRegen") revokeBuff(player, "regeneration", "stat:vit");
  else if (statKey === "agiJump") revokeBuff(player, "jump_boost", "stat:agi");
  else if (statKey === "strExecute") revokeBuff(player, "strength", "stat:str");

  showSuccess(player, t("stats.resetOneSuccess", {
    name: t(STAT_DISPLAY[statKey].nameKey),
    points: amount
  }));
}

function confirmResetSingleStat(player, statKey) {
  const handler = SUB_STAT_HANDLERS[statKey];
  const display = STAT_DISPLAY[statKey];
  if (!handler || !display) return;

  const currentPoints = handler.get(player);
  if (currentPoints <= 0) {
    showError(player, t("stats.statNotSet"));
    return openStatUI(player);
  }

  const currentBonus = bonusForPoints(player, statKey, currentPoints);

  return showConfirm({
    player,
    titleKey: "stats.resetOneConfirmTitle",
    bodyKey: "stats.resetOneConfirmBody",
    bodyVars: {
      name: t(display.nameKey),
      current: currentBonus,
      unit: display.unit,
      points: currentPoints
    },
    // เปิดจากในตัวเมนูสเตตัสเอง (ไม่ push สแตกใหม่) — เหมือน
    // confirmReset()/confirmSpendPoint() ทั้งยืนยันและยกเลิกกลับเมนู
    // สเตตัสเดิมเสมอ
    onCancel: () => openStatUI(player),
    onConfirm: () => {
      resetSingleStat(player, statKey);
      return openStatUI(player);
    }
  });
}

/* =========================
   CLASS SYSTEM (v1.4.0) — เลือกคลาสครั้งแรกฟรี เปลี่ยนภายหลังเสียเงิน
   (CLASS.CHANGE_COST เข้าธนาคารกลางเหมือน buyPoint) — คูณโบนัสทำงานที่
   getStatBonuses() จุดเดียว ที่นี่แค่ UI + จ่ายเงิน + setPlayerClass()
========================= */

function openClassMenu(player) {
  const current = getPlayerClass(player);
  const isFirstPick = current === null;
  const changeCost = STAT_CONFIG.CLASS.CHANGE_COST;

  const items = Object.keys(STAT_CONFIG.CLASS.CLASSES).map((classId) => ({
    id: classId,
    labelKey: `stats.class.${classId}`,
    icon: classId === "warrior"
      ? "textures/items/diamond_sword"
      : classId === "archer"
        ? "textures/items/bow_standby"
        : "textures/items/apple_golden"
  }));

  return createListMenu(player, {
    titleKey: "stats.classTitle",
    bodyKey: "stats.classBody",
    bodyVars: {
      current: current ? t(`stats.class.${current}`) : t("stats.classNone"),
      cost: isFirstPick ? 0 : changeCost
    },
    items,
    onSelect: (item) => {
      if (item.id === current) {
        showError(player, t("stats.classAlreadySelected"));
        return openStatUI(player);
      }

      // ครั้งแรกฟรี — ตั้งแต่ยังไม่เคยเลือก (current = null)
      if (!isFirstPick) {
        if (getMoney(player) < changeCost) {
          showError(player, t("stats.classNotEnoughMoney", { cost: changeCost }));
          return openStatUI(player);
        }
        return showConfirm({
          player,
          titleKey: "stats.classChangeConfirmTitle",
          bodyKey: "stats.classChangeConfirmBody",
          bodyVars: { oldClass: t(`stats.class.${current}`), newClass: t(`stats.class.${item.id}`), cost: changeCost },
          onCancel: () => openStatUI(player),
          onConfirm: () => {
            removeMoney(player, changeCost);
            depositToBank(changeCost);
            applyClass(player, item.id);
            return openStatUI(player);
          }
        });
      }

      applyClass(player, item.id);
      return openStatUI(player);
    },
    // เปิดจากในตัวเมนูสเตตัสเอง (ไม่ push สแตกใหม่) — กลับ/ยกเลิก = เมนู
    // สเตตัสเดิมเสมอ (fromConfirm เผื่อเรียกซ้ำจาก confirm flow)
    onCancel: () => openStatUI(player)
  });
}

/* =========================
   ACTION MENU (v1.4.24) — เมนูกลาง เปิดเมื่อกดสเตตัสย่อยตัวใดตัวหนึ่ง
   ให้เลือก "ลงแต้ม" หรือ "รีเซ็ตเฉพาะสเตตัสนี้" แทนที่จะเข้าช่องกรอกจำนวน
   ทันที (ของเดิม promptSpendPoint() ยังใช้ได้เหมือนเดิม แค่ย้ายจุดเรียก
   มาไว้หลังเมนูนี้)
========================= */
function openStatActionMenu(player, statKey) {
  const handler = SUB_STAT_HANDLERS[statKey];
  const display = STAT_DISPLAY[statKey];
  if (!handler || !display) return;

  const currentPoints = handler.get(player);
  const currentBonus = bonusForPoints(player, statKey, currentPoints);

  const items = [
    { id: "spend", labelKey: "stats.actionSpend", icon: "textures/items/emerald" },
    { id: "resetOne", labelKey: "stats.actionResetOne", icon: ICONS.back }
  ];

  return createListMenu(player, {
    titleKey: "stats.actionMenuTitle",
    titleVars: { name: t(display.nameKey) },
    bodyKey: "stats.actionMenuBody",
    bodyVars: { name: t(display.nameKey), desc: getStatInfo(statKey), current: currentBonus, unit: display.unit, points: currentPoints, capBar: capBar(statKey, currentPoints) },
    items,
    // เปิดจากในตัวเมนูสเตตัสเอง (ไม่ push สแตกใหม่) — ยกเลิก = กลับเมนู
    // สเตตัสเดิมเสมอ เหมือน promptSpendPoint()/confirmReset()
    onCancel: () => openStatUI(player),
    onSelect: (item) => {
      switch (item.id) {
        case "spend":
          return promptSpendPoint(player, statKey);
        case "resetOne":
          return confirmResetSingleStat(player, statKey);
      }
    }
  });
}

function applyClass(player, classId) {
  if (!setPlayerClass(player, classId)) return;
  // โบนัส VIT-HP คูณด้วย class multiplier เปลี่ยน -> max health อาจต่างไป
  // ต้อง re-apply health_boost buff ทันที (loop refresh จะจัดการต่อภายหลัง)
  applyMaxHealthBonus(player);
  // v1.4.15: คลาสเปลี่ยน -> re-apply effect ที่ขึ้นกับ multiplier ด้วย
  applyRegenBonus(player);
  applyJumpBoostBonus(player);
  playJobLevelUp(player);
  showSuccess(player, t("stats.classSelectSuccess", {
    className: t(`stats.class.${classId}`)
  }));
}

function confirmReset(player) {
  return showConfirm({
    player,
    titleKey: "stats.resetConfirmTitle",
    bodyKey: "stats.resetConfirmBody",
    // หน้ายืนยันนี้เปิดจากในตัวเมนูสเตตัสเอง (ไม่ได้ push สแตกใหม่) —
    // ทั้งกดยืนยันและยกเลิกจึงกลับไปที่เมนูสเตตัสเดิมเสมอ ไม่ใช่
    // NavigationManager.back() ที่จะย้อนไปเมนูหลักแทน
    onCancel: () => openStatUI(player),
    onConfirm: () => {
      resetPoints(player);
      return openStatUI(player);
    }
  });
}

/* =========================
   UI — เมนูจัดสรรแต้มสเตตัส
========================= */

/**
 * เปิดเมนูจัดสรรแต้มสเตตัส — ผู้เรียก (mainUi.js / statCommands.js) ต้อง
 * NavigationManager.push() ก่อนเสมอ เหมือนโมดูลอื่นที่ migrate แล้ว
 * ยกเว้นตอนเป็น root ของสแตก (เช่นเรียกตรงจากคำสั่งแชท)
 * @param {import("@minecraft/server").Player} player
 */
export function openStatUI(player) {
  if (!player?.isValid) return;

  const strAtk = getStrAtk(player);
  const strProj = getStrProj(player);
  const agiSpd = getAgiSpd(player);
  const agiCrit = getAgiCrit(player);
  const vitHp = getVitHp(player);
  const vitRed = getVitRed(player);
  const strCritDmg = getStrCritDmg(player);
  const agiEvasion = getAgiEvasion(player);
  const agiParry = getAgiParry(player);
  const vitBlock = getVitBlock(player);
  const strLifesteal = getStrLifesteal(player);
  const vitThorn = getVitThorn(player);
  const vitRegen = getVitRegen(player);
  const agiJump = getAgiJump(player);
  const strExecute = getStrExecute(player);
  const points = getPoints(player);
  const money = getMoney(player);
  const bonuses = getStatBonuses(player);
  const level = getLevel(player);
  const exp = getExp(player);
  const currentClass = getPlayerClass(player);

  const cappedLabel = (statKey, value, baseKey) =>
    isStatAtCap(statKey, value) ? `${baseKey}Max` : baseKey;

  const items = [
    { id: "class", labelKey: "stats.classButton", icon: "textures/items/diamond_chestplate" },
    // v1.4.24: ลำดับปุ่มจัดใหม่ตามที่ผู้ใช้กำหนด (บนลงล่าง) — พลังโจมตี,
    // ดาเมจธนู, ดาเมจคริติคอล, โอกาสคริติคอล, ดูดเลือด, พลังสังหาร,
    // ความเร็ว, การหลบหลีก, แพรี่, แล้วตามด้วยสเตตัสที่เหลือ (เดิมอยู่
    // ท้ายรายการ) ตามลำดับเดิม — ไม่กระทบ id/logic ใด ๆ แค่ตำแหน่งปุ่ม
    { id: "strAtk", labelKey: cappedLabel("strAtk", strAtk, "stats.addStrAtk"), icon: "textures/items/diamond_sword" },
    { id: "strProj", labelKey: cappedLabel("strProj", strProj, "stats.addStrProj"), icon: "textures/items/bow_standby" },
    { id: "strCritDmg", labelKey: cappedLabel("strCritDmg", strCritDmg, "stats.addStrCritDmg"), icon: "textures/items/diamond_axe" },
    { id: "agiCrit", labelKey: cappedLabel("agiCrit", agiCrit, "stats.addAgiCrit"), icon: "textures/items/iron_sword" },
    { id: "strLifesteal", labelKey: cappedLabel("strLifesteal", strLifesteal, "stats.addStrLifesteal"), icon: "textures/items/apple_golden" },
    { id: "strExecute", labelKey: cappedLabel("strExecute", strExecute, "stats.addStrExecute"), icon: "textures/items/netherite_sword" },
    { id: "agiSpd", labelKey: cappedLabel("agiSpd", agiSpd, "stats.addAgiSpd"), icon: "textures/items/leather_boots" },
    { id: "agiEvasion", labelKey: cappedLabel("agiEvasion", agiEvasion, "stats.addAgiEvasion"), icon: "textures/items/feather" },
    { id: "agiParry", labelKey: cappedLabel("agiParry", agiParry, "stats.addAgiParry"), icon: "textures/items/trident" },
    { id: "agiJump", labelKey: cappedLabel("agiJump", agiJump, "stats.addAgiJump"), icon: "textures/items/saddle" },
    { id: "vitHp", labelKey: cappedLabel("vitHp", vitHp, "stats.addVitHp"), icon: "textures/items/totem" },
    { id: "vitRed", labelKey: cappedLabel("vitRed", vitRed, "stats.addVitRed"), icon: "textures/items/carrot_golden" },
    { id: "vitBlock", labelKey: cappedLabel("vitBlock", vitBlock, "stats.addVitBlock"), icon: "textures/items/turtle_helmet" },
    { id: "vitThorn", labelKey: cappedLabel("vitThorn", vitThorn, "stats.addVitThorn"), icon: "textures/items/cactus" },
    { id: "vitRegen", labelKey: cappedLabel("vitRegen", vitRegen, "stats.addVitRegen"), icon: "textures/items/golden_apple" },
    { id: "reset", labelKey: "stats.resetButton", icon: ICONS.back }
  ];

  return createListMenu(player, {
    titleKey: "stats.title",
    bodyKey: "stats.body",
    bodyVars: {
      points, money,
      level, exp, expNext: expToNext(level),
      className: currentClass ? t(`stats.class.${currentClass}`) : t("stats.classNone"),
      // Affinity levels
      affinityWeapon: getAffinityLevels(player).weapon,
      affinityArmor: getAffinityLevels(player).armor,
      // combined totals (stat + affinity)
      totalAtk: round2(bonuses.attackDamageBonus + (bonuses.affinityAttackDamageBonus ?? 0)),
      totalProj: round2(bonuses.projectileDamageBonus + (bonuses.affinityProjectileDamageBonus ?? 0)),
      totalCrit: round2(bonuses.criticalChanceBonus + (bonuses.affinityCriticalChanceBonus ?? 0)),
      totalCritDmg: round2(150 + bonuses.criticalDamageBonus + (bonuses.affinityCriticalDamageBonus ?? 0)),
      totalSpd: round2(bonuses.movementSpeedBonus + (bonuses.affinityMovementSpeedBonus ?? 0)),
      totalReduce: round2(bonuses.damageReductionBonus + (bonuses.affinityDamageReductionBonus ?? 0)),
      totalLifesteal: round2(bonuses.lifestealChanceBonus + (bonuses.affinityLifestealBonus ?? 0)),
      totalThorn: round2(bonuses.thornPercentBonus),
      totalEvasion: round2(Math.min(bonuses.evasionChanceBonus + (bonuses.affinityEvasionBonus ?? 0), (STAT_CONFIG.DEFENSE_CAP_PERCENT ?? 70) / 100)),
      totalParry: round2(Math.min(bonuses.parryChanceBonus + (bonuses.affinityParryBonus ?? 0), (STAT_CONFIG.DEFENSE_CAP_PERCENT ?? 70) / 100)),
      totalBlock: round2(Math.min(bonuses.blockChanceBonus + (bonuses.affinityBlockBonus ?? 0), (STAT_CONFIG.DEFENSE_CAP_PERCENT ?? 70) / 100)),
      totalRegen: bonuses.regenerationBonus,
      totalJump: bonuses.jumpBoostBonus,
      totalExecute: bonuses.executeThresholdBonus,
      defenseCap: STAT_CONFIG.DEFENSE_CAP_PERCENT ?? 70
    },
    menuGroup: "statsMenu",
    items,
    onSelect: (item) => {
      switch (item.id) {
        case "class":
          return openClassMenu(player);
        case "strAtk":
        case "strProj":
        case "strCritDmg":
        case "strLifesteal":
        case "strExecute":
        case "agiSpd":
        case "agiCrit":
        case "agiEvasion":
        case "agiParry":
        case "agiJump":
        case "vitHp":
        case "vitRed":
        case "vitThorn":
        case "vitBlock":
        case "vitRegen":
          return openStatActionMenu(player, item.id);
        case "reset":
          return confirmReset(player);
      }
    }
    // onCancel ไม่ระบุ — ใช้ default ของ createListMenu (NavigationManager.back())
    // ถูกต้องแล้วเพราะผู้เรียกทุกทาง (mainUi.js / statCommands.js) push
    // ก่อนเข้ามาเสมอ เหมือนโมดูลอื่นที่ migrate แล้ว
  });
}

/* =========================
   EVENT WIRING
========================= */

subscribeSafe(["playerSpawn", "playerRespawn"], (event) => {
  try {
    initializePlayer(event.player);
    capStatsForNewLimits(event.player);
    applyMaxHealthBonus(event.player);
    applyRegenBonus(event.player);
    applyJumpBoostBonus(event.player);
  } catch (error) {
    console.warn("[StatSystem] spawn/respawn handler error:", error);
  }
});

/* =========================
   HELPER: คำนวณ HP% ของผู้เล่น (ใช้กับ strExecute threshold)
============================ */
function getPlayerHpPercent(player) {
  try {
    const health = player.getComponent(EntityComponentTypes.Health);
    if (!health) return 1;
    const max = typeof health.effectiveMax === "number" ? health.effectiveMax : 20;
    return max > 0 ? health.currentValue / max : 1;
  } catch {
    return 1;
  }
}

let tickCounter = 0;
system.runInterval(() => {
  tickCounter = (tickCounter + 1) % 1000000;
  for (const player of world.getPlayers()) {
    if (!isStatInitialized(player)) {
      initializePlayer(player);
    }

    // v1.4.20: cap ผู้เล่นที่ online อยู่ (เผื่อไม่ได้อยู่ในเกมตอน deploy)
    if (tickCounter % 1200 === 0) {
      capStatsForNewLimits(player);
    }

    // v1.4.21: refresh tier bonuses ทุก 1 วินาที (กรณีสลับอาวุธ/เกราะ)

    // เช็คเป็นระยะว่า buff เลือดยังอยู่ไหม (กันกรณี effect หมดอายุตอน
    // ผู้เล่นอยู่นาน ๆ) — เหมือนแนวทาง PERK refresh loop ใน jobSystem.js
    if (tickCounter % STAT_CONFIG.HEALTH_BOOST_CHECK_INTERVAL_TICKS === 0) {
      if (getVitHp(player) > 0 && player.getEffect("health_boost") === undefined) {
        applyMaxHealthBonus(player);
      }
    }

    // v1.4.15: refresh regeneration effect ทุก ๆ REGEN_CHECK_INTERVAL_TICKS
    if (tickCounter % STAT_CONFIG.VIT_REGEN.REGEN_CHECK_INTERVAL_TICKS === 0) {
      if (getVitRegen(player) > 0 && player.getEffect("regeneration") === undefined) {
        applyRegenBonus(player);
      }
    }

    // v1.4.15: refresh jump_boost effect ทุก ๆ JUMP_CHECK_INTERVAL_TICKS
    if (tickCounter % STAT_CONFIG.AGI_JUMP.JUMP_CHECK_INTERVAL_TICKS === 0) {
      if (getAgiJump(player) > 0 && player.getEffect("jump_boost") === undefined) {
        applyJumpBoostBonus(player);
      }
    }

    // v1.4.15: STR-EXECUTE — apply strength เมื่อ HP <= threshold, revoke เมื่อฟื้น
    if (tickCounter % STAT_CONFIG.STR_EXECUTE.EXECUTE_CHECK_INTERVAL_TICKS === 0) {
      const executePoints = getStrExecute(player);
      if (executePoints > 0) {
        const hpPct = getPlayerHpPercent(player);
        if (hpPct <= STAT_CONFIG.STR_EXECUTE.EXECUTE_THRESHOLD) {
          if (player.getEffect("strength") === undefined) {
            applyExecuteBonus(player);
          }
        } else if (player.getEffect("strength") !== undefined) {
          revokeBuff(player, "strength", "stat:str");
        }
      }
    }
  }
}, 20); // ทุก 1 วินาที (20 tick)
