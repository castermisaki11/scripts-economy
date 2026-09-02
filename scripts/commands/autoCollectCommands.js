// =========================
// commands/autoCollectCommands.js
// /prakan:autocollect — เปิดเมนู "เก็บของอัตโนมัติ" โดยตรง แทนที่จะต้อง
// เข้าเมนูหลักแล้วเลือก "เก็บของอัตโนมัติ" ก่อน (เหมือนความสัมพันธ์
// /prakan:shop กับปุ่ม "การเงิน" ในเมนูหลัก — ดู shopCommands.js)
//
// สำคัญ: ต้องเรียกผ่าน instance เดียวกับที่ mainUi.js สร้างไว้ (ไม่
// new AutoCollector() ขึ้นมาเอง) เพราะ instance นั้นผูกกับ event ที่
// initialize() ลงทะเบียนไว้แล้ว (registerEvents, startXPInterval,
// startItemVacuumInterval, startMoneyDrainInterval) — ถ้าสร้าง instance
// ใหม่ toggle ที่ตั้งจากคำสั่งนี้จะไปเก็บอยู่ใน Map ของ instance ที่ไม่มี
// event ใด ๆ ทำงานจริง กลายเป็นตั้งค่าไม่มีผลอะไรเลย
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
  name: "prakan:autocollect",
  description: "เปิดเมนูเก็บของอัตโนมัติ",
  execute(source) {
    // custom command ทำงานใน read-only mode — ต้องสั่งเปิด UI ผ่าน
    // system.run() เหมือนคำสั่งเปิดเมนูอื่น ๆ ของแอดออนนี้
    system.run(() => {
      const menu = getMainMenu();
      if (!menu?.autoCollector?.showToggleForm) {
        showError(source, t("ui.mainMenuUnavailable"));
        return;
      }
      menu.autoCollector.showToggleForm(source);
    });
  },
});
