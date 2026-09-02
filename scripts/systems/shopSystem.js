// =========================
// shopSystem.js
// ระบบร้านค้า "ซื้อ / ขาย" แบบใหม่ ขับเคลื่อนด้วยฐานข้อมูลไอเทมกลาง
//
// แทนที่ shop.js / sellfood.js / sellex.js เดิมทั้งหมด
// ทุกเมนูในไฟล์นี้ดึงราคาจาก data/items.js เพียงที่เดียวเท่านั้น
// ไม่มีตารางราคาซ้ำ ไม่มี logic ราคาเก่าหลงเหลืออยู่
//
// === MIGRATED to scripts/ui/ framework ===
// ไฟล์นี้ไม่สร้าง ActionFormData / ModalFormData ตรง ๆ อีกต่อไป
// ทุกหน้าจอผ่าน UIFramework.js, การนำทางผ่าน NavigationManager.js,
// ทุกสตริงผ่าน t() — ตรรกะการซื้อ/ขาย/คำนวณเงินไม่ถูกแก้ไขจากเดิม
// =========================

import {
  getMoney,
  addMoney,
  removeMoney,
  addItemToInventory,
  depositToBank
} from "../core/economyUtils";
import {
  hasItem,
  getSellPrice,
  getBuyPrice,
  getItemsByCategory,
  getItemIcon,
  getItemDisplayName
} from "../data/items";
import { getShopCategories, getCategoryLabelKey } from "../data/shops";
import { SHOP_CONFIG } from "../config/shopConfig";
import { createListMenu, createAmountPrompt } from "../ui/framework/UIFramework";
import { showIconConfirm } from "../core/confirmDialog";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { t } from "../ui/locale/index";
import { filterEnabledItems } from "../core/menuVisibility";
import { playBuySuccess, playSellSuccess, playError, playCancel, playUnlockSuccess } from "../core/soundUtils";
import { showSuccess, showError, showInfo, showActionBar } from "../core/messageUtils";
import { getInventoryContainer, countItem, removeItems } from "../core/itemUtils";
import { reportItemSold, reportItemBought } from "./questSystem";
import { unlockItem, isItemUnlocked, grantUnlockRight, hasUnlockRight, getUnlockStatuses, getUnlockCount } from "../core/shopUnlocks";

// รายชื่อหมวดหมู่ + ไอคอน/locale key ย้ายไปอยู่ data/shops.js แล้ว —
// เพิ่มหมวดหมู่ใหม่แก้ที่นั่นจุดเดียว ไม่ต้องแก้ไฟล์นี้
function categoryLabel(category) {
  return t(getCategoryLabelKey(category));
}

// Progress bar ด้วย Unicode block — ใช้ในหน้าเมนูซื้อแสดงสถิติปลดล็อค
function buildProgressBar(ratio, length = 10) {
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  const pct = Math.round(ratio * 100);
  return `§a${"█".repeat(filled)}§8${"░".repeat(empty)} §7${pct}%`;
}

// container ระดับดิบ (ไม่ใช่ itemId เดี่ยว) ยังต้องใช้ตรงนี้สำหรับสแกนรวม
// ทั้งกระเป๋า (openSellMenu) — ย้ายไปใช้ getInventoryContainer จาก
// itemUtils.js แล้ว แทนฟังก์ชันในไฟล์นี้เอง

// =====================================================
// SELL MENU
// เมนูขายรวมเมนูเดียว — สแกนกระเป๋าผู้เล่นแล้วเทียบกับฐานข้อมูลไอเทม
// (แหล่งความจริงเดียวของ "ไอเทมที่ขายได้") แสดงเฉพาะไอเทมที่ผู้เล่นถือ
// อยู่จริง (จำนวน > 0) เท่านั้น — ไอเทมที่ลงทะเบียนไว้ในฐานข้อมูลแต่
// ผู้เล่นไม่มีเลย (จำนวน 0) จะไม่ถูกแสดงในเมนู
//
// ไม่มีรายชื่อไอเทมซ้ำอยู่ในไฟล์นี้ — เพิ่มไอเทมใหม่ที่ data/items.js
// อย่างเดียวก็ขายได้ทันทีเมื่อผู้เล่นถือของนั้นอยู่ ไม่ต้องแก้ไฟล์นี้เลย
// =====================================================

export async function openSellMenu(player) {
  if (!player?.isValid) return;
  const container = getInventoryContainer(player);
  if (!container) return;

  // สแกนกระเป๋าครั้งเดียว นับจำนวนไอเทมที่ขายได้ (มีอยู่ในฐานข้อมูลไอเทม)
  // ที่ผู้เล่นถืออยู่จริง
  const owned = new Map();
  const size = container.size ?? 36;

  for (let i = 0; i < size; i++) {
    const stack = container.getItem(i);
    if (!stack || !hasItem(stack.typeId)) continue;

    owned.set(stack.typeId, (owned.get(stack.typeId) ?? 0) + stack.amount);
  }

  // เทียบกับฐานข้อมูลไอเทมแล้วกรองเหลือเฉพาะไอเทมที่ผู้เล่นมีจำนวน > 0 —
  // รักษาลำดับตามที่ประกาศไว้ใน data/items.js
  const ids = getItemsByCategory().filter(id => (owned.get(id) ?? 0) > 0);

  if (ids.length === 0) {
    // ไม่มีไอเทมให้ขาย — แสดงข้อความพร้อมปุ่ม "กลับ" ที่ชัดเจนกลับไปหน้า
    // เมนูร้านค้าก่อนหน้า (ไม่ใช้ createResultMessage เพราะปุ่มนั้นคือ "ตกลง"
    // ปิดฟอร์มเฉย ๆ ไม่ใช่ปุ่ม "กลับ" ที่นำทางกลับไปหน้าก่อนหน้าจริง ๆ)
    return createListMenu(player, {
      titleKey: "ui.sellMenuTitle",
      bodyKey: "ui.noSellableItems",
      items: []
    });
  }

  // ปุ่ม "ขายทั้งหมดในกระเป๋า" อยู่บนสุดเสมอ — ขายทุกไอเทมที่ขายได้ในคลัง
  // (ตรงกับฐานข้อมูล data/items.js) รวดเดียว ไม่ต้องกดเข้าไปทีละชนิด
  const items = [
    { id: "__sellAllInventory__", labelKey: "ui.sellAllInventoryButton", icon: "textures/ui/realms_slot_check" },
    ...ids.map(id => ({
      id,
      labelKey: "ui.sellItemButton",
      labelVars: { name: getItemDisplayName(id), amount: owned.get(id), price: getSellPrice(id) },
      icon: getItemIcon(id)
    }))
  ];

  return createListMenu(player, {
    titleKey: "ui.sellMenuTitle",
    bodyKey: "ui.balanceLabel",
    bodyVars: { balance: getMoney(player) },
    items,
    onSelect: (item) => {
      NavigationManager.push(player, () => openSellMenu(player));
      if (item.id === "__sellAllInventory__") {
        return openSellAllConfirm(player, ids);
      }
      return openSellItemMenu(player, item.id);
    }
  });
}

// =========================
// ขายทั้งหมดในกระเป๋า (ทุกไอเทมที่ขายได้ในคลัง — ไม่ใช่แค่ชนิดเดียว)
// =========================
async function openSellAllConfirm(player, ids) {
  // คำนวณยอดรวมใหม่ ณ ตอนเปิดหน้ายืนยัน กันกรณีของเปลี่ยนไปแล้วระหว่างที่
  // เมนูก่อนหน้าเปิดอยู่ (เหมือน openSellItemMenu เช็ค owned ใหม่ตอนเปิด)
  // พร้อมกันนี้เก็บรายการ "ชื่อ ×จำนวน = เงิน" ทีละชนิดไว้โชว์ในหน้ายืนยัน
  let totalEarned = 0;
  let totalTypes = 0;
  const lines = [];
  const MAX_LIST_LINES = 20;

  for (const id of ids) {
    const owned = countItem(player, id);
    if (owned <= 0) continue;
    const earned = owned * getSellPrice(id);
    totalEarned += earned;
    totalTypes++;

    if (lines.length < MAX_LIST_LINES) {
      lines.push(`§7- §f${getItemDisplayName(id)}§r §8x${owned} = §a${earned}`);
    }
  }
  if (totalTypes > MAX_LIST_LINES) {
    lines.push(`§8…และอีก ${totalTypes - MAX_LIST_LINES} ชนิด`);
  }

  if (totalTypes === 0) {
    showError(player, t("ui.noSellableItems"));
    return NavigationManager.back(player);
  }

  return showIconConfirm({
    player,
    titleKey: "ui.sellAllConfirmTitle",
    bodyKey: "ui.sellAllConfirmBodyList",
    bodyVars: {
      types: totalTypes,
      total: totalEarned.toLocaleString(),
      list: lines.join("\n")
    },
    confirmIcon: "textures/ui/realms_slot_check",
    onCancel: () => {
      playCancel(player);
      return NavigationManager.back(player);
    },
    onConfirm: () => sellAllInventory(player, ids)
  });
}

function sellAllInventory(player, ids) {
  let totalEarned = 0;
  let typesSold = 0;

  for (const id of ids) {
    const owned = countItem(player, id);
    if (owned <= 0) continue;

    const removed = removeItems(player, id, owned);
    if (removed <= 0) continue;

    totalEarned += removed * getSellPrice(id);
    typesSold++;

    // แจ้งระบบเควส (systems/quests/reportApi.js) เผื่อมีเควส "ขายไอเทม" ที่
    // targetId ตรงกับไอเทมนี้อยู่ — ไม่มี event ของเกมให้ฟังตอนขาย จึงต้อง
    // เรียกตรงจากจุดที่ขายสำเร็จจริงแบบนี้ (เหมือน sellItems() ด้านล่าง)
    reportItemSold(player, id, removed);
    grantUnlockRight(player, id);
  }

  if (typesSold === 0) {
    playError(player);
    showError(player, t("ui.noSellableItems"));
    return NavigationManager.close(player);
  }

  const newBalance = addMoney(player, totalEarned);

  playSellSuccess(player);
  showSuccess(player, t("ui.sellAllSuccess", { types: typesSold, earned: totalEarned, balance: newBalance }));
  showActionBar(player, t("ui.sellAllActionBar", { types: typesSold, earned: totalEarned }), "shop");

  // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตกที่ค้างไว้ (openSellMenu ที่ถูก push)
  NavigationManager.close(player);
}

async function openSellItemMenu(player, itemId) {
  if (!player?.isValid) return;

  const owned = countItem(player, itemId);
  if (owned <= 0) {
    showError(player, t("ui.itemNoLongerOwned", { item: getItemDisplayName(itemId) }));
    // ไม่มีของชิ้นนี้ (ไม่เคยมี หรือถูกใช้/ดรอประหว่างเปิดเมนู) — กลับไปหน้า
    // รายการแทนการเรียกซ้ำตรง ๆ เพื่อไม่ให้สแตกค้าง (openSellMenu ถูก push ไว้แล้ว)
    return NavigationManager.back(player);
  }

  const price = getSellPrice(itemId);
  const items = [
    { id: "all", labelKey: "ui.sellAll", icon: "textures/ui/realms_slot_check" },
    { id: "custom", labelKey: "ui.sellCustomAmount", icon: "textures/ui/icon_recipe_item" }
  ];

  return createListMenu(player, {
    titleKey: "ui.itemTitle",
    titleVars: { name: getItemDisplayName(itemId) },
    bodyKey: "ui.sellItemMenuBody",
    bodyVars: { owned, price },
    menuGroup: "sellItemMenu",
    items,
    onSelect: (item) => {
      if (item.id === "all") {
        // เข้าหน้ายืนยัน (อีกหนึ่ง "หน้าจอ") — push หน้ารายการไอเทมไว้ก่อนเสมอ
        NavigationManager.push(player, () => openSellItemMenu(player, itemId));
        return openSellConfirm(player, itemId, owned);
      }
      // ไม่ push ก่อนเข้า custom amount — เป็น modal ชั่วคราว ไม่ใช่ "หน้าจอ"
      // ในสแตก ใช้ callback ตรงเหมือนพฤติกรรมเดิมแทน
      return openSellCustomAmount(player, itemId, owned);
    }
  });
}

async function openSellCustomAmount(player, itemId, owned) {
  return createAmountPrompt(player, {
    titleKey: "ui.sellAmountTitle",
    titleVars: { name: getItemDisplayName(itemId) },
    promptKey: "ui.sellAmountPrompt",
    promptVars: { max: owned },
    placeholder: t("ui.numberPlaceholder"),
    // เดิม: ปิดฟอร์มด้วย X = ปิดเมนูทั้งหมด (ไม่กลับไปหน้ารายการไอเทม)
    onCancel: () => {
      playCancel(player);
      return NavigationManager.close(player);
    },
    onSubmit: (value) => {
      const amount = Number(value);
      if (!Number.isInteger(amount) || amount <= 0 || amount > owned) {
        showError(player, t("ui.invalidAmount"));
        // เดิม: เรียก openSellItemMenu ตรง ๆ ซ้ำ (ไม่ใช่ NavigationManager.back)
        // เพราะ custom amount ไม่เคย push ตัวเองเข้าสแตก
        return openSellItemMenu(player, itemId);
      }
      // เข้าหน้ายืนยัน — push หน้ารายการไอเทมไว้ก่อนเสมอ เหมือนเส้นทาง "ขายทั้งหมด"
      NavigationManager.push(player, () => openSellItemMenu(player, itemId));
      return openSellConfirm(player, itemId, amount);
    }
  });
}

// =========================
// ยืนยันการขาย
// =========================
async function openSellConfirm(player, itemId, amount) {
  const price = getSellPrice(itemId);
  const total = amount * price;

  return showIconConfirm({
    player,
    titleKey: "ui.sellConfirmTitle",
    bodyKey: "ui.sellConfirmBody",
    bodyVars: { name: getItemDisplayName(itemId), amount, total },
    confirmIcon: getItemIcon(itemId),
    onCancel: () => {
      playCancel(player);
      return NavigationManager.back(player);
    },
    onConfirm: () => sellItems(player, itemId, amount)
  });
}

function sellItems(player, itemId, amount) {
  const removed = removeItems(player, itemId, amount);

  // ของอาจหายไประหว่างที่หน้ายืนยันเปิดอยู่ (ใช้/ดรอปทิ้ง ฯลฯ) — ไม่ขายอะไรได้เลย
  if (removed <= 0) {
    playError(player);
    showError(player, t("ui.itemNoLongerOwned", { item: getItemDisplayName(itemId) }));
    return NavigationManager.back(player);
  }

  const earned = removed * getSellPrice(itemId);
  const newBalance = addMoney(player, earned);

  // แจ้งระบบเควส (systems/quests/reportApi.js) เผื่อมีเควส "ขายไอเทม" ที่
  // targetId ตรงกับไอเทมนี้อยู่ — ไม่มี event ของเกมให้ฟังตอนขาย
  reportItemSold(player, itemId, removed);
  grantUnlockRight(player, itemId);

  playSellSuccess(player);
  showSuccess(player, t("ui.sellSuccess", {
    item: getItemDisplayName(itemId),
    amount: removed,
    earned,
    balance: newBalance
  }));
  showActionBar(player, t("ui.sellActionBar", {
    item: getItemDisplayName(itemId),
    amount: removed,
    earned
  }), "shop");

  // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตกที่ค้างไว้ (openSellMenu + openSellItemMenu ที่ถูก push)
  // กันไม่ให้หลงเหลือข้ามไปปนกับเมนูอื่นในเซสชันถัดไปของผู้เล่นคนนี้
  NavigationManager.close(player);
}

// =====================================================
// BUY MENU
// =====================================================

export async function openBuyCategoryPicker(player) {
  if (!player?.isValid) return;

  // รายการหมวดหมู่มาจาก data/shops.js ทั้งหมด — เพิ่มหมวดหมู่ใหม่ในอนาคต
  // ไม่ต้องแก้ฟังก์ชันนี้เลย จากนั้นกรองหมวดหมู่ที่ Admin ปิดไว้จากหน้า
  // "จัดการเมนู" ออก (เช่น ปิดปุ่ม "ซื้อแร่ต่างๆ" ไม่ให้ผู้เล่นเห็น) —
  // ทั้งเซิร์ฟเวอร์ ดู core/menuVisibility.js
  const items = filterEnabledItems(
    "buyCategory",
    getShopCategories().map(cat => ({
      id: cat.id,
      labelKey: cat.labelKey,
      icon: cat.icon
    }))
  );

  // Admin ปิดหมวดหมู่ไว้หมดทุกหมวด — แจ้งเตือนแล้วปิดเมนูแทนที่จะโชว์หน้า
  // ว่างเปล่า (พฤติกรรมเดียวกับ openBuyMenu ตอนหมวดหมู่ไม่มีไอเทมให้ซื้อ)
  if (items.length === 0) {
    showInfo(player, t("ui.noBuyableItems"));
    return NavigationManager.close(player);
  }

  return createListMenu(player, {
    titleKey: "ui.buyCategoryPickerTitle",
    bodyKey: "ui.buyCategoryPickerBody",
    bodyVars: { balance: getMoney(player) },
    items,
    onSelect: (item) => {
      NavigationManager.push(player, () => openBuyCategoryPicker(player));
      return openBuyMenu(player, item.id);
    }
  });
}

export async function openBuyMenu(player, category) {
  if (!player?.isValid) return;

  const ids = getItemsByCategory(category);
  if (ids.length === 0) {
    showInfo(player, t("ui.noBuyableItems"));
    return NavigationManager.close(player);
  }

  // อ่าน data ครั้งเดียว แทน isItemUnlocked + hasUnlockRight ทีละตัว
  const statuses = getUnlockStatuses(player, ids);
  const unlockCount = getUnlockCount(player);
  const totalCount = getItemsByCategory().length;

  const items = statuses.map(({ id, hasRight, unlocked }) => {
    const unlockCost = getSellPrice(id) * 5;

    if (unlocked) {
      return {
        id,
        locked: false,
        labelKey: "ui.buyItemButton",
        labelVars: { name: getItemDisplayName(id), price: getBuyPrice(id) },
        icon: getItemIcon(id)
      };
    }
    if (hasRight) {
      return {
        id,
        locked: true,
        labelKey: "ui.buyItemReady",
        labelVars: { name: getItemDisplayName(id), cost: unlockCost },
        icon: getItemIcon(id)
      };
    }
    return {
      id,
      locked: true,
      labelKey: "ui.buyItemNoRight",
      labelVars: { name: getItemDisplayName(id) },
      icon: "textures/ui/icon_lock"
    };
  });

  return createListMenu(player, {
    titleKey: "ui.buyMenuTitle",
    titleVars: { category: categoryLabel(category) },
    bodyKey: "ui.buyMenuBodyWithProgress",
    bodyVars: {
      balance: getMoney(player),
      unlocked: unlockCount,
      total: totalCount,
      bar: buildProgressBar(totalCount > 0 ? unlockCount / totalCount : 0)
    },
    items,
    onSelect: (item) => {
      if (item.locked) {
        const status = statuses.find((s) => s.id === item.id);
        if (!status?.hasRight) {
          // ไม่มีสิทธิ — แสดงข้อความแล้วกลับเข้าหน้าเดิม (ไม่ back ออกจากหมวด)
          showInfo(player, t("ui.buyNoRightMessage", { name: getItemDisplayName(item.id) }));
          return openBuyMenu(player, category);
        }
        const unlockCost = getSellPrice(item.id) * 5;
        NavigationManager.push(player, () => openBuyMenu(player, category));
        return openUnlockConfirm(player, item.id, unlockCost);
      }
      NavigationManager.push(player, () => openBuyMenu(player, category));
      return openBuyItemMenu(player, item.id, category);
    }
  });
}

// =========================
// ปลดล็อคร้านค้า — จ่าย sellPrice × 5 เพื่อปลดล็อคไอเทม
// =========================
async function openUnlockConfirm(player, itemId, unlockCost) {
  return showIconConfirm({
    player,
    titleKey: "ui.buyUnlockConfirmTitle",
    bodyKey: "ui.buyUnlockConfirmBody",
    bodyVars: { name: getItemDisplayName(itemId), cost: unlockCost },
    confirmIcon: "textures/ui/icon_lock",
    onCancel: () => {
      playCancel(player);
      return NavigationManager.back(player);
    },
    onConfirm: () => executeUnlock(player, itemId, unlockCost)
  });
}

function executeUnlock(player, itemId, unlockCost) {
  const money = getMoney(player);
  if (money < unlockCost) {
    playError(player);
    showError(player, t("ui.buyUnlockInsufficientFunds", { cost: unlockCost, balance: money }));
    return NavigationManager.back(player);
  }

  removeMoney(player, unlockCost);
  unlockItem(player, itemId);

  // ภาษี 10% เข้าธนาคารกลาง (เหมือนการซื้อปกติ)
  const tax = Math.floor(unlockCost * SHOP_CONFIG.NPC_SHOP.TAX_RATE);
  depositToBank(tax);

  playUnlockSuccess(player);
  showSuccess(player, t("ui.buyUnlockSuccess", {
    name: getItemDisplayName(itemId),
    cost: unlockCost,
    balance: getMoney(player)
  }));

  // กลับไปหน้าเมนูซื้อเดิม
  NavigationManager.back(player);
}

async function openBuyItemMenu(player, itemId, category) {
  if (!player?.isValid) return;

  const price = getBuyPrice(itemId);
  const presets = SHOP_CONFIG.BUY_AMOUNT_PRESETS;
  const items = [
    ...presets.map(amount => ({
      id: amount,
      labelKey: "ui.buyPreset",
      labelVars: { amount },
      icon: "textures/items/gold_ingot"
    })),
    { id: "custom", labelKey: "ui.buyCustomAmount", icon: "textures/ui/icon_recipe_item" }
  ];

  return createListMenu(player, {
    titleKey: "ui.itemTitle",
    titleVars: { name: getItemDisplayName(itemId) },
    bodyKey: "ui.buyItemMenuBody",
    bodyVars: { price, balance: getMoney(player) },
    menuGroup: "buyItemMenu",
    items,
    onSelect: (item) => {
      if (item.id === "custom") {
        return openBuyCustomAmount(player, itemId, category);
      }
      // เข้าหน้ายืนยัน (อีกหนึ่ง "หน้าจอ") — push หน้าเลือกจำนวนไว้ก่อนเสมอ
      NavigationManager.push(player, () => openBuyItemMenu(player, itemId, category));
      return openBuyConfirm(player, itemId, item.id, category);
    }
  });
}

async function openBuyCustomAmount(player, itemId, category) {
  return createAmountPrompt(player, {
    titleKey: "ui.buyAmountTitle",
    titleVars: { name: getItemDisplayName(itemId) },
    promptKey: "ui.buyAmountPrompt",
    placeholder: t("ui.numberPlaceholder"),
    onCancel: () => {
      playCancel(player);
      return NavigationManager.close(player);
    },
    onSubmit: (value) => {
      const amount = Number(value);
      if (!Number.isInteger(amount) || amount <= 0) {
        showError(player, t("ui.invalidAmount"));
        return openBuyItemMenu(player, itemId, category);
      }
      // เข้าหน้ายืนยัน — push หน้าเลือกจำนวนไว้ก่อนเสมอ เหมือนเส้นทาง preset amount
      NavigationManager.push(player, () => openBuyItemMenu(player, itemId, category));
      return openBuyConfirm(player, itemId, amount, category);
    }
  });
}

// =========================
// ยืนยันการซื้อ
// =========================
async function openBuyConfirm(player, itemId, amount, category) {
  const price = getBuyPrice(itemId);
  const total = amount * price;

  return showIconConfirm({
    player,
    titleKey: "ui.buyConfirmTitle",
    bodyKey: "ui.buyConfirmBody",
    bodyVars: { name: getItemDisplayName(itemId), amount, total },
    confirmIcon: getItemIcon(itemId),
    onCancel: () => {
      playCancel(player);
      return NavigationManager.back(player);
    },
    onConfirm: () => buyItems(player, itemId, amount, category)
  });
}

function buyItems(player, itemId, amount, category) {
  const price = getBuyPrice(itemId);
  const totalCost = price * amount;
  const money = getMoney(player);

  if (money < totalCost) {
    playError(player);
    showError(player, t("ui.insufficientFunds", { cost: totalCost, balance: money }));
    // ตอนนี้หน้ายืนยันถูก push ไว้ก่อนเข้ามาแล้วเสมอ (ทั้งเส้นทาง preset และ
    // custom amount) — ย้อนกลับผ่าน NavigationManager.back() แทนเรียกซ้ำตรง ๆ
    // เพื่อไม่ให้สแตกที่ push ไว้ค้าง
    return NavigationManager.back(player);
  }

  const container = getInventoryContainer(player);
  if (!container) return;

  const added = addItemToInventory(container, itemId, amount);
  if (added <= 0) {
    playError(player);
    showError(player, t("ui.buyInventoryFull"));
    return NavigationManager.close(player);
  }

  const actualCost = price * added;
  removeMoney(player, actualCost);
  // เงินที่ผู้เล่นเสียไปตอนซื้อของร้านค้า เข้าธนาคารกลางแค่ "ส่วนภาษี" เท่านั้น
  // (แก้บั๊ก: เดิมเข้าธนาคารกลางเต็ม 100% ของเงินที่จ่าย ทำให้จ่าย 100 แล้ว
  // "ภาษี" ในธนาคารกลางขึ้น 100 เป๊ะ ๆ แทนที่จะเป็น 10% เหมือนภาษีตลาด/โอนเงิน)
  const shopTax = Math.floor(actualCost * SHOP_CONFIG.NPC_SHOP.TAX_RATE);
  depositToBank(shopTax);
  playBuySuccess(player);

  // แจ้งระบบเควส (systems/quests/reportApi.js) เผื่อมีเควส "ซื้อไอเทม" ที่
  // targetId ตรงกับไอเทมนี้อยู่ — เหมือน reportItemSold() ฝั่งขายด้านบน
  // ใช้ added (จำนวนที่ซื้อได้จริง) ไม่ใช่ amount ที่ขอซื้อ เผื่อกระเป๋าเต็ม
  // ระหว่างทางแล้วซื้อได้ไม่ครบ (ตรงกับ actualCost ที่คำนวณข้างบน)
  reportItemBought(player, itemId, added);

  if (added < amount) {
    showSuccess(player, t("ui.buyPartial", {
      added,
      amount,
      cost: actualCost,
      balance: getMoney(player)
    }));
  } else {
    showSuccess(player, t("ui.buySuccess", {
      item: getItemDisplayName(itemId),
      amount: added,
      cost: actualCost,
      balance: getMoney(player)
    }));
  }
  showActionBar(player, t("ui.buyActionBar", {
    item: getItemDisplayName(itemId),
    amount: added,
    cost: actualCost
  }), "shop");

  // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตก (categoryPicker + buyMenu ที่ถูก push)
  NavigationManager.close(player);
}
