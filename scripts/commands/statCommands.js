// =========================
// commands/statCommands.js
// คำสั่งแชทของระบบจัดสรรแต้มสเตตัส (systems/statSystem.js)
//   /prakan:stats — เปิดเมนูจัดสรรแต้มสเตตัส (STR/AGI/VIT) — ทางเข้าเพิ่ม
//                    คู่กับปุ่ม "สเตตัส" ในเมนูหลัก ไม่ได้แทนที่กัน (เหมือน
//                    ความสัมพันธ์ /prakan:job กับปุ่ม "อาชีพ" — ดู jobCommands.js)
//
// เป็นคำสั่งระดับ "root" ของสแตกเมนู (เหมือน /prakan:job) จึงเรียก
// openStatUI() ตรง ๆ ได้เลย ไม่ต้อง NavigationManager.push() ก่อนเหมือน
// ตอน mainUi.js เรียกจากปุ่มเมนูหลัก — ที่นี่ไม่มีเมนูก่อนหน้าให้ย้อนกลับไป
// ปุ่ม "กลับ"/X ของ openStatUI() เลยแค่ปิดเมนูไปเฉย ๆ ถูกต้องอยู่แล้วตาม
// พฤติกรรมเดิมของ createListMenu() เมื่อไม่มีอะไรถูก push ไว้ก่อนหน้า
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { openStatUI } from "../systems/statSystem";

definePlayerCommand({
  name: "prakan:stats",
  description: "เปิดเมนูจัดสรรแต้มสเตตัส (STR/AGI/VIT)",
  execute(source) {
    // custom command ทำงานใน read-only mode — ต้องสั่งเปิด UI ผ่าน
    // system.run() เหมือน /prakan:job (ดู jobCommands.js)
    system.run(() => {
      openStatUI(source);
    });
  },
});
