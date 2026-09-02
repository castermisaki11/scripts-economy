// =========================
// combatState.js
// Shared combat state สำหรับระบบ cross-module — ใช้ร่วมกันระหว่าง
// combatAttributes.js (เขียน) และ affinitySystem.js (อ่าน)
//
// วัตถุประสงค์: หลีกเลี่ยง circular import ระหว่าง
// statUtils.js -> affinitySystem.js -> combatAttributes.js -> statUtils.js
//
// ทั้ง combatAttributes.js และ affinitySystem.js import จากไฟล์นี้
// แทนที่จะ import จากกันและกันโดยตรง
// =========================

import { system } from "@minecraft/server";

// Per-tick crit tracker — combatAttributes.js เขียน, affinitySystem.js อ่าน
// key = playerId, value = tick ที่เกิด crit
const critThisTick = new Map();

/**
 * บันทึกว่าผู้เล่นนี้ crit ใน tick ปัจจุบัน
 * เรียกจาก combatAttributes.js ตอน crit trigger
 */
export function recordCrit(playerId) {
  critThisTick.set(playerId, system.currentTick);
}

/**
 * ตรวจสอบว่าผู้เล่นนี้ crit ใน tick ปัจจุบันหรือไม่
 * เรียกจาก affinitySystem.js สำหรับ WEAPON_CRIT bonus
 */
export function wasCriticalThisTick(playerId) {
  return critThisTick.get(playerId) === system.currentTick;
}

/**
 * ลบข้อมูล crit ของผู้เล่น (เรียกตอน playerLeave)
 */
export function clearCritState(playerId) {
  critThisTick.delete(playerId);
}
