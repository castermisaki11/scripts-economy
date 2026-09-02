// =========================
// commands/tpCommands.js
// คำสั่งแชทของระบบ Teleport แบบขอ-ยอมรับ (tpBankSystem.js)
//   /prakan:tpmenu        — เปิดเมนู Teleport (เลือกผู้เล่นจากรายชื่อ)
//   /prakan:tpa <player>  — ส่งคำขอ Teleport ไปหาผู้เล่นที่ระบุ
//   /prakan:tpahelp       — อธิบายวิธีใช้คำสั่งข้างบน
//   /prakan:tpaccept      — ยอมรับคำขอ TP ที่ค้างอยู่ทางแชท
//
// ทุกคำสั่งเรียกฟังก์ชันเดียวกับที่เมนู TP ใช้ (openTpUI / openTpConfirmUI /
// acceptTp / hasPendingTpRequest จาก tpBankSystem.js) — ไม่มีตรรกะราคา/คำขอ
// ซ้ำ
// =========================

import { system, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { openTpUI, openTpConfirmUI, acceptTp, hasPendingTpRequest } from "../systems/tpBankSystem";
import { showError, showInfo } from "../core/messageUtils";
import { t } from "../ui/locale/index";
import { ECONOMY_CONFIG } from "../config/economyConfig";

// =========================
// /prakan:tpmenu — เปิดเมนู Teleport (รายชื่อผู้เล่น + ปุ่มเปิด/ปิดรับคำขอ)
// ชื่อเดิมคือ /prakan:tp แต่ทับกับคำสั่ง /tp มาตรฐานของเกม (สั้นพอที่
// ไคลเอนต์บางตัว/auto-complete จะสับสนได้) จึงเปลี่ยนมาใช้ /prakan:tpmenu
// แทน — เป็นคำสั่งระดับ "root" ของสแตกเมนู (เหมือน /prakan:job,
// /prakan:quest) จึงเรียก openTpUI() ตรง ๆ ได้เลย ไม่ต้อง
// NavigationManager.push() ก่อน — ไม่มีเมนูก่อนหน้าให้ย้อนกลับไป ปุ่ม
// "กลับ"/X เลยแค่ปิดเมนูไปเฉย ๆ
// =========================
definePlayerCommand({
  name: "prakan:tpmenu",
  description: "เปิดเมนู Teleport (เลือกผู้เล่นจากรายชื่อ)",
  execute(source) {
    system.run(() => {
      openTpUI(source);
    });
  },
});

// =========================
// /prakan:tpa <player> — ส่งคำขอ Teleport ตรง ๆ จากแชท แทนการเปิดเมนู TP
// แล้วเลือกผู้เล่นเอง ทุกอย่างหลังจากนี้ (คิดราคา/แจ้งเตือน/หน้ายืนยันฝั่ง
// ผู้รับ) เหมือนเดิมทุกประการ เพราะเรียก openTpConfirmUI ตัวเดียวกับที่
// เมนูใช้
// =========================
definePlayerCommand({
  name: "prakan:tpa",
  description: "ส่งคำขอ Teleport ไปหาผู้เล่นที่ระบุ",
  mandatoryParameters: [
    { name: "target", type: CustomCommandParamType.PlayerSelector },
  ],
  execute(source, origin, targetSelector) {
    // targetSelector เป็นผลลัพธ์ของ player selector — อาจว่าง (ไม่พบ/
    // ไม่ออนไลน์), มีมากกว่า 1 คน (เช่นใช้ selector แบบกว้าง), หรือมี
    // ตัวเองปนอยู่ — เอาคนแรกที่ไม่ใช่ตัวเองมาใช้เป็นเป้าหมาย
    const target = [...targetSelector].find(p => p.id !== source.id);

    if (!target || !target.isValid) {
      const hitSelf = targetSelector.length > 0 &&
        [...targetSelector].every(p => p.id === source.id);

      system.run(() => {
        showError(source, hitSelf ? t("tp.commandSelfTarget") : t("tp.commandPlayerNotFound"));
      });
      return { status: CustomCommandStatus.Failure };
    }

    // custom command ทำงานใน read-only mode — ต้องเปิด UI ผ่าน
    // system.run() เสมอ
    system.run(() => {
      openTpConfirmUI(source, target);
    });
  },
});

// =========================
// /prakan:tpahelp — อธิบายวิธีใช้ระบบ Teleport ก่อนผู้เล่นจะเริ่มใช้
// /prakan:tpa จริง ๆ ดึงค่ามาจาก ECONOMY_CONFIG.TELEPORT ตรง ๆ เพื่อไม่ให้
// ข้อความเพี้ยนไปจากค่าจริงถ้ามีคนแก้ config ภายหลัง
// =========================
definePlayerCommand({
  name: "prakan:tpahelp",
  description: "อธิบายวิธีใช้คำสั่ง /prakan:tpa และกฎการวาป",
  execute(source) {
    system.run(() => {
      showInfo(source, t("tp.helpMessage", {
        costPerBlock: ECONOMY_CONFIG.TELEPORT.COST_PER_BLOCK.toLocaleString(),
        crossDimCost: ECONOMY_CONFIG.TELEPORT.CROSS_DIMENSION_COST.toLocaleString(),
        timeoutSeconds: ECONOMY_CONFIG.TELEPORT.REQUEST_TIMEOUT_SECONDS,
        channelSeconds: ECONOMY_CONFIG.TELEPORT.CHANNEL_SECONDS,
      }));
    });
  },
});

// =========================
// /prakan:tpaccept — ยอมรับคำขอ TP ที่ค้างอยู่ทางแชท แทนการรอฟอร์ม
// (openReceiveUI) ที่เด้งได้แค่ครั้งเดียวตอนคำขอมาถึง — เรียก acceptTp()
// ตัวเดียวกับที่ปุ่ม "ยอมรับ" บนฟอร์มเรียก ไม่มีการเขียนตรรกะซ้ำ
// =========================
definePlayerCommand({
  name: "prakan:tpaccept",
  description: "ยอมรับคำขอ Teleport ที่มีคนส่งมาหาคุณ",
  execute(source) {
    if (!hasPendingTpRequest(source)) {
      system.run(() => {
        showError(source, t("tp.noPendingRequestMessage"));
      });
      return { status: CustomCommandStatus.Failure };
    }

    system.run(() => {
      acceptTp(source);
    });
  },
});
