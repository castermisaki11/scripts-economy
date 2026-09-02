// =========================
// data/affinityItems.js
// Mapping ไอเทม vanilla → Affinity category
//
// Weapon → blade / axe / tool / bow / crossbow / shield
// Armor → light / medium / heavy
//
// อัปเดตเมื่อเพิ่มไอเทมใหม่: เพิ่ม typeId ใน category ที่ตรง
// =========================

// Weapon → Affinity category mapping
export const WEAPON_AFFINITY_MAP = {
  // Swords → blade
  "minecraft:wooden_sword": "blade",
  "minecraft:stone_sword": "blade",
  "minecraft:iron_sword": "blade",
  "minecraft:golden_sword": "blade",
  "minecraft:diamond_sword": "blade",
  "minecraft:netherite_sword": "blade",
  // Axes → axe
  "minecraft:wooden_axe": "axe",
  "minecraft:stone_axe": "axe",
  "minecraft:iron_axe": "axe",
  "minecraft:golden_axe": "axe",
  "minecraft:diamond_axe": "axe",
  "minecraft:netherite_axe": "axe",
  // Shovels + Hoes → tool
  "minecraft:wooden_shovel": "tool",
  "minecraft:stone_shovel": "tool",
  "minecraft:iron_shovel": "tool",
  "minecraft:golden_shovel": "tool",
  "minecraft:diamond_shovel": "tool",
  "minecraft:netherite_shovel": "tool",
  "minecraft:wooden_hoe": "tool",
  "minecraft:stone_hoe": "tool",
  "minecraft:iron_hoe": "tool",
  "minecraft:golden_hoe": "tool",
  "minecraft:diamond_hoe": "tool",
  "minecraft:netherite_hoe": "tool",
  // Bow → bow
  "minecraft:bow": "bow",
  // Crossbow → crossbow
  "minecraft:crossbow": "crossbow",
  // Shield → shield
  "minecraft:shield": "shield"
};

// Armor → Affinity category mapping
export const ARMOR_AFFINITY_MAP = {
  // Leather → light
  "minecraft:leather_helmet": "light",
  "minecraft:leather_chestplate": "light",
  "minecraft:leather_leggings": "light",
  "minecraft:leather_boots": "light",
  // Chainmail + Golden → medium
  "minecraft:chainmail_helmet": "medium",
  "minecraft:chainmail_chestplate": "medium",
  "minecraft:chainmail_leggings": "medium",
  "minecraft:chainmail_boots": "medium",
  "minecraft:golden_helmet": "medium",
  "minecraft:golden_chestplate": "medium",
  "minecraft:golden_leggings": "medium",
  "minecraft:golden_boots": "medium",
  // Iron + Diamond + Netherite → heavy
  "minecraft:iron_helmet": "heavy",
  "minecraft:iron_chestplate": "heavy",
  "minecraft:iron_leggings": "heavy",
  "minecraft:iron_boots": "heavy",
  "minecraft:diamond_helmet": "heavy",
  "minecraft:diamond_chestplate": "heavy",
  "minecraft:diamond_leggings": "heavy",
  "minecraft:diamond_boots": "heavy",
  "minecraft:netherite_helmet": "heavy",
  "minecraft:netherite_chestplate": "heavy",
  "minecraft:netherite_leggings": "heavy",
  "minecraft:netherite_boots": "heavy"
};

/**
 * คืน affinity category จาก typeId
 * @param {string} typeId - Minecraft typeId เช่น "minecraft:diamond_sword"
 * @returns {{ category: string, type: "weapon" | "armor" } | null}
 */
export function getAffinityCategory(typeId) {
  if (!typeId) return null;
  const weaponCat = WEAPON_AFFINITY_MAP[typeId];
  if (weaponCat) return { category: weaponCat, type: "weapon" };
  const armorCat = ARMOR_AFFINITY_MAP[typeId];
  if (armorCat) return { category: armorCat, type: "armor" };
  return null;
}

/**
 * คืน list ของ weapon typeId ทั้งหมด
 */
export function getAllWeaponTypeIds() {
  return Object.keys(WEAPON_AFFINITY_MAP);
}

/**
 * คืน list ของ armor typeId ทั้งหมด
 */
export function getAllArmorTypeIds() {
  return Object.keys(ARMOR_AFFINITY_MAP);
}

/**
 * คืน weapon typeIds ที่อยู่ใน category นั้น
 */
export function getWeaponTypeIdsByCategory(category) {
  return Object.entries(WEAPON_AFFINITY_MAP)
    .filter(([, cat]) => cat === category)
    .map(([id]) => id);
}

/**
 * คืน armor typeIds ที่อยู่ใน category นั้น
 */
export function getArmorTypeIdsByCategory(category) {
  return Object.entries(ARMOR_AFFINITY_MAP)
    .filter(([, cat]) => cat === category)
    .map(([id]) => id);
}