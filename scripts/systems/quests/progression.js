// =========================
// quests/progression.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ REWARD / COMPLETION + LIFETIME
// COUNTER + ACHIEVEMENT) แบบคงเดิมทุกประการ
//
// รวมไฟล์เดียวกันเพราะผูกกันเป็นลูกโซ่: grantQuestReward() ->
// checkAchievementsForStat() -> grantAchievementReward() -> payReward()
// แยกเป็นหลายไฟล์จะเกิด Circular Import ระหว่างกันทันที
// =========================

import { system } from "@minecraft/server";
import { t } from "../../ui/locale/index";
import { addMoney } from "../../core/economyUtils";
import { showSuccess } from "../../core/messageUtils";
import { playSuccess } from "../../core/soundUtils";
import { QUEST_CONFIG } from "../../config/questConfig";
import { QUEST_ACHIEVEMENTS, hasAchievementsForStat } from "../../data/questAchievements";
import { getObjective } from "../../data/questObjectives";
import { getJobBridge } from "./jobBridge";
import { formatQuestReward, achievementName } from "./display";
import { STAT_CONFIG } from "../../config/statConfig";
import { addPlayerExp } from "../playerLevel";

/* =========================
   REWARD / COMPLETION — จุดกลางเดียวที่จ่ายรางวัลเควส (Phase 2: เพิ่ม EXP ->
   อาชีพปัจจุบัน / fallback เป็นเงินถ้าไม่มีอาชีพ) ใช้ร่วมกันทั้ง Bounty และ
   Daily/Weekly — เงิน (reward.money) จ่ายเหมือน Phase 1 ทุกประการเสมอ ไม่ว่า
   จะมีอาชีพหรือไม่ก็ตาม (คนละก้อนกับ EXP)

   ⚠️ Re-entrancy guard (สเปค Phase 2 ข้อ 14/16): เควสสำเร็จ -> มี EXP
   รางวัล -> ผู้เล่นมีอาชีพ -> ต้องเรียก jobBridge.applyJobExp() ซึ่งจะ
   reportJobExpGained()/reportJobLevelUp() -> advanceQuests() กลับเข้ามาอีก
   รอบ แต่ ณ จุดนี้เรายัง "อยู่ในกลางคัน" advanceQuests() รอบปัจจุบันอยู่
   (data ยังไม่ถูก saveQuestData() เลย) ถ้าเรียก applyJobExp() ตรงนี้แบบ
   synchronous จะเกิด advanceQuests() ซ้อนกัน (Re-entrant) ตัวในจะอ่าน
   questData เวอร์ชันเก่า (ตัวนอกยังไม่ save) แล้ว save ทับ พอตัวนอก save
   ทีหลังจะเขียนทับการเปลี่ยนแปลงของตัวในหายไป (Lost Update)

   ทางแก้: ห่อการเรียก applyJobExp() ด้วย system.run() (รูปแบบเดียวกับที่
   ใช้ทั่วทั้งแอดออนอยู่แล้ว) เลื่อนไปทำ "Tick ถัดไป" แทน ตอนนั้น
   advanceQuests() รอบปัจจุบัน saveQuestData() เสร็จสมบูรณ์ไปแล้วแน่นอน
   การเรียก advanceQuests() รอบใหม่ (จาก reportJobExpGained ที่ตามมา) จึง
   อ่าน/เขียนข้อมูลที่ถูกต้องเสมอ ไม่มี Lost Update — ส่วนเงิน (money) ไม่มี
   ความเสี่ยงนี้เลย (addMoney() ไม่เรียกย้อนกลับเข้า Quest System) จึงยังทำ
   แบบ synchronous ตามปกติ

   Phase 3B: แยก "จ่ายเงิน/exp" (payReward — ล้วน ๆ ไม่แตะ lifetime) ออกจาก
   "บันทึกว่าเควสสำเร็จ" (grantQuestReward — บวก questsCompleted/
   moneyRewardEarned ด้วย) เพราะ Achievement ต้อง "จ่ายรางวัลผ่านเส้นทาง
   เดียวกัน" แต่ Achievement เอง "ไม่ใช่เควส" — ต้องไม่บวก questsCompleted
   เมื่อ Achievement ปลดล็อก (questsCompleted ต้องบวกเฉพาะตอนเควส
   Bounty/Daily/Weekly สำเร็จจริงเท่านั้น)
========================= */

export function payReward(player, reward) {
  const money = reward.money ?? 0;
  const exp = reward.exp ?? 0;

  if (money > 0) addMoney(player, money);

  let totalMoney = money;

  if (exp > 0 && jobBridgeAvailable()) {
    const jobId = getJobBridge().getCurrentJobId(player);
    if (jobId) {
      // เลื่อนไป Tick ถัดไป — ดูคอมเมนต์ Re-entrancy guard ด้านบนฟังก์ชันนี้
      system.run(() => {
        getJobBridge()?.applyJobExp(player, jobId, exp);
      });
    } else {
      // ไม่มีอาชีพให้ลง EXP — แปลงเป็นเงินแทนตาม EXP_TO_MONEY_RATE (ผ่าน
      // Economy API addMoney() เท่านั้น ไม่แตะ dynamic property เงินตรง ๆ)
      const fallbackMoney = Math.round(exp * QUEST_CONFIG.EXP_TO_MONEY_RATE);
      if (fallbackMoney > 0) {
        addMoney(player, fallbackMoney);
        totalMoney += fallbackMoney;
      }
    }
  }

  return totalMoney;
}

function jobBridgeAvailable() {
  return Boolean(getJobBridge());
}

// ใช้กับ Bounty/Daily/Weekly เท่านั้น (การ "ทำเควสสำเร็จ" จริง ๆ) — จ่าย
// รางวัลผ่าน payReward() แล้วบวก questsCompleted/moneyRewardEarned ต่อ
// (เควส Reward Money ที่ addMoney() ตรงนี้ห้ามถูกนับย้อนกลับเป็น Progress
// ของเควสอื่นเด็ดขาด — ดูคอมเมนต์ Anti-Abuse ใน facade questSystem.js)
export function grantQuestReward(player, data, quest) {
  const totalMoney = payReward(player, quest.reward);

  data.lifetime.questsCompleted += 1;
  data.lifetime.moneyRewardEarned += totalMoney;

  // Achievement ที่ผูกกับ 2 ตัวนับนี้ (เช่น "ทำเควสสำเร็จครบ N ครั้ง") ไม่ได้
  // ผ่าน advanceLifetime() ตรง ๆ เพราะเป็นตัวนับ Meta ของระบบเควสเอง ไม่ใช่
  // Objective — เช็คตรงนี้แทน
  checkAchievementsForStat(player, data, "questsCompleted");
  checkAchievementsForStat(player, data, "moneyRewardEarned");

  // v1.4.0: เควสสำเร็จให้ EXP เลเวลผู้เล่น — addPlayerExp() แตะเฉพาะ rpg:*
  // props + money ไม่วนกลับเข้า questData (ไม่มี re-entrancy กับ
  // advanceQuests() ที่กำลังรันอยู่)
  addPlayerExp(player, STAT_CONFIG.LEVEL.EXP_PER_QUEST);
}

// ใช้กับ Achievement เท่านั้น (checkAchievementsForStat()) — จ่ายรางวัลผ่าน
// เส้นทางเดียวกับ grantQuestReward() (payReward()) แต่ "ไม่บวก"
// questsCompleted/moneyRewardEarned เพราะ Achievement ไม่ใช่การทำเควสสำเร็จ
// (ปลดล็อก Achievement ≠ ทำเควสสำเร็จ) — ถ้าบวกด้วยจะทำให้
// data.lifetime.questsCompleted ไม่ตรงกับจำนวนเควส Bounty/Daily/Weekly ที่
// ทำสำเร็จจริงอีกต่อไป และเป็นผลพลอยได้ที่ดี: ตัดปัญหา Re-entrancy ของ
// checkAchievementsForStat() เรียกตัวเองซ้อนไม่รู้จบไปด้วย เพราะ
// grantAchievementReward() ไม่เรียก checkAchievementsForStat() ต่อเลย
function grantAchievementReward(player, data, def) {
  payReward(player, def.reward);
}

/* =========================
   LIFETIME COUNTER
========================= */

export function advanceLifetime(player, data, type, amount) {
  const objective = getObjective(type);
  const key = objective?.lifetimeKey;
  if (!key || !(key in data.lifetime)) return;
  data.lifetime[key] += amount;
  checkAchievementsForStat(player, data, key);
}

/* =========================
   ACHIEVEMENT (Phase 3B) — ปลดล็อกครั้งเดียวถาวรจาก questData.lifetime
   ล้วน ๆ ไม่ต้อง Poll เพราะเช็คตรงจุดที่ lifetime counter ตัวไหนก็ตามถูก
   บวกเสมอ (เรียกจาก advanceLifetime() ด้านบน — ครอบคลุม mine/kill/sell/
   buy/marketSell/jobExpGained/jobLevelUps — และเรียกซ้ำจาก
   grantQuestReward() ด้านบนสำหรับ questsCompleted/moneyRewardEarned ที่
   ไม่ได้ผ่าน advanceLifetime() ตรง ๆ เพราะเป็นตัวนับ "Meta" ของระบบเควสเอง)

   รูปแบบ Threshold เดียวกับ getActivePerkTier() ใน jobSystem.js (ไล่เทียบ
   ค่าปัจจุบันกับ Tier ที่ตั้งไว้ใน data/questAchievements.js) ต่างกันตรงที่
   Achievement ทุก Tier ที่ถึงเกณฑ์ "ปลดล็อกสะสมทั้งหมด" ไม่ใช่แค่ Tier
   สูงสุดที่ Active อยู่ตอนนั้นแบบ Perk — จึง Loop เช็คทีละรายการแทนการหา
   Tier เดียว

   ไม่มี Re-entrancy ต้องกังวล: grantAchievementReward() (ต่างจาก
   grantQuestReward()) ไม่บวก questsCompleted/moneyRewardEarned และไม่เรียก
   checkAchievementsForStat() ต่อเลย — ปลดล็อก Achievement จึงไม่มีทาง
   Trigger การเช็ค Achievement ซ้อนตัวเองได้
========================= */

export function checkAchievementsForStat(player, data, statKey) {
  if (!player?.isValid) return;
  if (!hasAchievementsForStat(statKey)) return;
  if (typeof data.lifetime[statKey] !== "number") return;

  for (const def of QUEST_ACHIEVEMENTS) {
    if (def.statKey !== statKey) continue;
    if (data.achievements.unlocked.includes(def.id)) continue;
    if (data.lifetime[statKey] < def.threshold) continue;

    data.achievements.unlocked.push(def.id);
    // รางวัล Achievement จ่ายผ่าน payReward() เส้นทางเดียวกับ Bounty/Daily/
    // Weekly (เงิน -> addMoney ตรง ๆ, exp -> อาชีพปัจจุบัน/fallback เงิน)
    // แต่ "ไม่นับเป็นเควสสำเร็จ" (ดู grantAchievementReward())
    grantAchievementReward(player, data, def);
    playSuccess(player);
    showSuccess(player, t("quest.achievementUnlockedSuccess", {
      achievement: achievementName(def),
      reward: formatQuestReward(def.reward)
    }));
  }
}
