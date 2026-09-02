// =========================
// quests/generation.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ RANDOM HELPERS / BOUNTY QUEST
// GENERATION / GENERIC QUEST GENERATION) แบบคงเดิมทุกประการ
// =========================

import { QUEST_CONFIG } from "../../config/questConfig";
import { MINE_POOL, KILL_POOL } from "../../data/quests";
import { getItemsByCategory, getSellPrice } from "../../data/items";
import {
  getObjective,
  getObjectiveTypes,
  hasAvailableTargets
} from "../../data/questObjectives";

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================
   BOUNTY QUEST GENERATION (เดิม — ไม่เปลี่ยนพฤติกรรม)
   ใช้ QUEST_CONFIG.TYPES (Config เดิมของ Bounty) ไม่ใช่ระบบ Difficulty ใหม่
========================= */

// รายชื่อประเภทเควส Bounty ที่เปิดใช้งานอยู่จริง (QUEST_CONFIG.TYPES.*.enabled)
function enabledBountyTypes() {
  return Object.entries(QUEST_CONFIG.TYPES)
    .filter(([, cfg]) => cfg.enabled)
    .map(([type]) => type);
}

// สุ่มเควส Bounty ใหม่ 1 อัน — คืน null ถ้าไม่มีเป้าหมายให้สุ่มได้เลย (เช่น
// pool ว่างหรือปิดทุกประเภท) กันเควสพังไม่มีเป้าหมาย
export function generateBountyQuest() {
  const types = enabledBountyTypes();
  if (types.length === 0) return null;

  const type = pickRandom(types);
  const typeConfig = QUEST_CONFIG.TYPES[type];

  let targetId;
  if (type === "mine") {
    targetId = pickRandom(MINE_POOL);
  } else if (type === "kill") {
    targetId = pickRandom(KILL_POOL);
  } else if (type === "sell") {
    // ดึงจากฐานข้อมูลไอเทมกลางตรง ๆ (data/items.js) — ไม่มีตารางแยกของตัวเอง
    const sellable = getItemsByCategory().filter((id) => getSellPrice(id) > 0);
    if (sellable.length === 0) return null;
    targetId = pickRandom(sellable);
  } else {
    return null;
  }

  if (!targetId) return null;

  return {
    type,
    targetId,
    amountRequired: randomInt(typeConfig.minAmount, typeConfig.maxAmount),
    amountProgress: 0,
    // Phase 2: reward.money สุ่มจากช่วงเดิม (QUEST_CONFIG.REWARD.MIN/MAX_MONEY)
    // เป๊ะ ๆ ไม่เปลี่ยนแปลงจาก Phase 1 — reward.exp เป็นของใหม่ที่เพิ่มเข้ามา
    // เฉย ๆ (ดู grantQuestReward()) ไม่กระทบมูลค่า/ข้อความเงินรางวัลเดิมเลย
    reward: {
      money: randomInt(QUEST_CONFIG.REWARD.MIN_MONEY, QUEST_CONFIG.REWARD.MAX_MONEY),
      exp: randomInt(QUEST_CONFIG.REWARD.MIN_EXP, QUEST_CONFIG.REWARD.MAX_EXP)
    },
    completed: false
  };
}

/* =========================
   GENERIC QUEST GENERATION (Data-driven จาก data/questObjectives.js)
   ใช้กับ Daily/Weekly (และ Chain ในอนาคต) — ไม่ใช้กับ Bounty
========================= */

export function questKey(quest) {
  return `${quest.type}:${quest.targetId}`;
}

function pickTargetForType(type) {
  const objective = getObjective(type);
  if (!objective) return undefined;
  const pool = objective.getPool();
  if (!Array.isArray(pool) || pool.length === 0) return undefined;
  return pickRandom(pool);
}

/**
 * สุ่มเควส 1 อันของ type/difficulty ที่ระบุ โดยดึงเป้าหมาย+ช่วงจำนวนจาก
 * QUEST_OBJECTIVES[type] (data/questObjectives.js) ล้วน ๆ — ไม่มี if/else
 * แยกตาม type ในฟังก์ชันนี้ คืน null ถ้า type ไม่รู้จักหรือ pool ว่าง
 */
export function generateQuest(type, difficulty = "normal") {
  const objective = getObjective(type);
  if (!objective) return null;

  const targetId = pickTargetForType(type);
  if (targetId === undefined) return null;

  const diffConfig = QUEST_CONFIG.DIFFICULTY[difficulty] ?? QUEST_CONFIG.DIFFICULTY.normal;
  const amountRequired = randomInt(objective.amountRange.min, objective.amountRange.max);

  const baseMoney = randomInt(QUEST_CONFIG.REWARD_BASE.MIN_MONEY, QUEST_CONFIG.REWARD_BASE.MAX_MONEY);
  const baseExp = randomInt(QUEST_CONFIG.REWARD_BASE.MIN_EXP, QUEST_CONFIG.REWARD_BASE.MAX_EXP);

  return {
    type,
    targetId,
    difficulty,
    amountRequired,
    amountProgress: 0,
    reward: {
      money: Math.max(1, Math.round(baseMoney * diffConfig.multiplier)),
      exp: Math.max(0, Math.round(baseExp * diffConfig.multiplier))
    },
    completed: false
  };
}

/**
 * สุ่มเควส 1 อันที่ "ไม่ซ้ำ" กับ excludeKeys (รูปแบบ "type:targetId" —
 * ดู questKey()) ใช้ตอนสุ่มหลาย Slot ในรอบเดียวกัน (Daily/Weekly) กันสุ่ม
 * เป้าหมายเดียวกันซ้ำในรอบ ถ้าลองครบจำนวนครั้งแล้วยังไม่เจอที่ไม่ซ้ำ (pool
 * เหลือไม่พอจริง ๆ) จะคืนค่า Duplicate เป็น Fallback แทนที่จะคืน null
 */
export function generateUniqueQuest(difficulty, excludeKeys = [], types = getObjectiveTypes()) {
  const excludeSet = new Set(excludeKeys);
  const candidateTypes = types.filter((type) => hasAvailableTargets(type));
  if (candidateTypes.length === 0) return null;

  let fallback = null;
  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const type = pickRandom(candidateTypes);
    const quest = generateQuest(type, difficulty);
    if (!quest) continue;
    if (!fallback) fallback = quest;
    if (!excludeSet.has(questKey(quest))) return quest;
  }

  // Pool มีเควสเหลือไม่พอจริง ๆ -> Duplicate เป็น Fallback (ตามสเปค 3.6)
  return fallback;
}

export function pickRandomDifficulty() {
  return pickRandom(Object.keys(QUEST_CONFIG.DIFFICULTY));
}

// สุ่มเควสหลาย Slot รวดเดียว ไม่ซ้ำกันภายในรอบเดียวกัน (ใช้กับ Daily/Weekly)
export function generateQuestBatch(count) {
  const quests = [];
  const excludeKeys = [];
  for (let i = 0; i < count; i++) {
    const quest = generateUniqueQuest(pickRandomDifficulty(), excludeKeys);
    if (!quest) break;
    quests.push(quest);
    excludeKeys.push(questKey(quest));
  }
  return quests;
}
