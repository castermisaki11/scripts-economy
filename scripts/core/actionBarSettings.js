// =========================
// actionBarSettings.js
// เก็บค่าเปิด/ปิด action bar เป็นรายหัวข้อ (per-player Dynamic Property) —
// แยกไฟล์ต่างหากจาก ui/settings/uiSettings.js โดยเจตนา เพราะไฟล์นี้ถูก
// import จาก messageUtils.js (จุดยิง action bar จริง) ซึ่งเป็นไฟล์ระดับ
// core — ถ้าเก็บ logic นี้ไว้ใน uiSettings.js (ที่ import UIFramework.js /
// locale/index.js ฯลฯ) จะทำให้ messageUtils.js ต้องลาก dependency ของ UI
// framework ทั้งชุดเข้ามาด้วย (และเสี่ยง circular import กับ uiSettings.js
// ที่ import showSuccess จาก messageUtils.js อยู่แล้ว)
//
// รูปแบบที่เก็บ (Dynamic Property "actionBarSettings"): { "shop": true,
// "tpBank": false, ... } — คีย์ที่ไม่มีอยู่ในข้อมูลที่บันทึกไว้ (ยังไม่เคย
// ตั้งค่า หรือเป็นหัวข้อใหม่ที่เพิ่งเพิ่มเข้ามาทีหลัง) ถือว่า "เปิด" อยู่
// เป็นค่า default เสมอ (พฤติกรรมเดิมก่อนมีระบบนี้ = ยิง action bar ทุกครั้ง)
// =========================

import { ACTIONBAR_CATEGORIES } from "../config/uiConfig";

const ACTIONBAR_DYNAMIC_PROPERTY_KEY = "actionBarSettings";

function readSavedMap(player) {
  try {
    const raw = player.getDynamicProperty(ACTIONBAR_DYNAMIC_PROPERTY_KEY);
    if (typeof raw !== "string") return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * หัวข้อนี้ (categoryId) เปิดใช้งาน action bar อยู่ไหมสำหรับผู้เล่นคนนี้ —
 * เรียกจาก messageUtils.js ก่อนยิง action bar ทุกครั้งที่ระบุ category
 * ยังไม่เคยตั้งค่า/หัวข้อใหม่ -> ถือว่าเปิดอยู่ (default = true)
 * @param {import("@minecraft/server").Player} player
 * @param {string} categoryId
 */
export function isActionBarEnabled(player, categoryId) {
  if (!player?.isValid) return false;
  if (!categoryId) return true;
  const saved = readSavedMap(player);
  const value = saved[categoryId];
  if (typeof value === "boolean") return value;
  const category = ACTIONBAR_CATEGORIES.find((c) => c.id === categoryId);
  return category?.defaultEnabled !== false;
}

/**
 * คืนสถานะเปิด/ปิดของทุกหัวข้อ (เติม default = true ให้หัวข้อที่ยังไม่เคย
 * ตั้งค่า) — ใช้วาดหน้าจอตั้งค่า action bar (ui/settings/uiSettings.js)
 * @param {import("@minecraft/server").Player} player
 */
export function getActionBarSettings(player) {
  const saved = readSavedMap(player);
  const result = {};
  for (const cat of ACTIONBAR_CATEGORIES) {
    const value = saved[cat.id];
    result[cat.id] = typeof value === "boolean" ? value : cat.defaultEnabled !== false;
  }
  return result;
}

/**
 * บันทึกสถานะเปิด/ปิดทุกหัวข้อ (เขียนทับทั้งก้อน — เรียกจากหน้าตั้งค่า
 * action bar หลังกด "บันทึก" เท่านั้น)
 * @param {import("@minecraft/server").Player} player
 * @param {Record<string, boolean>} settings
 */
export function saveActionBarSettings(player, settings) {
  if (!player?.isValid) return;
  player.setDynamicProperty(ACTIONBAR_DYNAMIC_PROPERTY_KEY, JSON.stringify(settings));
}
