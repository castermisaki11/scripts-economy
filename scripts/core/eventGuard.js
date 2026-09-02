// =========================
// core/eventGuard.js
// Helper subscribe world.afterEvents แบบ "หา signal ให้เจอก่อน" —
// กัน TypeError ตอน module load ถ้า runtime ไม่มี event ชื่อนั้น
//
// ที่มีปัญหาจริง (v1.4.0): event ขุดบล็อกมี 2 ชื่อตามเวอร์ชัน API —
//   "playerBlockBreak" (docs/@minecraft/server 2.x ล่าสุด)
//   "playerBreakBlock" (runtime ที่ใช้จริงบางเวอร์ชัน — ใช้อยู่แล้วใน
//    jobSystem.js / quests/events.js และทำงานปกติ)
// subscribeSafe() ลองชื่อตามลำดับที่ให้มา ใช้ตัวแรกที่ runtime มี
// ถ้าไม่มีเลย -> console.warn แค่บรรทัดเดียว โมดูลโหลดผ่าน ส่วนอื่น
// ของ addon ทำงานต่อได้ทั้งหมด (กันพังลุกลามทั้ง index.js)
// =========================

import { world } from "@minecraft/server";

/**
 * subscribe handler กับ world.afterEvents[eventNames] ตัวแรกที่มีอยู่จริง
 * @param {string[]} eventNames ชื่อ event เรียงตามลำดับที่ต้องการ (fallback)
 * @param {(event: any) => void} handler
 * @param {string} tag ชื่อระบบสำหรับ log (เช่น "Scoreboard")
 * @returns {boolean} true ถ้า subscribe สำเร็จ
 */
export function subscribeSafe(eventNames, handler, tag = "unknown") {
  for (const name of eventNames) {
    const signal = world.afterEvents[name];
    if (signal && typeof signal.subscribe === "function") {
      signal.subscribe(handler);
      return true;
    }
  }
  console.warn(`[${tag}] none of events [${eventNames.join(", ")}] available — feature disabled`);
  return false;
}

/**
 * ชื่อ event ขุดบล็อกที่รองรับหลาย runtime — ใช้คู่กับ subscribeSafe()
 */
export const BLOCK_BREAK_EVENTS = ["playerBlockBreak", "playerBreakBlock"];
