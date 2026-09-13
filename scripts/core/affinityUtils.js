// =========================
// affinityUtils.js
// Dynamic Property ของระบบ "Affinity" — ความเชี่ยวชาญของผู้เล่น
//
// เก็บข้อมูลที่ Dynamic Property "affinity:data":
// {
//   weapon: { blade: { level, exp }, axe: {...}, ... },
//   armor: { light: { level, exp }, medium: {...}, ... }
// }
//
// Anti-farming เก็บที่ "affinity:afk":
// { hits: [{ entityId, category, tick, count }] }
//
// getStatBonuses() (statUtils.js) คือจุดที่ system อื่นใช้
// ================================================

import { AFFINITY_CONFIG } from "../config/affinityConfig";

const DATA_KEY = "affinity:data";
const AFK_KEY = "affinity:afk";

// Default affinity data structure
function defaultAffinityData() {
  const data = { weapon: {}, armor: {} };
  const WEAPON_CATS = Object.keys(AFFINITY_CONFIG.WEAPON_CATEGORIES);
  const ARMOR_CATS = Object.keys(AFFINITY_CONFIG.ARMOR_CATEGORIES);
  for (const cat of WEAPON_CATS) data.weapon[cat] = { level: 1, exp: 0 };
  for (const cat of ARMOR_CATS) data.armor[cat] = { level: 1, exp: 0 };
  return data;
}

function defaultAfkData() {
  return { hits: [] };
}

/**
 * อ่านข้อมูล affinity ทั้งหมดของผู้เล่น
 */
export function getAffinityData(player) {
  try {
    const raw = Database.get(player, DATA_KEY);
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.weapon && parsed.armor) return parsed;
    }
  } catch {}
  return defaultAffinityData();
}

/**
 * เซฟข้อมูล affinity ทั้งหมด
 */
export function setAffinityData(player, data) {
  Database.set(player, DATA_KEY, JSON.stringify(data));
}

/**
 * คืนข้อมูล affinity ของ category นั้น
 */
export function getAffinityCategory(player, type, category) {
  const data = getAffinityData(player);
  return data[type]?.[category] ?? { level: 1, exp: 0 };
}

/**
 * เซฟข้อมูล affinity ของ category นั้น
 */
export function setAffinityCategory(player, type, category, entry) {
  const data = getAffinityData(player);
  if (!data[type]) data[type] = {};
  data[type][category] = entry;
  setAffinityData(player, data);
}

/**
 * คืน level ของ affinity category
 */
export function getAffinityLevel(player, type, category) {
  return getAffinityCategory(player, type, category).level ?? 1;
}

/**
 * คืน exp ของ affinity category
 */
export function getAffinityExp(player, type, category) {
  return getAffinityCategory(player, type, category).exp ?? 0;
}

/**
 * เพิ่ม EXP ให้ affinity category คืนค่า { level, exp, leveledUp }
 */
export function addAffinityExp(player, type, category, expAmount) {
  if (!expAmount || expAmount <= 0) return { level: 1, exp: 0, leveledUp: false };

  const data = getAffinityData(player);
  if (!data[type]) data[type] = {};
  if (!data[type][category]) data[type][category] = { level: 1, exp: 0 };

  const entry = data[type][category];
  const expToNext = expToNextLevel(entry.level);
  entry.exp += expAmount;

  let leveledUp = false;
  while (entry.exp >= expToNext && entry.level < 50) {
    entry.exp -= expToNext;
    entry.level += 1;
    leveledUp = true;
    const nextExp = expToNextLevel(entry.level);
    if (entry.exp < nextExp) break;
    expToNext = nextExp;
  }

  // cap level at 50
  if (entry.level > 50) entry.level = 50;

  setAffinityData(player, data);
  return { level: entry.level, exp: entry.exp, leveledUp };
}

/**
 * expToNextLevel - คำนวณ EXP ที่ต้องใช้ในการเลเวลอัพถัดไป
 * expToNext(level) = floor(BASE * level^EXPONENT)
 */
export function expToNextLevel(level) {
  return Math.floor(AFFINITY_CONFIG.EXP.BASE * Math.pow(level, AFFINITY_CONFIG.EXP.EXPONENT));
}

/**
 * คืน progress เป็น % (0-100) ของ affinity category นั้น
 */
export function getAffinityProgress(player, type, category) {
  const entry = getAffinityCategory(player, type, category);
  const expToNext = expToNextLevel(entry.level);
  if (expToNext <= 0) return 100;
  const progress = Math.min(100, Math.round((entry.exp / expToNext) * 100));
  return progress;
}

// =========================
// ANTI-FARMING
// =========================

/**
 * บันทึกการโจมตี entity สำหรับ anti-farming
 */
export function recordAffinityHit(player, category, entityId) {
  try {
    const raw = Database.get(player, AFK_KEY);
    let afk = typeof raw === "string" ? JSON.parse(raw) : defaultAfkData();
    const now = Date.now();

    // เพิ่ม entry
    afk.hits.push({ entityId, category, tick: now });

    // เก็บเฉพาะ 10 ตัวล่าสุด
    if (afk.hits.length > AFFINITY_CONFIG.ANTI_FARM.maxTrackEntities) {
      afk.hits = afk.hits.slice(-AFFINITY_CONFIG.ANTI_FARM.maxTrackEntities);
    }

    Database.set(player, AFK_KEY, JSON.stringify(afk));
  } catch {}
}

/**
 * คำนวณ multiplier สำหรับ anti-farming
 * คืน { multiplier, shouldSkip }
 */
export function getAntiFarmMultiplier(player, category, entityId) {
  try {
    const raw = Database.get(player, AFK_KEY);
    if (!raw) return { multiplier: 1, shouldSkip: false };
    const afk = JSON.parse(raw);
    const now = Date.now();

    // นับครั้งที่โจมตี entity เดียวกันในช่วง recent
    const recentHits = afk.hits.filter(
      h => h.entityId === entityId && h.category === category && (now - h.tick) < 60000
    );
    const count = recentHits.length;

    const dr = AFFINITY_CONFIG.ANTI_FARM.diminishingReturns;
    let multiplier = 1;
    for (const [threshold, mult] of dr) {
      if (count >= threshold) multiplier = mult;
    }

    // ถ้าโจมตี entity เดียวกัน > 10 ครั้งใน 1 นาที → skip
    const shouldSkip = count >= 10;

    return { multiplier, shouldSkip };
  } catch {
    return { multiplier: 1, shouldSkip: false };
  }
}

/**
 * คืน cooldown ที่เหลือ (ticks) สำหรับ affinity gain
 */
export function getAffinityCooldownRemaining(player, category) {
  try {
    const raw = Database.get(player, AFK_KEY);
    if (!raw) return 0;
    const afk = JSON.parse(raw);
    const now = Date.now();
    const lastHit = afk.hits
      .filter(h => h.category === category)
      .sort((a, b) => b.tick - a.tick)[0];
    if (!lastHit) return 0;
    const elapsed = now - lastHit.tick;
    const cooldownMs = AFFINITY_CONFIG.ANTI_FARM.cooldownTicks * 50; // 20 ticks * 50ms
    return Math.max(0, Math.ceil((cooldownMs - elapsed) / 50)); // ticks
  } catch {
    return 0;
  }
}

/**
 * ลบ anti-farming data ของผู้เล่น (ใช้ตอน migrate)
 */
export function clearAfkData(player) { Database.set(player, AFK_KEY, JSON.stringify(defaultAfkData())); }

// =========================
// STAT GROWTH CALCULATION
// =========================

/**
 * คำนวณ stat growth bonus ทั้งหมดจาก affinity ทั้งหมด
 * คืน { strBonus, agiBonus, vitBonus }
 */
export function calculateStatGrowth(player) {
  let strBonus = 0, agiBonus = 0, vitBonus = 0;
  const data = getAffinityData(player);

  // Weapon stat growth
  const weaponGrowth = AFFINITY_CONFIG.STAT_GROWTH;
  for (const [category, entry] of Object.entries(data.weapon || {})) {
    const growthList = weaponGrowth[category];
    if (!growthList) continue;
    for (const milestone of growthList) {
      if (entry.level >= milestone.level) {
        strBonus += milestone.strBonus ?? 0;
        agiBonus += milestone.agiBonus ?? 0;
        vitBonus += milestone.vitBonus ?? 0;
      }
    }
  }

  // Armor stat growth
  for (const [category, entry] of Object.entries(data.armor || {})) {
    const growthList = weaponGrowth[category];
    if (!growthList) continue;
    for (const milestone of growthList) {
      if (entry.level >= milestone.level) {
        strBonus += milestone.strBonus ?? 0;
        agiBonus += milestone.agiBonus ?? 0;
        vitBonus += milestone.vitBonus ?? 0;
      }
    }
  }

  return { strBonus, agiBonus, vitBonus };
}

/**
 * คำนวณ passive bonuses ทั้งหมดจาก affinity ทั้งหมด
 * คืน object ที่มี field ตรงกับ getStatBonuses() fields
 */
export function calculatePassiveBonuses(player) {
  const bonuses = {};
  const data = getAffinityData(player);

  // Weapon passives
  for (const [category, entry] of Object.entries(data.weapon || {})) {
    const passives = AFFINITY_CONFIG.PASSIVES[category];
    if (!passives) continue;
    for (const milestone of passives) {
      if (entry.level >= milestone.level) {
        for (const [field, value] of Object.entries(milestone.bonuses)) {
          bonuses[field] = (bonuses[field] ?? 0) + value;
        }
      }
    }
  }

  // Armor passives
  for (const [category, entry] of Object.entries(data.armor || {})) {
    const passives = AFFINITY_CONFIG.PASSIVES[category];
    if (!passives) continue;
    for (const milestone of passives) {
      if (entry.level >= milestone.level) {
        for (const [field, value] of Object.entries(milestone.bonuses)) {
          bonuses[field] = (bonuses[field] ?? 0) + value;
        }
      }
    }
  }

  return bonuses;
}