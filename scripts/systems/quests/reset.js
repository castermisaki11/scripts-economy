// =========================
// quests/reset.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ DAILY / WEEKLY RESET) แบบคงเดิมทุกประการ
// =========================

import { QUEST_CONFIG } from "../../config/questConfig";
import { bangkokDayIndex, nowMs } from "../../core/timeUtils";
import { generateQuestBatch } from "./generation";
import { saveQuestData } from "./storage";

/* =========================
   DAILY / WEEKLY RESET (Lazy — ตรวจตอนใช้งานจริงเท่านั้น ไม่มี Interval)
========================= */

// สัปดาห์แบบเริ่มวันจันทร์ ที่ฐาน Bangkok Day Index (จาก timeUtils.js) — ไม่
// สร้างระบบเวลาใหม่ แค่จัดกลุ่ม bangkokDayIndex() เดิมเป็นสัปดาห์ ๆ ละ 7 วัน
// dayIndex 0 (เที่ยงคืนไทยของ epoch) ตรงกับวันพฤหัสบดี (ห่างจากวันจันทร์ 3
// วัน) จึงบวก 3 ก่อนหาร 7 เพื่อให้ดัชนีสัปดาห์เปลี่ยนพอดีตอนเข้าเที่ยงคืน
// วันจันทร์เสมอ
function bangkokWeekIndex(ms = nowMs()) {
  return Math.floor((bangkokDayIndex(ms) + 3) / 7);
}

// คืน true ถ้ามีการรีเซ็ต Daily เกิดขึ้นจริง (ต้อง saveQuestData ต่อ)
function ensureDailyReset(data) {
  const today = bangkokDayIndex(nowMs());
  if (data.daily.bangkokDay === today && data.daily.slots.length === QUEST_CONFIG.DAILY.SLOTS) {
    return false;
  }

  // Quest ที่ยังไม่เสร็จไม่ Carry Over — สุ่มชุดใหม่ทั้งหมดทับของเดิม
  data.daily.bangkokDay = today;
  data.daily.slots = generateQuestBatch(QUEST_CONFIG.DAILY.SLOTS);
  data.daily.freeRerollsUsed = 0;
  return true;
}

// คืน true ถ้ามีการรีเซ็ต Weekly เกิดขึ้นจริง (ต้อง saveQuestData ต่อ)
function ensureWeeklyReset(data) {
  const thisWeek = bangkokWeekIndex(nowMs());
  if (data.weekly.bangkokWeek === thisWeek && data.weekly.slots.length === QUEST_CONFIG.WEEKLY.SLOTS) {
    return false;
  }

  data.weekly.bangkokWeek = thisWeek;
  data.weekly.slots = generateQuestBatch(QUEST_CONFIG.WEEKLY.SLOTS);
  data.weekly.freeRerollsUsed = 0;
  return true;
}

// จุดเดียวที่ควรเรียกก่อนอ่าน/ใช้ data.daily หรือ data.weekly เสมอ (Lazy
// Reset) — ตรวจเมื่อ: Quest UI เปิด, Player Progress Event เกิด (เรียกจาก
// advanceQuests()), และ Player Spawn (ดู events.js)
export function ensureQuestResets(player, data) {
  const dailyChanged = ensureDailyReset(data);
  const weeklyChanged = ensureWeeklyReset(data);
  if (dailyChanged || weeklyChanged) saveQuestData(player, data);
  return dailyChanged || weeklyChanged;
}
