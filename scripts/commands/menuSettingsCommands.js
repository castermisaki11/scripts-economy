// =========================
// commands/menuSettingsCommands.js
// /prakan:menusettings — เปิดเมนู "ตั้งค่าเมนู" (จัดลำดับเมนูหลักส่วนตัว)
// โดยตรง (ui/settings/uiSettings.js) แทนที่จะต้องเข้าเมนูหลักแล้วเลื่อนไป
// กดปุ่มท้ายสุดก่อน
//
// เป็นคำสั่งระดับ "root" ของสแตกเมนู (เหมือน /prakan:job) — ไม่ส่ง
// onSaved/onCancel เข้าไป (เป็น optional ทั้งคู่ — ดู uiSettings.js) ปิด
// ฟอร์ม/กด "กลับ"/บันทึกสำเร็จ เลยแค่ปิดเมนูไปเฉย ๆ ไม่มีเมนูก่อนหน้าให้
// ย้อนกลับไป ต่างจากตอนเรียกจากเมนูหลัก (ซึ่งส่ง onSaved/onCancel เป็น
// NavigationManager.back() เพื่อย้อนไปเมนูหลัก)
//
// หมายเหตุ: คำสั่งนี้ไม่ใช่ isFirstTime — ผู้เล่นใหม่ที่ยังไม่เคยจัดลำดับ
// เมนูยังต้องเจอหน้าบังคับตั้งค่าตอนเปิดเมนูหลักครั้งแรกตามปกติ (ดู
// mainUi.js openUI()) คำสั่งนี้เป็นแค่ทางลัดแก้ไขซ้ำได้ทุกเมื่อ
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { openUISettings } from "../ui/settings/uiSettings";

definePlayerCommand({
  name: "prakan:menusettings",
  description: "เปิดเมนูตั้งค่าลำดับเมนูหลัก",
  execute(source) {
    system.run(() => {
      openUISettings(source);
    });
  },
});
