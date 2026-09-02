// =========================
// commands/shopCommands.js
// /prakan:shop — เปิดเมนูร้านค้า (โอน/ซื้อ/ขาย/ร้านเอฟเฟกต์) โดยตรง แทนที่
// จะต้องเข้าเมนูหลักแล้วเลือก "การเงิน" ก่อน — เรียก showShoppingMenu()
// ตัวเดียวกับที่เมนูหลักใช้ตอนกด "การเงิน" ทุกอย่างหลังจากนั้นเหมือนเดิม
// ทุกประการ (กด "กลับ"/ปิดฟอร์มจากเมนูนี้จะพาไปเมนูหลัก ตามพฤติกรรมเดิมของ
// showShoppingMenu — ไม่ได้แก้)
//
// /prakan:sell — เปิดเมนูขายไอเทมโดยตรง (openSellMenu จาก shopSystem.js)
// ตัวเดียวกับที่ปุ่ม "ขาย" ในเมนูร้านค้าเรียก — กด "กลับ"/ปิดฟอร์มจากที่นี่
// จะปิดเมนูไปเลย (ไม่มีอะไรถูก push ไว้ในสแตกก่อนหน้า เพราะเข้ามาจากคำสั่ง
// แชทตรง ๆ ไม่ได้ผ่านเมนูร้านค้าก่อน)
//
// เข้าถึง instance ผ่าน getMainMenu() (mainUi.js) — คืน null ได้ถ้าโมดูล
// mainUi ยังไม่ initialize จึง guard ทุกจุดแทนการเรียก globalThis ตรง ๆ
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { openSellMenu } from "../systems/shopSystem";
import { getMainMenu } from "../ui/components/mainUi";
import { showError } from "../core/messageUtils";
import { t } from "../ui/locale/index";

// =========================
// /prakan:shop
// =========================
definePlayerCommand({
  name: "prakan:shop",
  description: "เปิดเมนูร้านค้า (โอน/ซื้อ/ขาย/ร้านเอฟเฟกต์)",
  execute(source) {
    // custom command ทำงานใน read-only mode — ต้องสั่งเปิด UI ผ่าน
    // system.run() เหมือนคำสั่งเปิดเมนูอื่น ๆ ของแอดออนนี้
    system.run(() => {
      const menu = getMainMenu();
      if (!menu?.showShoppingMenu) {
        showError(source, t("ui.mainMenuUnavailable"));
        return;
      }
      menu.showShoppingMenu(source);
    });
  },
});

// =========================
// /prakan:sell
// =========================
definePlayerCommand({
  name: "prakan:sell",
  description: "เปิดเมนูขายไอเทมโดยตรง",
  execute(source) {
    system.run(() => {
      openSellMenu(source);
    });
  },
});
