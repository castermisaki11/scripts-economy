// =========================
// quests/ui/slotUi.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ UI: Daily / Weekly — Slot List +
// Quest Detail + Reroll UI) แบบคงเดิมทุกประการ
// =========================

import { createListMenu } from "../../../ui/framework/UIFramework";
import { showConfirm } from "../../../core/confirmDialog";
import { NavigationManager } from "../../../ui/framework/NavigationManager";
import { t } from "../../../ui/locale/index";
import { showSuccess, showError } from "../../../core/messageUtils";
import { playError, playCancel, playSuccess } from "../../../core/soundUtils";
import { QUEST_CONFIG } from "../../../config/questConfig";
import { msUntilNextBangkokMidnight, msUntilNextBangkokWeekReset } from "../../../core/timeUtils";
import { readQuestData } from "../storage";
import { ensureQuestResets } from "../reset";
import { REROLL_FAIL_REASON, rerollDailySlot, rerollWeeklySlot } from "../rerollEngine";
import {
  questTargetName,
  questTypeLabel,
  formatDuration
} from "../display";

/* =========================
   UI: Daily / Weekly — รายการช่อง (Slot List)
   ใช้ implementation กลางร่วมกัน (openSlotListUI) เหมือน rerollCategorySlot()
   ที่ engine ใช้ร่วมกันทั้ง Daily/Weekly อยู่แล้ว — เหลือแค่ category ต่างกัน
========================= */

// ไอคอนตามประเภทเควส (Daily/Weekly สุ่มได้ทุกประเภทจาก QUEST_OBJECTIVES ไม่ใช่
// แค่ mine/kill/sell แบบ Bounty) — ใช้ไอคอนที่มีอยู่แล้วในแอดออนเท่านั้น
// (ดู config/uiConfig.js / data/items.js สำหรับพาธที่ใช้ซ้ำอยู่แล้วที่อื่น)
// ไม่เพิ่มไอคอนใหม่เข้ามาในแอดออน — chainUi.js ใช้ร่วมด้วย
export function questTypeIcon(type) {
  switch (type) {
    case "mine":
      return "textures/items/diamond_pickaxe"; // ใช้ซ้ำจาก MAIN_MENU_ITEMS (job)
    case "kill":
      return "textures/items/iron_sword";
    case "sell":
    case "market_sell":
      return "textures/ui/trade_icon.png"; // ใช้ซ้ำจาก MAIN_MENU_ITEMS (market)
    case "buy":
      return "textures/items/emerald.png"; // ใช้ซ้ำจาก SHOP_MENU_ITEMS (buy)
    case "job_exp":
    case "job_levelup":
      return "textures/items/experience_bottle"; // ใช้ซ้ำจาก MAIN_MENU_ITEMS (stats)
    case "home_teleport":
      return "textures/items/bed_red"; // ใช้ซ้ำจาก MAIN_MENU_ITEMS (home)
    default:
      return "textures/ui/icon_book_writable";
  }
}

// วินาทีจนถึงรอบรีเซ็ตถัดไปของหมวดหมู่นี้ — Daily ใช้เที่ยงคืนไทยถัดไป
// (msUntilNextBangkokMidnight), Weekly ใช้เที่ยงคืนวันจันทร์ถัดไป
// (msUntilNextBangkokWeekReset)
function categoryResetCountdownSeconds(category) {
  const ms = category === "daily" ? msUntilNextBangkokMidnight() : msUntilNextBangkokWeekReset();
  return ms / 1000;
}

function categoryRerollConfig(category) {
  return category === "daily" ? QUEST_CONFIG.DAILY : QUEST_CONFIG.WEEKLY;
}

export const openSlotListUI = safeAsync(async (player, category) => {
  if (!player?.isValid) return;

  const data = readQuestData(player);
  ensureQuestResets(player, data);

  const slots = data[category].slots;
  const titleKey = category === "daily" ? "quest.dailyTitle" : "quest.weeklyTitle";
  const resetTime = formatDuration(categoryResetCountdownSeconds(category));

  const items = slots.map((quest, index) =>
    quest.completed
      ? {
          id: index,
          labelKey: "quest.slotLabelCompleted",
          labelVars: { index: index + 1, target: questTargetName(quest), time: resetTime },
          icon: questTypeIcon(quest.type)
        }
      : {
          id: index,
          labelKey: "quest.slotLabel",
          labelVars: {
            index: index + 1,
            typeLabel: questTypeLabel(quest.type),
            target: questTargetName(quest),
            progress: quest.amountProgress,
            required: quest.amountRequired,
            difficulty: t(`quest.difficulty.${quest.difficulty ?? "normal"}`)
          },
          icon: questTypeIcon(quest.type)
        }
  );

  return createListMenu(player, {
    titleKey,
    bodyKey: slots.length > 0 ? "quest.slotListBody" : "quest.slotListEmpty",
    bodyVars: { time: resetTime },
    items,
    onSelect: (item) => {
      NavigationManager.push(player, () => openSlotListUI(player, category));
      return openQuestSlotDetailUI(player, category, item.id);
    }
  });
}

export const openDailyQuestUI = safeAsync(async (player) => {
  return openSlotListUI(player, "daily");
}

export const openWeeklyQuestUI = safeAsync(async (player) => {
  return openSlotListUI(player, "weekly");
}

/* =========================
   UI: Daily / Weekly — รายละเอียดเควสในช่อง (Quest Detail Screen)
   แสดง Progress/Difficulty/Reward เต็ม ๆ + ปุ่ม Reroll (ถ้ายังไม่เสร็จ) —
   ช่องที่เสร็จแล้วไม่มีปุ่ม Reroll เลย (อ่านอย่างเดียว รอรีเซ็ตรอบถัดไป)
========================= */

export const openQuestSlotDetailUI = safeAsync(async (player, category, slotIndex) => {
  if (!player?.isValid) return;

  const data = readQuestData(player);
  ensureQuestResets(player, data);

  const quest = data[category].slots[slotIndex];
  // ช่องหาย (เช่น รีเซ็ตรอบใหม่ไปแล้วระหว่างที่ผู้เล่นเปิดหน้านี้ค้างไว้ หรือ
  // slotIndex ไม่ถูกต้อง) — ย้อนกลับไปหน้ารายการแทนที่จะแสดงหน้าจอว่าง/พัง
  if (!quest) return NavigationManager.back(player);

  const difficultyLabel = t(`quest.difficulty.${quest.difficulty ?? "normal"}`);
  const resetTime = formatDuration(categoryResetCountdownSeconds(category));

  let bodyKey, bodyVars;
  if (quest.completed) {
    bodyKey = "quest.slotDetailBodyCompleted";
    bodyVars = {
      typeLabel: questTypeLabel(quest.type),
      target: questTargetName(quest),
      difficulty: difficultyLabel,
      required: quest.amountRequired,
      moneyReward: quest.reward.money,
      expReward: quest.reward.exp,
      time: resetTime
    };
  } else {
    bodyKey = "quest.slotDetailBody";
    bodyVars = {
      typeLabel: questTypeLabel(quest.type),
      target: questTargetName(quest),
      difficulty: difficultyLabel,
      progress: quest.amountProgress,
      required: quest.amountRequired,
      moneyReward: quest.reward.money,
      expReward: quest.reward.exp
    };
  }

  const items = quest.completed
    ? []
    : [{ id: "reroll", labelKey: "quest.slotRerollButton", icon: "textures/ui/refresh_light" }];

  return createListMenu(player, {
    titleKey: "quest.slotDetailTitle",
    titleVars: { index: slotIndex + 1 },
    bodyKey,
    bodyVars,
    menuGroup: "questDetailMenu",
    items,
    onSelect: (item) => {
      if (item.id === "reroll") {
        NavigationManager.push(player, () => openQuestSlotDetailUI(player, category, slotIndex));
        return handleSlotRerollButton(player, category, slotIndex);
      }
    }
  });
}

/* =========================
   REROLL (Daily / Weekly Slot) — UI ที่เรียก rerollDailySlot()/
   rerollWeeklySlot() ใน Engine (Phase 3A) — เพิ่มหน้าจอยืนยัน + แปลผล
   { ok, reason }/{ ok, wasFree, cost, quest } เป็นข้อความ/เสียงเท่านั้น
========================= */

function handleSlotRerollButton(player, category, slotIndex) {
  const data = readQuestData(player);
  ensureQuestResets(player, data);

  const categoryData = data[category];
  const quest = categoryData.slots[slotIndex];
  if (!quest) {
    playError(player);
    return NavigationManager.close(player);
  }
  if (quest.completed) {
    // ปกติจะกดปุ่มนี้ไม่ได้อยู่แล้ว (ไม่มีปุ่ม Reroll แสดงในช่องที่เสร็จแล้ว
    // — ดู openQuestSlotDetailUI ด้านบน) กันไว้อีกชั้นเผื่อช่องเพิ่งเสร็จ
    // ระหว่างที่หน้าจอเดิมยังค้างอยู่ในมือผู้เล่น (Progress Event มาแทรก)
    playError(player);
    showError(player, t("quest.rerollFailAlreadyCompleted"));
    return NavigationManager.close(player);
  }

  const config = categoryRerollConfig(category);
  const isFree = categoryData.freeRerollsUsed < config.FREE_REROLLS;
  const cost = isFree ? 0 : config.REROLL_COST;

  return showConfirm({
    player,
    titleKey: "quest.slotRerollConfirmTitle",
    bodyKey: isFree ? "quest.slotRerollConfirmBodyFree" : "quest.slotRerollConfirmBodyPaid",
    bodyVars: {
      target: questTargetName(quest),
      progress: quest.amountProgress,
      required: quest.amountRequired,
      cost
    },
    onCancel: () => {
      playCancel(player);
      return NavigationManager.back(player);
    },
    onConfirm: () => {
      const result =
        category === "daily" ? rerollDailySlot(player, slotIndex) : rerollWeeklySlot(player, slotIndex);
      return handleSlotRerollResult(player, result);
    }
  });
}

// แปลผลลัพธ์ของ rerollDailySlot()/rerollWeeklySlot() เป็นข้อความ/เสียง —
// ทำรายการเสร็จสมบูรณ์แล้วเสมอ (ไม่ว่าสำเร็จหรือล้มเหลว) จึงปิดทั้งสแตก
// เหมือนกับ rollNewQuest()/executeJobChange() (ทำรายการเสร็จ = close())
function handleSlotRerollResult(player, result) {
  if (!result.ok) {
    playError(player);
    switch (result.reason) {
      case REROLL_FAIL_REASON.INSUFFICIENT_FUNDS:
        showError(player, t("quest.rerollFailInsufficientFunds", { cost: result.cost }));
        break;
      case REROLL_FAIL_REASON.ALREADY_COMPLETED:
        showError(player, t("quest.rerollFailAlreadyCompleted"));
        break;
      case REROLL_FAIL_REASON.NO_TARGETS_AVAILABLE:
        showError(player, t("quest.noTargetsAvailable"));
        break;
      default:
        showError(player, t("quest.rerollFailGeneric"));
    }
    return NavigationManager.close(player);
  }

  playSuccess(player);
  showSuccess(player, t("quest.rerollSlotSuccess", {
    typeLabel: questTypeLabel(result.quest.type),
    target: questTargetName(result.quest),
    required: result.quest.amountRequired
  }));
  return NavigationManager.close(player);
}
