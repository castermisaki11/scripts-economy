// =========================
// commands/mainUiCommand.js
// /prakan:mainui — เปิดเมนูหลัก (เหมือนใช้สมุดเมนู) แทนการใช้ไอเทม
// "สมุดเมนู" เพียงอย่างเดียว — ไม่ได้แทนที่ระบบเดิม แค่เป็นทางเข้าเพิ่ม
// เรียก getMainMenu().openUI() ตัวเดียวกับที่ mainUi.js ใช้ตอนกด
// ไอเทมเมนู ทุกอย่างหลังจากนั้น (Navigation, ฟอร์มต่าง ๆ) จึงเหมือนเดิม
// ทุกประการ ไม่มีการซ้อนสถานะ
//
// เข้าถึง instance ผ่าน getMainMenu() (mainUi.js) — คืน null ได้ถ้าโมดูล
// mainUi ยังไม่ initialize จึง guard ทุกจุดแทนการเรียก globalThis ตรง ๆ
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { getMainMenu } from "../ui/components/mainUi";
import { showError } from "../core/messageUtils";
import { t } from "../ui/locale/index";

definePlayerCommand({
  name: "prakan:mainui",
  description: "เปิดเมนูหลัก (เหมือนใช้สมุดเมนู)",
  execute(source) {
    // custom command ทำงานใน read-only mode — ต้องสั่งเปิด UI ผ่าน
    // system.run() เหมือนที่ mainUi.js เดิมทำตอนดักจับ itemUse
    system.run(() => {
      const menu = getMainMenu();
      if (!menu?.openUI) {
        showError(source, t("ui.mainMenuUnavailable"));
        return;
      }
      menu.openUI(source);
    });
  },
});
