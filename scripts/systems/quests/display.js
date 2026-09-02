// =========================
// quests/display.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ DISPLAY HELPERS + progress feedback)
// แบบคงเดิมทุกประการ
// =========================

import { world, system } from "@minecraft/server";
import { t } from "../../ui/locale/index";
import { showActionBar } from "../../core/messageUtils";
import { TICKS_PER_SECOND } from "../../core/constants";
import { QUEST_CONFIG } from "../../config/questConfig";
import { getItemDisplayName } from "../../data/items";
import { getJobById } from "../../data/jobs";
import { subscribeSafe } from "../../core/eventGuard";

const PROGRESS_FEEDBACK_COOLDOWN_TICKS = TICKS_PER_SECOND / 2;
const progressFeedbackState = new Map();
subscribeSafe(["playerLeave"], ({ playerId }) => {
  try {
    for (const key of [...progressFeedbackState.keys()]) {
      if (key.startsWith(playerId + ":")) progressFeedbackState.delete(key);
    }
  } catch (error) {
    console.warn("[QuestDisplay] playerLeave handler error:", error);
  }
});

// ชื่อ typeId แบบอ่านง่าย (เหมือน jobSystem.js formatTypeIdName) — ใช้กับ
// เป้าหมายเควส mine/kill ที่ไม่มี locale name ของตัวเอง (ตรงกับพฤติกรรม
// ชื่อไอเทมอัตโนมัติของ data/items.js getItemDisplayName() ทุกประการ)
export function formatTypeIdName(typeId) {
  return typeId
    .replace("minecraft:", "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function questTypeLabel(type) {
  return t(`quest.type.${type}`);
}

export function formatQuestReward(reward) {
  const money = Number.isFinite(reward?.money) ? reward.money : 0;
  const exp = Number.isFinite(reward?.exp) ? reward.exp : 0;
  const parts = [];

  if (money > 0) parts.push(t("quest.reward.money", { money }));
  if (exp > 0) parts.push(`${exp} EXP`);

  return parts.length > 0 ? parts.join(" + ") : t("quest.reward.none");
}

export function showQuestProgressFeedback(player, quest, feedbackScope, messageKey = "quest.progressActionBar", extraVars = {}) {
  const progress = quest.amountProgress;
  const now = system.currentTick;
  const key = `${player.id}:${feedbackScope}:${quest.type}:${quest.targetId ?? "any"}`;
  const previous = progressFeedbackState.get(key);

  // Action-bar updates replace one another, but rapid duplicate source events
  // can still make the feedback flicker. Keep the latest real progress and
  // suppress only updates from the same quest within half a second.
  if (previous && now - previous.tick < PROGRESS_FEEDBACK_COOLDOWN_TICKS) return;

  progressFeedbackState.set(key, { tick: now, progress });
  showActionBar(player, t(messageKey, {
    target: questTargetName(quest),
    progress,
    required: quest.amountRequired,
    ...extraVars
  }), "quest");
}

export function achievementName(def) {
  return t(`quest.achievement.${def.id}`);
}

export function chainName(chainId) {
  return t(`quest.chain.${chainId}`);
}

// Bounty เดิมมีแค่ 3 ประเภท (mine/kill/sell) แต่ Daily/Weekly (Phase 3A เป็น
// ต้นมา) สุ่มจาก QUEST_OBJECTIVES ทั้งหมด (data/questObjectives.js) ซึ่งรวม
// buy/job_exp/job_levelup/market_sell/home_teleport ด้วย —
// ฟังก์ชันนี้ต้องรู้จักครบทุกประเภทก่อนจะมี Daily/Weekly UI จริง (Phase 4A)
// ไม่งั้น formatTypeIdName(null) ของ home_teleport จะ throw ทันทีที่มีเควส
// ประเภทนี้ติดอยู่ในช่อง Daily/Weekly แล้วผู้เล่นเปิดดู
//
// ⚠️ targetId = null ("เป้าหมายใดก็ได้") พบได้จริงใน Quest Chain
// (market_tycoon_path/shopaholic/explorer_path — data/questChains.js) ต้อง
// guard ก่อน switch ไม่งั้น getItemDisplayName(null)/formatTypeIdName(null)
// throw ทั้งหน้า UI รายละเอียดสายและ progress feedback ระหว่างขาย-ซื้อของ
export function questTargetName(quest) {
  if (quest.targetId === null || quest.targetId === undefined) {
    return t("quest.target.any");
  }
  switch (quest.type) {
    case "sell":
    case "buy":
    case "market_sell":
      // ทั้ง 4 ประเภทนี้ targetId เป็น itemId จาก data/items.js เหมือนกันหมด
      return getItemDisplayName(quest.targetId);
    case "job_exp":
    case "job_levelup": {
      const job = getJobById(quest.targetId);
      return job ? t(job.nameKey) : formatTypeIdName(quest.targetId);
    }
    case "home_teleport":
      // ไม่มีเป้าหมายเฉพาะเจาะจง (targetId เป็น null เสมอ — ดู
      // QUEST_OBJECTIVES.home_teleport.getPool() ใน data/questObjectives.js)
      return t("quest.target.home");
    default:
      return formatTypeIdName(quest.targetId);
  }
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  if (hours > 0) return t("quest.durationHM", { h: hours, m: minutes });
  if (minutes > 0) return t("quest.durationMS", { m: minutes, s: seconds });
  return t("quest.durationS", { s: seconds });
}

export function cooldownRemainingSeconds(bounty) {
  const elapsedSeconds = (system.currentTick - bounty.lastRolledAt) / TICKS_PER_SECOND;
  return QUEST_CONFIG.REROLL_COOLDOWN_SECONDS - elapsedSeconds;
}
