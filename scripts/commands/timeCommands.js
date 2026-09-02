// =========================
// commands/timeCommands.js
//   /prakan:timezone [actionbar] — แสดงวันที่/เวลาปัจจุบัน (เวลาไทย UTC+7)
//   ไม่ใส่ argument = แสดงทางแชท (ข้อความหลายบรรทัด) ครั้งเดียว
//   ใส่ "bar"        = เปิด/ปิด (toggle) การแสดงเวลาที่ action bar "ตลอดเวลา"
//                       อัปเดตทุก 1 วินาทีเอง จนกว่าจะสั่งปิด (เรียกคำสั่ง
//                       เดิมซ้ำ) หรือออกจากเกม — ต่างจากเดิมที่ยิง action
//                       bar ครั้งเดียวแล้วข้อความหายไปเองตามปกติของ Minecraft
//
// เรียก formatDateLongThai()/formatTime() จาก core/timeUtils.js ตัวเดียว
// กับที่ระบบอื่นใช้บันทึก log (Transaction Log ฯลฯ) — ไม่มีการคำนวณเวลาซ้ำ
// ในไฟล์นี้เลย รับประกันว่าเวลาที่โชว์ตรงกับที่อื่นในแอดออนเสมอ ไม่ขึ้นกับ
// timezone ของเครื่อง host ที่รันเซิร์ฟเวอร์ (ดูหมายเหตุใน timeUtils.js)
//
// หมายเหตุ: ตั้งใจใช้ชื่อคำสั่ง "/prakan:timezone" ไม่ใช่ "/time" เฉย ๆ เพราะ
// "/time" เป็นคำสั่งของตัวเกม Minecraft เองอยู่แล้ว (ควบคุมรอบกลางวัน/
// กลางคืนในโลก เช่น /time set day) — Custom Command API ก็บังคับให้ทุก
// คำสั่งต้องมี namespace นำหน้าอยู่แล้วด้วย จะตั้งชื่อสั้นกว่านี้ไม่ได้
//
// PERSISTENT ACTION BAR LOOP
// เก็บรายชื่อผู้เล่นที่เปิดโหมด "bar" ไว้ใน Set เดียว (activeTimezoneBar)
// แล้ววน system.runInterval() รอบเดียวทุก TICKS_PER_SECOND (1 วินาที) คำนวณ
// วันที่/เวลาแค่ครั้งเดียวต่อรอบแล้วยิง action bar ให้ทุกคนใน Set — ไม่เปิด
// interval แยกต่อผู้เล่น (แบบเดียวกับ ACTIONBAR LOOP ใน systems/scoreboard.js)
// เพื่อไม่ให้เปลืองทรัพยากรถ้ามีคนเปิดพร้อมกันหลายคน วนผ่าน
// world.getPlayers() เท่านั้นจึงไม่ต้องคอยเคลียร์ Set ตอนผู้เล่นออกจากเกมเอง
// (คน offline จะไม่ถูกวนถึงอยู่แล้ว) — id ที่ค้างใน Set หลัง log out ไม่มีผล
// เพราะไม่มีทาง match กับผู้เล่นที่ล็อกอินใหม่ (id ของ Player object เปลี่ยน
// ทุกครั้งที่เข้าเกม)
// =========================

import { system, world, CustomCommandParamType } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { showInfo, showSuccess, showActionBar } from "../core/messageUtils";
import { t } from "../ui/locale/index";
import { formatDateLongThai, formatTime } from "../core/timeUtils";
import { TICKS_PER_SECOND } from "../core/constants";

// ผู้เล่น (id) ที่เปิดโหมดแสดงเวลาที่ action bar แบบต่อเนื่องอยู่ตอนนี้
const activeTimezoneBar = new Set();

// enum ของพารามิเตอร์ "mode" — ประกาศผ่าน definePlayerCommand (enums) เพื่อให้
// เกม registerEnum ตอน startup ค่า "bar" จะโชว์เป็น suggestion แบบวานิลา
// ตอนพิมพ์ /prakan:timezone ใน chat autocomplete
const TIMEZONE_MODE_ENUM = "prakan:timezone_mode";

definePlayerCommand({
  name: "prakan:timezone",
  description: "แสดงวันที่และเวลาปัจจุบัน (เวลาไทย) — ใส่ 'bar' เพื่อเปิด/ปิดแสดงทาง action bar ตลอดเวลา",
  enums: [{ name: TIMEZONE_MODE_ENUM, values: ["bar"] }],
  optionalParameters: [
    // พารามิเตอร์ Enum — name ต้องตรงกับชื่อ enum ที่ registerEnum ไว้เป๊ะ
    { name: TIMEZONE_MODE_ENUM, type: CustomCommandParamType.Enum },
  ],
  execute(source, origin, mode) {
    system.run(() => {
      if (typeof mode === "string" && mode.toLowerCase() === "bar") {
        // toggle: เปิดอยู่ -> ปิด, ปิดอยู่ -> เปิด
        if (activeTimezoneBar.has(source.id)) {
          activeTimezoneBar.delete(source.id);
          showSuccess(source, t("time.barDisabled"));
        } else {
          activeTimezoneBar.add(source.id);
          showSuccess(source, t("time.barEnabled"));
          // โชว์ทันทีรอบแรกโดยไม่ต้องรอ interval รอบถัดไป (สูงสุด 1 วินาที)
          showActionBar(source, t("time.currentActionBar", { date: formatDateLongThai(), time: formatTime() }), "time");
        }
      } else {
        const date = formatDateLongThai();
        const time = formatTime();
        showInfo(source, t("time.currentMessage", { date, time }));
      }
    });
  },
});

// วน 1 ครั้งทุก 1 วินาที (TICKS_PER_SECOND) อัปเดต action bar ให้ผู้เล่นทุกคน
// ที่เปิดโหมด "bar" ไว้ — คำนวณวันที่/เวลาแค่ครั้งเดียวต่อรอบแล้วใช้ร่วมกัน
system.runInterval(() => {
  if (activeTimezoneBar.size === 0) return;

  const date = formatDateLongThai();
  const time = formatTime();
  const message = t("time.currentActionBar", { date, time });

  for (const player of world.getPlayers()) {
    if (activeTimezoneBar.has(player.id)) {
      showActionBar(player, message, "time");
    }
  }
}, TICKS_PER_SECOND);
