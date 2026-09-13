// =========================
// playerMarket.js  (LOGIC LAYER — ไม่มี import จาก UIFramework/NavigationManager/
// confirmDialog เลยแม้แต่บรรทัดเดียว — ตามกฎ CONTRIBUTING.md ข้อ "แยกไฟล์ใหญ่")
//
// ตลาดผู้เล่น (Player Market) — ซื้อ/ขายไอเทมระหว่างผู้เล่น พร้อมหักภาษี 10%
// เข้าธนาคารกลาง, ระบบ "เงินค้างรับ" / "ของค้างรับ" กันของหาย, และการดึง
// listing ที่ค้างขายนานเกิน SHOP_CONFIG.MARKET.LISTING_EXPIRE_DAYS วัน
// ออกจากตลาดอัตโนมัติ (แก้ที่ shopConfig.js จุดเดียว ข้อความ UI จะอ่านค่า
// นี้ตรง ๆ ไม่มี hardcode จำนวนวันซ้ำที่อื่นแล้ว)
//
// === แยกจาก UI แล้ว (จากไฟล์ playerMarket.js เดิมที่รวม logic+UI ไว้ในไฟล์
// เดียว 950 บรรทัด) ===
// ไฟล์นี้เก็บเฉพาะ "การเข้าถึง/คำนวณข้อมูลตลาด" ล้วน ๆ — อ่าน/เขียน
// dynamic property, คำนวณภาษี/ราคา/การเรียงลำดับ, serialize ไอเทม, และ
// การแจ้งเตือน (ส่งข้อความ ไม่ใช่การวาดเมนู) ทุกฟังก์ชันในไฟล์นี้เรียกได้
// โดยไม่ต้องมีเมนูใด ๆ เปิดอยู่ก่อน
//
// หน้าจอ/เมนูทั้งหมด (openMarketUI, showMarketList, confirmPurchase,
// showInventorySell ฯลฯ) ย้ายไปอยู่ที่ ui/components/marketUi.js แล้ว —
// ไฟล์นั้น import ฟังก์ชันจากไฟล์นี้ไปใช้แทนการเขียนโค้ดเข้าถึงข้อมูลเอง
//
// ตรรกะการซื้อ/ขาย/ภาษี/เงินค้างรับ/ของค้างรับ/การ serialize ไอเทม ไม่ถูก
// แก้ไขจากของเดิมแม้แต่บรรทัดเดียว — ย้ายที่อยู่ไฟล์เท่านั้น
// =========================

import { findOnlinePlayerByName, findOnlinePlayerById, findOnlinePlayerByIdOrName } from "../core/playerUtils";
import { t } from "../ui/locale/index";
import { showSuccess } from "../core/messageUtils";
import { giveItems } from "../core/itemUtils";
import { getBankBalance, depositToBank, withdrawFromBank } from "../core/economyUtils";
import { nowMs, daysBetweenBangkok } from "../core/timeUtils";
import { SHOP_CONFIG } from "../config/shopConfig";
import { searchItems } from "../ui/framework/SearchService";

const MARKET_KEY = "GlobalMarket";
const BANK_KEY = BANK_DYNAMIC_PROPERTY_KEY; // คีย์สำหรับเก็บเงินภาษีกลาง — ใช้ร่วมกับ economy.js ผ่าน constants.js

// ค่าตั้งค่าตลาดผู้เล่นทั้งหมด (ภาษี/ลิมิตรายการ/ราคาสูงสุด/อายุ listing)
// อยู่ที่ config/shopConfig.js (SHOP_CONFIG.MARKET) — แก้ค่าที่นั่นจุดเดียว
// ไม่ต้องแก้ไฟล์นี้
export const TAX_RATE = SHOP_CONFIG.MARKET.TAX_RATE; // ภาษี 10%
// จำนวนรายการสูงสุดที่ตลาดรับได้พร้อมกัน (กัน dynamic property เกินลิมิต)
export const MAX_MARKET_LISTINGS = SHOP_CONFIG.MARKET.MAX_LISTINGS;
// ราคาสูงสุดที่ตั้งขายได้ต่อ 1 รายการ (กันตั้งราคาเกิน Number.MAX_SAFE_INTEGER จน UI/คำนวณพัง)
export const MAX_LISTING_PRICE = SHOP_CONFIG.MARKET.MAX_LISTING_PRICE;
// อายุสูงสุดของรายการที่ยังไม่ถูกซื้อ ก่อนจะถูกดึงกลับเข้าคิว "ของค้างรับ" ให้เจ้าของ
// นับเป็น "วันปฏิทินไทย" (ข้ามเที่ยงคืนไทยกี่ครั้ง) ไม่ใช่ต้องครบ N*24 ชม. เป๊ะ ๆ —
// ดู pruneExpiredListings() ที่ใช้ daysBetweenBangkok() เทียบค่านี้
export const LISTING_EXPIRE_DAYS = SHOP_CONFIG.MARKET.LISTING_EXPIRE_DAYS;
// ความยาวสูงสุดของ "รายละเอียดสินค้า" ที่ผู้ขายพิมพ์เอง (ค้างขายไว้คู่กับ listing)
export const MAX_DESCRIPTION_LENGTH = SHOP_CONFIG.MARKET.MAX_DESCRIPTION_LENGTH;

// จำนวนคำค้นหาที่ติดตามพร้อมกันได้ต่อคน / จำนวนการแจ้งเตือนค้างไว้สูงสุดต่อคน
export const MAX_WATCHLIST_ITEMS = 10;
export const MAX_WATCH_ALERTS = 15;
const WATCH_KEY_PREFIX = "market_watch_";
const WATCH_ALERTS_KEY_PREFIX = "market_watch_alerts_";

// --- การเรียงลำดับรายการตลาด (ปุ่ม "เรียงลำดับ" คู่กับปุ่มค้นหา) ---
// ต่อ id แต่ละตัวไว้ที่นี่จุดเดียว — labelKey อ้าง locale ผ่าน t() ตามปกติ
export const SORT_MODES = [
    { id: "newest", labelKey: "market.sort.newest" },
    { id: "priceAsc", labelKey: "market.sort.priceAsc" },
    { id: "priceDesc", labelKey: "market.sort.priceDesc" },
    { id: "mine", labelKey: "market.sort.mine" }
];

// --- Utility Functions (ตรรกะเดิมทั้งหมด ไม่แก้ไข) ---
export const getMarket = () => {
    try {
        const data = world.getDynamicProperty(MARKET_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.warn("[PlayerMarket] getMarket parse error:", error);
        return [];
    }
};

export const saveMarket = (marketData) => {
    world.setDynamicProperty(MARKET_KEY, JSON.stringify(marketData));
};

// ระบบเงินผู้เล่น: getMoney/changeMoney มาจาก economyUtils.js ที่เดียว
// (UI layer import ตรงจากที่นั่นเอง) — addMoney เดิมของไฟล์นี้รับ delta
// บวก/ลบได้ (เช่น addMoney(player, -price) ตอนหักเงินคนซื้อ) ซึ่งตรงกับ
// signature ของ changeMoney() ใน economyUtils.js พอดี จึงแทนที่ตรง ๆ ได้

function pendingMoneyKey(player) {
    if (player?.id) return `money_pending_${player.id}`;
    return `money_pending_${player}`;
}
function legacyPendingMoneyKey(player) {
    return player?.name ? `money_pending_${player.name}` : null;
}
export const getPendingMoney = (player) => {
    const idKey = pendingMoneyKey(player);
    const v = world.getDynamicProperty(idKey);
    if (typeof v === "number" && v !== 0) return v;
    const legacyKey = legacyPendingMoneyKey(player);
    if (legacyKey && legacyKey !== idKey) {
        const legacy = world.getDynamicProperty(legacyKey);
        if (typeof legacy === "number" && legacy !== 0) {
            world.setDynamicProperty(idKey, legacy);
            try { world.setDynamicProperty(legacyKey, 0); } catch {}
            return legacy;
        }
    }
    return v ?? 0;
};
export const addPendingMoney = (player, amount) => {
    const key = pendingMoneyKey(player);
    const current = getPendingMoney(player);
    world.setDynamicProperty(key, current + amount);
};
export const clearPendingMoney = (player) => {
    const idKey = pendingMoneyKey(player);
    world.setDynamicProperty(idKey, 0);
    const legacyKey = legacyPendingMoneyKey(player);
    if (legacyKey && legacyKey !== idKey) try { world.setDynamicProperty(legacyKey, 0); } catch {}
};

function pendingItemsKey(player) {
    if (player?.id) return `items_pending_${player.id}`;
    return `items_pending_${player}`;
}
function legacyPendingItemsKey(player) {
    return player?.name ? `items_pending_${player.name}` : null;
}
export const getPendingItems = (player) => {
    const idKey = pendingItemsKey(player);
    try {
        const v = world.getDynamicProperty(idKey);
        if (typeof v === "string" && v !== "[]") return JSON.parse(v);
        if (v === "[]") return [];
    } catch { }
    const legacyKey = legacyPendingItemsKey(player);
    if (legacyKey && legacyKey !== idKey) {
        try {
            const legacy = world.getDynamicProperty(legacyKey);
            if (typeof legacy === "string" && legacy !== "[]") {
                const parsed = JSON.parse(legacy);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    world.setDynamicProperty(idKey, legacy);
                    try { world.setDynamicProperty(legacyKey, "[]"); } catch {}
                    return parsed;
                }
            }
        } catch {}
    }
    try {
        return JSON.parse(world.getDynamicProperty(idKey) ?? "[]");
    } catch {
        return [];
    }
};
export const savePendingItems = (player, items) => {
    world.setDynamicProperty(pendingItemsKey(player), JSON.stringify(items));
};

// --- เควส market_sell ค้างส่ง (ผู้ขายออฟไลน์ตอนของขายได้ในตลาด) ---
// ตามรูปแบบเดียวกับ money_pending_/items_pending_ ด้านบน — world dynamic
// property คีย์ด้วยชื่อผู้เล่น เพราะ Quest System (systems/quests/events.js)
// ต้องมี Player object จริงถึงจะ advanceQuests() ได้ ผู้ขายออฟไลน์ = ไม่มี
// Player object ให้เรียกตอนของขายออก ต้องคิวไว้ก่อน ไม่ใช่ระบบเก็บข้อมูล
// ใหม่ — ใช้ Pattern เดิมของไฟล์นี้ทุกประการ แค่คนละคีย์/ชนิดข้อมูล (array
// ของ { itemId, amount } แทนตัวเลข/ItemStack เดี่ยว ๆ เพราะอาจมีหลายรายการ
// ค้างพร้อมกันก่อนเจ้าของจะกลับมา online — เทียบเท่า items_pending_ ที่เป็น
// array อยู่แล้ว) ไฟล์นี้ไม่รู้จัก questSystem.js เลย (แค่เก็บ/คืนคิว) —
// flush จริงทำที่ systems/quests/events.js เอง (ดู playerSpawn subscription
// ที่นั่น) กัน Circular Import (questSystem.js -> playerMarket.js ทิศทาง
// เดียว ไม่มี Edge ย้อนกลับ)
const QUEST_PENDING_MARKET_SELL_PREFIX = "quest_pending_marketSell_";
function questPendingKey(player) {
    if (player?.id) return `${QUEST_PENDING_MARKET_SELL_PREFIX}${player.id}`;
    return `${QUEST_PENDING_MARKET_SELL_PREFIX}${player}`;
}
function legacyQuestPendingKey(player) {
    return player?.name ? `${QUEST_PENDING_MARKET_SELL_PREFIX}${player.name}` : null;
}
export const getPendingQuestMarketSales = (player) => {
    const idKey = questPendingKey(player);
    try {
        const v = world.getDynamicProperty(idKey);
        if (typeof v === "string" && v !== "[]") return JSON.parse(v);
        if (v === "[]") return [];
    } catch { }
    const legacyKey = legacyQuestPendingKey(player);
    if (legacyKey && legacyKey !== idKey) {
        try {
            const legacy = world.getDynamicProperty(legacyKey);
            if (typeof legacy === "string" && legacy !== "[]") {
                const parsed = JSON.parse(legacy);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    world.setDynamicProperty(idKey, legacy);
                    try { world.setDynamicProperty(legacyKey, "[]"); } catch {}
                    return parsed;
                }
            }
        } catch {}
    }
    try {
        return JSON.parse(world.getDynamicProperty(idKey) ?? "[]");
    } catch {
        return [];
    }
};
export const addPendingQuestMarketSale = (player, itemId, amount) => {
    const pending = getPendingQuestMarketSales(player);
    pending.push({ itemId, amount });
    world.setDynamicProperty(questPendingKey(player), JSON.stringify(pending));
};
export const clearPendingQuestMarketSales = (player) => {
    const idKey = questPendingKey(player);
    world.setDynamicProperty(idKey, "[]");
    const legacyKey = legacyQuestPendingKey(player);
    if (legacyKey && legacyKey !== idKey) try { world.setDynamicProperty(legacyKey, "[]"); } catch {}
};

// หา Player object ของผู้เล่นออนไลน์จากชื่อ — ใช้ตัดสินใจว่าจะแจ้ง Quest
// Progress ของผู้ขายตรง ๆ ได้เลย (ออนไลน์) หรือต้องคิวไว้ก่อน (ออฟไลน์ —
// ดู addPendingQuestMarketSale ด้านบน) เหมือน notifySellerOfSale() ด้านล่าง
// แต่คืน Player object กลับมาแทนที่จะแจ้งข้อความเลย เพราะผู้เรียกใหม่นี้
// (marketUi.js confirmPurchase) ต้องใช้ผลลัพธ์ตัดสินใจต่อ ไม่ใช่แค่โชว์ข้อความ
// Player lookup now delegated to core/playerUtils
// findOnlinePlayerByName, findOnlinePlayerById, findOnlinePlayerByIdOrName are imported above.

function findSellerPlayer(listing) {
  // Use id-or-name helper for convenience
  return findOnlinePlayerByIdOrName(listing.sellerId ?? listing.seller);
}

// Strategy: use core/economyUtils for bank operations – keep compatibility wrapper if needed

export const addBankBalance = (amount) => {
  // Delegate to core/economyUtils
  depositToBank(amount);
};
export const clearBankBalance = () => {
  // Reset bank via core/economyUtils
  withdrawFromBank(getBankBalance());
};

export function playSound(player, soundName) {
    player.playSound(soundName, { volume: 1.0, pitch: 1.0 });
}

export function sortListings(listings, sortMode, player) {
    const playerId = player?.id ?? player;
    const playerName = player?.name ?? player;
    const sorted = [...listings];
    switch (sortMode) {
        case "priceAsc":
            sorted.sort((a, b) => a.price - b.price);
            break;
        case "priceDesc":
            sorted.sort((a, b) => b.price - a.price);
            break;
        case "mine":
            sorted.sort((a, b) => {
                const aMine = (a.sellerId ? a.sellerId === playerId : a.seller === playerName) ? 0 : 1;
                const bMine = (b.sellerId ? b.sellerId === playerId : b.seller === playerName) ? 0 : 1;
                if (aMine !== bMine) return aMine - bMine;
                return (b.listedAt ?? 0) - (a.listedAt ?? 0);
            });
            break;
        case "newest":
        default:
            sorted.sort((a, b) => (b.listedAt ?? 0) - (a.listedAt ?? 0));
    }
    return sorted;
}

export function notifySellerOfSale(buyer, itemData, profit) {
    const seller = findSellerPlayer(itemData);
    if (!seller?.isValid) return;
    showSuccess(seller, t("market.saleNotifySeller", {
        buyer: buyer.name,
        name: itemData.displayName,
        amount: itemData.amount,
        profit: profit.toLocaleString()
    }));
    playSound(seller, "random.orb");
}

function watchKey(player) {
    if (player?.id) return `${WATCH_KEY_PREFIX}${player.id}`;
    return `${WATCH_KEY_PREFIX}${player}`;
}
function legacyWatchKey(player) {
    return player?.name ? `${WATCH_KEY_PREFIX}${player.name}` : null;
}
function watchAlertsKey(player) {
    if (player?.id) return `${WATCH_ALERTS_KEY_PREFIX}${player.id}`;
    return `${WATCH_ALERTS_KEY_PREFIX}${player}`;
}
function legacyWatchAlertsKey(player) {
    return player?.name ? `${WATCH_ALERTS_KEY_PREFIX}${player.name}` : null;
}
export const getWatchlist = (player) => {
    const idKey = watchKey(player);
    try {
        const v = world.getDynamicProperty(idKey);
        if (typeof v === "string" && v !== "[]") return JSON.parse(v);
        if (v === "[]") return [];
    } catch { }
    const legacyKey = legacyWatchKey(player);
    if (legacyKey && legacyKey !== idKey) {
        try {
            const legacy = world.getDynamicProperty(legacyKey);
            if (typeof legacy === "string" && legacy !== "[]") {
                const parsed = JSON.parse(legacy);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    world.setDynamicProperty(idKey, legacy);
                    try { world.setDynamicProperty(legacyKey, "[]"); } catch {}
                    return parsed;
                }
            }
        } catch {}
    }
    try { return JSON.parse(world.getDynamicProperty(idKey) ?? "[]"); } catch { return []; }
};
export const saveWatchlist = (player, list) => {
    world.setDynamicProperty(watchKey(player), JSON.stringify(list));
};
export const getWatchAlerts = (player) => {
    const idKey = watchAlertsKey(player);
    try {
        const v = world.getDynamicProperty(idKey);
        if (typeof v === "string" && v !== "[]") return JSON.parse(v);
        if (v === "[]") return [];
    } catch { }
    const legacyKey = legacyWatchAlertsKey(player);
    if (legacyKey && legacyKey !== idKey) {
        try {
            const legacy = world.getDynamicProperty(legacyKey);
            if (typeof legacy === "string" && legacy !== "[]") {
                const parsed = JSON.parse(legacy);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    world.setDynamicProperty(idKey, legacy);
                    try { world.setDynamicProperty(legacyKey, "[]"); } catch {}
                    return parsed;
                }
            }
        } catch {}
    }
    try { return JSON.parse(world.getDynamicProperty(idKey) ?? "[]"); } catch { return []; }
};
export const saveWatchAlerts = (player, alerts) => {
    world.setDynamicProperty(watchAlertsKey(player), JSON.stringify(alerts));
};

// ตรวจ listing ที่เพิ่งลงขายกับ watchlist ของทุกคน (ยกเว้นผู้ขายเอง) — เรียก
// จาก showPriceInput (UI layer) ทันทีหลังลงขายสำเร็จ ใช้ searchItems() ตัวเดียวกับที่
// ค้นหาในตลาด/ร้านค้าทุกจุด ตาม amendment 4 (matching logic ต้องเหมือนกัน
// ทุกจุดที่มีการค้นหา — ดูหมายเหตุบนสุดของ SearchService.js) แทนที่จะเขียน
// ตัวเทียบสตริงแยกเองอีกชุด
//
// world.getDynamicPropertyIds() ใช้สแกนหาว่าใครมี watchlist บ้าง (คีย์ขึ้นต้น
// ด้วย WATCH_KEY_PREFIX) เพราะไม่มีรายชื่อผู้เล่นทั้งหมดที่เคยเข้าเซิร์ฟเก็บ
// ไว้ที่อื่นในแอดออนนี้ให้ loop ตรง ๆ ได้
export function notifyWatchers(listing) {
    const ids = world.getDynamicPropertyIds().filter(id => id.startsWith(WATCH_KEY_PREFIX));
    for (const id of ids) {
        const watcherId = id.slice(WATCH_KEY_PREFIX.length);
        const watcher = findOnlinePlayerById(watcherId) ?? findOnlinePlayerByName(watcherId);
        if (listing.sellerId && watcher?.id === listing.sellerId) continue;
        if (!listing.sellerId && watcher?.name === listing.seller) continue;
        if (!watcher && watcherId === (listing.sellerId ?? listing.seller)) continue;
        const watching = getWatchlist(watcherId);
        if (watching.length === 0) continue;
        const isMatch = watching.some(w => searchItems(w.query, [{ id: 1, name: listing.displayName }]).length > 0);
        if (!isMatch) continue;
        const alerts = getWatchAlerts(watcherId);
        alerts.unshift({
            name: listing.displayName,
            amount: listing.amount,
            price: listing.price,
            seller: listing.seller,
            notifiedAt: nowMs()
        });
        if (alerts.length > MAX_WATCH_ALERTS) alerts.length = MAX_WATCH_ALERTS;
        saveWatchAlerts(watcherId, alerts);
        if (watcher?.isValid) {
            showSuccess(watcher, t("market.watchAlertNotify", {
                name: listing.displayName,
                amount: listing.amount,
                price: listing.price.toLocaleString(),
                seller: listing.seller
            }));
            playSound(watcher, "random.orb");
        }
    }
}

// =========================
// เก็บ/คืนค่า enchant, lore, ชื่อ, ความทนทานของไอเทมจริง
// (แก้ปัญหาไอเทมกลายเป็นของเปล่าตอนซื้อขายผ่านตลาด)
// =========================
export function serializeItemStack(item) {
    const data = {
        typeId: item.typeId,
        amount: item.amount,
        nameTag: item.nameTag ?? null,
        lore: (typeof item.getLore === "function" ? item.getLore() : []) ?? [],
        enchantments: [],
        damage: null,
    };

    try {
        const durability = item.getComponent("minecraft:durability");
        if (durability) data.damage = durability.damage;
    } catch (e) { /* ไอเทมนี้ไม่มี durability ก็ข้ามไป */ }

    try {
        const enchantable = item.getComponent("minecraft:enchantable");
        if (enchantable) {
            data.enchantments = enchantable.getEnchantments().map(e => ({
                id: e.type?.id ?? e.type,
                level: e.level
            }));
        }
    } catch (e) { /* ไอเทมนี้ใส่เอนช้านต์ไม่ได้ก็ข้ามไป */ }

    return data;
}

export function buildItemStack(data) {
    const item = new ItemStack(data.typeId, data.amount);

    if (data.nameTag) item.nameTag = data.nameTag;
    if (data.lore?.length && typeof item.setLore === "function") {
        item.setLore(data.lore);
    }

    if (typeof data.damage === "number") {
        try {
            const durability = item.getComponent("minecraft:durability");
            if (durability) durability.damage = data.damage;
        } catch (e) { /* ข้าม ถ้าตั้งค่าไม่ได้ */ }
    }

    if (data.enchantments?.length) {
        try {
            const enchantable = item.getComponent("minecraft:enchantable");
            if (enchantable) {
                for (const ench of data.enchantments) {
                    try {
                        enchantable.addEnchantment({ type: new EnchantmentType(ench.id), level: ench.level });
                    } catch (e) { /* เอนช้านต์บางตัวอาจใส่ไม่ได้ ข้ามไปทีละตัว */ }
                }
            }
        } catch (e) { /* ข้าม ถ้าคอมโพเนนต์ไม่รองรับ */ }
    }

    return item;
}

// สร้าง ItemStack จากข้อมูล listing แบบรองรับของเก่าที่ลงขายไว้ก่อนอัปเดตนี้
// (ของเก่าจะไม่มี itemData เลย fallback ไปสร้างของเปล่าเหมือนเดิม)
export function rebuildItemFromListing(listing) {
    if (listing.itemData) return buildItemStack(listing.itemData);
    return new ItemStack(listing.itemType, listing.amount);
}

// =========================
// ดึง listing ที่ค้างขายนานเกินกำหนดออกจากตลาด แล้วคืนเข้าคิว "ของค้างรับ"
// ของเจ้าของ (ไม่ทำลายไอเทมทิ้ง) พร้อมจำกัดจำนวน listing สูงสุดในตลาด
// =========================
export function pruneExpiredListings() {
    const market = getMarket();
    if (market.length === 0) return market;
    const now = nowMs();
    const stillActive = [];
    let changed = false;
    for (const listing of market) {
        if (listing.listedAt && daysBetweenBangkok(listing.listedAt, now) >= LISTING_EXPIRE_DAYS) {
            const sellerKey = listing.sellerId ?? listing.seller;
            const pending = getPendingItems(sellerKey);
            pending.push(listing.itemData ?? { typeId: listing.itemType, amount: listing.amount });
            savePendingItems(sellerKey, pending);
            changed = true;
        } else {
            stillActive.push(listing);
        }
    }
    if (changed) saveMarket(stillActive);
    return stillActive;
}

export function claimPendingItemsLogic(player) {
    const pending = getPendingItems(player);
    if (pending.length === 0) return { claimed: 0, remaining: 0 };
    const remaining = [];
    let claimed = 0;
    for (const data of pending) {
        if (!giveItems(player, buildItemStack(data))) {
            remaining.push(data);
        } else {
            claimed++;
        }
    }
    savePendingItems(player, remaining);
    return { claimed, remaining: remaining.length };
}
