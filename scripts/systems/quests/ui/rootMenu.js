// =========================
// quests/ui/rootMenu.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ UI Phase 4A — เมนูรากของระบบเควส)
// แบบคงเดิมทุกประการ
//
// openQuestUI() เดิม (Phase 1-3) คือหน้าจอ Bounty ตรง ๆ — mainUi.js /
// questCommands.js เรียก openQuestUI(player) เป็นจุดเข้าเดียวอยู่แล้ว (push
// ก่อนเสมอตามที่ comment ไว้ที่ทั้งสองไฟล์) จึงไม่ต้องแก้ไฟล์เรียกเลยสัก
// จุด — "ข้างในเมนูราก" คือเมนูเลือกหมวดหมู่ และหน้าจอ Bounty เดิมทั้งหมด
// ย้ายไป ui/bountyUi.js openBountyQuestUI()
// =========================

import { createListMenu } from "../../../ui/framework/UIFramework";
import { NavigationManager } from "../../../ui/framework/NavigationManager";
import { readQuestData } from "../storage";
import { ensureQuestResets } from "../reset";
import { openBountyQuestUI } from "./bountyUi";
import { openDailyQuestUI, openWeeklyQuestUI } from "./slotUi";
// Phase 4B/4C: Achievement + Chain UI (engine เสร็จตั้งแต่ Phase 3B/3C —
// สองหน้านี้คือ UI ชิ้นสุดท้ายของระบบเควส)
import { openAchievementsUI } from "./achievementUi";
import { openChainsUI } from "./chainUi";

export async function openQuestUI(player) {
  if (!player?.isValid) return;

  const data = readQuestData(player);
  ensureQuestResets(player, data);

  const dailyDone = data.daily.slots.filter((q) => q.completed).length;
  const weeklyDone = data.weekly.slots.filter((q) => q.completed).length;

  const items = [
    { id: "bounty", labelKey: "quest.category.bounty", icon: "textures/ui/icon_book_writable" },
    {
      id: "daily",
      labelKey: "quest.category.daily",
      labelVars: { done: dailyDone, total: data.daily.slots.length },
      icon: "textures/ui/refresh_light"
    },
    {
      id: "weekly",
      labelKey: "quest.category.weekly",
      labelVars: { done: weeklyDone, total: data.weekly.slots.length },
      icon: "textures/ui/refresh_light"
    },
    // Phase 4B: Achievement (อ่านอย่างเดียว) + Phase 4C: Chain (เริ่ม/ยกเลิก)
    {
      id: "achievements",
      labelKey: "quest.category.achievements",
      icon: "textures/ui/icon_book_writable"
    },
    {
      id: "chains",
      labelKey: "quest.category.chains",
      icon: "textures/items/emerald.png"
    }
  ];

  return createListMenu(player, {
    titleKey: "quest.title",
    menuGroup: "questMenu",
    items,
    onSelect: (item) => {
      NavigationManager.push(player, () => openQuestUI(player));
      switch (item.id) {
        case "bounty":
          return openBountyQuestUI(player);
        case "daily":
          return openDailyQuestUI(player);
        case "weekly":
          return openWeeklyQuestUI(player);
        case "achievements":
          return openAchievementsUI(player);
        case "chains":
          return openChainsUI(player);
      }
    }
  });
}
