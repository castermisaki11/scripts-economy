// =========================
// statUtils.js
// Dynamic Property ของระบบ "จัดสรรแต้มสเตตัส" (RPG Stat Allocation) —
// สเตตัสย่อยทั้งหมด + แต้มคงเหลือ + เลเวล/EXP + คลาส (v1.4.0) ต่อผู้เล่น
// (per-entity Dynamic Property) ลงแต้มแยกอิสระจากกัน
//
// จุดเดียวที่อ่าน/เขียน Dynamic Property คีย์ "rpg:*" — systems/statSystem.js
// (เมนู/คำสั่ง) เรียกฟังก์ชันจากไฟล์นี้เท่านั้น เช่นเดียวกับ economyUtils.js
// ที่ระบบเศรษฐกิจอื่นเรียกใช้ร่วมกัน
//
// getStatBonuses() คือจุดที่ระบบอื่น (ดาเมจ/ความเร็ว) import ไปใช้ —
// shape ของ object เดิมคงเดิม และ v1.4.0 เพิ่ม field:
//   lifestealChanceBonus / thornPercentBonus
// การ apply: โบนัสจากแต้มถูก clamp ด้วย MAX_PERCENT ของสเตตัสนั้นก่อนเสมอ
// จากนั้นคูณ Class Multiplier (หมวดที่คลาสถนัด ×1.25) แล้วบวก Perk ฟลัต
// ประจำคลาสท้ายสุด — ทุกขั้นอยู่ในฟังก์ชันนี้จุดเดียว เมนูโชว์ตัวเลขเดียวกับ
// ที่สูตรดาเมจจริงใช้เสมอ (combatAttributes.js อ่านจากที่นี่)
// =========================

import { STAT_CONFIG } from "../config/statConfig";
import { system } from "@minecraft/server";
import { subscribeSafe } from "./eventGuard";
import { getAffinityBonuses } from "../systems/affinitySystem";

// Per-player per-tick cache
const statBonusCache = new Map();

subscribeSafe(["playerLeave"], (event) => {
  try {
    statBonusCache.delete(event.playerId);
  } catch (error) {
    console.warn("[StatUtils] playerLeave handler error:", error);
  }
}, "StatUtils");

const KEY = {
  strAtk: "rpg:strAtk",
  strProj: "rpg:strProj",
  agiSpd: "rpg:agiSpd",
  agiCrit: "rpg:agiCrit",
  vitHp: "rpg:vitHp",
  vitRed: "rpg:vitRed",
  strCritDmg: "rpg:strCritDmg",
  agiEvasion: "rpg:agiEvasion",
  agiParry: "rpg:agiParry",
  vitBlock: "rpg:vitBlock",
  strLifesteal: "rpg:strLifesteal",
  vitThorn: "rpg:vitThorn",
  vitRegen: "rpg:vitRegen",
  agiJump: "rpg:agiJump",
  strExecute: "rpg:strExecute",
  points: "rpg:points",
  initialized: "rpg:initialized",
  level: "rpg:level",
  exp: "rpg:exp",
  playerClass: "rpg:class"
};

export const STAT_GROUP = {
  strAtk: "str", strProj: "str", strCritDmg: "str", strLifesteal: "str", strExecute: "str",
  agiSpd: "agi", agiCrit: "agi", agiEvasion: "agi", agiParry: "agi", agiJump: "agi",
  vitHp: "vit", vitRed: "vit", vitBlock: "vit", vitThorn: "vit", vitRegen: "vit"
};

function getNumber(player, key) {
  const raw = Database.get(player, key);
  return typeof raw === "number" ? raw : 0;
}

export function getStrAtk(player) { return getNumber(player, KEY.strAtk); }
export function getStrProj(player) { return getNumber(player, KEY.strProj); }
export function getAgiSpd(player) { return getNumber(player, KEY.agiSpd); }
export function getAgiCrit(player) { return getNumber(player, KEY.agiCrit); }
export function getVitHp(player) { return getNumber(player, KEY.vitHp); }
export function getVitRed(player) { return getNumber(player, KEY.vitRed); }
export function getStrCritDmg(player) { return getNumber(player, KEY.strCritDmg); }
export function getAgiEvasion(player) { return getNumber(player, KEY.agiEvasion); }
export function getAgiParry(player) { return getNumber(player, KEY.agiParry); }
export function getVitBlock(player) { return getNumber(player, KEY.vitBlock); }
export function getStrLifesteal(player) { return getNumber(player, KEY.strLifesteal); }
export function getVitThorn(player) { return getNumber(player, KEY.vitThorn); }
export function getVitRegen(player) { return getNumber(player, KEY.vitRegen); }
export function getAgiJump(player) { return getNumber(player, KEY.agiJump); }
export function getStrExecute(player) { return getNumber(player, KEY.strExecute); }
export function getPoints(player) { return getNumber(player, KEY.points); }

export function getLevel(player) { return Math.max(1, getNumber(player, KEY.level) || 1); }
export function getExp(player) { return getNumber(player, KEY.exp); }

/** คลาสปัจจุบัน ("warrior"/"archer"/"adventurer") — null ถ้ายังไม่เคยเลือก */
export function getPlayerClass(player) {
  const raw = Database.get(player, KEY.playerClass);
  return typeof raw === "string" && STAT_CONFIG.CLASS.CLASSES[raw] ? raw : null;
}

export function setStrAtk(player, value) { Database.set(player, KEY.strAtk, value); }
export function setStrProj(player, value) { Database.set(player, KEY.strProj, value); }
export function setAgiSpd(player, value) { Database.set(player, KEY.agiSpd, value); }
export function setAgiCrit(player, value) { Database.set(player, KEY.agiCrit, value); }
export function setVitHp(player, value) { Database.set(player, KEY.vitHp, value); }
export function setVitRed(player, value) { Database.set(player, KEY.vitRed, value); }
export function setStrCritDmg(player, value) { Database.set(player, KEY.strCritDmg, value); }
export function setAgiEvasion(player, value) { Database.set(player, KEY.agiEvasion, value); }
export function setAgiParry(player, value) { Database.set(player, KEY.agiParry, value); }
export function setVitBlock(player, value) { Database.set(player, KEY.vitBlock, value); }
export function setStrLifesteal(player, value) { Database.set(player, KEY.strLifesteal, value); }
export function setVitThorn(player, value) { Database.set(player, KEY.vitThorn, value); }
export function setVitRegen(player, value) { Database.set(player, KEY.vitRegen, value); }
export function setAgiJump(player, value) { Database.set(player, KEY.agiJump, value); }
export function setStrExecute(player, value) { Database.set(player, KEY.strExecute, value); }
export function setPoints(player, value) { Database.set(player, KEY.points, value); }
export function markStatInitialized(player) { Database.set(player, KEY.initialized, 1); }

export function isStatInitialized(player) {
  return getNumber(player, KEY.initialized) === 1;
}

export function setLevelState(player, level, exp) {
  Database.set(player, KEY.level, Math.max(1, Math.floor(level)));
  Database.set(player, KEY.exp, Math.max(0, Math.floor(exp)));
}

export function setPlayerClass(player, classId) {
  if (!STAT_CONFIG.CLASS.CLASSES[classId]) return false;
  Database.set(player, KEY.playerClass, classId);
  return true;
}

// clamp % bonus ตามเพดานของสเตตัส (MAX_PERCENT) — undefined = ไม่มีเพดาน
function clampPercent(rawBonus, maxPercent) {
  return maxPercent != null ? Math.min(rawBonus, maxPercent) : rawBonus;
}

/**
 * โบนัสทั้งหมดจากแต้มสเตตัสย่อย + คลาส (v1.4.0) ของผู้เล่น — คำนวณสดจากค่า
 * ที่เก็บไว้เสมอ ไม่แคช
 *
 * ลำดับคำนวณต่อ 1 โบนัส: points*perPoint -> clamp(MAX_PERCENT) ->
 * ×Class Multiplier (ถ้าคลาสถนัดหมวดนั้น) -> +Perk ฟลัตประจำคลาส
 * @param {import("@minecraft/server").Player} player
 */
export function getStatBonuses(player) {
  // Per-tick cache — dynamic properties ไม่เปลี่ยนภายใน tick เดียว
  const cached = statBonusCache.get(player.id);
  if (cached && cached.tick === system.currentTick) return cached.bonuses;

  const classId = getPlayerClass(player);
  const groupMult = {};
  for (const key of Object.keys(STAT_CONFIG.CLASS.CLASSES)) {
    if (key !== classId) continue;
    for (const group of STAT_CONFIG.CLASS.CLASSES[key].groups) {
      groupMult[group] = STAT_CONFIG.CLASS.MULTIPLIER_VALUE;
    }
  }

  const bonus = (statKey, config, perPointField) => {
    const raw = getNumber(player, KEY[statKey]) * config[perPointField];
    const clamped = clampPercent(raw, config.MAX_PERCENT);
    return clamped * (groupMult[STAT_GROUP[statKey]] ?? 1);
  };

  const perks = classId ? (STAT_CONFIG.CLASS.PERKS[classId] ?? {}) : {};

  // Affinity bonuses (from affinitySystem.js)
  const affinityBonuses = getAffinityBonuses(player);
  const statGrowth = {
    strBonus: affinityBonuses.strBonus ?? 0,
    agiBonus: affinityBonuses.agiBonus ?? 0,
    vitBonus: affinityBonuses.vitBonus ?? 0
  };

  const result = {
    attackDamageBonus: bonus("strAtk", STAT_CONFIG.STR_ATK, "ATTACK_DAMAGE_PER_POINT"),
    projectileDamageBonus: bonus("strProj", STAT_CONFIG.STR_PROJ, "PROJECTILE_DAMAGE_PER_POINT"),
    movementSpeedBonus: bonus("agiSpd", STAT_CONFIG.AGI_SPD, "MOVEMENT_SPEED_PER_POINT"),
    criticalChanceBonus:
      bonus("agiCrit", STAT_CONFIG.AGI_CRIT, "CRITICAL_CHANCE_PER_POINT") +
      (perks.criticalChanceBonusPercent ?? 0),
    maxHealthBonus: bonus("vitHp", STAT_CONFIG.VIT_HP, "MAX_HEALTH_PER_POINT"),
    damageReductionBonus: bonus("vitRed", STAT_CONFIG.VIT_RED, "DAMAGE_REDUCTION_PER_POINT"),
    criticalDamageBonus: bonus("strCritDmg", STAT_CONFIG.STR_CRITDMG, "CRITICAL_DAMAGE_PER_POINT"),
    evasionChanceBonus: bonus("agiEvasion", STAT_CONFIG.AGI_EVASION, "EVASION_CHANCE_PER_POINT"),
    parryChanceBonus: bonus("agiParry", STAT_CONFIG.AGI_PARRY, "PARRY_CHANCE_PER_POINT"),
    blockChanceBonus: bonus("vitBlock", STAT_CONFIG.VIT_BLOCK, "BLOCK_CHANCE_PER_POINT"),

    lifestealChanceBonus:
      bonus("strLifesteal", STAT_CONFIG.STR_LIFESTEAL, "LIFESTEAL_PER_POINT") +
      (perks.lifestealChanceBonus ?? 0),
    thornPercentBonus:
      bonus("vitThorn", STAT_CONFIG.VIT_THORN, "THORN_PER_POINT") +
      (perks.thornPercentBonus ?? 0),

    regenerationBonus: bonus("vitRegen", STAT_CONFIG.VIT_REGEN, "HEALTH_PER_POINT"),
    jumpBoostBonus: bonus("agiJump", STAT_CONFIG.AGI_JUMP, "JUMP_BOOST_PER_POINT"),
    executeThresholdBonus: bonus("strExecute", STAT_CONFIG.STR_EXECUTE, "EXECUTE_PER_POINT"),

    // Affinity bonuses (v1.5.0)
    affinityStrBonus: statGrowth.strBonus,
    affinityAgiBonus: statGrowth.agiBonus,
    affinityVitBonus: statGrowth.vitBonus,
    affinityAttackSpeedBonus: affinityBonuses.affinityAttackSpeedBonus ?? 0,
    affinityCriticalChanceBonus: affinityBonuses.criticalChanceBonus ?? 0,
    affinityCriticalDamageBonus: affinityBonuses.criticalDamageBonus ?? 0,
    affinityLifestealBonus: affinityBonuses.lifestealChanceBonus ?? 0,
    affinityAttackDamageBonus: affinityBonuses.attackDamageBonus ?? 0,
    affinityProjectileDamageBonus: affinityBonuses.projectileDamageBonus ?? 0,
    affinityMovementSpeedBonus: affinityBonuses.movementSpeedBonus ?? 0,
    affinityEvasionBonus: affinityBonuses.evasionChanceBonus ?? 0,
    affinityBlockBonus: affinityBonuses.blockChanceBonus ?? 0,
    affinityDamageReductionBonus: affinityBonuses.damageReductionBonus ?? 0,
    affinityMaxHealthBonus: affinityBonuses.maxHealthBonus ?? 0,
    affinityParryBonus: affinityBonuses.parryChanceBonus ?? 0
  };

  statBonusCache.set(player.id, { tick: system.currentTick, bonuses: result });
  return result;
}
