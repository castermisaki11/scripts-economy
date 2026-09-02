// =========================
// menuToggleConfig.js
// รายการกลุ่มของ "ทุกหน้าจอที่มีปุ่มให้เลือก" ซึ่ง Admin เปิด/ปิดได้จาก
// หน้าเดียวกัน ทั้งเมนูหลักและเมนูย่อย
//
// กลุ่มที่เป็นข้อมูลแบบไดนามิก (รายชื่อผู้เล่น, บ้าน, รายการตลาด, ช่องเควส)
// จะกรองเฉพาะปุ่มคงที่ในหน้าจอนั้น ส่วนรายการที่สร้างจากข้อมูลจริงจะยังแสดง
// ตามปกติ เพราะไม่มี id คงที่ให้ Admin ปิดเป็นรายรายการ
//
// เมื่อเพิ่มกลุ่มใหม่:
//   1) เพิ่ม { id, labelKey, items } ที่นี่
//   2) ครอบ items ในหน้าจอจริงด้วย
//      filterEnabledItems("groupId", items)
//   3) เพิ่ม locale key menuConfig.group.<name> ใน ui/locale/th.js
// =========================

import { MAIN_MENU_ITEMS, SHOP_MENU_ITEMS, ADMIN_MENU_ITEMS } from "./uiConfig";
import { SHOP_CATEGORIES } from "../data/shops";
import { EFFECTS } from "../data/effects";
import { SHOP_CONFIG } from "./shopConfig";

const BUY_AMOUNT_ITEMS = SHOP_CONFIG.BUY_AMOUNT_PRESETS.map((amount) => ({
  id: amount,
  labelKey: "ui.buyPreset",
  labelVars: { amount },
  icon: "textures/items/gold_ingot"
}));

const STAT_ITEMS = [
  { id: "strAtk", labelKey: "stats.addStrAtk" },
  { id: "strProj", labelKey: "stats.addStrProj" },
  { id: "strCritDmg", labelKey: "stats.addStrCritDmg" },
  { id: "agiSpd", labelKey: "stats.addAgiSpd" },
  { id: "agiCrit", labelKey: "stats.addAgiCrit" },
  { id: "agiEvasion", labelKey: "stats.addAgiEvasion" },
  { id: "agiParry", labelKey: "stats.addAgiParry" },
  { id: "vitHp", labelKey: "stats.addVitHp" },
  { id: "vitRed", labelKey: "stats.addVitRed" },
  { id: "vitBlock", labelKey: "stats.addVitBlock" },
  { id: "reset", labelKey: "stats.resetButton" }
];

export const MENU_TOGGLE_GROUPS = [
  {
    id: "main",
    labelKey: "menuConfig.group.main",
    items: MAIN_MENU_ITEMS
  },
  {
    id: "shopMenu",
    labelKey: "menuConfig.group.shopMenu",
    items: SHOP_MENU_ITEMS
  },
  {
    id: "buyCategory",
    labelKey: "menuConfig.group.buyCategory",
    items: SHOP_CATEGORIES
  },
  {
    id: "adminMenu",
    labelKey: "menuConfig.group.adminMenu",
    items: ADMIN_MENU_ITEMS
  },
  {
    id: "transferMenu",
    labelKey: "menuConfig.group.transferMenu",
    items: [
      { id: "__admin__", labelKey: "transfer.adminPanelButton" }
    ]
  },
  {
    id: "homeMenu",
    labelKey: "menuConfig.group.homeMenu",
    items: [
      { id: "__setHome__", labelKey: "home.uiSetHomeButton" }
    ]
  },
  {
    id: "homeDetailMenu",
    labelKey: "menuConfig.group.homeDetailMenu",
    items: [
      { id: "__go__", labelKey: "home.uiGoButton" },
      { id: "__delete__", labelKey: "home.uiDeleteButton" }
    ]
  },
  {
    id: "tpMenu",
    labelKey: "menuConfig.group.tpMenu",
    items: [
      { id: "__toggle__", labelKey: "tp.toggleOnButton" },
      { id: "__toggleCombat__", labelKey: "tp.toggleCombatOnButton" }
    ]
  },
  {
    id: "jobMenu",
    labelKey: "menuConfig.group.jobMenu",
    items: [
      { id: "change", labelKey: "job.changeButton" },
      { id: "rewards", labelKey: "job.rewardsButton" }
    ]
  },
  {
    id: "questMenu",
    labelKey: "menuConfig.group.questMenu",
    items: [
      { id: "bounty", labelKey: "quest.category.bounty" },
      { id: "daily", labelKey: "quest.category.daily" },
      { id: "weekly", labelKey: "quest.category.weekly" }
    ]
  },
  {
    id: "bountyQuestMenu",
    labelKey: "menuConfig.group.bountyQuestMenu",
    items: [
      { id: "reroll", labelKey: "quest.rerollButton" }
    ]
  },
  {
    id: "questDetailMenu",
    labelKey: "menuConfig.group.questDetailMenu",
    items: [
      { id: "reroll", labelKey: "quest.slotRerollButton" }
    ]
  },
  {
    id: "statsMenu",
    labelKey: "menuConfig.group.statsMenu",
    items: STAT_ITEMS
  },
  {
    id: "effectMenu",
    labelKey: "menuConfig.group.effectMenu",
    items: EFFECTS.map((effect) => ({
      id: effect.id,
      labelKey: effect.labelKey,
      icon: `textures/ui/${effect.id}_effect.png`
    }))
  },
  {
    id: "buyItemMenu",
    labelKey: "menuConfig.group.buyItemMenu",
    items: [
      ...BUY_AMOUNT_ITEMS,
      { id: "custom", labelKey: "ui.buyCustomAmount", icon: "textures/ui/icon_recipe_item" }
    ]
  },
  {
    id: "sellItemMenu",
    labelKey: "menuConfig.group.sellItemMenu",
    items: [
      { id: "all", labelKey: "ui.sellAll", icon: "textures/ui/realms_slot_check" },
      { id: "custom", labelKey: "ui.sellCustomAmount", icon: "textures/ui/icon_recipe_item" }
    ]
  },
  {
    id: "marketMenu",
    labelKey: "menuConfig.group.marketMenu",
    items: [
      { id: "enter", labelKey: "market.enterMarket" },
      { id: "sell", labelKey: "market.sellItem" },
      { id: "watchlist", labelKey: "market.watchlistButton" },
      { id: "claimMoney", labelKey: "market.claimMoney" },
      { id: "claimItems", labelKey: "market.claimItems" },
      { id: "watchAlerts", labelKey: "market.watchAlertsButton" }
    ]
  },
  {
    id: "marketListMenu",
    labelKey: "menuConfig.group.marketListMenu",
    items: [
      { id: "__search__", labelKey: "market.searchButton" },
      { id: "__sort__", labelKey: "market.sortButton" }
    ]
  },
  {
    id: "marketManageMenu",
    labelKey: "menuConfig.group.marketManageMenu",
    items: [
      { id: "edit", labelKey: "market.editPriceButton" },
      { id: "cancel", labelKey: "market.cancelListingButton" }
    ]
  },
  {
    id: "marketWatchlistMenu",
    labelKey: "menuConfig.group.marketWatchlistMenu",
    items: [
      { id: "__add__", labelKey: "market.watchAddButton" }
    ]
  },
  {
    id: "marketAdminBankMenu",
    labelKey: "menuConfig.group.marketAdminBankMenu",
    items: [
      { id: "withdraw", labelKey: "market.adminBankWithdraw" }
    ]
  },
  {
    id: "inventoryMenu",
    labelKey: "menuConfig.group.inventoryMenu",
    items: [
      { id: "selectPlayer", labelKey: "inv.selectPlayer" }
    ]
  },
  {
    id: "inventoryActionMenu",
    labelKey: "menuConfig.group.inventoryActionMenu",
    items: [
      { id: "remove", labelKey: "inv.actionRemove" },
      { id: "edit", labelKey: "inv.actionEdit" },
      { id: "replace", labelKey: "inv.actionReplace" }
    ]
  },
  {
    id: "adminGamemodeMenu",
    labelKey: "menuConfig.group.adminGamemodeMenu",
    items: [
      { id: "survival", labelKey: "adminui.gamemodeSurvival" },
      { id: "creative", labelKey: "adminui.gamemodeCreative" }
    ]
  },
  {
    id: "adminGameruleMenu",
    labelKey: "menuConfig.group.adminGameruleMenu",
    items: [
      { id: "randomTick", labelKey: "adminui.gameruleRandomTick" },
      { id: "killItem", labelKey: "adminui.gameruleKillItem" }
    ]
  },
  {
    id: "economyAdminMenu",
    labelKey: "menuConfig.group.economyAdminMenu",
    items: [
      { id: "bankToPlayer", labelKey: "admin.bankToPlayer" },
      { id: "setTax", labelKey: "admin.setTax" },
      { id: "viewLogs", labelKey: "admin.viewLogs" },
      { id: "searchLogs", labelKey: "admin.searchLogs" }
    ]
  }
];
