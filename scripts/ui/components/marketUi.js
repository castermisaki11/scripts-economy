// =========================
// marketUi.js  (UI LAYER)
//
// หน้าจอทั้งหมดของตลาดผู้เล่น (Player Market) — แยกออกมาจาก
// systems/playerMarket.js เดิม (950 บรรทัด รวม logic+UI ไว้ไฟล์เดียว) ตาม
// CONTRIBUTING.md ข้อ "แยกไฟล์ใหญ่" — ไฟล์นี้ไม่มีการเข้าถึง dynamic
// property ของตลาดตรง ๆ เลย ทุกจุดเรียกผ่านฟังก์ชันที่ export จาก
// systems/playerMarket.js (logic layer) แทน
//
// === MIGRATED to scripts/ui/ framework === (ย้ายมาจากไฟล์เดิม ไม่เปลี่ยน)
// ไฟล์นี้ไม่สร้าง ActionFormData / ModalFormData / MessageFormData ตรง ๆ
// ทุกหน้าจอผ่าน UIFramework.js, การนำทางผ่าน NavigationManager.js,
// ทุกสตริงผ่าน t() — ตรรกะการซื้อ/ขาย/ภาษี/เงินค้างรับ/ของค้างรับ/การ
// serialize ไอเทมไม่ถูกแก้ไขจากเดิมแม้แต่บรรทัดเดียว (ย้ายมาจาก
// systems/playerMarket.js เดิมทั้งก้อน)
//
// การค้นหาใช้ SearchService.js ร่วมกับ shopSystem.js ผ่าน
// getMarketSearchSource() adapter (matching logic เดียวกันทั้งแอปตาม
// amendment 4)
// =========================

import { world } from "@minecraft/server";
import { createListMenu, createResultMessage, createAmountPrompt, createModalPrompt } from "../framework/UIFramework";
import { showConfirm, showIconConfirm } from "../../core/confirmDialog";
import { NavigationManager } from "../framework/NavigationManager";
import { t } from "../locale/index";
import { searchItems, getMarketSearchSource } from "../framework/SearchService";
import { getMoney, changeMoney } from "../../core/economyUtils";
import { showSuccess, showError, showInfo } from "../../core/messageUtils";
import { isAdmin } from "../../core/playerUtils";
import { giveItems, getInventoryContainer, getGenericItemIcon } from "../../core/itemUtils";
import { addLog } from "../../systems/economy";
import { nowMs } from "../../core/timeUtils";
import { ICONS } from "../../config/uiConfig";
import {
    TAX_RATE, MAX_MARKET_LISTINGS, MAX_LISTING_PRICE, MAX_DESCRIPTION_LENGTH,
    MAX_WATCHLIST_ITEMS, LISTING_EXPIRE_DAYS, SORT_MODES,
    getMarket, saveMarket,
    getPendingMoney, addPendingMoney, clearPendingMoney,
    getPendingItems,
    getBankBalance, depositToBank, withdrawFromBank,
    getWatchlist, saveWatchlist, getWatchAlerts, saveWatchAlerts,
    playSound, sortListings, notifySellerOfSale, notifyWatchers,
    serializeItemStack, rebuildItemFromListing,
    pruneExpiredListings, claimPendingItemsLogic,
    findOnlinePlayerById, findOnlinePlayerByName, findOnlinePlayerByIdOrName,
    addPendingQuestMarketSale
} from "../../core/economyUtils";
import { findOnlinePlayerById, findOnlinePlayerByName, findOnlinePlayerByIdOrName } from "../../core/playerUtils";
// Phase 3B: แจ้งระบบเควส (systems/quests/reportApi.js) ตอนของขายออกในตลาด
// ผู้เล่นสำเร็จ — เหมือน reportItemSold()/reportItemBought() ที่
// shopSystem.js เรียกใช้งานอยู่แล้ว ไม่มี Circular Import (questSystem.js
// ไม่ import กลับมาที่ไฟล์นี้เลย)
import { reportMarketSold } from "../../systems/questSystem";

// Lock สำหรับป้องกัน race condition ตอนซื้อ listing พร้อมกัน
const purchaseLocks = new Set();

// Helper สำหรับตรวจสอบราคา listing — ใช้ซ้ำใน showPriceInput และ showEditPriceForm
function validateMarketPrice(price) {
  if (isNaN(price) || price <= 0) return { valid: false, errorKey: "market.priceInvalid" };
  if (price > MAX_LISTING_PRICE) return { valid: false, errorKey: "market.priceTooHigh", errorVars: { max: MAX_LISTING_PRICE.toLocaleString() } };
  return { valid: true };
}

function claimPendingItems(player) {
    const { claimed, remaining } = claimPendingItemsLogic(player);
    // เดิม: if (pending.length === 0) return; (ไม่ทำอะไรเลย ไม่เปิดเมนูใหม่) —
    // claimed+remaining นับรวมได้ 0 ก็ต่อเมื่อไม่มีของค้างรับตั้งแต่แรกเท่านั้น
    // (pending.length === 0) จึงเทียบเท่าเงื่อนไขเดิมทุกกรณี ปุ่มนี้แสดงเฉพาะ
    // ตอน pendingItems.length > 0 ใน openMarketUI() อยู่แล้ว จึง edge case นี้
    // ไม่เกิดจริงจากการกดปุ่ม แต่คงพฤติกรรมเดิมไว้เผื่อเรียกตรง
    if (claimed === 0 && remaining === 0) return;

    if (remaining === 0) {
        showSuccess(player, t("market.claimItemsSuccess"));
    } else {
        showInfo(player, t("market.claimItemsPartial", { remaining }));
    }

    return openMarketUI(player);
}

function claimMoney(player) {
    const amount = getPendingMoney(player);
    if (amount <= 0) return;
    changeMoney(player, amount);
    clearPendingMoney(player);
    playSound(player, "random.orb");
    showSuccess(player, t("market.claimMoneySuccess", { amount: amount.toLocaleString() }));
    return openMarketUI(player);
}

// --- Main UI ---

export const openMarketUI = safeAsync(async (player) => {
    if (!player?.isValid) return;
    pruneExpiredListings();
    const pendingMoney = getPendingMoney(player);
    const pendingItems = getPendingItems(player);
    const bankTotal = getBankBalance();
    const watchAlerts = getWatchAlerts(player);

    // หมายเหตุ: บอดี้นี้ประกอบจากหลายบรรทัดที่ "มี/ไม่มี" ตามเงื่อนไข
    // (ต่างจากบอดี้ 1 บรรทัดของหน้าจออื่นที่ใช้ bodyKey/bodyVars ตรง ๆ ได้)
    // แต่ละบรรทัดยังมาจาก t() ทั้งหมด — ไม่มีข้อความ hardcode — แค่การ
    // ต่อสตริงเป็น logic ระดับไฟล์นี้ ปล่อยผ่าน bodyKey ไปตรง ๆ เพราะ t()
    // จะคืนสตริงเดิมกลับมาเมื่อไม่พบ key ที่ตรงกัน (ดู locale/index.js)
    const bodyLines = [t("market.balanceLine", { balance: getMoney(player).toLocaleString() })];
    if (pendingMoney > 0) bodyLines.push(t("market.pendingMoneyLine", { amount: pendingMoney.toLocaleString() }));
    if (pendingItems.length > 0) bodyLines.push(t("market.pendingItemsLine", { count: pendingItems.length }));
    if (watchAlerts.length > 0) bodyLines.push(t("market.pendingWatchAlertsLine", { count: watchAlerts.length }));
    if (isAdmin(player)) bodyLines.push(t("market.adminBankLine", { amount: bankTotal.toLocaleString() }));

    const items = [
        { id: "enter", labelKey: "market.enterMarket", icon: "textures/ui/icon_recipe_item" },
        { id: "sell", labelKey: "market.sellItem", icon: "textures/ui/inventory_icon" },
        { id: "watchlist", labelKey: "market.watchlistButton", icon: "textures/ui/magnifyingGlass.png" }
    ];
    if (pendingMoney > 0) items.push({ id: "claimMoney", labelKey: "market.claimMoney", icon: "textures/ui/realms_slot_check" });
    if (pendingItems.length > 0) items.push({ id: "claimItems", labelKey: "market.claimItems", icon: "textures/ui/icon_import" });
    if (watchAlerts.length > 0) items.push({ id: "watchAlerts", labelKey: "market.watchAlertsButton", labelVars: { count: watchAlerts.length }, icon: "textures/ui/bell" });

    return createListMenu(player, {
        titleKey: "market.mainTitle",
        bodyKey: bodyLines.join("\n"),
        menuGroup: "marketMenu",
        items,
        onSelect: (item) => {
            if (item.id === "enter") {
                NavigationManager.push(player, () => openMarketUI(player));
                return showMarketList(player);
            }
            if (item.id === "sell") {
                NavigationManager.push(player, () => openMarketUI(player));
                return showInventorySell(player);
            }
            if (item.id === "watchlist") {
                NavigationManager.push(player, () => openMarketUI(player));
                return showWatchlist(player);
            }
            if (item.id === "watchAlerts") {
                NavigationManager.push(player, () => openMarketUI(player));
                return showWatchAlerts(player);
            }
            if (item.id === "claimMoney") return claimMoney(player);
            if (item.id === "claimItems") return claimPendingItems(player);
        }
    });
});

// --- ตลาด: รายการสินค้า + ค้นหา ---

export const showMarketList = safeAsync(async (player, query = "", sortMode = "newest") => {
    if (!player?.isValid) return;
    let market = getMarket();

    if (query) {
        const matches = searchItems(query, getMarketSearchSource(market));
        const matchedIds = new Set(matches.map(m => m.id));
        market = market.filter(listing => matchedIds.has(listing.id));
    }

    market = sortListings(market, sortMode, player);

    let bodyKey, bodyVars;
    if (market.length === 0) {
        if (query) { bodyKey = "market.searchNoResults"; bodyVars = { query }; }
        else { bodyKey = "market.listEmptyBody"; }
    } else {
        bodyKey = "market.listBody";
    }

    const currentSortLabel = t(SORT_MODES.find(m => m.id === sortMode)?.labelKey ?? SORT_MODES[0].labelKey);

    const items = [
        { id: "__search__", labelKey: "market.searchButton", icon: "textures/ui/magnifyingGlass.png" },
        { id: "__sort__", labelKey: "market.sortButton", labelVars: { mode: currentSortLabel }, icon: "textures/ui/icon_setting" },
        ...market.map(listing => {
            const isOwner = listing.sellerId ? listing.sellerId === player.id : listing.seller === player.name;
            return {
                id: listing.id,
                labelKey: isOwner ? "market.ownListingButton" : "market.listingButton",
                labelVars: isOwner
                    ? { name: listing.displayName, amount: listing.amount, price: listing.price.toLocaleString() }
                    : { name: listing.displayName, amount: listing.amount, price: listing.price.toLocaleString(), seller: listing.seller },
                icon: listing.iconPath
            };
        })
    ];

    return createListMenu(player, {
        titleKey: "market.listTitle",
        bodyKey,
        bodyVars,
        menuGroup: "marketListMenu",
        items,
        onSelect: (item) => {
            if (item.id === "__search__") return openMarketSearch(player, query, sortMode);
            if (item.id === "__sort__") return openSortMenu(player, query, sortMode);

            const selected = market.find(listing => listing.id === item.id);
            if (!selected) return NavigationManager.back(player);

            NavigationManager.push(player, () => showMarketList(player, query, sortMode));
            const isOwn = selected.sellerId ? selected.sellerId === player.id : selected.seller === player.name;
            if (isOwn) return showOwnListingMenu(player, selected);
            return confirmPurchase(player, selected);
        }
    });
});

export const openMarketSearch = safeAsync(async (player, previousQuery = "", sortMode = "newest") => {
    return createAmountPrompt(player, {
        titleKey: "market.searchTitle",
        promptKey: "market.searchPrompt",
        placeholder: t("market.searchPlaceholder"),
        // ไม่ push ก่อนเข้าช่องค้นหา — เป็น modal ชั่วคราวเหมือน custom amount
        // ใน shopSystem.js ไม่ใช่ "หน้าจอ" ในสแตก
        onCancel: () => showMarketList(player, previousQuery, sortMode),
        onSubmit: (value) => showMarketList(player, String(value ?? "").trim(), sortMode)
    });
});

// เมนูเลือกลำดับการแสดงผล — modal ชั่วคราวเหมือน openMarketSearch ข้างบน
// ไม่ push เข้าสแตก (กด X/ยกเลิก ก็แค่วาด showMarketList เดิมใหม่)
export const openSortMenu = safeAsync(async (player, query, currentSort) => {
    const defaultIndex = Math.max(0, SORT_MODES.findIndex(m => m.id === currentSort));

    return createModalPrompt(player, {
        titleKey: "market.sortTitle",
        fields: [
            {
                type: "dropdown",
                labelKey: "market.sortPrompt",
                optionKeys: SORT_MODES.map(m => m.labelKey),
                defaultIndex
            }
        ],
        onCancel: () => showMarketList(player, query, currentSort),
        onSubmit: (values) => {
            const selected = SORT_MODES[values[0]] ?? SORT_MODES[0];
            return showMarketList(player, query, selected.id);
        }
    });
});

// --- ระบบการซื้อ (จุดที่หักภาษีไปเข้า Bank) ---
export const confirmPurchase = safeAsync(async (player, itemData) => {
    const tax = Math.floor(itemData.price * TAX_RATE); // คำนวณภาษี
    const profit = itemData.price - tax; // เงินที่คนขายจะได้

    // ต่อท้ายด้วยรายละเอียดสินค้าจากผู้ขาย (ถ้ามี) — listing เก่าก่อนอัปเดต
    // นี้จะไม่มี description เลย ก็ข้ามบรรทัดนี้ไปเงียบ ๆ เหมือน pendingMoneyLine
    // ใน openMarketUI (บอดี้ประกอบจากหลายบรรทัดที่ "มี/ไม่มี" ตามเงื่อนไข)
    let bodyText = t("market.confirmPurchaseBody", {
        name: itemData.displayName,
        amount: itemData.amount,
        price: itemData.price.toLocaleString(),
        tax: tax.toLocaleString()
    });
    if (itemData.description) {
        bodyText += "\n" + t("market.confirmPurchaseDescLine", { description: itemData.description });
    }

    return showIconConfirm({
        player,
        titleKey: "market.confirmPurchaseTitle",
        bodyKey: bodyText, // สตริงสำเร็จรูปแล้ว — t() จะคืนค่าเดิมกลับมาเมื่อไม่พบ key ที่ตรงกัน
        confirmIcon: itemData.iconPath,
        onCancel: () => NavigationManager.back(player),
        onConfirm: async () => {
            // Lock listing เพื่อป้องกัน race condition (สองคนซื้อพร้อมกัน)
            if (purchaseLocks.has(itemData.id)) {
                return createResultMessage(player, { type: "error", messageKey: "market.purchaseSoldOut" });
            }
            purchaseLocks.add(itemData.id);

            try {
                let market = getMarket();
                const currentIndex = market.findIndex(i => i.id === itemData.id);
                if (currentIndex === -1) {
                    return createResultMessage(player, { type: "error", messageKey: "market.purchaseSoldOut" });
                }

                if (getMoney(player) < itemData.price) {
                    playSound(player, "note.bass");
                    return createResultMessage(player, { type: "error", messageKey: "market.purchaseInsufficientFunds" });
                }

                // เช็คที่ว่างในกระเป๋าก่อนหักเงินทุกครั้ง กันเงินหายเปล่าถ้าของใส่ไม่ได้
                // ใช้ rebuildItemFromListing เพื่อคืนไอเทมพร้อม enchant/lore/ความทนทานเดิม
                if (!giveItems(player, rebuildItemFromListing(itemData))) {
                    playSound(player, "note.bass");
                    return createResultMessage(player, { type: "error", messageKey: "market.purchaseInventoryFull" });
                }

                // 1. หักเงินคนซื้อ (เต็มจำนวน)
                changeMoney(player, -itemData.price);

                addPendingMoney(itemData.sellerId ?? itemData.seller, profit);
                addBankBalance(tax);
                notifySellerOfSale(player, itemData, profit);
    const sellerPlayer = findOnlinePlayerById(itemData.sellerId) ?? findOnlinePlayerByName(itemData.seller);
                if (sellerPlayer?.isValid) {
                    reportMarketSold(sellerPlayer, itemData.itemType, itemData.amount);
                } else {
                    addPendingQuestMarketSale(itemData.sellerId ?? itemData.seller, itemData.itemType, itemData.amount);
                }

                // นำออกจากรายการตลาด
                market.splice(currentIndex, 1);
                saveMarket(market);

                playSound(player, "note.pling");

                // แจ้งเตือน Admin (ตัวเลือกเสริม) — ภาษี 10% เข้าธนาคารกลาง
                console.warn(`[Market] ภาษีตลาด ${tax} เหรียญ เข้าธนาคารกลาง`);

                await createResultMessage(player, { type: "success", messageKey: "market.purchaseSuccess" });
                return NavigationManager.close(player);
            } finally {
                purchaseLocks.delete(itemData.id);
            }
        }
    });
});

// --- ฟังก์ชันเสริมสำหรับ Admin (ใช้ดูหรือเบิกเงินธนาคาร) ---
export const adminBankUI = safeAsync(async (player) => {
    if (!isAdmin(player)) return;

    const bankTotal = getBankBalance();

    return createListMenu(player, {
        titleKey: "market.adminBankTitle",
        bodyKey: "market.adminBankBody",
        bodyVars: { balance: bankTotal.toLocaleString() },
        menuGroup: "marketAdminBankMenu",
        items: [{ id: "withdraw", labelKey: "market.adminBankWithdraw", icon: "textures/ui/icon_import" }],
        onSelect: async (item) => {
            if (item.id !== "withdraw") return;
            if (bankTotal <= 0) {
                return createResultMessage(player, { type: "warning", messageKey: "market.adminBankEmpty" });
            }
            changeMoney(player, bankTotal);
            clearBankBalance();
            addLog({
                type: "shop_bank_withdraw",
                admin: player.name,
                amount: bankTotal
            });
            playSound(player, "random.levelup");
            await createResultMessage(player, {
                type: "success",
                messageKey: "market.adminBankSuccess",
                messageVars: { amount: bankTotal.toLocaleString() }
            });
            return NavigationManager.close(player);
        }
    });
});

// --- ลงขายสินค้า ---
export const showInventorySell = safeAsync(async (player) => {
    if (!player?.isValid) return;
    const inventory = getInventoryContainer(player);
    const itemsInInv = [];

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;
        const displayName = item.nameTag || item.typeId.replace("minecraft:", "").replace(/_/g, " ");
        const iconPath = getGenericItemIcon(item.typeId);
        itemsInInv.push({ item, slot: i, displayName, typeId: item.typeId, amount: item.amount, iconPath });
    }

    if (itemsInInv.length === 0) {
        await createResultMessage(player, { type: "warning", titleKey: "market.sellMenuTitle", messageKey: "market.sellMenuEmpty" });
        return NavigationManager.close(player);
    }

    const items = itemsInInv.map(info => ({
        id: info.slot,
        labelKey: "market.sellItemButton",
        labelVars: { name: info.displayName, amount: info.amount },
        icon: info.iconPath
    }));

    return createListMenu(player, {
        titleKey: "market.sellMenuTitle",
        items,
        onSelect: (item) => {
            const info = itemsInInv.find(i => i.slot === item.id);
            if (!info) return NavigationManager.back(player);
            NavigationManager.push(player, () => showInventorySell(player));
            return showPriceInput(player, info);
        }
    });
});

export const showPriceInput = safeAsync(async (player, itemInfo) => {
    return createModalPrompt(player, {
        titleKey: "market.setPriceTitle",
        fields: [
            {
                type: "textField",
                labelKey: "market.setPricePrompt",
                labelVars: { name: itemInfo.displayName, amount: itemInfo.amount, taxPercent: TAX_RATE * 100 },
                placeholder: t("market.setPricePlaceholder")
            },
            {
                type: "textField",
                labelKey: "market.setDescriptionPrompt",
                placeholder: t("market.setDescriptionPlaceholder")
            }
        ],
        onCancel: () => showInventorySell(player),
        onSubmit: (values) => {
            const [rawPrice, rawDescription] = values;
            const price = parseInt(rawPrice);
            const validation = validateMarketPrice(price);
            if (!validation.valid) {
                showError(player, t(validation.errorKey, validation.errorVars));
                return showInventorySell(player);
            }

            // รายละเอียดสินค้า: ไม่บังคับกรอก — เว้นว่างได้ ตัดความยาวถ้าเกินลิมิต
            // (ไม่ปฏิเสธการลงขายเพราะกรอกยาวไป แค่ตัดส่วนเกินทิ้งเงียบ ๆ)
            const description = String(rawDescription ?? "").trim().slice(0, MAX_DESCRIPTION_LENGTH);

            // จำกัดจำนวน listing รวมในตลาด กัน dynamic property เกินลิมิต
            const market = pruneExpiredListings();
            if (market.length >= MAX_MARKET_LISTINGS) {
                showError(player, t("market.marketFull", { max: MAX_MARKET_LISTINGS }));
                return showInventorySell(player);
            }

            const inventory = getInventoryContainer(player);
            const newListing = {
                id: nowMs() + Math.random(),
                seller: player.name,
                sellerId: player.id,
                itemType: itemInfo.typeId,
                displayName: itemInfo.displayName,
                amount: itemInfo.amount,
                price: price,
                description,
                iconPath: itemInfo.iconPath,
                itemData: serializeItemStack(itemInfo.item),
                listedAt: nowMs(),
            };
            market.push(newListing);
            saveMarket(market);
            inventory.setItem(itemInfo.slot, undefined);
            playSound(player, "random.orb");
            notifyWatchers(newListing); // เช็ค watchlist ของทุกคนกับ listing ที่เพิ่งลงขาย
            // จำนวนวันดึงจาก config ตรง ๆ (LISTING_EXPIRE_DAYS re-export จาก
            // systems/playerMarket.js ซึ่งอ่านจาก SHOP_CONFIG.MARKET.LISTING_EXPIRE_DAYS
            // ตรง ๆ) กันข้อความกับพฤติกรรมจริงไม่ตรงกันแบบที่เคยเป็น (เคย hardcode
            // "14 วัน" ไว้ในข้อความ ทั้งที่ pruneExpiredListings() ใช้ค่าจาก config จริง ๆ)
            showSuccess(player, t("market.listSuccess", { days: LISTING_EXPIRE_DAYS }));
            return NavigationManager.close(player);
        }
    });
});

// เมนูจัดการ listing ของตัวเอง (แทนที่การพาไปหน้ายกเลิกตรง ๆ) — เลือกได้ว่า
// จะแก้ราคา (ไม่ต้องถอนของออกจากตลาด) หรือยกเลิกการขาย (showCancelForm เดิม)
export const showOwnListingMenu = safeAsync(async (player, itemData) => {
    return createListMenu(player, {
        titleKey: "market.manageListingTitle",
        bodyKey: "market.manageListingBody",
        bodyVars: { name: itemData.displayName, amount: itemData.amount, price: itemData.price.toLocaleString() },
        menuGroup: "marketManageMenu",
        items: [
            { id: "edit", labelKey: "market.editPriceButton", icon: ICONS.save },
            { id: "cancel", labelKey: "market.cancelListingButton", icon: ICONS.exit }
        ],
        onSelect: (item) => {
            if (item.id === "edit") {
                NavigationManager.push(player, () => showOwnListingMenu(player, itemData));
                return showEditPriceForm(player, itemData);
            }
            if (item.id === "cancel") {
                NavigationManager.push(player, () => showOwnListingMenu(player, itemData));
                return showCancelForm(player, itemData);
            }
        }
    });
});

// แก้ราคาของ listing ที่ยังลงขายอยู่ โดยไม่ต้องยกเลิก+ลงขายใหม่ทั้งหมด —
// ใช้ MAX_LISTING_PRICE เดียวกับตอนลงขายครั้งแรก (showPriceInput)
export const showEditPriceForm = safeAsync(async (player, itemData) => {
    return createModalPrompt(player, {
        titleKey: "market.editPriceTitle",
        fields: [
            {
                type: "textField",
                labelKey: "market.editPricePrompt",
                labelVars: { name: itemData.displayName, amount: itemData.amount },
                placeholder: t("market.setPricePlaceholder"),
                defaultValue: String(itemData.price)
            }
        ],
        onCancel: () => NavigationManager.back(player),
        onSubmit: (values) => {
            const price = parseInt(values[0]);
            const validation = validateMarketPrice(price);
            if (!validation.valid) {
                showError(player, t(validation.errorKey, validation.errorVars));
                return showEditPriceForm(player, itemData);
            }

            const market = getMarket();
            const currentIndex = market.findIndex(i => i.id === itemData.id);
            if (currentIndex === -1) {
                return createResultMessage(player, { type: "error", messageKey: "market.listingNotFound" });
            }

            market[currentIndex].price = price;
            saveMarket(market);
            playSound(player, "random.orb");
            showSuccess(player, t("market.editPriceSuccess", { price: price.toLocaleString() }));
            return NavigationManager.close(player);
        }
    });
});

export const showCancelForm = safeAsync(async (player, itemData) => {
    return showConfirm({
        player,
        titleKey: "market.cancelListingTitle",
        bodyKey: "market.cancelListingBody",
        bodyVars: { name: itemData.displayName, amount: itemData.amount },
        onCancel: () => NavigationManager.back(player),
        onConfirm: async () => {
            let market = getMarket();
            const currentIndex = market.findIndex(i => i.id === itemData.id);
            if (currentIndex === -1) return NavigationManager.back(player);

            if (!giveItems(player, rebuildItemFromListing(itemData))) {
                return createResultMessage(player, { type: "error", messageKey: "market.cancelListingFull" });
            }

            market.splice(currentIndex, 1);
            saveMarket(market);
            playSound(player, "random.pop");
            await createResultMessage(player, { type: "success", messageKey: "market.cancelListingSuccess" });
            return NavigationManager.close(player);
        }
    });
});

// --- ระบบติดตามไอเทม: หน้าจอ ---

// รายการคำค้นหาที่ผู้เล่นติดตามอยู่ + ปุ่มเพิ่มรายการใหม่ (สูงสุด MAX_WATCHLIST_ITEMS)
export const showWatchlist = safeAsync(async (player) => {
    const watching = getWatchlist(player);

    const items = [
        { id: "__add__", labelKey: "market.watchAddButton", icon: "textures/ui/icon_add" },
        ...watching.map(w => ({
            id: w.id,
            labelKey: "market.watchItemButton",
            labelVars: { query: w.query },
            icon: "textures/ui/magnifyingGlass.png"
        }))
    ];

    return createListMenu(player, {
        titleKey: "market.watchlistTitle",
        bodyKey: watching.length === 0 ? "market.watchlistEmptyBody" : "market.watchlistBody",
        menuGroup: "marketWatchlistMenu",
        items,
        onSelect: (item) => {
            if (item.id === "__add__") {
                NavigationManager.push(player, () => showWatchlist(player));
                return showAddWatchlist(player);
            }

            const target = watching.find(w => w.id === item.id);
            if (!target) return NavigationManager.back(player);

            NavigationManager.push(player, () => showWatchlist(player));
            return showRemoveWatchConfirm(player, target);
        }
    });
});

// เพิ่มคำค้นหาใหม่เข้า watchlist — ใช้ตัวเทียบ query เดียวกับตอนค้นหาในตลาด
// (searchItems) กันไม่ให้พฤติกรรม "ตรงกัน" ต่างจากตอนค้นหาจริง
export const showAddWatchlist = safeAsync(async (player) => {
    return createAmountPrompt(player, {
        titleKey: "market.watchAddTitle",
        promptKey: "market.watchAddPrompt",
        placeholder: t("market.searchPlaceholder"),
        onCancel: () => NavigationManager.back(player),
        onSubmit: (value) => {
            const query = String(value ?? "").trim();
            if (!query) {
                showError(player, t("market.watchQueryInvalid"));
                return showAddWatchlist(player);
            }

            const watching = getWatchlist(player);
            const normalized = query.toLowerCase();
            if (watching.some(w => w.query.toLowerCase() === normalized)) {
                showError(player, t("market.watchDuplicate"));
                return NavigationManager.back(player);
            }
            if (watching.length >= MAX_WATCHLIST_ITEMS) {
                showError(player, t("market.watchFull", { max: MAX_WATCHLIST_ITEMS }));
                return NavigationManager.back(player);
            }

            watching.push({ id: nowMs() + Math.random(), query, addedAt: nowMs() });
            saveWatchlist(player, watching);
            playSound(player, "random.orb");
            showSuccess(player, t("market.watchAddSuccess", { query }));
            return NavigationManager.close(player);
        }
    });
});

// เลิกติดตามคำค้นหาที่เลือก
export const showRemoveWatchConfirm = safeAsync(async (player, target) => {
    return showConfirm({
        player,
        titleKey: "market.watchRemoveTitle",
        bodyKey: "market.watchRemoveBody",
        bodyVars: { query: target.query },
        onCancel: () => NavigationManager.back(player),
        onConfirm: async () => {
            const watching = getWatchlist(player).filter(w => w.id !== target.id);
            saveWatchlist(player, watching);
            playSound(player, "random.pop");
            await createResultMessage(player, { type: "success", messageKey: "market.watchRemoveSuccess" });
            return NavigationManager.close(player);
        }
    });
});

// รายการแจ้งเตือนที่ค้างไว้ (จากตอนออฟไลน์ หรือพลาดข้อความแชทตอนออนไลน์) —
// ล้างคิวทันทีที่เปิดหน้านี้ (อ่านครั้งเดียวถือว่ารับทราบแล้ว เหมือน inbox
// ทั่วไป) กันไม่ให้ dynamic property โตไม่มีที่สิ้นสุดโดยไม่ต้องมีปุ่มล้างแยก
export const showWatchAlerts = safeAsync(async (player) => {
    const alerts = getWatchAlerts(player);
    saveWatchAlerts(player, []);

    const items = alerts.map((a, idx) => ({
        id: `alert_${idx}`,
        labelKey: "market.watchAlertItem",
        labelVars: { name: a.name, amount: a.amount, price: a.price.toLocaleString(), seller: a.seller },
        icon: "textures/ui/bell"
    }));

    return createListMenu(player, {
        titleKey: "market.watchAlertsTitle",
        bodyKey: alerts.length === 0 ? "market.watchAlertsEmpty" : "market.watchAlertsBody",
        items,
        // แค่รายการอ่านอย่างเดียว — แตะอันไหนก็ปิดเมนูเหมือนกัน ไม่มีหน้าถัดไป
        onSelect: () => NavigationManager.close(player)
    });
});
