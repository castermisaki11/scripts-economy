// =========================
// quests/ui/bountyUi.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ REROLL (Bounty) + UI: Bounty)
// แบบคงเดิมทุกประการ
//
// ผู้เรียก openBountyQuestUI() ต้อง push ผ่าน NavigationManager ก่อนเสมอ
// (เดิม mainUi.js/questCommands.js push เข้า openQuestUI() — ตอนนี้
// openQuestUI() อยู่ใน ui/rootMenu.js และเป็นเมนูรากแทน)
// =========================

import { system } from "@minecraft/server";
import { createListMenu } from "../../../ui/framework/UIFramework";
import { showConfirm } from "../../../core/confirmDialog";
import { NavigationManager } from "../../../ui/framework/NavigationManager";
import { t } from "../../../ui/locale/index";
import { showSuccess, showError } from "../../../core/messageUtils";
import { playError, playCancel, playQuestComplete, playSuccess } from "../../../core/soundUtils";
import { readQuestData, saveQuestData } from "../storage";
import { generateBountyQuest } from "../generation";
import {
  questTargetName,
  questTypeLabel,
  formatQuestReward,
  formatDuration,
  cooldownRemainingSeconds
} from "../display";

/* =========================
   REROLL (Bounty)
========================= */

function rollNewQuest(player, data) {
  const quest = generateBountyQuest();
  if (!quest) {
    playError(player);
    showError(player, t("quest.noTargetsAvailable"));
    return;
  }

  data.bounty.active = quest;
  data.bounty.lastRolledAt = system.currentTick;
  saveQuestData(player, data);

  playSuccess(player);
  showSuccess(player, t("quest.rollSuccess", {
    typeLabel: questTypeLabel(quest.type),
    target: questTargetName(quest),
    required: quest.amountRequired,
    reward: formatQuestReward(quest.reward)
  }));
}

function handleRerollButton(player, data) {
  const remaining = cooldownRemainingSeconds(data.bounty);
  if (remaining > 0) {
    playError(player);
    showError(player, t("quest.rerollCooldown", { time: formatDuration(remaining) }));
    return NavigationManager.back(player);
  }

  // มีเควสเดิมค้างอยู่และยังไม่เสร็จ — ต้องยืนยันก่อน เพราะความคืบหน้าเดิม
  // จะหายไปทันทีที่สุ่มใหม่ทับ (ไม่มีเควสเดิมเลย = สุ่มตรง ๆ ไม่ต้องถาม)
  if (data.bounty.active) {
    return showConfirm({
      player,
      titleKey: "quest.rerollConfirmTitle",
      bodyKey: "quest.rerollConfirmBody",
      bodyVars: {
        target: questTargetName(data.bounty.active),
        progress: data.bounty.active.amountProgress,
        required: data.bounty.active.amountRequired
      },
      onCancel: () => {
        playCancel(player);
        return NavigationManager.back(player);
      },
      onConfirm: () => {
        rollNewQuest(player, data);
        // แสดง UI ใหม่หลัง reroll สำเร็จ แทนที่จะปิดทั้ง stack
        return openBountyQuestUI(player);
      }
    });
  }

  rollNewQuest(player, data);
  return openBountyQuestUI(player);
}

/* =========================
   UI: Bounty — ย้ายมาจาก openQuestUI() เดิม (Phase 1-3) ไม่เปลี่ยนพฤติกรรม/
   ข้อความ/locale key เลยสักจุด — openQuestUI() กลายเป็นเมนูรากใหม่
   (ui/rootMenu.js) และหน้าจอ Bounty เดิมทั้งหมดย้ายมาอยู่ที่นี่
========================= */

export async function openBountyQuestUI(player) {
  if (!player?.isValid) return;

  const data = readQuestData(player);
  const quest = data.bounty.active;

  let bodyKey, bodyVars;
  if (quest) {
    bodyKey = "quest.bodyActive";
    bodyVars = {
      typeLabel: questTypeLabel(quest.type),
      target: questTargetName(quest),
      progress: quest.amountProgress,
      required: quest.amountRequired,
      reward: formatQuestReward(quest.reward)
    };
  } else {
    bodyKey = "quest.bodyNone";
  }

  const items = [
    { id: "reroll", labelKey: quest ? "quest.rerollButton" : "quest.rollButton", icon: "textures/ui/refresh_light" }
  ];

  return createListMenu(player, {
    titleKey: "quest.title",
    bodyKey,
    bodyVars,
    menuGroup: "bountyQuestMenu",
    items,
    onSelect: (item) => {
      if (item.id === "reroll") {
        return handleRerollButton(player, data);
      }
    }
  });
}
