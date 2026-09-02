// =========================
// quests/chains.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ CHAIN + CHAIN CONTROL) แบบคงเดิม
// ทุกประการ
// =========================

import { t } from "../../ui/locale/index";
import { showSuccess, showInfo } from "../../core/messageUtils";
import { playSuccess } from "../../core/soundUtils";
import {
  getAllChains,
  getChainById,
  getChainStage,
  isValidChainId
} from "../../data/questChains";
import { readQuestData, saveQuestData } from "./storage";
import { payReward } from "./progression";
import {
  chainName,
  questTargetName,
  formatQuestReward,
  showQuestProgressFeedback
} from "./display";

/* =========================
   CHAIN (Phase 3C) — สายเควสหลายด่านคงที่ (data/questChains.js) ผู้เล่นต้อง
   "เริ่ม" เอง (Opt-in — ดู startChain() ด้านล่าง) ก่อนถึงจะ Progress ที่นี่
   ได้ ใช้ "กฎ Matching" เดียวกับ tryProgressQuest() (ใน engine.js) ที่ใช้กับ
   Bounty/Daily/Weekly ทุกประการ (type ต้องตรงกัน + targetId ตรงกันหรือเป็น
   "any") แต่เขียนเป็นฟังก์ชันแยก (chainStageMatches()) เพราะ Shape ข้อมูล
   ต่างกัน: Quest ปกติเก็บ type/targetId/amountRequired/amountProgress ไว้
   ในตัวเควสเอง แต่ Chain เก็บแค่ { stage, progress } ต่อ chainId ใน
   data.chains.active — ส่วน type/targetId/amountRequired ของด่านปัจจุบันมา
   จาก stageDef (data/questChains.js) แยกต่างหาก (คนละ Shape จริง จึง
   บังคับใช้ tryProgressQuest() ตรง ๆ ไม่ได้)

   Anti-Duplication (สเปค Phase 3C ข้อ 5 — "achievement/chain rewards
   cannot be duplicated"): เมื่อด่านสุดท้ายของสายสำเร็จ จะลบออกจาก
   chains.active และย้ายไป chains.completed ทันทีในรอบเดียวกัน (synchronous
   ก่อน saveQuestData() ปลาย advanceQuests()) ทำให้:
     1) Event เดียวกันไม่มีทาง Trigger ด่านเดิมซ้ำ (ลบออกจาก active แล้ว)
     2) startChain() เช็ค chains.completed ก่อนเสมอ กันเริ่มสายที่จบไปแล้ว
        ซ้ำ (= กันรับรางวัลทั้งสายซ้ำ)
   ส่วนรางวัลรายด่าน (ไม่ใช่ด่านสุดท้าย) ก็ปลอดภัยเช่นกันเพราะ state.stage
   ขยับไปด่านถัดไปพร้อมกับ progress รีเซ็ตเป็น 0 ในตอนเดียวกับที่จ่ายรางวัล
========================= */

// จ่ายรางวัลด่านของสายเควส — เส้นทางเดียวกับ Bounty/Daily/Weekly/
// Achievement (payReward()) แต่ "ไม่บวก" questsCompleted/moneyRewardEarned
// เพราะ "ด่านของสายเควสสำเร็จ" ≠ "ทำเควส (Bounty/Daily/Weekly) สำเร็จ" —
// Chain เป็นคนละ Category ตาม Taxonomy ในเอกสารออกแบบ — ฟังก์ชันนี้ไม่เรียก
// checkAchievementsForStat() ต่อเช่นกัน จึงไม่มี Re-entrancy ให้กังวล
function grantChainStageReward(player, reward) {
  payReward(player, reward);
}

// กฎ Matching ของด่านสายเควส 1 ด่าน — เหมือน tryProgressQuest() ทุกประการ
// (type ต้องตรงกัน + targetId ตรงกันหรือ stageDef.targetId เป็น null =
// เป้าหมายใดก็ได้)
function chainStageMatches(stageDef, type, targetId) {
  if (stageDef.type !== type) return false;
  if (stageDef.targetId !== null && stageDef.targetId !== targetId) return false;
  return true;
}

// Progress สายเควสทั้งหมดที่ผู้เล่น "เริ่ม" ไว้แล้ว (data.chains.active)
// เรียกจาก advanceQuests() (Central Dispatcher ใน engine.js) จุดเดียว
export function advanceChainStages(player, data, type, targetId, amount) {
  for (const chainId of Object.keys(data.chains.active)) {
    const state = data.chains.active[chainId];
    if (!state) continue;

    const chainDef = getChainById(chainId);
    if (!chainDef) continue; // สายถูกถอดออกจาก data/questChains.js ไปแล้ว (sanitizeChainsActive กันไว้อีกชั้นตอนอ่านแล้ว แต่กันซ้ำไว้ที่นี่ด้วย)

    const stageDef = getChainStage(chainDef, state.stage);
    if (!stageDef) {
      // stage index เกินขอบเขตของสาย (เนื้อหาแก้ตัดด่านออกภายหลัง) — ถือว่า
      // สายนี้จบเงียบ ๆ กัน Progress ค้างวนไปตลอดกาลแบบไม่มีทางสำเร็จ
      delete data.chains.active[chainId];
      if (!data.chains.completed.includes(chainId)) data.chains.completed.push(chainId);
      continue;
    }

    if (!chainStageMatches(stageDef, type, targetId)) continue;

    state.progress = Math.min(stageDef.amountRequired, state.progress + amount);
    if (state.progress < stageDef.amountRequired) {
      showQuestProgressFeedback(
        player,
        { ...stageDef, amountProgress: state.progress },
        `chain:${chainId}`,
        "quest.chainProgressActionBar",
        {
          chain: chainName(chainId),
          stage: state.stage + 1
        }
      );
      continue;
    }

    // ด่านนี้สำเร็จ — จ่ายรางวัลด่านก่อน แล้วค่อยขยับสถานะ (ลำดับไม่มีผลต่อ
    // ความถูกต้อง เพราะ payReward()/grantChainStageReward() ไม่อ่าน
    // data.chains เลย)
    grantChainStageReward(player, stageDef.reward);
    playSuccess(player);

    const stageNumber = state.stage + 1;
    showSuccess(player, t("quest.chainStageCompleteSuccess", {
      chain: chainName(chainId),
      stage: stageNumber,
      reward: formatQuestReward(stageDef.reward)
    }));

    const nextStageIndex = state.stage + 1;
    if (nextStageIndex >= chainDef.stages.length) {
      // ด่านสุดท้ายของสายสำเร็จ -> ทั้งสายจบถาวร ย้ายจาก active ไป completed
      // ทันที (ดูคอมเมนต์ Anti-Duplication ด้านบนหัวข้อนี้)
      delete data.chains.active[chainId];
      if (!data.chains.completed.includes(chainId)) data.chains.completed.push(chainId);
      showSuccess(player, t("quest.chainCompleteSuccess", {
        chain: chainName(chainId)
      }));
    } else {
      const nextStage = chainDef.stages[nextStageIndex];
      state.stage = nextStageIndex;
      state.progress = 0;
      showInfo(player, t("quest.chainNextStageInfo", {
        chain: chainName(chainId),
        stage: nextStageIndex + 1,
        target: questTargetName(nextStage),
        required: nextStage.amountRequired
      }));
    }
  }
}

/* =========================
   CHAIN CONTROL (Phase 3C) — เริ่ม/เลิกสายเควส (Opt-in) UI/คำสั่งเรียกผ่าน
   facade questSystem.js — คืนค่าเป็น { ok, ... } ตามรูปแบบเดียวกับ
   rerollCategorySlot() (reason เป็นค่าคงที่จาก CHAIN_FAIL_REASON ไม่ผูกกับ
   ข้อความ UI)
========================= */

export const CHAIN_FAIL_REASON = {
  NOT_FOUND: "not_found",
  ALREADY_ACTIVE: "already_active",
  ALREADY_COMPLETED: "already_completed",
  NOT_ACTIVE: "not_active"
};

// เริ่มสายเควส — ต้องเรียกก่อนถึงจะเริ่ม Progress ผ่าน advanceChainStages()
// ได้ (สายที่ยังไม่เริ่มจะไม่อยู่ใน data.chains.active เลย จึงไม่ Progress
// อัตโนมัติจาก Event ทั่วไป) ปฏิเสธถ้าสายนี้ (1) ไม่รู้จัก (2) กำลัง Active
// อยู่แล้ว หรือ (3) ทำจบไปแล้วถาวร — ข้อ (3) คือกลไก "prevent repeat
// completion" (กันเริ่มสายที่จบไปแล้วซ้ำ = กันรับรางวัลทั้งสายซ้ำ)
export function startChain(player, chainId) {
  if (!player?.isValid || !isValidChainId(chainId)) {
    return { ok: false, reason: CHAIN_FAIL_REASON.NOT_FOUND };
  }

  const data = readQuestData(player);

  if (data.chains.completed.includes(chainId)) {
    return { ok: false, reason: CHAIN_FAIL_REASON.ALREADY_COMPLETED };
  }
  if (data.chains.active[chainId]) {
    return { ok: false, reason: CHAIN_FAIL_REASON.ALREADY_ACTIVE };
  }

  data.chains.active[chainId] = { stage: 0, progress: 0 };
  saveQuestData(player, data);
  return { ok: true, chainId, stage: 0 };
}

// เลิกสายเควสที่กำลัง Active อยู่ (Abandon) — ล้าง Progress ของสายนี้ทิ้ง
// ทั้งหมด (state.stage/progress หายไปพร้อมกัน) ไม่ใช่ "ทำสำเร็จ" จึงไม่แตะ
// data.chains.completed เลย — เริ่มสายเดิมซ้ำผ่าน startChain() ได้อีกครั้ง
// หลัง Abandon (ต่างจากทำสำเร็จที่ startChain() ปฏิเสธถาวรตามด้านบน)
export function abandonChain(player, chainId) {
  if (!player?.isValid || !isValidChainId(chainId)) {
    return { ok: false, reason: CHAIN_FAIL_REASON.NOT_FOUND };
  }

  const data = readQuestData(player);
  if (!data.chains.active[chainId]) {
    return { ok: false, reason: CHAIN_FAIL_REASON.NOT_ACTIVE };
  }

  delete data.chains.active[chainId];
  saveQuestData(player, data);
  return { ok: true, chainId };
}

// อ่านสถานะสายเควสทั้งหมด (ทุกสายที่ลงทะเบียนไว้ใน data/questChains.js ไม่
// ใช่แค่สายที่ Active/Completed อยู่ — ให้ UI/คำสั่ง Phase 4 โชว์สายที่ยัง
// ไม่เริ่มได้ด้วย) ไม่มี Side Effect (ไม่เรียก saveQuestData เลย)
export function getChainStatuses(player) {
  if (!player?.isValid) return [];
  const data = readQuestData(player);
  return getAllChains().map((chainDef) => ({
    chainId: chainDef.id,
    isCompleted: data.chains.completed.includes(chainDef.id),
    state: data.chains.active[chainDef.id] ?? null
  }));
}
