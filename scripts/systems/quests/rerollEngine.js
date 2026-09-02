// =========================
// quests/rerollEngine.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ DAILY / WEEKLY REROLL — Phase 3A)
// แบบคงเดิมทุกประการ
// =========================

import { QUEST_CONFIG } from "../../config/questConfig";
import { addMoney, removeMoney, depositToBank } from "../../core/economyUtils";
import { readQuestData, saveQuestData } from "./storage";
import { ensureQuestResets } from "./reset";
import { generateUniqueQuest, pickRandomDifficulty, questKey } from "./generation";

/* =========================
   DAILY / WEEKLY REROLL (Phase 3A)
   Reroll ได้ทีละ 1 ช่อง (slot) เท่านั้น — ไม่กระทบช่องอื่นในรอบเดียวกัน ฟรี
   ได้ FREE_REROLLS ครั้ง/รอบ (นับตาม bangkokDay/bangkokWeek รีเซ็ตพร้อมรอบ
   ใหม่อัตโนมัติ) เกินจากนั้นเสียเงิน REROLL_COST/ครั้งแทน (ไม่มีคูลดาวน์แบบ
   Bounty เพราะมีรอบใหม่มาเองอยู่แล้วทุกวัน/ทุกสัปดาห์)

   คืนค่าเป็น { ok: true, wasFree, cost, quest } ตอนสำเร็จ หรือ
   { ok: false, reason, cost? } ตอนล้มเหลว (reason เป็นค่าคงที่จาก
   REROLL_FAIL_REASON ด้านล่าง ให้ผู้เรียก (UI/คำสั่ง) เอาไป map เป็นข้อความ
   locale เองอีกที ไฟล์นี้ไม่ผูกกับข้อความ UI ตรง ๆ)
========================= */

export const REROLL_FAIL_REASON = {
  INVALID_SLOT: "invalid_slot",
  ALREADY_COMPLETED: "already_completed",
  INSUFFICIENT_FUNDS: "insufficient_funds",
  NO_TARGETS_AVAILABLE: "no_targets_available"
};

function rerollCategorySlot(player, category, slotIndex) {
  if (!player?.isValid) return { ok: false, reason: REROLL_FAIL_REASON.INVALID_SLOT };
  if (typeof slotIndex !== "number" || !Number.isInteger(slotIndex) || slotIndex < 0) {
    return { ok: false, reason: REROLL_FAIL_REASON.INVALID_SLOT };
  }

  const data = readQuestData(player);
  // ให้ชุดเควสเป็นของรอบปัจจุบันก่อนเสมอ (กันกรณี slotIndex อ้างอิงชุดเก่า
  // ที่ยังไม่ถูกรีเซ็ต หรือ freeRerollsUsed ค้างจากรอบก่อน)
  ensureQuestResets(player, data);

  const categoryData = data[category];
  const slot = categoryData.slots[slotIndex];
  if (!slot) return { ok: false, reason: REROLL_FAIL_REASON.INVALID_SLOT };
  // ช่องที่ทำเสร็จแล้วรอรีเซ็ตรอบถัดไปอยู่ — reroll ทับไม่ได้ (จะกลายเป็น
  // "ได้เควสฟรีไม่จำกัด" ถ้าเสร็จแล้ว reroll วนไปเรื่อย ๆ)
  if (slot.completed) return { ok: false, reason: REROLL_FAIL_REASON.ALREADY_COMPLETED };

  const categoryConfig = category === "daily" ? QUEST_CONFIG.DAILY : QUEST_CONFIG.WEEKLY;
  const isFree = categoryData.freeRerollsUsed < categoryConfig.FREE_REROLLS;
  const cost = isFree ? 0 : categoryConfig.REROLL_COST;

  if (!isFree && cost > 0) {
    const paid = removeMoney(player, cost);
    if (!paid) return { ok: false, reason: REROLL_FAIL_REASON.INSUFFICIENT_FUNDS, cost };
  }

  // ห้ามสุ่มซ้ำกับช่องอื่นในรอบเดียวกัน (เฉพาะช่องที่ยังไม่ว่าง — ช่องนี้เอง
  // ไม่รวมอยู่แล้วเพราะเรากำลังจะแทนที่มัน)
  const excludeKeys = categoryData.slots
    .filter((s, i) => i !== slotIndex && s)
    .map(questKey);

  const newQuest = generateUniqueQuest(pickRandomDifficulty(), excludeKeys);

  if (!newQuest) {
    // สุ่มเควสใหม่ไม่ได้จริง ๆ (ทุก Objective ไม่มีเป้าหมายให้สุ่มเลย ณ ขณะนี้)
    // — คืนเงิน/ภาษีที่หักไปแล้ว (ถ้ามี) กันผู้เล่นเสียเงินฟรีไม่ได้อะไรตอบแทน
    // ไม่แตะ freeRerollsUsed/slot เดิมเลย (เหมือนไม่มีอะไรเกิดขึ้น)
    if (!isFree && cost > 0) addMoney(player, cost);
    return { ok: false, reason: REROLL_FAIL_REASON.NO_TARGETS_AVAILABLE };
  }

  if (!isFree && cost > 0) {
    // ภาษี reroll เข้าธนาคารกลาง เหมือนค่าธรรมเนียมเปลี่ยนอาชีพ/ภาษีร้านค้า —
    // หักหลังยืนยันว่าสุ่มเควสใหม่ได้จริงแล้วเท่านั้น (ไม่งั้นต้องถอนคืนซ้ำ
    // ในเคส NO_TARGETS_AVAILABLE ด้านบน)
    const tax = Math.floor(cost * QUEST_CONFIG.REROLL_TAX_RATE);
    if (tax > 0) depositToBank(tax);
  } else {
    categoryData.freeRerollsUsed += 1;
  }

  categoryData.slots[slotIndex] = newQuest;
  saveQuestData(player, data);

  return { ok: true, wasFree: isFree, cost, quest: newQuest };
}

// Reroll เควส Daily ช่องที่ slotIndex (0-based) — ดูรายละเอียดที่คอมเมนต์
// หัวข้อ "DAILY / WEEKLY REROLL" ด้านบน
export function rerollDailySlot(player, slotIndex) {
  return rerollCategorySlot(player, "daily", slotIndex);
}

// Reroll เควส Weekly ช่องที่ slotIndex (0-based) — เหมือน rerollDailySlot()
// ทุกประการ แค่คนละ category/config (WEEKLY.FREE_REROLLS/REROLL_COST)
export function rerollWeeklySlot(player, slotIndex) {
  return rerollCategorySlot(player, "weekly", slotIndex);
}
