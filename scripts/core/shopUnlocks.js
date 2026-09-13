// =========================
// shopUnlocks.js
// ระบบปลดล็อกร้านค้า — 2 ขั้น:
//   1. ขายไอเทม 1 ชิ้น → ได้ "สิทธิปลดล็อก" (rights)
//   2. จ่าย sellPrice × 5 → ปลดล็อคจริง (unlocked)
//
// เก็บข้อมูล: dynamic property "shopUnlocks" (JSON) ต่อผู้เล่น
// รูปแบบ: { rights: [...], unlocked: [...] }
//
// เริ่มจาก [] ทุกคน — ไม่มี auto-unlock
//
// World backup: per-player key "backup_shop_<playerId>"
// ใช้ compressed format — item IDs ถูกแปลงเป็น indices เพื่อลดขนาด ~88%
// =========================

import { world, system } from "@minecraft/server";
import { hasItem, itemIdToIndex, indexToItemId } from "../data/items";
import { subscribeSafe } from "./eventGuard";

const SHOP_UNLOCKS_KEY = "shopUnlocks";
const WORLD_SHOP_BACKUP_PREFIX = "backup_shop_";

// Per-tick cache สำหรับ readData() — dynamic properties ไม่เปลี่ยนภายใน tick เดียว
const readDataCache = new Map();

subscribeSafe(["playerLeave"], (event) => {
  try {
    readDataCache.delete(event.playerId);
  } catch (error) {
    console.warn("[ShopUnlocks] playerLeave handler error:", error);
  }
}, "ShopUnlocks");

/* =========================
   Compress / Decompress
   เก็บ item IDs เป็น indices เพื่อลดขนาด (17 chars → ~2 chars ต่อไอเทม)
   รูปแบบcompressed: { v: 1, r: [idx, ...], u: [idx, ...] }
========================= */

/**
 * แปลง data format เป็น compressed format สำหรับ world backup
 * @param {{ rights: string[], unlocked: string[] }} data
 * @returns {{ v: number, r: number[], u: number[] }}
 */
function compressData(data) {
  return {
    v: 1,
    r: data.rights.map(itemIdToIndex).filter((i) => i >= 0),
    u: data.unlocked.map(itemIdToIndex).filter((i) => i >= 0)
  };
}

/**
 * แปลง compressed format กลับเป็น data format
 * item ที่ index นอก range (ถูกลบออกจากระบบ) จะถูกข้ามเงียบ ๆ
 * @param {{ v?: number, r?: number[], u?: number[] }} compressed
 * @returns {{ rights: string[], unlocked: string[] }}
 */
function decompressData(compressed) {
  if (!compressed || typeof compressed !== "object") return { rights: [], unlocked: [] };
  const rights = (Array.isArray(compressed.r) ? compressed.r : [])
    .map(indexToItemId)
    .filter((id) => typeof id === "string");
  const unlocked = (Array.isArray(compressed.u) ? compressed.u : [])
    .map(indexToItemId)
    .filter((id) => typeof id === "string");
  return { rights, unlocked };
}

/* =========================
   Read / Save — Player-level
========================= */

/**
 * อ่านข้อมูล unlock ของผู้เล่น — เรียกครั้งเดียวแล้วส่ง data เข้าเช็ค
 * แทนการเรียก isItemUnlocked/hasUnlockRight ทีละตัว (ลด JSON.parse ซ้ำ)
 * ใช้ per-tick cache เพื่อไม่อ่าน dynamic property ซ้ำภายใน tick เดียวกัน
 *
 * Recovery: ถ้า player-level data หาย ลองดึงจาก world backup แล้ว restore กลับ
 */
export function readData(player) {
  const cached = readDataCache.get(player.id);
  if (cached && cached.tick === system.currentTick) return cached.data;

  const defaultData = { rights: [], unlocked: [] };
  let result = defaultData;

  try {
    const raw = Database.get(player, SHOP_UNLOCKS_KEY);
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      const rights = Array.isArray(parsed.rights)
        ? parsed.rights.filter((id) => typeof id === "string")
        : [];
      const unlocked = Array.isArray(parsed.unlocked)
        ? parsed.unlocked.filter((id) => typeof id === "string")
        : [];
      if (rights.length > 0 || unlocked.length > 0) {
        result = { rights, unlocked };
      }
    }
  } catch {
    // player-level data เสีย — ลอง recovery จาก world backup
  }

  // Player-level ว่าง/เสีย — ลองดึงจาก world backup (per-player key)
  if (result === defaultData) {
    try {
      const backupKey = WORLD_SHOP_BACKUP_PREFIX + /** @type {string} */ (player.id);
      const backupRaw = world.getDynamicProperty(backupKey);
      if (typeof backupRaw === "string") {
        const compressed = JSON.parse(backupRaw);
        const restored = decompressData(compressed);
        if (restored.rights.length > 0 || restored.unlocked.length > 0) {
          Database.set(player, SHOP_UNLOCKS_KEY, JSON.stringify(restored));
          result = restored;
        }
      }
    } catch {
      // world backup เสีย — คืน default
    }
  }

  readDataCache.set(player.id, { tick: system.currentTick, data: result });
  return result;
}

/**
 * เซฟข้อมูล unlock ลง player-level dynamic property
 * พร้อม mirror ไป world backup (per-player key, compressed)
 */
function saveData(player, data) {
    Database.set(player, SHOP_UNLOCKS_KEY, JSON.stringify(data));
  readDataCache.delete(player.id);

  // Mirror ไป world backup (per-player key)
  try {
    const backupKey = WORLD_SHOP_BACKUP_PREFIX + /** @type {string} */ (player.id);
    world.setDynamicProperty(backupKey, JSON.stringify(compressData(data)));
  } catch {
    // world backup เขียนไม่ได้ — ไม่เป็นไร player-level ยังอยู่
  }
}

// ---- เช็คแบบ batch (ใช้ data ที่อ่านครั้งเดียว) ----

/**
 * คืนข้อมูล unlock ของทุกไอเทมใน list — [{ id, hasRight, unlocked }]
 * อ่าน data ครั้งเดียว แทน isItemUnlocked + hasUnlockRight ทีละตัว
 * @param {import("@minecraft/server").Player} player
 * @param {string[]} itemIds
 */
export function getUnlockStatuses(player, itemIds) {
  const data = readData(player);
  const rightSet = new Set(data.rights);
  const unlockedSet = new Set(data.unlocked);
  return itemIds.map((id) => ({
    id,
    hasRight: rightSet.has(id),
    unlocked: unlockedSet.has(id)
  }));
}

/**
 * จำนวนไอเทมที่ปลดล็อคแล้วทั้งหมด
 * @param {import("@minecraft/server").Player} player
 * @returns {number}
 */
export function getUnlockCount(player) {
  if (!player?.isValid) return 0;
  return readData(player).unlocked.length;
}

// ---- สิทธิปลดล็อก (ได้จากขายไอเทม) ----

/**
 * ให้สิทธิปลดล็อคไอเทม — เรียกหลัง sell สำเร็จ
 * @param {import("@minecraft/server").Player} player
 * @param {string} itemId
 */
export function grantUnlockRight(player, itemId) {
  if (!player?.isValid || !itemId || !hasItem(itemId)) return;
  const data = readData(player);
  if (data.rights.includes(itemId)) return;
  data.rights.push(itemId);
  saveData(player, data);
}

/**
 * เช็คว่ามีสิทธิปลดล็อคไอเทมนี้หรือยัง
 * @param {import("@minecraft/server").Player} player
 * @param {string} itemId
 * @returns {boolean}
 */
export function hasUnlockRight(player, itemId) {
  if (!player?.isValid) return false;
  return readData(player).rights.includes(itemId);
}

// ---- ปลดล็อคจริง (ได้จากจ่ายเงิน) ----

/**
 * ปลดล็อคไอเทม — เรียกหลังจ่ายเงินสำเร็จ
 * @param {import("@minecraft/server").Player} player
 * @param {string} itemId
 */
export function unlockItem(player, itemId) {
  if (!player?.isValid || !itemId || !hasItem(itemId)) return;
  const data = readData(player);
  if (data.unlocked.includes(itemId)) return;
  data.unlocked.push(itemId);
  saveData(player, data);
}

/**
 * เช็คว่าไอเทมนี้ปลดล็อคแล้ว (ซื้อได้แล้ว)
 * @param {import("@minecraft/server").Player} player
 * @param {string} itemId
 * @returns {boolean}
 */
export function isItemUnlocked(player, itemId) {
  if (!player?.isValid) return false;
  return readData(player).unlocked.includes(itemId);
}
