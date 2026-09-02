// =========================
// messageUtils.js
// ศูนย์รวมการแสดงผล feedback ให้ผู้เล่นทั้งหมดของแอดออน (แชท / action bar /
// title) — ไฟล์อื่นไม่เรียก player.sendMessage() / player.onScreenDisplay.*
// ตรง ๆ อีกต่อไป ให้เรียกผ่านฟังก์ชัน show*() ด้านล่างแทนเสมอ เพื่อให้:
//   - มีจุดเดียวที่คุมรูปแบบการแสดงผล เปลี่ยนวิธีแจ้งผู้เล่นในอนาคตได้
//     (เช่น เพิ่ม log, เปลี่ยนช่องทาง) โดยไม่ต้องไล่แก้ทีละไฟล์
//   - ข้อความ "สำเร็จ"/"ไม่สำเร็จ" มีไอคอน + สีเหมือนกันทั้งแอดออนเสมอ
//     (ใช้ชุดไอคอน/สีเดียวกับ config/uiConfig.js ที่ createResultMessage ใช้อยู่แล้ว)
//
// ก่อนหน้านี้แต่ละไฟล์ใส่สีเอาเองใน locale string ไม่ตรงกัน — บางไฟล์ลืมใส่
// สีเลย (shopSystem.js, playerMarket.js), บางไฟล์ใส่สีแต่ไม่มีไอคอนกำกับ,
// บางที่ใส่สีผิดสถานะไปเลย (เช่น inventoryUi.js เดิมใช้สีแดงกับข้อความ "ลบไอเทม
// สำเร็จ" ทั้งที่เป็นสถานะสำเร็จ) — showSuccess()/showError() แก้ปัญหานี้
// ด้วยการคุมไอคอน/สีนำหน้าให้เองเสมอ ไม่ต้องพึ่งให้แต่ละ locale string ใส่เอง
//
// showInfo() / showActionBar() / showTitle() ไม่แทรกไอคอน/สีให้ (ปล่อย
// ข้อความตามที่ส่งมา) เพราะไม่มีสถานะ "ถูก/ผิด" ตายตัวแบบ success/error
// =========================

import { ICONS, COLORS } from "../config/uiConfig";
import { isActionBarEnabled } from "./actionBarSettings";

// ตัดโค้ดสีเดี่ยวที่นำหน้าข้อความออก (เช่น "§a", "§c") ถ้ามี เพื่อไม่ให้ซ้อน
// กับไอคอน/สีมาตรฐานที่ showSuccess()/showError() ใส่ให้เอง — ไม่แตะโค้ดสี
// ที่อยู่กลาง/ท้ายข้อความ (เช่นตัวเน้นตัวเลข) ปล่อยไว้ตามเดิม
function stripLeadingColor(message) {
  return /^§[0-9a-f]/i.test(message) ? message.slice(2) : message;
}

// แจ้งผลสำเร็จทางแชท — ไอคอน/สีมาตรฐานเดียวกันทั้งแอดออนเสมอ
export function showSuccess(player, message) {
  if (!player?.isValid) return;
  player.sendMessage(`${COLORS.status.success}${ICONS.status.success} ${stripLeadingColor(message)}`);
}

// แจ้งผลไม่สำเร็จ/ข้อผิดพลาดทางแชท — ไอคอน/สีมาตรฐานเดียวกันทั้งแอดออนเสมอ
export function showError(player, message) {
  if (!player?.isValid) return;
  player.sendMessage(`${COLORS.status.error}${ICONS.status.error} ${stripLeadingColor(message)}`);
}

// แจ้งข้อมูลทั่วไปทางแชท ไม่ใช่สถานะสำเร็จ/ไม่สำเร็จ (เช่น การแจ้งเตือน,
// สถานะที่เป็นกลาง) — ไม่แทรกไอคอน/สี ปล่อยตามข้อความที่ส่งมา
export function showInfo(player, message) {
  if (!player?.isValid) return;
  player.sendMessage(message);
}

// แสดงข้อความ action bar (เหนือ hotbar, หายไปเอง) — ข้อความ action bar
// มีสี/รูปแบบของตัวเองอยู่แล้วจาก locale string จึงไม่แทรกไอคอน/สีเพิ่ม
//
// category: id หัวข้อ action bar (ดู config/uiConfig.js ACTIONBAR_CATEGORIES)
// — ผู้เล่นปิดหัวข้อนี้ไว้จากหน้าตั้งค่าเมนู (ui/settings/uiSettings.js) ก็จะ
// ไม่ยิง action bar ให้เลย ไม่ระบุ (undefined) = ยิงตามปกติเสมอ ไม่เช็ค
// สถานะเปิด/ปิดของหัวข้อไหน (ใช้กับ action bar ที่ไม่ควรปิดได้ ถ้ามีในอนาคต)
export function showActionBar(player, message, category) {
  if (!player?.isValid) return;
  if (!isActionBarEnabled(player, category)) return;
  player.onScreenDisplay.setActionBar(message);
}

// แสดง title/subtitle กลางจอ (ยังไม่มีโมดูลไหนใช้จริงตอนนี้ เตรียมไว้ให้
// โมดูลอื่นในอนาคตใช้แทนการเรียก player.onScreenDisplay.setTitle() ตรง ๆ)
export function showTitle(player, title, subtitle) {
  if (!player?.isValid) return;
  player.onScreenDisplay.setTitle(title, subtitle ? { subtitle } : undefined);
}
