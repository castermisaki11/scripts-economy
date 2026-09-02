// =========================
// commands/rewardCommands.js
// คำสั่งแชทฝั่ง admin (v1.4.6) — ให้รางวัลแก่ผู้เล่นโดยตรง (คู่กับ flow
// "ให้รางวัลผู้เล่น" ใน /prakan:admin — ทั้งสองทางเรียก addPlayerExp()/
// addMoney() เดียวกัน):
//   /prakan:addexp   <player> <amount> — ให้ EXP เลเวล RPG
//   /prakan:addmoney <player> <amount> — ให้เงินตรง ๆ (ผ่าน addMoney()
//                                        = มิเรอร์กระดานอันดับให้อัตโนมัติ)
//
// สำคัญ: เช็ค isAdmin(source) เองทุกคำสั่ง (แบบเดียวกับ adminCommands.js)
// เพราะ permissionLevel default = Any — กันผู้เล่นทั่วไปพิมพ์ตรง
//
// custom command ทำงานใน "read-only mode" — การเขียน dynamic property
// (EXP/money) และการส่งข้อความ feedback ต้องครอบด้วย system.run() เสมอ
// (applier callback ด้านล่างถูกเรียก "ภายใน" system.run แล้ว)
// =========================

import { system, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { isAdmin } from "../core/playerUtils";
import { ADMIN_FEATURES_ENABLED } from "../config/buildConfig";
import { addMoney } from "../core/economyUtils";
import { addPlayerExp } from "../systems/playerLevel";
import { showError, showSuccess } from "../core/messageUtils";
import { t } from "../ui/locale/index";

const REWARD_PARAMS = [
  { name: "target", type: CustomCommandParamType.PlayerSelector },
  { name: "amount", type: CustomCommandParamType.Integer }
];

// helper ร่วมสองคำสั่ง — validate input -> หา target -> system.run(applier)
// applier(target, amount) ทำ mutation + feedback message ทั้งฝั่ง admin/ผู้รับ
function executeReward(admin, targetSelector, amountRaw, applier) {
  if (!isAdmin(admin)) {
    system.run(() => showError(admin, t("ui.noPermission")));
    return { status: CustomCommandStatus.Failure };
  }

  const amount = Math.floor(Number(amountRaw));
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    system.run(() => showError(admin, t("reward.invalidAmount")));
    return { status: CustomCommandStatus.Failure };
  }

  // selector อาจว่าง/มีหลายคน/มีตัวเองปน — เอาคนแรกที่ไม่ใช่ตัวเอง
  // (pattern เดียวกับ /prakan:tpa)
  const target = [...targetSelector].find(p => p.id !== admin.id);
  if (!target || !target.isValid) {
    const hitSelf = targetSelector.length > 0 &&
      [...targetSelector].every(p => p.id === admin.id);
    const errorKey = hitSelf ? "reward.selfTarget" : "reward.targetOffline";
    system.run(() => showError(admin, t(errorKey)));
    return { status: CustomCommandStatus.Failure };
  }

  system.run(() => applier(target, amount));
  return { status: CustomCommandStatus.Success };
}

// no-admin build — ไม่ register คำสั่งทั้งสอง (ครอบแบบเดียวกับ
// adminCommands.js: definePlayerCommand ต่อคิวตอน module load)
if (ADMIN_FEATURES_ENABLED) {

definePlayerCommand({
  name: "prakan:addexp",
  description: "(Admin) ให้ EXP เลเวล RPG แก่ผู้เล่นที่ระบุ",
  mandatoryParameters: REWARD_PARAMS,
  execute(source, origin, targetSelector, amount) {
    return executeReward(source, targetSelector, amount, (target, amt) => {
      addPlayerExp(target, amt);
      showSuccess(target, t("reward.successTargetExp", { amount: amt }));
      showSuccess(source, t("reward.successAdmin", {
        type: t("reward.typeExp"), amount: amt, name: target.name
      }));
    });
  },
});

definePlayerCommand({
  name: "prakan:addmoney",
  description: "(Admin) ให้เงินแก่ผู้เล่นที่ระบุ",
  mandatoryParameters: REWARD_PARAMS,
  execute(source, origin, targetSelector, amount) {
    return executeReward(source, targetSelector, amount, (target, amt) => {
      addMoney(target, amt);
      showSuccess(target, t("reward.successTargetMoney", { amount: amt }));
      showSuccess(source, t("reward.successAdmin", {
        type: t("reward.typeMoney"), amount: amt, name: target.name
      }));
    });
  },
});

} // end if (ADMIN_FEATURES_ENABLED)
