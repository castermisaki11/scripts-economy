// =========================
// data/mobExpTable.js
// ฐานข้อมูล EXP ที่ได้ต่อการฆ่ามอบ 1 ตัว (ระบบเลเวลผู้เล่น — systems/
// playerLevel.js) — เพิ่ม/แก้ค่า EXP ของมอบแก้ที่ไฟล์นี้จุดเดียว ไม่ต้อง
// แตะ playerLevel.js
//
// กติกาการตั้งค่า:
//   - EXP_OVERRIDES = มอบที่กำหนด EXP เฉพาะตัว "ไม่ผ่านเพดาน
//     NORMAL_MOB_EXP_CAP" (บอสหลัก + มอบพิเศษที่ตั้งใจให้เกินเพดานปกติ) —
//     ค่าที่นี่คือค่าสุดท้าย ไม่ถูก clamp
//   - MOB_EXP_TABLE ที่เหลือทั้งหมด (มอบทั่วไป) ห้ามเกิน NORMAL_MOB_EXP_CAP
//     ปรับตามความยาก/อันตรายของมอบแต่ละตัว (ยากกว่า = EXP เยอะกว่า แต่ไม่
//     เกินเพดาน) — มอบที่ไม่มีในตารางนี้ใช้ DEFAULT_MOB_EXP แทน
//   - typeId ต้องมี "minecraft:" นำหน้าเสมอ (ตรงกับ deadEntity.typeId จาก
//     event entityDie)
// =========================

import { STAT_CONFIG } from "../config/statConfig";

// เพดาน EXP ของมอบทั่วไป (ไม่ใช่บอส/ไม่อยู่ใน EXP_OVERRIDES) — ห้ามตัวไหน
// เกินค่านี้
export const NORMAL_MOB_EXP_CAP = 50;

// มอบที่ไม่มีระบุในตาราง (เช่นมอบจากแอดออนอื่น/มอบที่ตกหล่น) ใช้ค่านี้ —
// อ้างอิง STAT_CONFIG.LEVEL.EXP_PER_KILL จุดเดียว ไม่ประกาศตัวเลขซ้ำ
export const DEFAULT_MOB_EXP = STAT_CONFIG.LEVEL.EXP_PER_KILL;

// มอบที่ EXP "ไม่ผ่านเพดาน NORMAL_MOB_EXP_CAP" — ตั้งใจให้เกินเพดานปกติ
// เพราะยากเกินมอบทั่วไปมาก (บอส/มินิบอสระดับสูง) แก้ค่าตรงนี้ได้เลย ไม่ต้อง
// แตะ getMobKillExp()
export const EXP_OVERRIDES = {
  "minecraft:warden": 1000,
  "minecraft:ender_dragon": 1000,
  "minecraft:wither": 1750,
  "minecraft:elder_guardian": 125
};

export const MOB_EXP_TABLE = {
  /* =========================
     ELITE / มินิบอส — อันตรายสูง แต่ไม่ใช่บอสหลัก (ใกล้เพดาน 50)
     หมายเหตุ: Elder Guardian ย้ายไป EXP_OVERRIDES แล้ว (125 — เกินเพดาน
     ปกติของหมวดนี้ตั้งใจ)
  ========================= */
  "minecraft:ravager": 45,
  "minecraft:piglin_brute": 40,
  "minecraft:evoker": 40,
  "minecraft:wither_skeleton": 35,
  "minecraft:vindicator": 32,
  "minecraft:hoglin": 30,
  "minecraft:zoglin": 30,
  "minecraft:phantom": 28,
  "minecraft:pillager": 26,
  "minecraft:vex": 25,
  "minecraft:breeze": 25,
  "minecraft:guardian": 22,
  "minecraft:shulker": 22,
  "minecraft:blaze": 20,
  "minecraft:ghast": 20,
  "minecraft:illusioner": 20,

  /* =========================
     กลาง — มอบฝูงล่า/มีความเสี่ยงปานกลาง
  ========================= */
  "minecraft:witch": 18,
  "minecraft:magma_cube": 16, // ตัวใหญ่สุด — แยกตามขนาดจริงไม่ได้ (typeId เดียวกันทุกไซส์)
  "minecraft:slime": 14,      // เช่นเดียวกับ magma_cube
  "minecraft:drowned": 14,
  "minecraft:zombified_piglin": 14,
  "minecraft:enderman": 14,
  "minecraft:husk": 12,
  "minecraft:stray": 12,
  "minecraft:creeper": 12,
  "minecraft:cave_spider": 10,
  "minecraft:spider": 8,
  "minecraft:zombie_villager": 8,
  "minecraft:skeleton": 7,
  "minecraft:zombie": 6,
  "minecraft:silverfish": 6,
  "minecraft:endermite": 6,
  "minecraft:piglin": 16,
  "minecraft:creaking": 18,

  /* =========================
     มอบเป็นกลาง (ไม่โจมตีก่อน แต่ตอบโต้ได้/บางตัวแข็งแรง)
  ========================= */
  "minecraft:polar_bear": 12,
  "minecraft:wolf": 8,
  "minecraft:iron_golem": 15,
  "minecraft:llama": 5,
  "minecraft:panda": 6,
  "minecraft:bee": 3,
  "minecraft:fox": 4,
  "minecraft:goat": 5,
  "minecraft:dolphin": 4,
  "minecraft:snow_golem": 3,

  /* =========================
     สัตว์เลี้ยง/ฟาร์ม (passive) — EXP ต่ำสุด (ฟาร์มง่ายไม่ควรให้ EXP เยอะ)
  ========================= */
  "minecraft:cow": 2,
  "minecraft:mooshroom": 2,
  "minecraft:pig": 2,
  "minecraft:sheep": 2,
  "minecraft:chicken": 1,
  "minecraft:rabbit": 1,
  "minecraft:squid": 1,
  "minecraft:glow_squid": 1,
  "minecraft:cod": 1,
  "minecraft:salmon": 1,
  "minecraft:pufferfish": 1,
  "minecraft:tropicalfish": 1,
  "minecraft:turtle": 2,
  "minecraft:parrot": 1,
  "minecraft:cat": 1,
  "minecraft:ocelot": 1,
  "minecraft:horse": 3,
  "minecraft:donkey": 3,
  "minecraft:mule": 3,
  "minecraft:skeleton_horse": 5,
  "minecraft:zombie_horse": 5,
  "minecraft:bat": 1,
  "minecraft:strider": 2,
  "minecraft:axolotl": 2,
  "minecraft:frog": 2,
  "minecraft:tadpole": 1,
  "minecraft:allay": 1,
  "minecraft:camel": 3,
  "minecraft:sniffer": 4,
  "minecraft:armadillo": 2,
  "minecraft:trader_llama": 2
};

/**
 * หา EXP ที่จะได้จากการฆ่ามอบชนิดนี้ 1 ตัว — มอบใน EXP_OVERRIDES (บอส/
 * มินิบอสระดับสูง) คืนค่าตรงตัวไม่ผ่านเพดาน, มอบทั่วไปที่อยู่ใน
 * MOB_EXP_TABLE คืนค่าตามตาราง (clamp ไม่ให้เกิน NORMAL_MOB_EXP_CAP กันใคร
 * มาแก้ตัวเลขในตารางเผลอเกินเพดานทีหลัง), มอบที่ไม่มีในตารางคืนค่า
 * DEFAULT_MOB_EXP
 * @param {string} typeId เช่น "minecraft:zombie"
 * @returns {number}
 */
export function getMobKillExp(typeId) {
  const override = EXP_OVERRIDES[typeId];
  if (typeof override === "number") return override;

  const value = MOB_EXP_TABLE[typeId];
  if (typeof value !== "number") return DEFAULT_MOB_EXP;
  return Math.min(value, NORMAL_MOB_EXP_CAP);
}
