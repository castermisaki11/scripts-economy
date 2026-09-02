// =========================
// commands/adminCommands.js
// คำสั่งแชทเปิดเมนู Admin โดยตรง (ทางเข้าเพิ่มคู่กับปุ่มในเมนูหลัก ซึ่งจะ
// ถูกซ่อนจากผู้เล่นที่ไม่ใช่แอดมินอยู่แล้ว — ดู config/uiConfig.js
// adminOnly: true)
//   /prakan:admin        — เปิดเมนู Admin (GameMode/Gamerule/Command/TP)
//   /prakan:checkplayer  — เปิดเมนูเช็คของผู้เล่น
//
// สำคัญ — ทำไมต้องเช็ค isAdmin() เองในไฟล์นี้:
// adminUi.js (AdminUI.showMainMenu) และ inventoryUi.js (inv.showMainMenu)
// ไม่เช็คสิทธิ์แอดมินภายในตัวเองเลย — ที่ปลอดภัยอยู่ทุกวันนี้เพราะปุ่มเข้า
// เมนูพวกนี้ในเมนูหลัก (mainUi.js) ถูกกรองออกไปก่อนแล้วถ้า !isAdmin(player)
// (getOrderedMainMenuItems ใน uiSettings.js) ผู้เล่นทั่วไปเลย "มองไม่เห็น"
// ปุ่ม แต่คำสั่งแชทไม่ผ่านการกรองเมนูนั้น — ถ้าไม่เช็คตรงนี้เอง ผู้เล่น
// ทั่วไปจะพิมพ์คำสั่งตรง ๆ เข้าเมนู Admin ได้ทันที ไฟล์นี้จึงต้องเช็ค
// isAdmin(source) ก่อนเปิด UI ทุกครั้ง (แบบเดียวกับที่ economy.js /
// playerMarket.js เช็ค isAdmin ก่อนแสดงปุ่ม Admin Panel ของตัวเอง)
//
// ไฟล์นี้เข้าถึง instance ผ่าน getMainMenu() (mainUi.js) — คืน null ได้ถ้า
// โมดูล mainUi ยังไม่ initialize จึง guard ทุกจุดแทนการเรียก globalThis
// ตรง ๆ (เดิมพึ่ง "ต้องถูก import หลัง mainUi เสมอ" — queue pattern ของ
// commandRegistry ทำให้ handler ทำงานหลังโมดูลโหลดครบอยู่แล้ว แต่กันไว้
// อีกชั้น)
// =========================

import { system, CustomCommandStatus } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { isAdmin } from "../core/playerUtils";
import { showError } from "../core/messageUtils";
import { t } from "../ui/locale/index";
import { getMainMenu } from "../ui/components/mainUi";
import { ADMIN_FEATURES_ENABLED } from "../config/buildConfig";

// build no-admin — ไม่ queue คำสั่งทั้งสองเลย (ไม่ขึ้น autocomplete ด้วย)
// definePlayerCommand ต่อคิวตอน module load จึงต้องครอบการเรียกทั้งหมด
// ด้านล่างด้วยเงื่อนไขนี้
if (ADMIN_FEATURES_ENABLED) {

// =========================
// /prakan:admin
// =========================
definePlayerCommand({
  name: "prakan:admin",
  description: "เปิดเมนู Admin (เฉพาะแอดมิน)",
  execute(source) {
    if (!isAdmin(source)) {
      system.run(() => {
        showError(source, t("ui.noPermission"));
      });
      return { status: CustomCommandStatus.Failure };
    }

    system.run(() => {
      const menu = getMainMenu();
      if (!menu?.adminUI?.showMainMenu) {
        showError(source, t("ui.mainMenuUnavailable"));
        return;
      }
      menu.adminUI.showMainMenu(source);
    });
  },
});

// =========================
// /prakan:checkplayer
// =========================
definePlayerCommand({
  name: "prakan:checkplayer",
  description: "เปิดเมนูเช็คของผู้เล่น (เฉพาะแอดมิน)",
  execute(source) {
    if (!isAdmin(source)) {
      system.run(() => {
        showError(source, t("ui.noPermission"));
      });
      return { status: CustomCommandStatus.Failure };
    }

    system.run(() => {
      const menu = getMainMenu();
      if (!menu?.invUI?.showMainMenu) {
        showError(source, t("ui.mainMenuUnavailable"));
        return;
      }
      menu.invUI.showMainMenu(source);
    });
  },
});

} // end if (ADMIN_FEATURES_ENABLED)
