// =========================
// commands/questCommands.js
// คำสั่งแชทของระบบเควสสุ่ม (systems/quests/ui/rootMenu.js)
//   /prakan:quest — เปิดเมนูเควส (ดูเควสปัจจุบัน / สุ่มเควสใหม่)
//
// เป็นคำสั่งระดับ "root" ของสแตกเมนู (เหมือน /prakan:stats, /prakan:job)
// จึงเรียก openQuestUI() ตรง ๆ ได้เลย ไม่ต้อง NavigationManager.push()
// ก่อน — ไม่มีเมนูก่อนหน้าให้ย้อนกลับไป ปุ่ม "กลับ"/X เลยแค่ปิดเมนูไปเฉย ๆ
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { openQuestUI } from "../systems/questSystem";

definePlayerCommand({
  name: "prakan:quest",
  description: "เปิดเมนูเควส (ดูเควสปัจจุบัน / สุ่มเควสใหม่)",
  execute(source) {
    // custom command ทำงานใน read-only mode — ต้องสั่งเปิด UI ผ่าน
    // system.run() เหมือนคำสั่งเปิดเมนูอื่น ๆ (ดู statCommands.js)
    system.run(() => {
      openQuestUI(source);
    });
  },
});
