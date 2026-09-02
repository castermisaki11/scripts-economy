// =========================
// registerCommands.js
// จุดรวมการลงทะเบียนคำสั่งแชท (Custom Command API) ทั้งหมดของแอดออนนี้ —
// ต้องใช้ @minecraft/server >= 2.1.0 (ดู manifest.json)
//
// === โครงสร้างใหม่ (ดู core/commandRegistry.js) ===
// ไฟล์นี้ไม่ได้ประกาศคำสั่งเองอีกต่อไป — แต่ละคำสั่งแยกไฟล์ของตัวเองอยู่ใน
// commands/ (เช่น mainUiCommand.js, tpCommands.js, homeCommands.js) เรียก
// definePlayerCommand() "ต่อคิว" ตัวเองไว้ตอนถูก import — ไฟล์นี้มีหน้าที่
// แค่ 2 อย่าง:
//   1) import ไฟล์คำสั่งทุกไฟล์ (เพื่อให้แต่ละไฟล์ต่อคิวตัวเอง)
//   2) เรียก installCommands() ครั้งเดียวตอนท้าย เพื่อลงทะเบียนคิวทั้งหมด
//      กับ customCommandRegistry จริงตอน startup event
//
// เพิ่มคำสั่งใหม่ในอนาคต = สร้างไฟล์ใหม่ใน commands/ (ดูตัวอย่างจากไฟล์ที่
// มีอยู่) แล้วเพิ่ม import บรรทัดเดียวด้านล่าง — ไม่ต้องแก้โค้ดคำสั่งเดิม
// ไฟล์อื่นเลย ไม่ต้องแตะ core/commandRegistry.js ด้วย
//
// สำคัญ: ไฟล์นี้ต้องถูก import หลัง "./ui/components/mainUi" เสมอ (ดู
// index.js) เพราะ mainUiCommand.js ต้องพึ่ง globalThis.mainMenu ที่
// mainUi.js สร้างไว้ตอนโหลดโมดูล — ลำดับ import ปกติของ ES module
// รับประกันเรื่องนี้อยู่แล้ว
// =========================

import "./mainUiCommand";
import "./tpCommands";
import "./homeCommands";
import "./shopCommands";
import "./timeCommands";
import "./jobCommands";
import "./statCommands";
import "./mystatsCommand";
import "./questCommands";
import "./autoCollectCommands";
import "./marketCommands";
import "./scoreboardCommands";
import "./aliasCommands";
import "./adminCommands";
import "./menuSettingsCommands";
import "./rewardCommands";

import { installCommands } from "../core/commandRegistry";

installCommands();
