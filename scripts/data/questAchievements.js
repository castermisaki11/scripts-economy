// =========================
// data/questAchievements.js
// Achievement (ความสำเร็จสะสม) ของระบบเควส — ปลดล็อกครั้งเดียวถาวรต่อคน
// ไม่มี Slot/Reroll/Reset เหมือน Bounty/Daily/Weekly — อ้างอิงตัวนับสะสม
// questData.lifetime (systems/quests/storage.js defaultLifetime()) ล้วน ๆ
//
// รูปแบบ Threshold/Tier เดียวกับ JOB_CONFIG.PERK.TIERS (config/jobConfig.js
// — ดู getActivePerkTier() ใน systems/jobSystem.js): array ของ { เกณฑ์,
// ผลลัพธ์ } เรียงจากน้อยไปมาก ต่างจาก Perk Tier ตรงที่ Achievement ทุก Tier
// ที่ถึงเกณฑ์แล้ว "ค้างปลดล็อกถาวรทั้งหมด" (ไม่ใช่แค่ tier สูงสุดที่ active
// อยู่ ณ ขณะนั้นแบบ Perk) — เช็คทีละรายการ ไม่ scan หา tier เดียวแบบ
// getActivePerkTier()
//
// Data-driven เหมือน data/questObjectives.js — เพิ่ม Achievement ใหม่ =
// เพิ่ม 1 รายการที่นี่เท่านั้น ไม่ต้องแก้โมดูลใน systems/quests/
//
// statKey ต้องตรงกับคีย์ใน questData.lifetime เท่านั้น (mine, kill, sell,
// buy, marketSell, jobExpGained, jobLevelUps, questsCompleted,
// moneyRewardEarned) — ดู defaultLifetime() ใน systems/quests/storage.js
//
// reward ใช้ shape เดียวกับ Quest.reward ({ money, exp }) จ่ายผ่าน
// payReward() จุดเดียวกับ Bounty/Daily/Weekly (ไม่มี item reward — ถ้าจะเพิ่ม
// items ต้องให้ payReward() รองรับก่อน)
//
// Achievement UI (อ่านอย่างเดียว): systems/quests/ui/achievementUi.js
// — ปลดล็อกเองอัตโนมัติผ่าน checkAchievementsForStat() (progression.js)
// =========================

export const QUEST_ACHIEVEMENTS = [
  // --- mine ---
  { id: "mine_bronze", statKey: "mine", threshold: 500, reward: { money: 5000, exp: 200 } },
  { id: "mine_silver", statKey: "mine", threshold: 2500, reward: { money: 25000, exp: 800 } },
  { id: "mine_gold", statKey: "mine", threshold: 10000, reward: { money: 120000, exp: 3000 } },

  // --- kill ---
  { id: "kill_bronze", statKey: "kill", threshold: 250, reward: { money: 5000, exp: 200 } },
  { id: "kill_silver", statKey: "kill", threshold: 1000, reward: { money: 25000, exp: 800 } },
  { id: "kill_gold", statKey: "kill", threshold: 5000, reward: { money: 120000, exp: 3000 } },

  // --- sell (ร้านค้า NPC) ---
  { id: "sell_bronze", statKey: "sell", threshold: 300, reward: { money: 4000, exp: 150 } },
  { id: "sell_silver", statKey: "sell", threshold: 1500, reward: { money: 20000, exp: 600 } },
  { id: "sell_gold", statKey: "sell", threshold: 6000, reward: { money: 100000, exp: 2500 } },

  // --- buy (ร้านค้า NPC) ---
  { id: "buy_bronze", statKey: "buy", threshold: 150, reward: { money: 3000, exp: 100 } },
  { id: "buy_silver", statKey: "buy", threshold: 800, reward: { money: 15000, exp: 500 } },
  { id: "buy_gold", statKey: "buy", threshold: 3000, reward: { money: 80000, exp: 2000 } },

  // --- marketSell (ตลาดผู้เล่น — ของเราถูกคนอื่นซื้อ) ---
  { id: "marketSell_bronze", statKey: "marketSell", threshold: 50, reward: { money: 6000, exp: 200 } },
  { id: "marketSell_silver", statKey: "marketSell", threshold: 250, reward: { money: 30000, exp: 900 } },
  { id: "marketSell_gold", statKey: "marketSell", threshold: 1000, reward: { money: 150000, exp: 3500 } },

  // --- jobExpGained (EXP อาชีพสะสมที่ได้จากรางวัลเควส) ---
  { id: "jobExp_bronze", statKey: "jobExpGained", threshold: 5000, reward: { money: 5000, exp: 0 } },
  { id: "jobExp_silver", statKey: "jobExpGained", threshold: 25000, reward: { money: 25000, exp: 0 } },
  { id: "jobExp_gold", statKey: "jobExpGained", threshold: 100000, reward: { money: 120000, exp: 0 } },

  // --- jobLevelUps ---
  { id: "jobLevelUps_bronze", statKey: "jobLevelUps", threshold: 10, reward: { money: 5000, exp: 0 } },
  { id: "jobLevelUps_silver", statKey: "jobLevelUps", threshold: 30, reward: { money: 25000, exp: 0 } },
  { id: "jobLevelUps_gold", statKey: "jobLevelUps", threshold: 60, reward: { money: 120000, exp: 0 } },

  // --- questsCompleted (meta — รวมทุกหมวด Bounty/Daily/Weekly) ---
  { id: "questsCompleted_bronze", statKey: "questsCompleted", threshold: 25, reward: { money: 10000, exp: 0 } },
  { id: "questsCompleted_silver", statKey: "questsCompleted", threshold: 100, reward: { money: 50000, exp: 0 } },
  { id: "questsCompleted_gold", statKey: "questsCompleted", threshold: 500, reward: { money: 300000, exp: 0 } },

  // --- moneyRewardEarned (meta — เงินรางวัลเควสที่ได้รับสะสม) — กลุ่มเดียว
  // ที่เพิ่มภายหลัง v1.2.0 (engine รองรับอยู่แล้ว: grantQuestReward() เช็ค
  // checkAchievementsForStat("moneyRewardEarned") ตั้งแต่ Phase 3B)
  { id: "moneyReward_bronze", statKey: "moneyRewardEarned", threshold: 50000, reward: { money: 10000, exp: 0 } },
  { id: "moneyReward_silver", statKey: "moneyRewardEarned", threshold: 250000, reward: { money: 50000, exp: 0 } },
  { id: "moneyReward_gold", statKey: "moneyRewardEarned", threshold: 1000000, reward: { money: 200000, exp: 0 } },

  // --- Tier 4 "platinum" ของทุกกลุ่ม (content pack รอบใหม่) — เป้าหมาย
  // ระยะยาวสำหรับผู้เล่นเก่า รางวัลใหญ่ที่สุดของแต่ละกลุ่ม
  { id: "mine_platinum", statKey: "mine", threshold: 25000, reward: { money: 300000, exp: 6000 } },
  { id: "kill_platinum", statKey: "kill", threshold: 12500, reward: { money: 300000, exp: 6000 } },
  { id: "sell_platinum", statKey: "sell", threshold: 15000, reward: { money: 250000, exp: 5000 } },
  { id: "buy_platinum", statKey: "buy", threshold: 7500, reward: { money: 200000, exp: 4000 } },
  { id: "marketSell_platinum", statKey: "marketSell", threshold: 2500, reward: { money: 375000, exp: 7000 } },
  { id: "jobExp_platinum", statKey: "jobExpGained", threshold: 250000, reward: { money: 300000, exp: 0 } },
  { id: "jobLevelUps_platinum", statKey: "jobLevelUps", threshold: 120, reward: { money: 300000, exp: 0 } },
  { id: "questsCompleted_platinum", statKey: "questsCompleted", threshold: 1250, reward: { money: 750000, exp: 0 } },
  { id: "moneyReward_platinum", statKey: "moneyRewardEarned", threshold: 2500000, reward: { money: 500000, exp: 0 } }
];

// เช็คเร็ว ๆ ว่า statKey นี้มี Achievement ผูกอยู่ไหม ก่อนจะวน Array เต็ม —
// เรียกทุกครั้งที่ lifetime counter ตัวไหนก็ตามถูกบวก (ดู
// checkAchievementsForStat() ใน systems/quests/progression.js) จึงต้องเร็ว (O(1))
const STAT_KEYS_WITH_ACHIEVEMENTS = new Set(QUEST_ACHIEVEMENTS.map((def) => def.statKey));

/** true ถ้า statKey นี้ (คีย์ใน questData.lifetime) มี Achievement อย่างน้อย 1 รายการผูกอยู่ */
export function hasAchievementsForStat(statKey) {
  return STAT_KEYS_WITH_ACHIEVEMENTS.has(statKey);
}

/** ข้อมูล Achievement จาก id — undefined ถ้าไม่รู้จัก id นี้ */
export function getAchievementById(id) {
  return QUEST_ACHIEVEMENTS.find((def) => def.id === id);
}
