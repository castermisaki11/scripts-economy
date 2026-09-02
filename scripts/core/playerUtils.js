// =========================
// playerUtils.js
// ศูนย์รวมฟังก์ชันช่วยเรื่อง "ผู้เล่น" ที่ใช้ร่วมกันหลายโมดูล — เช่น เช็ค
// สถานะ admin, เช็คว่าอยู่มิติเดียวกันไหม, คำนวณระยะทาง, หาผู้เล่นที่อยู่
// ใกล้ ๆ กัน — รวมมาจาก mainUi.js / shopEffect.js / tpBankSystem.js /
// economy.js ที่แต่ก่อนต่างคนต่างเขียนฟังก์ชันแบบเดียวกัน (หรือใกล้เคียงกัน
// มาก) ซ้ำกันคนละไฟล์
//
// ทุกโมดูลที่ต้องเช็ค admin / ระยะทาง / มิติ / ผู้เล่นใกล้เคียง ควร import
// จากไฟล์นี้แทนการเขียนเองซ้ำ ตามสถาปัตยกรรมเดียวกับ economyUtils.js /
// soundUtils.js / messageUtils.js / confirmDialog.js
//
// หมายเหตุการรวม:
//   - isAdmin(): เดิม mainUi.js เช็คแค่แท็ก "admin" ส่วน playerMarket.js /
//     economy.js ก็เช็ค player.hasTag("admin") ตรง ๆ แบบเดียวกัน — ใช้เกณฑ์
//     นี้เป็นมาตรฐาน (shopEffect.js เคยมี isAdmin() ที่เช็คทั้ง "admin" และ
//     "Admin" แต่ไม่มีจุดไหนเรียกใช้เลย เป็นโค้ดตายที่ถูกลบไปพร้อมการรวมนี้)
//   - distanceBetween(): ย้ายมาจาก economy.js (ฟังก์ชัน distance(a, b) เดิม
//     รับ location ตรง ๆ อยู่แล้ว) — สูตรเดียวกับ calcDistance() ใน
//     tpBankSystem.js ทุกประการ (Euclidean 3 มิติ) ต่างแค่เดิม tpBankSystem.js
//     รับ entity (a.location.x) แทนที่จะรับ location ตรง ๆ
// =========================

import { world } from "@minecraft/server";
import { ADMIN_TAG } from "./constants";
import { ADMIN_FEATURES_ENABLED } from "../config/buildConfig";

// เช็คว่า player ยัง valid อยู่ไหม (ผู้เล่นยัง online / entity ยังไม่ถูกทำลาย)
export function isValidPlayer(player) {
  return !!player?.isValid;
}

// เช็คว่าผู้เล่นมีสิทธิ์ admin ไหม (แท็ก "admin" — ค่าคงที่ ADMIN_TAG
// ใน constants.js เดียวกับที่ newPlayerRewards.js ใช้ตอนแจกแท็ก)
// build no-admin (ADMIN_FEATURES_ENABLED = false) คืน false เสมอ —
// ปิดปุ่ม/เมนู admin ทุกจุดในระบบที่ gate ผ่านฟังก์ชันนี้ด้วยบรรทัดเดียว
export function isAdmin(player) {
  if (!ADMIN_FEATURES_ENABLED) return false;
  return isValidPlayer(player) && player.hasTag(ADMIN_TAG);
}

// เช็คว่าผู้เล่นสองคนอยู่มิติเดียวกันไหม
export function isSameDimension(playerA, playerB) {
  return playerA?.dimension?.id !== undefined && playerA.dimension.id === playerB?.dimension?.id;
}

// ระยะทางแบบ Euclidean 3 มิติ ระหว่างพิกัดสองจุด ({x,y,z})
export function distanceBetween(locationA, locationB) {
  const dx = locationA.x - locationB.x;
  const dy = locationA.y - locationB.y;
  const dz = locationA.z - locationB.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// หาผู้เล่นอื่น (ไม่รวมตัวเอง) ที่อยู่มิติเดียวกันและอยู่ในระยะ maxDistance
// บล็อกจาก player — คืน [] ถ้า player ไม่ valid
export function findNearbyPlayers(player, maxDistance) {
  if (!isValidPlayer(player)) return [];
  return world.getPlayers().filter(p =>
    p.id !== player.id &&
    isSameDimension(p, player) &&
    distanceBetween(player.location, p.location) <= maxDistance
  );
}

// หา "ผู้โจมตีจริง" จาก damageSource ของ event entityHurt/entityDie —
// ถ้าตัวที่สร้างความเสียหาย (damagingEntity) เป็น projectile (ธนู/ลูกไฟ
// ที่ผู้เล่นยิง) ให้แก้กลับไปเป็นเจ้าของ (owner) แทน เพื่อนับว่า "ผู้เล่น
// ยิงเอง" — เดิม jobSystem.js (ตอนให้รางวัลอาชีพจากการฆ่ามอบ) กับ
// scoreboard.js (ตอนนับ kill) ต่างคนต่างเขียน pattern นี้ซ้ำกันเป๊ะ ๆ
// คนละไฟล์ (เสี่ยงแก้ไฟล์หนึ่งแล้วลืมอีกไฟล์ ทำให้สองระบบตีความ "ใครคือ
// ผู้ฆ่า" ไม่ตรงกัน) — รวมมาไว้จุดเดียวที่นี่ ระบบอื่นที่ฟัง entityHurt/
// entityDie แล้วต้องหาผู้เล่นที่เป็นต้นเหตุ ควรเรียกจากที่นี่แทนการเขียนเอง
// @param {import("@minecraft/server").EntityDamageSource} damageSource
// @returns {import("@minecraft/server").Entity | undefined}
export function resolveAttacker(damageSource) {
  let attacker = damageSource?.damagingEntity;

  // Wither skull/กระสุนบางชนิดถูก remove ทันทีตอน impact — getComponent()
  // บน entity ที่ invalid จะ throw InvalidEntityError ดึง handler ทุกระบบ
  // (scoreboard/job/quest/level) ที่ใช้ helper นี้ร่วมกันล้ม (QA v1.4.5)
  try {
    if (attacker && attacker.isValid && attacker.getComponent("minecraft:projectile")) {
      const owner = attacker.getComponent("minecraft:projectile").owner;
      if (owner) attacker = owner;
    }
  } catch {
    return undefined; // projectile โดนลบก่อน event — ไม่มีผู้โจมตีให้สืบแล้ว
  }

  return attacker;
}

// เหมือน resolveAttacker() แต่กรองคืนเฉพาะกรณีที่เป็น "ผู้เล่นจริงที่ยัง
// online อยู่" เท่านั้น (typeId ตรง + isValid) — ใช้ตรงจุดที่ต้องการแค่
// ผู้เล่น ไม่สนใจ mob/dispenser ที่ยิงธนูโดยไม่มีเจ้าของเป็นผู้เล่น
// @param {import("@minecraft/server").EntityDamageSource} damageSource
// @returns {import("@minecraft/server").Player | undefined}
export function resolveAttackingPlayer(damageSource) {
  const attacker = resolveAttacker(damageSource);
  return attacker?.typeId === "minecraft:player" && attacker.isValid ? attacker : undefined;
}
