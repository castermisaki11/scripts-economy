// =========================
// soundUtils.js
// ศูนย์รวมเสียงตอบสนอง UI ทั้งหมดของแอดออน — ไฟล์นี้เป็นที่เดียวที่รู้จัก
// sound id จริง ๆ ไฟล์อื่นเรียกผ่านฟังก์ชัน play*() ด้านล่างแทนการเรียก
// player.playSound() ตรง ๆ กระจัดกระจาย เพื่อให้:
//   - แก้/สลับเสียงได้จากจุดเดียว ไม่ต้องไล่หาทีละไฟล์
//   - พฤติกรรมเดียวกัน (เช่น "ยกเลิก") ใช้เสียงเดียวกันทั้งแอดออนเสมอ
//
// รวมมาจาก shopSystem.js / shopEffect.js ที่แต่ก่อนต่างคนต่างมี SOUNDS
// map + playSound() ของตัวเองซ้ำกันคนละไฟล์ ค่าเสียงไม่ถูกเปลี่ยนจากเดิม
//
// รายชื่อเสียงจริง + สวิตช์เปิด/ปิดย้ายไปอยู่ config/uiConfig.js
// (SOUND_CONFIG) แล้ว — แก้/สลับเสียง หรือปิดเสียง UI ทั้งหมด แก้ที่นั่น
// จุดเดียว ไม่ต้องแก้ไฟล์นี้
// =========================

import { SOUND_CONFIG } from "../config/uiConfig";
import { world } from "@minecraft/server";
import { subscribeSafe } from "./eventGuard";

// กันเสียงซ้อนกัน: จำเวลาที่เล่นเสียงจริง (soundId) ต่อผู้เล่น ถ้าเล่นซ้ำในช่วง
// throttle จะข้ามไป — แก้ปัญหาเสียง UI (random.click) ถูกกดซ้ำซ้อนทับกันเวลา
// นำทางเมนูเร็ว ๆ (Main -> Shop -> Buy เรียก random.click 3 ครั้งติด)
// คีย์ด้วยเสียงที่เล่นจริง ไม่ใช่ key ตรรกะ เพื่อให้ click + cancel (ทั้งคู่
// random.click) แบ่ง cooldown ชุดเดียวกันและไม่ซ้อนกัน
const lastPlayedByPlayer = new Map(); // player.id -> { [soundId]: timestamp }

function play(player, key) {
  if (!SOUND_CONFIG.enabled) return;
  const soundId = SOUND_CONFIG.sounds[key];
  if (!soundId || !player?.isValid) return;
  const now = Date.now();
  const perPlayer = lastPlayedByPlayer.get(player.id) ?? {};
  if (now - (perPlayer[soundId] ?? 0) < (SOUND_CONFIG.throttleMs ?? 100)) return;
  perPlayer[soundId] = now;
  lastPlayedByPlayer.set(player.id, perPlayer);
  player.playSound(soundId);
}

// เคลียร์แคชเมื่อผู้เล่นออก — ป้องกัน memory leak (CONTRIBUTING §Map)
subscribeSafe(["playerLeave"], (event) => {
  try {
    lastPlayedByPlayer.delete(event.playerId);
  } catch (err) {
    console.warn("[Sound] cleanup error:", err);
  }
}, "SoundUtils");

// ทำรายการสำเร็จแบบทั่วไป — ค่าเริ่มต้นใช้เสียงเดียวกับ playBuySuccess()
// โมดูลที่ต้องแยกเสียง "ซื้อ" กับ "ขาย" ให้ใช้ playBuySuccess()/playSellSuccess()
// แทนเพื่อคงพฤติกรรมเดิมของ shopSystem.js ไว้
export function playSuccess(player) {
  play(player, "buySuccess");
}

// ซื้อสำเร็จ
export function playBuySuccess(player) {
  play(player, "buySuccess");
}

// ขายสำเร็จ
export function playSellSuccess(player) {
  play(player, "sellSuccess");
}

// ทำรายการไม่สำเร็จ เช่น เงิน/ของไม่พอ, ของหมดระหว่างเปิดเมนู
export function playError(player) {
  play(player, "error");
}

// ยกเลิก / กดปุ่ม "กลับ"
export function playCancel(player) {
  play(player, "cancel");
}

// กดปุ่มทั่วไปในเมนู (ยังไม่มีโมดูลไหนเรียกใช้จริงตอนนี้ เตรียมไว้ให้
// เมนูอื่นในอนาคตใช้แทนการเรียก player.playSound() ตรง ๆ)
export function playClick(player) {
  play(player, "click");
}

// อาชีพเลเวลอัป (jobSystem.js — grantReward) — แยกจาก playSuccess()/
// playBuySuccess() เพราะเป็นเหตุการณ์คนละความหมาย (ฉลองเลเวลอัป ไม่ใช่
// ทำรายการซื้อขายสำเร็จ) ถึงจะใช้เสียงจริงตัวเดียวกันในค่าเริ่มต้นก็ตาม
export function playJobLevelUp(player) {
  play(player, "jobLevelUp");
}

// ทำเควสสำเร็จ (quests/engine.js — completeBountyQuest/advanceSlotGroup) — แยกจาก playJobLevelUp()
// เพราะเป็นเหตุการณ์คนละความหมาย (ทำเควสสำเร็จ ไม่ใช่อาชีพเลเวลอัป) ถึงจะ
// ใช้เสียงจริงตัวเดียวกันในค่าเริ่มต้นก็ตาม (ดู config/uiConfig.js)
export function playQuestComplete(player) {
  play(player, "questComplete");
}

/* =========================
   PROC FEEDBACK (v1.4.0 — combatAttributes.js) — เสียงประกอบ action bar
   ตอนคริ/หลบ/แพร์รี่/บล็อก trigger จริง (เกิดถี่ ใช้เสียงสั้น)
========================= */
export function playCritProc(player) { play(player, "critProc"); }
export function playParryProc(player) { play(player, "parryProc"); }
export function playEvasionProc(player) { play(player, "evasionProc"); }
export function playBlockProc(player) { play(player, "blockProc"); }

// ปลดล็อครายการสำเร็จ (shopUnlocks.js)
export function playUnlockSuccess(player) { play(player, "unlockSuccess"); }
