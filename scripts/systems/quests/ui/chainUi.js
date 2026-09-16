// =========================
// quests/ui/chainUi.js
// Quest Chain UI (Phase 4C) — หน้าจอ "เส้นทางเควส"
//
// Engine ฝั่ง Chain เสร็จตั้งแต่ Phase 3C (chains.js — startChain/
// abandonChain/getChainStatuses + advanceChainStages ผ่าน Central
// Dispatcher) แต่ยังไม่มีหน้าจอให้ผู้เล่นเริ่ม/ดูสายเลย — ไฟล์นี้คือ UI
// ชิ้นสุดท้ายของระบบเควส:
//   - หน้าแรก: รายการสายทุกสายใน data/questChains.js พร้อมสถานะ
//     (ยังไม่เริ่ม / Active ด่าน X/Y / จบแล้วถาวร)
//   - หน้ารายละเอียด: รายการด่านทั้งหมด + progress ของด่านปัจจุบัน +
//     ปุ่ม "เริ่ม" (opt-in — engine ไม่นับ progress ก่อนเริ่ม) / "ยกเลิก"
//
// import startChain/abandonChain/CHAIN_FAIL_REASON จาก ../chains "ตรง ๆ"
// ไม่ผ่าน facade questSystem.js เพราะ facade export openQuestUI จาก
// ui/rootMenu.js ซึ่ง import ไฟล์นี้ — จะวนกลับมาเป็น Circular Import
// (facade -> rootMenu -> chainUi -> facade)
// =========================

import { createListMenu } from "../../../ui/framework/UIFramework";
import { showConfirm } from "../../../core/confirmDialog";
import { NavigationManager } from "../../../ui/framework/NavigationManager";
import { t } from "../../../ui/locale/index";
import { showSuccess, showInfo, showError } from "../../../core/messageUtils";
import { playError, playCancel, playSuccess } from "../../../core/soundUtils";
import {
  getAllChains,
  getChainById,
  getChainStage
} from "../../../data/questChains";
import { CHAIN_FAIL_REASON, startChain, abandonChain } from "../chains";
import { readQuestData } from "../storage";
import { questTargetName, formatQuestReward } from "../display";
import { questTypeIcon } from "./slotUi";

/* =========================
   CHAIN STATE HELPERS
========================= */

// คืน { completed: string[], active: Record<chainId, {stage, progress}> }
// ของผู้เล่นคนนี้ (read-only — Chain ไม่มี lazy reset ให้ ensure)
function readChainState(player) {
  const data = readQuestData(player);
  return { completed: data.chains.completed, active: data.chains.active };
}

/* =========================
   CHAIN LIST (หน้าแรก)
========================= */

export const openChainsUI = safeAsync(async (player) => {
  if (!player?.isValid) return;

  const { completed, active } = readChainState(player);

  const items = getAllChains().map((chainDef) => {
    const chainLabel = t(`quest.chain.${chainDef.id}`);
    const isCompleted = completed.includes(chainDef.id);
    const state = active[chainDef.id] ?? null;

    if (isCompleted) {
      return {
        id: chainDef.id,
        labelKey: "quest.chainItemCompleted",
        labelVars: { chain: chainLabel },
        icon: "textures/ui/trade_icon.png"
      };
    }
    if (state) {
      return {
        id: chainDef.id,
        labelKey: "quest.chainItemActive",
        labelVars: {
          chain: chainLabel,
          stage: state.stage + 1,
          total: chainDef.stages.length
        },
        icon: questTypeIcon(chainDef.stages[state.stage]?.type ?? "")
      };
    }
    return {
      id: chainDef.id,
      labelKey: "quest.chainItemNotStarted",
      labelVars: { chain: chainLabel },
      icon: "textures/items/emerald.png"
    };
  });

  return createListMenu(player, {
    titleKey: "quest.chainTitle",
    bodyKey: "quest.chainsBody",
    menuGroup: "questMenu",
    items,
    onSelect: (item) => {
      NavigationManager.push(player, () => openChainsUI(player));
      return openChainDetailUI(player, item.id);
    }
  });
});

/* =========================
   CHAIN DETAIL
========================= */

export const openChainDetailUI = safeAsync(async (player, chainId) => {
  if (!player?.isValid) return;

  const chainDef = getChainById(chainId);
  // สายหายจาก data/questChains.js ไปแล้ว (เนื้อหาถูกลบ) — ย้อนกลับแทนแสดง
  // หน้าว่าง/พัง (pattern เดียวกับ slotUi.openQuestSlotDetailUI)
  if (!chainDef) return NavigationManager.back(player);

  const { completed, active } = readChainState(player);
  const isCompleted = completed.includes(chainId);
  const state = active[chainId] ?? null;

  const items = chainDef.stages.map((stage, index) => {
    const isCurrent = state && state.stage === index;
    const isPast = state ? index < state.stage : false;

    if (isPast || (isCompleted && !state)) {
      return {
        id: index,
        labelKey: "quest.chainStageDone",
        labelVars: {
          index: index + 1,
          target: questTargetName(stage),
          required: stage.amountRequired,
          reward: formatQuestReward(stage.reward)
        },
        icon: "textures/ui/trade_icon.png"
      };
    }
    if (isCurrent) {
      return {
        id: index,
        labelKey: "quest.chainStageCurrent",
        labelVars: {
          index: index + 1,
          target: questTargetName(stage),
          progress: Math.min(state.progress, stage.amountRequired),
          required: stage.amountRequired,
          reward: formatQuestReward(stage.reward)
        },
        icon: questTypeIcon(stage.type)
      };
    }
    return {
      id: index,
      labelKey: "quest.chainStageUpcoming",
      labelVars: {
        index: index + 1,
        target: questTargetName(stage),
        required: stage.amountRequired
      },
      icon: "textures/ui/refresh_light"
    };
  });

  // ปุ่มควบคุม — เฉพาะกรณีที่ engine รองรับ:
  //   ยังไม่เริ่ม → [เริ่มเส้นทาง] (opt-in)
  //   Active     → [ยกเลิกเส้นทาง] (confirm เตือน progress หายทั้งหมด)
  //   จบแล้ว     → ไม่มีปุ่ม (startChain() ปฏิเสธถาวรอยู่แล้ว)
  if (!isCompleted && !state) {
    items.push({
      id: "__start__",
      labelKey: "quest.chainStartButton",
      icon: "textures/ui/refresh_light"
    });
  } else if (state) {
    items.push({
      id: "__abandon__",
      labelKey: "quest.chainAbandonButton",
      icon: "textures/ui/trade_icon.png"
    });
  }

  return createListMenu(player, {
    titleKey: "quest.chainDetailTitle",
    titleVars: { chain: t(`quest.chain.${chainId}`) },
    bodyKey: isCompleted
      ? "quest.chainDetailBodyCompleted"
      : state
        ? "quest.chainDetailBodyActive"
        : "quest.chainDetailBodyNotStarted",
    menuGroup: "chainMenu",
    items,
    onSelect: (item) => {
      if (item.id === "__start__") {
        return handleStartChainButton(player, chainDef);
      }
      if (item.id === "__abandon__") {
        return handleAbandonChainButton(player, chainId);
      }
      // กดรายการด่าน = ไม่มี action (ข้อมูลอ่านอย่างเดียว)
    }
  });
});

/* =========================
   START / ABANDON (UI wrappers ของ chains.js engine)
========================= */

function handleStartChainButton(player, chainDef) {
  const firstStage = getChainStage(chainDef, 0);
  if (!firstStage) return NavigationManager.back(player);

  return showConfirm({
    player,
    titleKey: "quest.chainStartConfirmTitle",
    bodyKey: "quest.chainStartConfirmBody",
    bodyVars: {
      chain: t(`quest.chain.${chainDef.id}`),
      target: questTargetName(firstStage),
      required: firstStage.amountRequired
    },
    onCancel: () => {
      playCancel(player);
      return NavigationManager.back(player);
    },
    onConfirm: () => {
      const result = startChain(player, chainDef.id);
      return handleChainActionResult(player, result, "quest.chainStartSuccess", chainDef.id);
    }
  });
}

function handleAbandonChainButton(player, chainId) {
  return showConfirm({
    player,
    titleKey: "quest.chainAbandonConfirmTitle",
    bodyKey: "quest.chainAbandonConfirmBody",
    bodyVars: { chain: t(`quest.chain.${chainId}`) },
    onCancel: () => {
      playCancel(player);
      return NavigationManager.back(player);
    },
    onConfirm: () => {
      const result = abandonChain(player, chainId);
      return handleChainActionResult(player, result, "quest.chainAbandonSuccess", chainId);
    }
  });
}

// แปลผลลัพธ์ของ startChain()/abandonChain() ({ ok, reason }) เป็นข้อความ/
// เสียง — ทำรายการเสร็จสมบัติแล้วเสมอ (ไม่ว่าสำเร็จหรือล้มเหลว) จึง close
// ทั้งสแตก (pattern เดียวกับ handleSlotRerollResult ใน slotUi.js) ผู้เล่น
// เปิดเมนูเควสใหม่จะเห็นสถานะล่าสุดของสายทันที
function handleChainActionResult(player, result, successMessageKey, chainId) {
  if (!result.ok) {
    playError(player);
    switch (result.reason) {
      case CHAIN_FAIL_REASON.ALREADY_COMPLETED:
        showError(player, t("quest.chainFailAlreadyCompleted"));
        break;
      case CHAIN_FAIL_REASON.ALREADY_ACTIVE:
        showError(player, t("quest.chainFailAlreadyActive"));
        break;
      case CHAIN_FAIL_REASON.NOT_ACTIVE:
        showError(player, t("quest.chainFailNotActive"));
        break;
      case CHAIN_FAIL_REASON.NOT_FOUND:
      default:
        showError(player, t("quest.chainFailGeneric"));
    }
    return NavigationManager.close(player);
  }

  playSuccess(player);
  showSuccess(player, t(successMessageKey, { chain: t(`quest.chain.${chainId}`) }));
  showInfo(player, t("quest.chainReopenHint"));
  return NavigationManager.close(player);
}
