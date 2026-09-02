// =========================
// quests/ui/achievementUi.js
// Achievement UI (Phase 4B) — หน้าจอ "ความสำเร็จ" แบบอ่านอย่างเดียว
//
// Engine ฝั่ง Achievement เสร็จตั้งแต่ Phase 3B (progression.js —
// checkAchievementsForStat() ปลดล็อกเงียบ ๆ และจ่ายรางวัลอัตโนมัติ) ไฟล์นี้
// ทำหน้าที่ "แสดงผล" เท่านั้น:
//   - หน้าแรก: group รายการตาม statKey ของ lifetime (8 กลุ่ม) โชว์จำนวน
//     ปลดล็อค/ทั้งหมดของแต่ละกลุ่ม
//   - หน้ากลุ่ม: tier bronze→gold ของ statKey นั้น พร้อม progress
//     current/threshold + รางวัล + สถานะปลดล็อคแล้วหรือยัง
//
// ไม่มี side effect ใด ๆ (ไม่แตะ saveQuestData — Achievement ไม่มีการ
// Reroll/Reset ให้กดจาก UI)
//
// ผู้เรียก openAchievementsUI() ต้อง push ผ่าน NavigationManager ก่อนเสมอ
// (rootMenu.js จัดการให้แล้ว)
// =========================

import { createListMenu } from "../../../ui/framework/UIFramework";
import { NavigationManager } from "../../../ui/framework/NavigationManager";
import { t } from "../../../ui/locale/index";
import { QUEST_ACHIEVEMENTS } from "../../../data/questAchievements";
import { readQuestData } from "../storage";
import { formatQuestReward, achievementName } from "../display";

// ลำดับ group บนหน้าแรก = ลำดับที่ statKey ปรากฏครั้งแรกใน QUEST_ACHIEVEMENTS
// (mine → kill → sell → buy → marketSell → jobExpGained → jobLevelUps ->
// questsCompleted) — data-driven ไม่ hardcode รายชื่อ statKey ซ้ำ
function groupByStat(achievements) {
  const groups = new Map();
  for (const def of achievements) {
    if (!groups.has(def.statKey)) groups.set(def.statKey, []);
    groups.get(def.statKey).push(def);
  }
  return groups;
}

// Cache ผลลัพธ์ที่ module level — QUEST_ACHIEVEMENTS เป็น static data
// ไม่ต้องคำนวณใหม่ทุกครั้งที่เปิดเมนู
const GROUPED_ACHIEVEMENTS = groupByStat(QUEST_ACHIEVEMENTS);

export async function openAchievementsUI(player) {
  if (!player?.isValid) return;

  const data = readQuestData(player);
  const unlockedSet = new Set(data.achievements.unlocked);
  const groups = GROUPED_ACHIEVEMENTS;

  const items = [...groups.entries()].map(([statKey, defs]) => ({
    id: statKey,
    labelKey: "quest.achievementGroupLabel",
    labelVars: {
      stat: t(`quest.stat.${statKey}`),
      unlocked: defs.filter((def) => unlockedSet.has(def.id)).length,
      total: defs.length
    },
    icon: "textures/ui/icon_book_writable"
  }));

  return createListMenu(player, {
    titleKey: "quest.achievementTitle",
    bodyKey: "quest.achievementBody",
    menuGroup: "questMenu",
    items,
    onSelect: (item) => {
      NavigationManager.push(player, () => openAchievementsUI(player));
      return openAchievementGroupUI(player, item.id);
    }
  });
}

async function openAchievementGroupUI(player, statKey) {
  if (!player?.isValid) return;

  const data = readQuestData(player);
  const unlockedSet = new Set(data.achievements.unlocked);
  const current = Number.isFinite(data.lifetime[statKey]) ? data.lifetime[statKey] : 0;
  const defs = QUEST_ACHIEVEMENTS.filter((def) => def.statKey === statKey);

  const items = defs.map((def) =>
    unlockedSet.has(def.id)
      ? {
          id: def.id,
          labelKey: "quest.achievementItemUnlocked",
          labelVars: {
            name: achievementName(def),
            progress: Math.min(current, def.threshold),
            threshold: def.threshold,
            reward: formatQuestReward(def.reward)
          },
          icon: "textures/ui/trade_icon.png"
        }
      : {
          id: def.id,
          labelKey: "quest.achievementItemLocked",
          labelVars: {
            name: achievementName(def),
            progress: Math.min(current, def.threshold),
            threshold: def.threshold,
            reward: formatQuestReward(def.reward)
          },
          icon: "textures/ui/refresh_light"
        }
  );

  return createListMenu(player, {
    titleKey: "quest.achievementGroupTitle",
    titleVars: { stat: t(`quest.stat.${statKey}`) },
    // progress ปัจจุบันของ statKey นี้ (clamp ที่ threshold ของ tier สุดท้าย
    // กันเลขยาวเว่อร์เมื่อสถิติสูงมากแล้ว)
    bodyKey: "quest.achievementGroupBody",
    bodyVars: {
      progress: Math.min(current, defs[defs.length - 1]?.threshold ?? current),
      totalProgress: current
    },
    items,
    onSelect: () => {
      // อ่านอย่างเดียว — ไม่มี detail page / ปุ่มใด ๆ ให้กด กดรายการ = ไม่
      // เกิดอะไร (framework ต้องการ onSelect เสมอ จึงว่างไว้)
    }
  });
}
