// =========================
// quests/reportApi.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ REPORT API — 3.8) แบบคงเดิมทุกประการ
//
// ให้ระบบอื่นเรียกหลังเกิด Event จริงที่ไม่มี world event ให้ฟังตรง ๆ (ต่าง
// จาก mine/kill) — Call Site ปัจจุบัน:
//   - reportItemSold/reportItemBought -> shopSystem.js
//   - reportMarketSold                -> marketUi.js (ผู้ซื้อซื้อของในตลาด)
//   - reportJobExpGained/reportJobLevelUp -> jobSystem.js
//   - reportHomeTeleport              -> homeSystem.js
// =========================

import { advanceQuests } from "./engine";

export function reportItemSold(player, itemId, amount) {
  if (!player?.isValid || amount <= 0) return;
  advanceQuests(player, "sell", itemId, amount);
  // v1.4.6: ไม่ให้ EXP เลเวล RPG จากการขายแล้ว — การขายคือ "การหาเงิน"
  // EXP ผู้เล่นต้องมาจากเควส (progression.grantQuestReward) / kill / mine
}

export function reportItemBought(player, itemId, amount) {
  if (!player?.isValid || amount <= 0) return;
  advanceQuests(player, "buy", itemId, amount);
}

// Phase 3B: เรียกจาก marketUi.js confirmPurchase() ตอนของในตลาดผู้เล่นถูก
// ซื้อสำเร็จ — ผู้ขาย (player ที่ส่งเข้ามา) อาจออฟไลน์อยู่ตอนนั้นได้ ผู้เรียก
// ต้องเช็คเองก่อนว่าจะเรียกฟังก์ชันนี้ตรง ๆ (ผู้ขายออนไลน์) หรือคิวไว้ก่อน
// ผ่าน playerMarket.js addPendingQuestMarketSale() (ผู้ขายออฟไลน์ — flush
// ตอน spawn ดู events.js)
export function reportMarketSold(player, itemId, amount) {
  if (!player?.isValid || amount <= 0) return;
  advanceQuests(player, "market_sell", itemId, amount);
}

export function reportJobExpGained(player, jobId, exp) {
  if (!player?.isValid || exp <= 0) return;
  advanceQuests(player, "job_exp", jobId, exp);
}

export function reportJobLevelUp(player, jobId) {
  if (!player?.isValid) return;
  advanceQuests(player, "job_levelup", jobId, 1);
}

export function reportHomeTeleport(player) {
  if (!player?.isValid) return;
  advanceQuests(player, "home_teleport", null, 1);
}
