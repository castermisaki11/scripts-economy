// =========================
// quests/engine.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ PROGRESS MATCHING / REWARD-COMPLETION
// Bounty & Daily-Weekly advance / CENTRAL DISPATCHER) แบบคงเดิมทุกประการ
// =========================

import { t } from "../../ui/locale/index";
import { getMoney } from "../../core/economyUtils";
import { showSuccess, showInfo } from "../../core/messageUtils";
import { playQuestComplete } from "../../core/soundUtils";
import { readQuestData, saveQuestData } from "./storage";
import { ensureQuestResets } from "./reset";
import { grantQuestReward, advanceLifetime } from "./progression";
import { advanceChainStages } from "./chains";
import { generateBountyQuest } from "./generation";
import { QUEST_CONFIG } from "../../config/questConfig";
import {
  questTargetName,
  questTypeLabel,
  formatQuestReward,
  showQuestProgressFeedback
} from "./display";

/* =========================
   PROGRESS MATCHING (3.7) — Helper กลางที่ใช้ทั้ง Bounty/Daily/Weekly/Chain
========================= */

// พยายาม Progress เควส 1 อัน — คืน true ถ้าเควสนี้ตรงกับ Event (type ตรงกัน
// และ targetId ตรงกันหรือเป้าหมายเป็น "any") แล้ว mutate quest.amountProgress
// ให้ (มี clamp ไม่ให้เกิน amountRequired) — ไม่ตัดสินใจเรื่องรางวัล/ความ
// สำเร็จ (ผู้เรียกต้องเช็ค amountProgress >= amountRequired เอง)
function tryProgressQuest(quest, type, targetId, amount) {
  if (!quest || quest.completed) return false;
  if (quest.type !== type) return false;
  if (quest.targetId !== null && quest.targetId !== targetId) return false;

  quest.amountProgress = Math.min(quest.amountRequired, quest.amountProgress + amount);
  return true;
}

/* =========================
   REWARD / COMPLETION — Bounty (ข้อความ/พฤติกรรม "เงิน" เหมือน Phase 1
   ทุกประการ — grantQuestReward() แค่เพิ่ม EXP->อาชีพ/fallback เงินเข้ามา
   เงียบ ๆ ข้างหลัง)
========================= */

function completeBountyQuest(player, data, quest) {
  grantQuestReward(player, data, quest);
  data.bounty.active = null;

  // อ่านยอดเงินสดใหม่หลัง grantQuestReward() (ครอบคลุมทั้งเงินรางวัลปกติ
  // และ fallback เงินจาก EXP ถ้ามี — addMoney() ทั้งสองจุดเป็น synchronous
  // เสมอ ต่างจาก applyJobExp() ที่เลื่อนไป Tick ถัดไป)
  const newBalance = getMoney(player);

  playQuestComplete(player);
  showSuccess(player, t("quest.completeSuccess", {
    target: questTargetName(quest),
    reward: formatQuestReward(quest.reward),
    balance: newBalance
  }));

  // Auto Bounty Renew — สุ่มใบใหม่ให้ทันที ไม่ต้องเข้าเมนูกด (ผู้เล่น
  // มี Bounty active ต่อเนื่องตลอด) generateBountyQuest() คืน null ได้ถ้า
  // pool ว่าง — กรณีนั้นคง active = null ให้กดสุ่มเองภายหลังตามเดิม
  if (QUEST_CONFIG.AUTO_BOUNTY_RENEW) {
    const nextQuest = generateBountyQuest();
    if (nextQuest) {
      data.bounty.active = nextQuest;
      showInfo(player, t("quest.autoNewBounty", {
        target: questTargetName(nextQuest),
        amountRequired: nextQuest.amountRequired,
        reward: formatQuestReward(nextQuest.reward)
      }));
    }
  }
}

function advanceBounty(player, data, type, targetId, amount) {
  const quest = data.bounty.active;
  if (!tryProgressQuest(quest, type, targetId, amount)) return;

  if (quest.amountProgress >= quest.amountRequired) {
    completeBountyQuest(player, data, quest);
    return;
  }

  showQuestProgressFeedback(player, quest, "bounty");
}

/* =========================
   REWARD / COMPLETION — Daily / Weekly (Phase 1: อัปเดตข้อมูล+จ่ายเงิน
   รางวัลเงียบ ๆ ตามสถานะ "ไม่มี UI" เดิมของ Phase 1 — ต่อมา Phase 2 ใช้
   grantQuestReward() กลางร่วมกับ Bounty)
========================= */

export function advanceSlotGroup(player, data, slots, category, type, targetId, amount) {
  let completedThisEvent = false;

  for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
    const quest = slots[slotIndex];
    if (!tryProgressQuest(quest, type, targetId, amount)) continue;
    if (quest.completed) continue;
    if (quest.amountProgress < quest.amountRequired) {
      showQuestProgressFeedback(
        player,
        quest,
        `${category}:${slotIndex}`,
        "quest.slotProgressActionBar",
        { category: t(`quest.category.${category}Short`) }
      );
      continue;
    }

    // Quest ที่ทำเสร็จแล้วไม่เติม Quest ใหม่ทันที — แค่ mark completed ทิ้งไว้
    // ในช่องเดิมจนกว่าจะถึงรอบ Reset ถัดไป
    quest.completed = true;
    completedThisEvent = true;
    grantQuestReward(player, data, quest);
    playQuestComplete(player);
    showSuccess(player, t("quest.slotCompleteSuccess", {
      category: t(category === "daily" ? "quest.category.dailyShort" : "quest.category.weeklyShort"),
      target: questTargetName(quest),
      reward: formatQuestReward(quest.reward)
    }));
  }

  if (completedThisEvent && slots.length > 0 && slots.every((quest) => quest.completed)) {
    showInfo(player, t("quest.setCompleteInfo", {
      category: t(`quest.category.${category}Short`),
      total: slots.length
    }));
  }
}

/* =========================
   CENTRAL DISPATCHER (3.2)
   ศูนย์กลางของ Quest Progress ทั้งหมด — Bounty/Daily/Weekly/Chain/Lifetime
   ไหลผ่านจุดนี้จุดเดียว เรียกจาก Event Hook (mine/kill — ดู events.js) และ
   Report API (sell/buy/job_exp/job_levelup/market_sell/home_teleport — ดู
   reportApi.js)
========================= */

export function advanceQuests(player, type, targetId, amount = 1) {
  if (!player?.isValid) return;
  if (typeof type !== "string" || type.length === 0) return;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return;
  if (targetId !== null && typeof targetId !== "string") return;

  const data = readQuestData(player);
  ensureQuestResets(player, data);

  advanceLifetime(player, data, type, amount);
  advanceBounty(player, data, type, targetId, amount);
  advanceSlotGroup(player, data, data.daily.slots, "daily", type, targetId, amount);
  advanceSlotGroup(player, data, data.weekly.slots, "weekly", type, targetId, amount);
  advanceChainStages(player, data, type, targetId, amount);

  saveQuestData(player, data);
}
