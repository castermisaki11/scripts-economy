// =========================
// commands/jobCommands.js
// คำสั่งแชทของระบบอาชีพ (systems/jobSystem.js)
//   /prakan:job      — เปิดเมนูอาชีพ (เลือก/เปลี่ยนอาชีพ, ดูตารางรางวัล) —
//                       ทางเข้าเพิ่มเติมคู่กับปุ่ม "อาชีพ" ในเมนูหลัก ไม่ได้
//                       แทนที่กัน (เหมือนความสัมพันธ์ /prakan:mainui กับ
//                       ไอเทมสมุดเมนู — ดู mainUiCommand.js)
//   /prakan:jobhelp  — อธิบายวิธีใช้ระบบอาชีพ (แบบเดียวกับ /prakan:homehelp
//                       ของระบบบ้าน)
//
// เป็นคำสั่งระดับ "root" ของสแตกเมนู (เหมือน /prakan:mainui) จึงเรียก
// openJobUI() ตรง ๆ ได้เลย ไม่ต้อง NavigationManager.push() ก่อนเหมือนตอน
// mainUi.js เรียกจากปุ่มเมนูหลัก (ซึ่งต้อง push เพื่อให้ปุ่ม "กลับ" ย้อน
// ไปเมนูหลักได้) — ที่นี่ไม่มีเมนูก่อนหน้าให้ย้อนกลับไป ปุ่ม "กลับ"/X ของ
// openJobUI() เลยแค่ปิดเมนูไปเฉย ๆ ถูกต้องอยู่แล้วตามพฤติกรรมเดิมของ
// createListMenu() เมื่อไม่มีอะไรถูก push ไว้ก่อนหน้า
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { openJobUI } from "../systems/jobSystem";
import { showInfo } from "../core/messageUtils";
import { t } from "../ui/locale/index";
import { JOB_CONFIG } from "../config/jobConfig";

// =========================
// /prakan:job — เปิดเมนูอาชีพ
// =========================
definePlayerCommand({
  name: "prakan:job",
  description: "เปิดเมนูอาชีพ (เลือก/เปลี่ยนอาชีพ, ดูตารางรางวัล)",
  execute(source) {
    // custom command ทำงานใน read-only mode — ต้องสั่งเปิด UI ผ่าน
    // system.run() เหมือน /prakan:mainui (ดู mainUiCommand.js)
    system.run(() => {
      openJobUI(source);
    });
  },
});

// =========================
// /prakan:jobhelp — อธิบายวิธีใช้ระบบอาชีพ (ค่าธรรมเนียม/คูลดาวน์/เพิร์ค
// ดึงจาก config/jobConfig.js สดเสมอ ไม่ hardcode ตัวเลขในข้อความ)
// =========================
definePlayerCommand({
  name: "prakan:jobhelp",
  description: "อธิบายวิธีใช้ระบบอาชีพ (/prakan:job)",
  execute(source) {
    system.run(() => {
      showInfo(source, t("job.helpMessage", {
        fee: JOB_CONFIG.CHANGE.FEE.toLocaleString(),
        cooldownHours: Math.round(JOB_CONFIG.CHANGE.COOLDOWN_SECONDS / 3600),
        maxLevel: JOB_CONFIG.LEVEL.MAX_LEVEL,
        // รวมเลเวลปลดล็อกเพิร์คทุก tier เป็น "15/30/50" — ไม่ hardcode
        // จำนวน tier เผื่อมีคนเพิ่ม/ลด tier ใน jobConfig.js ภายหลัง
        perkTiers: JOB_CONFIG.PERK.TIERS.map((tier) => tier.level).join("/"),
      }));
    });
  },
});
