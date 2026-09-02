// =========================
// commands/marketCommands.js
// /prakan:market — เปิดเมนู "ตลาดผู้เล่น" (ui/components/marketUi.js) โดยตรง
// แทนที่จะต้องเข้าเมนูหลักแล้วเลือก "ตลาดผู้เล่น" ก่อน
//
// เป็นคำสั่งระดับ "root" ของสแตกเมนู (เหมือน /prakan:job, /prakan:quest)
// จึงเรียก openMarketUI() ตรง ๆ ได้เลย ไม่ต้อง NavigationManager.push()
// ก่อน — ไม่มีเมนูก่อนหน้าให้ย้อนกลับไป ปุ่ม "กลับ"/X เลยแค่ปิดเมนูไปเฉย ๆ
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { openMarketUI } from "../ui/components/marketUi";

definePlayerCommand({
  name: "prakan:market",
  description: "เปิดเมนูตลาดผู้เล่น",
  execute(source) {
    // custom command ทำงานใน read-only mode — ต้องสั่งเปิด UI ผ่าน
    // system.run() เหมือนคำสั่งเปิดเมนูอื่น ๆ ของแอดออนนี้
    system.run(() => {
      openMarketUI(source);
    });
  },
});
