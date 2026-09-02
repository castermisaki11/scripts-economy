// =========================
// commandRegistry.js
// ระบบกลางสำหรับลงทะเบียน Custom Command (แชท) ของแอดออน
//
// เดิม: ทุกคำสั่งถูกลงทะเบียนตรง ๆ ใน system.beforeEvents.startup.subscribe()
// เดียวกันทั้งก้อนภายในไฟล์ registerCommands.js ไฟล์เดียว — ทุกคำสั่งใหม่
// ต้องมาแก้ไฟล์นั้นเพิ่ม และต้องคัดลอกเช็ค "ต้องเป็นผู้เล่นในเกมเท่านั้น"
// (ไม่ใช่ console/command block) ซ้ำทุกคำสั่งเอง ยิ่งเพิ่มคำสั่งมาก ไฟล์นั้น
// ก็ยิ่งยาวและเสี่ยงชนกันตอนแก้พร้อมกันหลายคน
//
// ตอนนี้: แต่ละคำสั่งแยกไฟล์ของตัวเองใน commands/ (เช่น commands/homeCommands.js)
// เรียก definePlayerCommand() ตอนโมดูลถูกโหลด — เป็นแค่การ "ต่อคิว" ไว้ก่อน
// ยังไม่ได้ลงทะเบียนจริงกับเกม (customCommandRegistry ใช้ได้เฉพาะตอน
// startup event เท่านั้น) ทำงานได้เพราะ import ของ ES module ทำงานก่อน
// event ใด ๆ เสมอ รับประกันว่าทุกไฟล์คำสั่งต่อคิวเสร็จก่อน installCommands()
// จะถูกเรียก (ดู commands/registerCommands.js ที่เป็นจุดเดียวที่ import
// ไฟล์คำสั่งทั้งหมด + เรียก installCommands())
//
// เพิ่มคำสั่งใหม่ = สร้างไฟล์ใหม่ใน commands/ เรียก definePlayerCommand()
// ตามรูปแบบด้านล่าง แล้วเพิ่ม import ไฟล์นั้น 1 บรรทัดใน
// commands/registerCommands.js — ไม่ต้องแก้โค้ดคำสั่งเดิมไฟล์อื่นเลย
// =========================

import {
  system,
  Player,
  CommandPermissionLevel,
  CustomCommandStatus,
} from "@minecraft/server";
import { isValidPlayer } from "./playerUtils";
import { t } from "../ui/locale/index";

// ข้อความ error มาตรฐานตอนคำสั่งถูกเรียกจากที่ที่ไม่ใช่ผู้เล่นในเกม (เช่น
// console หรือ command block) — ใช้ key เดียวกันทุกคำสั่งเสมอ ไม่ต้องพิมพ์ซ้ำ
// ในแต่ละไฟล์คำสั่ง (ผ่าน t() ตอน handler ทำงาน ไม่ hardcode ข้อความ)
const PLAYER_ONLY_MESSAGE_KEY = "ui.playerOnlyCommand";

const queue = [];
let installed = false;

/**
 * ต่อคิวคำสั่งใหม่ที่ต้องมาจากผู้เล่นในเกมเท่านั้น (ปฏิเสธ console/
 * command block ให้อัตโนมัติ ก่อนเรียก execute() เสมอ — ครอบคลุมทุกคำสั่ง
 * ของแอดออนนี้ ณ ตอนนี้ ถ้าในอนาคตมีคำสั่งที่ต้องใช้จาก console ได้ด้วย
 * ค่อยเพิ่มฟังก์ชันคู่ขนานที่ไม่เช็คเงื่อนไขนี้)
 *
 * execute() ทำงานใน "read-only mode" ของ custom command เหมือนเดิมทุก
 * ประการ — ถ้าต้องแก้โลก/เปิด UI ยังต้องครอบด้วย system.run() เองในไฟล์
 * คำสั่งนั้น ๆ (ระบบนี้ไม่ได้ครอบให้อัตโนมัติ เพราะบางคำสั่งอยากอ่านค่า/
 * ตรวจสอบเงื่อนไขก่อนแล้วค่อยตัดสินใจว่าจะ system.run() หรือคืน Failure
 * เลยโดยไม่ต้องเปิด UI เลยก็ได้ เช่น /prakan:tpa ตอนหาผู้เล่นเป้าหมายไม่เจอ)
 *
 * @param {{
 *   name: string,                              เช่น "prakan:home" (ต้องมี namespace นำหน้าเสมอ)
 *   description: string,
 *   permissionLevel?: CommandPermissionLevel,   ค่าเริ่มต้น Any (ผู้เล่นทุกคนใช้ได้)
 *   cheatsRequired?: boolean,                   ค่าเริ่มต้น false
 *   enums?: Array<{name: string, values: string[]}>,  enum ของคำสั่งนี้ (registerEnum
 *                                              ให้เกมก่อนลงทะเบียนตัวคำสั่ง — ค่าที่
 *                                              ประกาศจะโชว์เป็น suggestion แบบวานิลา
 *                                              ใน chat autocomplete) name ต้องมี
 *                                              namespace เหมือนคำสั่ง เช่น "prakan:mode"
 *   mandatoryParameters?: Array,
 *   optionalParameters?: Array,
 *   execute: (source: Player, origin, ...args) => ({status, message} | void)
 * }} definition
 */
export function definePlayerCommand(definition) {
  const {
    name,
    description,
    permissionLevel = CommandPermissionLevel.Any,
    cheatsRequired = false,
    enums,
    mandatoryParameters,
    optionalParameters,
    execute,
  } = definition;

  queue.push({
    name,
    description,
    permissionLevel,
    cheatsRequired,
    enums,
    mandatoryParameters,
    optionalParameters,
    handler(origin, ...args) {
      const source = origin.sourceEntity;

      if (!(source instanceof Player) || !isValidPlayer(source)) {
        return {
          status: CustomCommandStatus.Failure,
          message: t(PLAYER_ONLY_MESSAGE_KEY),
        };
      }

      // execute() คืนค่าได้ 3 แบบ: object {status,...} (ใช้ตามนั้นตรง ๆ —
      // เช่นตอนต้องการคืน Failure), undefined/ไม่คืนอะไร (ถือว่าสำเร็จ),
      // หรือโยน error (ปล่อยให้หลุดออกไปเหมือนคำสั่งอื่นของเกม)
      const result = execute(source, origin, ...args);
      return result ?? { status: CustomCommandStatus.Success };
    },
  });
}

/**
 * ลงทะเบียนคำสั่งทั้งหมดที่ถูกต่อคิวไว้ (ผ่าน definePlayerCommand ด้านบน)
 * กับ customCommandRegistry จริง — ต้องเรียกครั้งเดียวเท่านั้น หลังจากไฟล์
 * คำสั่งทั้งหมดถูก import ไปแล้ว (ดู commands/registerCommands.js ซึ่งเป็น
 * จุดเดียวที่เรียกฟังก์ชันนี้)
 */
export function installCommands() {
  if (installed) return; // กันลงทะเบียนซ้ำถ้ามีการเรียกมากกว่า 1 ครั้งโดยไม่ตั้งใจ
  installed = true;

  system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    for (const cmd of queue) {
      try {
        // enum ต้อง registerEnum ก่อน registerCommand เสมอ (พารามิเตอร์
        // CustomCommandParamType.Enum อ้างชื่อ enum ที่ประกาศไว้แล้วเท่านั้น)
        if (cmd.enums) {
          for (const { name, values } of cmd.enums) {
            customCommandRegistry.registerEnum(name, values);
          }
        }

        const commandData = {
          name: cmd.name,
          description: cmd.description,
          permissionLevel: cmd.permissionLevel,
          cheatsRequired: cmd.cheatsRequired,
        };
        // ใส่เฉพาะ key ที่มีค่าจริง — registerCommand บางเวอร์ชันของ API
        // เข้มงวดกับ key ที่เป็น undefined
        if (cmd.mandatoryParameters) commandData.mandatoryParameters = cmd.mandatoryParameters;
        if (cmd.optionalParameters) commandData.optionalParameters = cmd.optionalParameters;

        customCommandRegistry.registerCommand(commandData, cmd.handler);

        // log ทีละคำสั่ง — ใช้ไล่ตอนคำสั่งไม่โผล่ใน chat autocomplete
        // (ถ้าจำนวนบรรทัดไม่ครบตามจำนวนคำสั่ง = มีตัวที่ throw กลางทาง)
        console.log(`[Commands] registered ${cmd.name}`);
      } catch (err) {
        // กันคำสั่งตัวหนึ่งพังแล้วดึงตัวที่เหลือหายไปหมดทั้ง startup event —
        // เกมจะ error ก้อนใหญ่ตอน startup ถ้าปล่อยหลุดออกไปเฉย ๆ
        console.warn(`[Commands] FAILED to register ${cmd.name}: ${err}`);
      }
    }
  });
}
