// =========================
// core/levelUtils.js
// สูตรเลเวล/EXP ของผู้เล่น (ระบบ RPG v1.4.0) — pure functions ล้วน ๆ
// (ไม่ import @minecraft/server) จึง unit test ใน Node ได้
// (tests/levelUtils.test.js) และ playerLevel.js เรียกใช้เป็นแหล่งความจริง
// เดียวของสูตร
//
// expToNext(level) = floor(BASE_EXP * level^EXPONENT)
//   Lv1 -> 100, Lv2 -> 282, Lv3 -> 519, ... (ยิ่งสูงยิ่งช้าแบบ RPG ทั่วไป)
// addExp() คืนผลหลังใส่ EXP: เลื่อนหลายเลเวลในครั้งเดียวได้ (loop) พร้อม
//   รายการเลเวลที่ขึ้น เพื่อให้ caller จ่ายรางวัลแต้ม/milestone ต่อได้ถูกต้อง
// =========================

import { STAT_CONFIG } from "../config/statConfig";

/** EXP ขั้นต่ำที่ต้องสะสมเพิ่มเพื่อขึ้นจาก level นี้ (level >= 1) */
export function expToNext(level) {
  const lv = Math.max(1, Math.floor(level));
  return Math.floor(STAT_CONFIG.LEVEL.BASE_EXP * Math.pow(lv, STAT_CONFIG.LEVEL.EXPONENT));
}

/**
 * ใส่ EXP เข้าสถานะ { level, exp } — คืน object ใหม่พร้อม levelsGained
 * (array ของเลเวลที่ขึ้น เรียงลำดับ) โดยไม่ mutate input
 * @param {{level: number, exp: number}} state
 * @param {number} amount EXP ที่ได้รับ (>=0, ไม่ใช่จำนวนเต็ม = floor)
 */
export function addExp(state, amount) {
  let level = Math.max(1, Math.floor(state.level));
  let exp = Math.max(0, Math.floor(state.exp)) + Math.max(0, Math.floor(amount));

  const levelsGained = [];
  while (exp >= expToNext(level)) {
    exp -= expToNext(level);
    level += 1;
    levelsGained.push(level);
    // กัน infinite loop ถ้า config พัง (expToNext <= 0)
    if (levelsGained.length > 10000) break;
  }

  return { level, exp, levelsGained };
}

/** true ถ้า newLevel เป็น milestone (หารลงตัวตาม MILESTONE_EVERY) */
export function isMilestone(newLevel) {
  const every = STAT_CONFIG.LEVEL.MILESTONE_EVERY;
  if (!Number.isFinite(every) || every <= 0) return false;
  return newLevel % every === 0;
}
