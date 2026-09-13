// =========================
// moneyScoreboardUi.js
// เมนู "กระดานอันดับ" (/prakan:score) — หน้าแรกให้เลือกหมวด:
//   อันดับเงิน / สถิติการขุด / Kills / Deaths
// เลือกแล้วเข้าหน้า Top 10 + อันดับของตัวเอง (ถ้าไม่ติด Top 10)
//
// - หมวด "อันดับเงิน" อ่านจาก core/economyUtils.js (getTopMoney/getMoneyRank)
//   เดิมที่มิเรอร์ยอดเงินเข้า world.scoreboard (prakan_money)
// - หมวด mined/kills/deaths อ่านผ่าน core/scoreboardUtils.js (generic top/
//   rank) — objective สร้าง/นับโดย systems/scoreboard.js
//
// แต่ละอันดับแสดงเป็น "ปุ่ม" (ไม่ใช่ข้อความล้วน) เพราะ ActionFormData ใส่
// ไอคอนต่อบรรทัดได้เฉพาะปุ่มเท่านั้น — กดปุ่มอันดับไหนก็แค่เปิดหน้าเดิมซ้ำ
// ผ่าน createListMenu ตามกฎ (ไฟล์เมนูอื่นห้ามสร้าง ActionFormData ตรง ๆ)
// =========================

import { createListMenu } from "../framework/UIFramework";
import { NavigationManager } from "../framework/NavigationManager";
import { t } from "../locale/index";
import { getTopMoney, getMoneyRank } from "../../core/economyUtils";
import { getTopObjective, getObjectiveRank, getOnlinePlayerNames } from "../../core/scoreboardUtils";
import { ICONS } from "../../config/uiConfig";

// ไอคอนต่ออันดับ Top 10 — ไล่ตามความหายากของไอเทมในเกม (หายากสุด -> เก็บ
// ง่ายสุด) — วานิลลาล้วน (ไม่พึ่ง Resource Pack เสริม)
const RANK_ICONS = [
  "textures/items/nether_star",
  "textures/items/nether_star",
  "textures/items/totem",
  "textures/items/netherite_ingot",
  "textures/items/diamond",
  "textures/items/emerald",
  "textures/items/gold_ingot",
  "textures/items/iron_ingot",
  "textures/items/redstone_dust",
  "textures/items/coal"
];

function rankIcon(rank) {
  return RANK_ICONS[rank - 1] ?? RANK_ICONS[RANK_ICONS.length - 1];
}

// นิยามหมวดกระดาน — objectiveName = ชื่อ world.scoreboard objective
// ("money" เป็นกรณีพิเศษ ใช้ helper ของ economyUtils เพราะมี logic mirror
// ของตัวเอง) icon ต้องเป็น texture วานิลลา
const CATEGORIES = [
  { id: "money", labelKey: "scoreboard.categories.money", icon: "textures/items/emerald", objectiveName: null },
  { id: "level", labelKey: "scoreboard.categories.level", icon: "textures/items/experience_bottle", objectiveName: "level" },
  { id: "mined", labelKey: "scoreboard.categories.mined", icon: "textures/items/iron_pickaxe", objectiveName: "mined" },
  { id: "kills", labelKey: "scoreboard.categories.kills", icon: "textures/items/diamond_sword", objectiveName: "kills" },
  { id: "deaths", labelKey: "scoreboard.categories.deaths", icon: "textures/items/rotten_flesh", objectiveName: "deaths" }
];

/* =========================
   หน้าแรก — เลือกหมวดกระดาน
========================= */
export const openMoneyScoreboardUI = safeAsync(async (player) => {
  if (!player?.isValid) return;

  return createListMenu(player, {
    titleKey: "scoreboard.categories.title",
    items: CATEGORIES.map((cat) => ({
      id: cat.id,
      labelKey: cat.labelKey,
      icon: cat.icon,
    })),
    onSelect: (selected) => {
      const cat = CATEGORIES.find((c) => c.id === selected.id);
      if (!cat) return;
      NavigationManager.push(player, () => openMoneyScoreboardUI(player));
      openBoard(player, cat);
    },
  });
}

/* =========================
   หน้ากระดานรายหมวด (Top 10 + อันดับตัวเอง)
========================= */
export const openBoard = safeAsync(async (player, category) => {
  if (!player?.isValid) return;

  const isMoney = category.objectiveName === null;
  const onlineNames = getOnlinePlayerNames();
  const top = isMoney
    ? getTopMoney(10, onlineNames)
    : getTopObjective(category.objectiveName, 10, onlineNames);
  const myRank = isMoney
    ? getMoneyRank(player, onlineNames)
    : getObjectiveRank(category.objectiveName, player, onlineNames);

  // entry key คนละชุดระหว่างเงิน ({money} Coins) กับหมวดทั่วไป ({value})
  const entryKey = isMoney ? "scoreboard.entry" : "scoreboard.entryValue";
  const entrySelfKey = isMoney ? "scoreboard.entrySelf" : "scoreboard.entryValueSelf";

  const items = top.map((entry) => ({
    id: `rank-${entry.rank}`,
    labelKey: entry.name === player.name ? entrySelfKey : entryKey,
    labelVars: { rank: entry.rank, name: entry.name, money: entry.score.toLocaleString(), value: entry.score.toLocaleString() },
    icon: rankIcon(entry.rank),
  }));

  // ไม่ติด Top 10 — ต่อท้ายด้วยปุ่มอันดับตัวเองแยกจากลิสต์
  if (myRank && myRank.rank > top.length) {
    items.push({
      id: "self",
      labelKey: isMoney ? "scoreboard.selfRank" : "scoreboard.selfRankValue",
      labelVars: { rank: myRank.rank, money: myRank.score.toLocaleString(), value: myRank.score.toLocaleString() },
      icon: ICONS.player,
    });
  }

  return createListMenu(player, {
    titleKey: isMoney ? "scoreboard.title" : "scoreboard.genericTitle",
    bodyKey: items.length === 0 ? (isMoney ? "scoreboard.empty" : "scoreboard.emptyGeneric") : undefined,
    items,
    // ปุ่มอันดับไม่มี action ย่อย — กดแล้วแค่เปิดหน้าเดิมซ้ำเฉย ๆ
    onSelect: () => openBoard(player, category),
  });
}
