// =========================
// commands/homeCommands.js
// คำสั่งแชทของระบบบ้านส่วนตัว (systems/homeSystem.js)
//   /prakan:sethome [name]  — ตั้งบ้านที่ตำแหน่งปัจจุบัน (ไม่ใส่ชื่อ = "home")
//   /prakan:home [name]     — วาปไปบ้านที่ตั้งไว้
//   /prakan:delhome [name]  — ลบบ้าน (มีหน้ายืนยันก่อนลบจริง)
//   /prakan:homes           — แสดงรายชื่อบ้านทั้งหมดที่ตั้งไว้ (ทางแชท)
//   /prakan:homemenu        — เปิดเมนูบ้านแบบกราฟิก (เลือก/วาป/ลบผ่านปุ่ม)
//
// ทุกคำสั่งเรียกฟังก์ชันเดียวกับที่ homeSystem.js export ไว้ — ไฟล์นี้มี
// หน้าที่แค่แปลผลลัพธ์ ({ok, reason, name, isNew}) เป็นข้อความ/เสียงให้
// ผู้เล่นเห็นเท่านั้น ไม่มีตรรกะเก็บ/อ่านข้อมูลบ้านเอง
// =========================

import { system, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import {
  setHome,
  deleteHome,
  teleportHome,
  listHomeNames,
  normalizeHomeName,
  openHomeUI,
} from "../systems/homeSystem";
import { showError, showSuccess, showInfo, showActionBar } from "../core/messageUtils";
import { showConfirm } from "../core/confirmDialog";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { t } from "../ui/locale/index";
import { ECONOMY_CONFIG } from "../config/economyConfig";

// พารามิเตอร์ "ชื่อบ้าน" เป็น optional เหมือนกันทุกคำสั่งที่ต้องใช้ —
// ไม่ระบุ = ใช้ชื่อ default "home" (ดู normalizeHomeName ใน homeSystem.js)
const OPTIONAL_NAME_PARAM = [
  { name: "homeName", type: CustomCommandParamType.String },
];

// =========================
// /prakan:sethome [name]
// =========================
definePlayerCommand({
  name: "prakan:sethome",
  description: "ตั้งบ้านที่ตำแหน่งปัจจุบัน (ระบุชื่อได้ ไม่ใส่ = 'home')",
  optionalParameters: OPTIONAL_NAME_PARAM,
  execute(source, origin, homeName) {
    const result = setHome(source, homeName);

    system.run(() => {
      if (!result.ok && result.reason === "cooldown") {
        showError(source, t("home.commandCooldown", { seconds: result.secondsLeft }));
        return;
      }
      if (!result.ok && result.reason === "limit") {
        showError(source, t("home.setLimitReached", { max: ECONOMY_CONFIG.HOME.MAX_HOMES }));
        return;
      }
      if (!result.ok && result.reason === "funds") {
        showError(source, t("home.setInsufficientFunds", {
          cost: ECONOMY_CONFIG.HOME.SET_HOME_COST.toLocaleString(),
        }));
        return;
      }

      showSuccess(source, t(result.isNew ? "home.setSuccessNew" : "home.setSuccessOverwrite", { name: result.name }));
      source.playSound("random.orb");
    });

    if (!result.ok) return { status: CustomCommandStatus.Failure };
  },
});

// =========================
// /prakan:home [name]
// วาปไม่ทันที — หักเงินแล้วเข้านับถอยหลัง ECONOMY_CONFIG.HOME.CHANNEL_SECONDS
// วินาที (ต้องยืนนิ่ง ห้ามเปลี่ยนมิติ/โดนโจมตี ไม่งั้นถูกยกเลิก+คืนเงิน) —
// ข้อความนับถอยหลัง/สำเร็จ/ถูกยกเลิก แจ้งผ่าน action bar โดย homeSystem.js
// เอง (ดู startHomeChannel()/finishHomeTeleport()) ไม่ต้องแจ้งซ้ำตรงนี้
// =========================
definePlayerCommand({
  name: "prakan:home",
  description: "วาปไปบ้านที่ตั้งไว้ (ระบุชื่อได้ ไม่ใส่ = 'home') — คิดค่าเดินทางตามระยะทางเหมือน /prakan:tpa มีนับถอยหลังก่อนวาป",
  optionalParameters: OPTIONAL_NAME_PARAM,
  execute(source, origin, homeName) {
    const result = teleportHome(source, homeName);

    if (!result.ok) {
      system.run(() => {
        if (result.reason === "funds") {
          showError(source, t("home.teleportInsufficientFunds", { cost: result.cost.toLocaleString() }));
          return;
        }
        if (result.reason === "channeling") {
          showActionBar(source, t("home.alreadyChannelingActionBar", { seconds: result.secondsLeft }), "home");
          return;
        }
        if (result.reason === "cooldown") {
          showError(source, t("home.commandCooldown", { seconds: result.secondsLeft }));
          return;
        }
        showError(source, t("home.notFound", { name: result.name }));
      });
      return { status: CustomCommandStatus.Failure };
    }
  },
});

// =========================
// /prakan:delhome [name] — มีหน้ายืนยันก่อนลบจริง (showConfirm มาตรฐาน
// เดียวกับหน้ายืนยันอื่น ๆ ของแอดออน) กันผู้เล่นลบบ้านผิดโดยไม่ตั้งใจ
// =========================
definePlayerCommand({
  name: "prakan:delhome",
  description: "ลบบ้านที่ตั้งไว้ (ระบุชื่อได้ ไม่ใส่ = 'home')",
  optionalParameters: OPTIONAL_NAME_PARAM,
  execute(source, origin, homeName) {
    const name = normalizeHomeName(homeName);

    system.run(() => {
      showConfirm({
        player: source,
        titleKey: "home.deleteConfirmTitle",
        bodyKey: "home.deleteConfirmBody",
        bodyVars: { name },
        onCancel: () => NavigationManager.back(source),
        onConfirm: () => {
          const result = deleteHome(source, name);

          if (!result.ok) {
            if (result.reason === "cooldown") {
              showError(source, t("home.commandCooldown", { seconds: result.secondsLeft }));
              return;
            }
            showError(source, t("home.notFound", { name: result.name }));
            return;
          }
          showSuccess(source, t("home.deleteSuccess", { name: result.name }));
          source.playSound("random.orb");
        },
      });
    });
  },
});

// =========================
// /prakan:homes — แสดงรายชื่อบ้านทั้งหมด (ไม่มีพารามิเตอร์)
// =========================
definePlayerCommand({
  name: "prakan:homes",
  description: "แสดงรายชื่อบ้านทั้งหมดที่ตั้งไว้",
  execute(source) {
    const names = listHomeNames(source);

    system.run(() => {
      if (names.length === 0) {
        showInfo(source, t("home.listEmpty"));
        return;
      }

      showInfo(source, t("home.listHeader", {
        list: names.map(n => `§b- ${n}`).join("\n"),
        count: names.length,
        max: ECONOMY_CONFIG.HOME.MAX_HOMES,
      }));
    });
  },
});

// =========================
// /prakan:homemenu — เปิดเมนูบ้านแบบกราฟิก (home.uiTitle) ต่างจาก
// /prakan:homes ที่แสดงแค่รายชื่อทางแชท — เมนูนี้เลือกบ้านจากปุ่มได้เลย
// (วาป/ลบ) และมีปุ่ม "+ ตั้งบ้านใหม่" ในตัว เป็นคำสั่งระดับ "root" ของ
// สแตกเมนู (เหมือน /prakan:job) จึงเรียก openHomeUI() ตรง ๆ ได้เลย ไม่ต้อง
// NavigationManager.push() ก่อน
// =========================
definePlayerCommand({
  name: "prakan:homemenu",
  description: "เปิดเมนูบ้านแบบกราฟิก (เลือก/วาป/ลบผ่านปุ่ม)",
  execute(source) {
    system.run(() => {
      openHomeUI(source);
    });
  },
});

// =========================
// /prakan:homehelp — อธิบายวิธีใช้คำสั่งของระบบบ้านทั้งหมด (แบบเดียวกับ
// /prakan:tpahelp ของระบบ TP)
// =========================
definePlayerCommand({
  name: "prakan:homehelp",
  description: "อธิบายวิธีใช้คำสั่งของระบบบ้าน (/prakan:home, sethome, ...)",
  execute(source) {
    system.run(() => {
      showInfo(source, t("home.helpMessage", {
        maxHomes: ECONOMY_CONFIG.HOME.MAX_HOMES,
        costPerBlock: ECONOMY_CONFIG.HOME.COST_PER_BLOCK.toLocaleString(),
        crossDimCost: ECONOMY_CONFIG.HOME.CROSS_DIMENSION_COST.toLocaleString(),
        channelSeconds: ECONOMY_CONFIG.HOME.CHANNEL_SECONDS,
        cooldownSeconds: ECONOMY_CONFIG.HOME.COMMAND_COOLDOWN_SECONDS,
      }));
    });
  },
});
