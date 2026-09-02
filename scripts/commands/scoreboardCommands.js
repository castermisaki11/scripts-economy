// =========================
// commands/scoreboardCommands.js
// /prakan:score — เปิดเมนู "กระดานอันดับ" โดยตรง (หน้าเลือกหมวด:
// เงิน/สถิติการขุด/Kills/Deaths — ui/components/moneyScoreboardUi.js)
// แทนที่จะต้องเข้าเมนูหลักแล้วเลือก "อันดับเงิน" ก่อน
//
// เป็นคำสั่งระดับ "root" ของสแตกเมนู (เหมือน /prakan:job) จึงเรียก
// openMoneyScoreboardUI() ตรง ๆ ได้เลย ไม่ต้อง NavigationManager.push()
// ก่อน — หน้านี้เป็นหน้าข้อมูลอย่างเดียว (ไม่มี logic ย่อยให้กด) ปุ่ม
// "กลับ"/X เลยแค่ปิดเมนูไปเฉย ๆ
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { openMoneyScoreboardUI } from "../ui/components/moneyScoreboardUi";

definePlayerCommand({
  name: "prakan:score",
  description: "เปิดเมนูกระดานอันดับ (เงิน/ขุด/Kills/Deaths)",
  execute(source) {
    system.run(() => {
      openMoneyScoreboardUI(source);
    });
  },
});
