// =========================
// quests/storage.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ STORAGE) แบบคงเดิมทุกประการ
//
// เก็บข้อมูลผู้เล่น: dynamic property เดียว "questData" (JSON) ต่อผู้เล่น —
// คีย์เดิมจาก Bounty-only เวอร์ชันก่อนหน้า ยังใช้คีย์เดิมเพื่อให้
// migrateQuestData() อ่านข้อมูลเก่าต่อได้
//
// World backup: mirror ข้อมูลลง world dynamic property อัตโนมัติทุกครั้งที่เซฟ
// เพื่อให้ข้อมูลอยู่รอดกรณี player-level dynamic property หายไป (ลบแอดออนแล้วติดตั้งใหม่)
// =========================

import { world } from "@minecraft/server";
import { isValidChainId } from "../../data/questChains";

export const QUEST_DYNAMIC_PROPERTY_KEY = "questData";
const WORLD_QUEST_BACKUP_PREFIX = "backup_quest_";

/* =========================
   Default Shapes
========================= */

export function defaultLifetime() {
  return {
    mine: 0,
    kill: 0,
    sell: 0,
    buy: 0,
    marketSell: 0,
    jobExpGained: 0,
    jobLevelUps: 0,
    questsCompleted: 0,
    moneyRewardEarned: 0
  };
}

export function defaultQuestData() {
  return {
    bounty: { active: null, lastRolledAt: 0 },
    daily: { bangkokDay: null, slots: [], freeRerollsUsed: 0 },
    weekly: { bangkokWeek: null, slots: [], freeRerollsUsed: 0 },
    achievements: { unlocked: [] },
    chains: { active: {}, completed: [] },
    lifetime: defaultLifetime()
  };
}

/* =========================
   Defensive Sanitizers
   ทุกฟังก์ชันด้านล่างต้องไม่ throw ไม่ว่า raw จะเป็นข้อมูลอะไรก็ตาม (รองรับ
   Dynamic Property ที่เสียหาย/ถูกแก้จากภายนอก) — คืน Default ที่ปลอดภัยเสมอ
========================= */

// รางวัลของเควส 1 อัน — Phase 2: เปลี่ยนจากตัวเลขล้วน (เงินอย่างเดียว) เป็น
// { money, exp } (เพิ่ม exp ส่งเข้าอาชีพปัจจุบันตอนเควสสำเร็จ) รองรับข้อมูล
// เก่าจาก Phase 1 ที่ reward ยังเป็นตัวเลขล้วนอยู่ (ห่อเป็น { money, exp: 0 }
// อัตโนมัติ — ไม่มี exp ย้อนหลัง เพราะของเก่าไม่เคยมีค่านี้)
function sanitizeReward(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return { money: Math.floor(raw), exp: 0 };
  }
  if (raw && typeof raw === "object") {
    const money = typeof raw.money === "number" && Number.isFinite(raw.money) && raw.money >= 0
      ? Math.floor(raw.money)
      : 0;
    const exp = typeof raw.exp === "number" && Number.isFinite(raw.exp) && raw.exp >= 0
      ? Math.floor(raw.exp)
      : 0;
    return { money, exp };
  }
  return { money: 0, exp: 0 };
}

// เควส 1 อัน (ใช้ทั้ง bounty.active และสมาชิกใน daily.slots/weekly.slots)
function sanitizeQuestObject(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.type !== "string" || raw.type.length === 0) return null;
  if (raw.targetId !== null && typeof raw.targetId !== "string") return null;
  if (typeof raw.amountRequired !== "number" || !Number.isFinite(raw.amountRequired) || raw.amountRequired <= 0) {
    return null;
  }

  // เวอร์ชันก่อนเคยมี market_list ที่นับทันทีตอนผู้ขายกดลงรายการ
  // ทำให้เควสจบทั้งที่ยังไม่มีผู้ซื้อเลย จึงย้ายเควสค้างที่ยังไม่จบให้เป็น
  // market_sell และเริ่มนับใหม่จากการขายออกจริงเท่านั้น
  const isLegacyMarketList = raw.type === "market_list";
  const wasCompleted = raw.completed === true;

  return {
    type: isLegacyMarketList ? "market_sell" : raw.type,
    targetId: raw.targetId,
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : undefined,
    amountRequired: Math.floor(raw.amountRequired),
    amountProgress:
      isLegacyMarketList
        ? wasCompleted
          ? Math.floor(raw.amountRequired)
          : 0
        : typeof raw.amountProgress === "number" && Number.isFinite(raw.amountProgress) && raw.amountProgress >= 0
          ? Math.floor(raw.amountProgress)
          : 0,
    reward: sanitizeReward(raw.reward),
    completed: wasCompleted
  };
}

// รายการเควสใน slots (daily/weekly) — ตัดรายการที่เสียทิ้งเงียบ ๆ (ไม่ throw)
function sanitizeSlots(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeQuestObject).filter((q) => q !== null);
}

// สถานะสายเควส 1 สาย (chains.active[chainId]) — null ถ้าข้อมูลเสีย
function sanitizeChainState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const stage =
    typeof raw.stage === "number" && Number.isFinite(raw.stage) && raw.stage >= 0 ? Math.floor(raw.stage) : 0;
  const progress =
    typeof raw.progress === "number" && Number.isFinite(raw.progress) && raw.progress >= 0
      ? Math.floor(raw.progress)
      : 0;
  return { stage, progress };
}

// chains.active ทั้งก้อน — Phase 3C: ตัดทั้ง (1) chainId ที่ไม่รู้จักใน
// data/questChains.js อีกต่อไปแล้ว (เช่น เนื้อหาถูกลบออกภายหลัง) และ (2)
// state ที่ shape เสีย ทิ้งเงียบ ๆ ทั้งคู่ (ไม่ throw — ตามหลัก Anti-Abuse
// ข้อ 8 ที่ readQuestData ต้องทนข้อมูลเพี้ยนได้เสมอ)
function sanitizeChainsActive(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result = {};
  for (const [chainId, state] of Object.entries(raw)) {
    if (!isValidChainId(chainId)) continue;
    const sanitized = sanitizeChainState(state);
    if (sanitized) result[chainId] = sanitized;
  }
  return result;
}

// ย้าย/แปลงข้อมูลเก่าให้เป็น Shape ปัจจุบันเสมอ — รองรับทั้งกรณี:
//   1) raw ไม่มีเลย / parse ไม่ได้ -> Default ทั้งหมด
//   2) raw เป็น Shape เดิมของระบบก่อน Phase 1 ({ active, lastRolledAt }) ->
//      ห่อเป็น bounty section (Bounty ที่กำลังทำอยู่ต้องไม่หาย)
//   3) raw เป็น Shape ใหม่อยู่แล้ว (อาจไม่ครบทุก field เพราะเวอร์ชันเก่ากว่า
//      ของ Phase 1 เอง) -> เติม field ที่ขาดด้วย Default อย่างปลอดภัย
export function migrateQuestData(raw) {
  if (!raw || typeof raw !== "object") return defaultQuestData();

  const isLegacyBountyOnlyShape = !raw.bounty && ("active" in raw || "lastRolledAt" in raw);
  const bountySource = isLegacyBountyOnlyShape ? raw : raw.bounty;

  const bounty = {
    active: sanitizeQuestObject(bountySource?.active),
    lastRolledAt:
      typeof bountySource?.lastRolledAt === "number" && Number.isFinite(bountySource.lastRolledAt)
        ? bountySource.lastRolledAt
        : 0
  };

  const daily = {
    bangkokDay:
      typeof raw.daily?.bangkokDay === "number" && Number.isFinite(raw.daily.bangkokDay)
        ? raw.daily.bangkokDay
        : null,
    slots: sanitizeSlots(raw.daily?.slots),
    freeRerollsUsed:
      typeof raw.daily?.freeRerollsUsed === "number" && raw.daily.freeRerollsUsed >= 0
        ? Math.floor(raw.daily.freeRerollsUsed)
        : 0
  };

  const weekly = {
    bangkokWeek:
      typeof raw.weekly?.bangkokWeek === "number" && Number.isFinite(raw.weekly.bangkokWeek)
        ? raw.weekly.bangkokWeek
        : null,
    slots: sanitizeSlots(raw.weekly?.slots),
    freeRerollsUsed:
      typeof raw.weekly?.freeRerollsUsed === "number" && raw.weekly.freeRerollsUsed >= 0
        ? Math.floor(raw.weekly.freeRerollsUsed)
        : 0
  };

  const achievements = {
    unlocked: Array.isArray(raw.achievements?.unlocked)
      ? raw.achievements.unlocked.filter((id) => typeof id === "string")
      : []
  };

  const chains = {
    active: sanitizeChainsActive(raw.chains?.active),
    completed: Array.isArray(raw.chains?.completed)
      ? raw.chains.completed.filter((id) => typeof id === "string")
      : []
  };

  const fallbackLifetime = defaultLifetime();
  const lifetime = {};
  for (const key of Object.keys(fallbackLifetime)) {
    const value = raw.lifetime?.[key];
    lifetime[key] = typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }

  return { bounty, daily, weekly, achievements, chains, lifetime };
}

/**
 * อ่านข้อมูลเควสของผู้เล่น
 *
 * Recovery: ถ้า player-level data หาย ลองดึงจาก world backup (per-player key) แล้ว restore กลับ
 */
export function readQuestData(player) {
  const defaultData = defaultQuestData();
  try {
    const raw = player.getDynamicProperty(QUEST_DYNAMIC_PROPERTY_KEY);
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      const migrated = migrateQuestData(parsed);
      // เช็คว่ามีข้อมูลจริง (ไม่ใช่ default ทั้งหมด)
      if (
        migrated.bounty.active !== null ||
        migrated.daily.slots.length > 0 ||
        migrated.weekly.slots.length > 0 ||
        migrated.achievements.unlocked.length > 0 ||
        Object.keys(migrated.chains.active).length > 0 ||
        migrated.chains.completed.length > 0 ||
        Object.values(migrated.lifetime).some((v) => v > 0)
      ) {
        return migrated;
      }
    }
  } catch {
    // player-level data เสีย — ลอง recovery จาก world backup
  }

  // Player-level ว่าง/เสีย — ลองดึงจาก world backup (per-player key)
  try {
    const backupKey = WORLD_QUEST_BACKUP_PREFIX + /** @type {string} */ (player.id);
    const backupRaw = world.getDynamicProperty(backupKey);
    if (typeof backupRaw === "string") {
      const entry = JSON.parse(backupRaw);
      if (entry && typeof entry === "object") {
        const migrated = migrateQuestData(entry);
        // มีข้อมูลจริง — restore กลับไป player-level
        if (
          migrated.bounty.active !== null ||
          migrated.daily.slots.length > 0 ||
          migrated.weekly.slots.length > 0 ||
          migrated.achievements.unlocked.length > 0 ||
          Object.keys(migrated.chains.active).length > 0 ||
          migrated.chains.completed.length > 0 ||
          Object.values(migrated.lifetime).some((v) => v > 0)
        ) {
          player.setDynamicProperty(QUEST_DYNAMIC_PROPERTY_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    }
  } catch {
    // world backup 也เสีย — คืน default
  }

  return defaultData;
}

/**
 * เซฟข้อมูลเควสลง player-level dynamic property
 * พร้อม mirror ไป world backup (per-player key) อัตโนมัติ
 */
export function saveQuestData(player, data) {
  if (!player?.isValid) return;
  const serialized = JSON.stringify(data);
  player.setDynamicProperty(QUEST_DYNAMIC_PROPERTY_KEY, serialized);

  // Mirror ไป world backup (per-player key)
  try {
    const backupKey = WORLD_QUEST_BACKUP_PREFIX + /** @type {string} */ (player.id);
    world.setDynamicProperty(backupKey, serialized);
  } catch {
    // world backup เขียนไม่ได้ — ไม่เป็นไร player-level ยังอยู่
  }
}
