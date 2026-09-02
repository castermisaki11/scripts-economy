// =========================
// data/questObjectives.js
// Objective Registry แบบ Data-driven ของระบบเควส (systems/quests/) —
// นิยาม "เควสประเภทไหนสุ่มเป้าหมายจากไหน / สุ่มจำนวนเท่าไหร่" ไว้ที่นี่จุด
// เดียว เพิ่ม Quest Type ใหม่ในอนาคต = เพิ่ม 1 รายการที่นี่เท่านั้น ไม่ต้อง
// เพิ่ม if/else ใน quests/generation.js
//
// ไม่สร้างตาราง Item/Job ใหม่ — ทุก Objective ที่เกี่ยวกับไอเทม/อาชีพ ดึงจาก
// data/items.js / data/jobs.js ตรง ๆ เสมอ (Single Source of Truth) ส่วน
// mine/kill ยังคงใช้ MINE_POOL/KILL_POOL เดิมจาก data/quests.js
//
// โครงสร้างของแต่ละ Objective:
//   getPool():  () => Array<string|null>
//               คืนรายการเป้าหมาย (typeId ของบล็อก/เอนทิตี้/ไอเทม/jobId)
//               ที่สุ่มได้ ณ ขณะนั้น (เรียกใหม่ทุกครั้ง ไม่แคช เพราะไอเทม/
//               อาชีพเปิด-ปิดได้ระหว่างรัน) — ถ้า Objective ไม่มีเป้าหมาย
//               เฉพาะเจาะจง (เช่น home_teleport) ให้คืน [null] แทน — null
//               หมายถึง "เป้าหมายใดก็ได้" (ดู tryProgressQuest() ใน
//               quests/engine.js)
//   amountRange: { min, max } ช่วงจำนวนที่ต้องทำให้ครบ สุ่มตอนออกเควส
//   lifetimeKey: string | null
//               คีย์ใน questData.lifetime ที่ควรถูกบวกสะสมทุกครั้งที่มี
//               Progress Event ของ Objective นี้เกิดขึ้น (ไม่ว่าจะมีเควส
//               Active ที่ตรงกันอยู่หรือไม่ก็ตาม) — null = ไม่มีตัวนับ
//               lifetime ของประเภทนี้ (เช่น home_teleport)
// =========================

import { MINE_POOL, KILL_POOL } from "./quests";
import { getItemsByCategory, getSellPrice, getBuyPrice } from "./items";
import { getJobs } from "./jobs";

export const QUEST_OBJECTIVES = {
  // ทุบ/ขุดบล็อก — เป้าหมายจาก data/quests.js MINE_POOL (ตารางเดิม)
  mine: {
    getPool: () => MINE_POOL,
    amountRange: { min: 16, max: 48 },
    lifetimeKey: "mine"
  },

  // ฆ่ามอนสเตอร์ — เป้าหมายจาก data/quests.js KILL_POOL (ตารางเดิม)
  kill: {
    getPool: () => KILL_POOL,
    amountRange: { min: 6, max: 20 },
    lifetimeKey: "kill"
  },

  // ขายไอเทมในร้านค้า — ดึงไอเทมทุกชิ้นที่ "ขายได้" (sellPrice > 0) จาก
  // data/items.js ตรง ๆ ไม่มีตารางแยกของตัวเอง (Single Source of Truth)
  sell: {
    getPool: () => getItemsByCategory().filter((id) => getSellPrice(id) > 0),
    amountRange: { min: 8, max: 32 },
    lifetimeKey: "sell"
  },

  // ซื้อไอเทมจากร้านค้า — ดึงไอเทมทุกชิ้นที่ "ซื้อได้" (buyPrice > 0) จาก
  // data/items.js ตรง ๆ เช่นเดียวกับ sell
  buy: {
    getPool: () => getItemsByCategory().filter((id) => getBuyPrice(id) > 0),
    amountRange: { min: 4, max: 16 },
    lifetimeKey: "buy"
  },

  // สะสม EXP อาชีพ (ไม่จำกัดอาชีพใดอาชีพหนึ่ง) — targetId คือ jobId จาก
  // data/jobs.js เป้าหมายคือ "ได้ EXP สะสมจากอาชีพนั้นครบตามจำนวน"
  job_exp: {
    getPool: () => getJobs().map((job) => job.id),
    amountRange: { min: 100, max: 500 },
    lifetimeKey: "jobExpGained"
  },

  // เลื่อนระดับอาชีพ — targetId คือ jobId จาก data/jobs.js เป้าหมายคือ
  // "เลื่อนระดับอาชีพนั้นครบตามจำนวนครั้ง"
  job_levelup: {
    getPool: () => getJobs().map((job) => job.id),
    amountRange: { min: 1, max: 3 },
    lifetimeKey: "jobLevelUps"
  },

  // ขายไอเทมในตลาดผู้เล่น — จะนับเมื่อมีผู้เล่นอื่นซื้อ listing สำเร็จ
  // เท่านั้น (ดู reportMarketSold() ใน systems/quests/reportApi.js) ไม่ได้นับ
  // ตอนผู้ขายกด "ลงขาย"
  market_sell: {
    getPool: () => getItemsByCategory().filter((id) => getSellPrice(id) > 0),
    amountRange: { min: 4, max: 16 },
    lifetimeKey: "marketSell"
  },

  // เดินทางกลับบ้าน (homeSystem.js) — ไม่มีเป้าหมายเฉพาะเจาะจง (ไม่ผูกกับ
  // typeId ใด ๆ) จึงมีเป้าหมายได้แบบเดียวคือ "any" (targetId: null)
  home_teleport: {
    getPool: () => [null],
    amountRange: { min: 1, max: 5 },
    lifetimeKey: null
  }
};

/** รายชื่อ Quest Type ทั้งหมดที่ลงทะเบียนไว้ในระบบ (ไม่สนใจว่าสุ่มได้จริง
 *  หรือไม่ ณ ขณะนั้น — ดู hasAvailableTargets() ถ้าต้องเช็คว่า pool ว่างไหม) */
export function getObjectiveTypes() {
  return Object.keys(QUEST_OBJECTIVES);
}

/** ข้อมูล Objective ของ type ที่ระบุ — undefined ถ้าไม่รู้จัก type นี้ */
export function getObjective(type) {
  return QUEST_OBJECTIVES[type];
}

/** true ถ้า type นี้ลงทะเบียนไว้ในระบบ */
export function isValidObjectiveType(type) {
  return Object.prototype.hasOwnProperty.call(QUEST_OBJECTIVES, type);
}

/** true ถ้า Objective นี้มีเป้าหมายให้สุ่มได้จริง ณ ขณะนี้ (pool ไม่ว่าง) */
export function hasAvailableTargets(type) {
  const objective = QUEST_OBJECTIVES[type];
  if (!objective) return false;
  const pool = objective.getPool();
  return Array.isArray(pool) && pool.length > 0;
}
