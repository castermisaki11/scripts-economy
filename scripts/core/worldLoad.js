// =========================
// core/worldLoad.js
// จุด subscribe world.afterEvents.worldLoad จุดเดียวของแอดออน
//
// เดิมแต่ละโมดูล (index.js, core/economyUtils.js, systems/scoreboard.js)
// subscribe ตรง ๆ คนละจุดสำหรับงานเล็ก ๆ ตอน world โหลด — รวมมาที่นี่
// เพื่อ (1) มี subscription เดียว (2) callback ทุกตัวถูกครอบ try/catch
// กัน callback ของโมดูลหนึ่ง throw แล้วกระทบตัวอื่น (3) เพิ่มงานตอน
// worldLoad ในอนาคต = import onWorldLoad() ไปใช้ ไม่ต้อง subscribe เอง
//
// ลำดับการรัน callback = ลำดับที่ import/register (เดิมทีละ subscription
// ก็รันตามลำดับ subscribe เหมือนกัน จึงไม่เปลี่ยนพฤติกรรม)
// =========================

import { world } from "@minecraft/server";
import { ADDON_VERSION } from "./constants";
import { ADMIN_FEATURES_ENABLED } from "../config/buildConfig";

const callbacks = [];

world.afterEvents.worldLoad.subscribe(() => {
  // โชว์เวอร์ชันครั้งเดียวต่อการเข้า world — ใช้ยืนยันว่าแพ็กเวอร์ชันไหน
  // (และตัวไหน full/no-admin) ถูกโหลดจริง กัน cache แพ็กเก่า
  const variant = ADMIN_FEATURES_ENABLED ? "" : " (no-admin)";
  console.log(`[Addon] mcpe-economy-system v${ADDON_VERSION}${variant}`);

  for (const cb of callbacks) {
    try {
      cb();
    } catch (error) {
      console.warn("[worldLoad] callback error:", error);
    }
  }
});

/**
 * ลงทะเบียนงานที่ต้องทำหลัง world โหลดเสร็จ (เช่น สร้าง/อ่าน scoreboard
 * objective — world.scoreboard ห้ามอ่านตอน early execution)
 * @param {() => void} callback
 */
export function onWorldLoad(callback) {
  callbacks.push(callback);
}
