// =========================
// systems/effectResetOnJoinLeave.js
// ฟีเจอร์: ล้างเอฟเฟกต์ (potion effect) ทั้งหมดบนตัวผู้เล่น ทั้งตอน
// "เข้าโลก" (playerSpawn ครั้งแรกของ session — ไม่ใช่ respawn หลังตาย)
// และตอน "ออกโลก" (ก่อนผู้เล่นออกจริง)
//
// ล้างด้วย runCommand("effect @s clear") แทนการวนลบทีละชนิดจาก
// data/effects.js เพราะครอบคลุมเอฟเฟกต์จาก addon อื่นในโลกเดียวกันด้วย
// (ผู้เล่นสั่ง "ล้างทั้งหมด" ไม่ใช่แค่เอฟเฟกต์ที่แอดออนนี้รู้จัก)
//
// *** ทำไมต้องเรียก purgeAllBuffs() คู่กันเสมอ ***
// core/buffManager.js เก็บบัญชี "ใครให้เอฟเฟกต์อะไรอยู่เท่าไหร่" แยกจาก
// entity เอง แล้ว sync กลับเข้า entity ทุก 1 วินาที (ดู reconcile loop ท้าย
// ไฟล์นั้น) — ถ้าล้างเอฟเฟกต์บน entity เฉย ๆ โดยไม่ล้างบัญชีนี้ด้วย รอบ
// reconcile ถัดไปจะเห็นว่า source เดิม (เช่น shopEffect, job perk, VIT
// stat) ยังไม่หมดอายุ แล้วใส่เอฟเฟกต์ที่เพิ่งล้างกลับเข้า entity ทันที
// ภายใน 1 วินาที (อาการเดียวกับบั๊ก "บัฟเพิ่มเป็นสองเท่า" ที่ buffManager.js
// เคยแก้ไปแล้ว — purgeAllBuffs() คือทางล้าง state ที่ปลอดภัย เพราะเรียก
// คู่กับการล้าง entity จริงเสมอ ไม่ใช่ล้างเฉย ๆ ตอน playerLeave แบบเดิม)
//
// ผลข้างเคียงที่ตั้งใจ: บัฟที่อิงสเตตัส VIT/AGI/STR หรือเพิร์คอาชีพซึ่ง
// grant ซ้ำเป็นระยะจากระบบต้นทางของมันเองอยู่แล้ว (statSystem.js /
// jobSystem.js) จะกลับมาใหม่เองตามปกติในรอบถัดไปหลังเข้าโลก — ไม่ใช่ปัญหา
// เพราะเป็นค่าที่ควรมีอยู่แล้วตามสเตตัส/อาชีพปัจจุบันของผู้เล่น ส่วนเอฟเฟกต์
// ที่ซื้อจากร้านค้า (ระยะเวลาจำกัด) จะถูกล้างทิ้งจริงและไม่กลับมาอีก
// =========================

import { world } from "@minecraft/server";
import { subscribeSafe } from "../core/eventGuard";
import { purgeAllBuffs } from "../core/buffManager";

function clearAllEffects(player) {
  try {
    if (player?.isValid) player.runCommand("effect @s clear");
  } catch (error) {
    console.warn("[EffectResetOnJoinLeave] clear effect error:", error);
  }
  purgeAllBuffs(player);
}

// ----- เข้าโลก -----
subscribeSafe(["playerSpawn"], event => {
  try {
    if (!event.initialSpawn) return; // เฉพาะเข้าโลกจริง ไม่ใช่ respawn หลังตาย
    clearAllEffects(event.player);
  } catch (error) {
    console.warn("[EffectResetOnJoinLeave] playerSpawn handler error:", error);
  }
}, "EffectResetOnJoinLeave");

// ----- ออกโลก -----
// ใช้ world.beforeEvents.playerLeave ตรง ๆ (subscribeSafe ผูกกับ
// world.afterEvents เท่านั้น) เพราะ afterEvents.playerLeave ให้แค่
// playerId/playerName — ผู้เล่นออกจาก entity list ไปแล้ว เรียก player.*
// ไม่ได้อีก ส่วน beforeEvents.playerLeave ยังให้ player object ที่ valid
// อยู่ก่อนออกจริง จึงล้างเอฟเฟกต์ได้ทัน
const leaveSignal = world.beforeEvents?.playerLeave;
if (leaveSignal && typeof leaveSignal.subscribe === "function") {
  leaveSignal.subscribe(event => {
    try {
      clearAllEffects(event.player);
    } catch (error) {
      console.warn("[EffectResetOnJoinLeave] playerLeave handler error:", error);
    }
  });
} else {
  console.warn("[EffectResetOnJoinLeave] beforeEvents.playerLeave ไม่มีใน runtime นี้ — ปิดการล้างเอฟเฟกต์ฝั่งออกโลก");
}
