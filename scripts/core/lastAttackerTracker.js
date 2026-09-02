// =========================
// lastAttackerTracker.js
// ระบบจำ "ผู้โจมตีล่าสุด" ของแต่ละ entity ร่วมกันทั้งแอดออน — แทนที่ lastAttacker
// Map ที่ซ้ำกัน 4 ไฟล์ (jobSystem.js / scoreboard.js / playerLevel.js /
// quests/events.js) ด้วย instance เดียวที่ shared ทุกคน
//
// วิธีใช้:
//   import { getLastAttacker, clearLastAttacker } from "../core/lastAttackerTracker";
//   const attacker = getLastAttacker(deadEntity.id);
//   clearLastAttacker(deadEntity.id);
//
// จุดเดียวที่ subscribe entityHurt/playerLeave — ทุก system เรียก
// getLastAttacker() ตอน entityDie แทนที่จะ maintain Map ของตัวเอง
// =========================

import { system } from "@minecraft/server";
import { resolveAttacker } from "./playerUtils";
import { TICKS_PER_SECOND } from "./constants";
import { subscribeSafe } from "./eventGuard";

const LAST_HIT_TIMEOUT = TICKS_PER_SECOND * 10;
const lastAttacker = new Map();

/**
 * ดึงผู้โจมตีล่าสุดของ entity ที่ระบุ — คืน { player, tick } หรือ undefined
 * @param {string} entityId
 */
export function getLastAttacker(entityId) {
  return lastAttacker.get(entityId);
}

/**
 * ลบข้อมูลผู้โจมตีของ entity — เรียกหลังใช้งานเสร็จตอน entityDie
 * @param {string} entityId
 */
export function clearLastAttacker(entityId) {
  lastAttacker.delete(entityId);
}

/**
 * เช็คว่า lastAttacker ของ entity นี้ "ยังใช้ได้" (ไม่หมดอายุ) — คืน player หรือ undefined
 * @param {string} entityId
 * @param {number} currentTick
 */
export function resolveLastAttacker(entityId, currentTick) {
  const data = lastAttacker.get(entityId);
  if (!data) return undefined;
  if (currentTick - data.tick > LAST_HIT_TIMEOUT) {
    lastAttacker.delete(entityId);
    return undefined;
  }
  return data.player;
}

subscribeSafe(["entityHurt"], (event) => {
  try {
    const victim = event.hurtEntity;
    const attacker = resolveAttacker(event.damageSource);
    if (attacker?.typeId === "minecraft:player" && attacker.id !== victim.id) {
      lastAttacker.set(victim.id, { player: attacker, tick: system.currentTick });
    }
  } catch (error) {
    console.warn("[LastAttackerTracker] entityHurt handler error:", error);
  }
}, "LastAttackerTracker");

subscribeSafe(["playerLeave"], (event) => {
  try {
    lastAttacker.delete(event.playerId);
  } catch (error) {
    console.warn("[LastAttackerTracker] playerLeave handler error:", error);
  }
}, "LastAttackerTracker");

// Periodic sweep — ลบ entry ที่หมดอายุสำหรับ entity ที่ไม่ถูก kill
// และไม่เคยถูก resolveLastAttacker เรียก (ป้องกัน Map โตค้าง)
system.runInterval(() => {
  const currentTick = system.currentTick;
  for (const [entityId, data] of lastAttacker) {
    if (currentTick - data.tick > LAST_HIT_TIMEOUT) {
      lastAttacker.delete(entityId);
    }
  }
}, TICKS_PER_SECOND * 60);
