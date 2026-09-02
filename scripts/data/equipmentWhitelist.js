// =========================
// data/equipmentWhitelist.js
// รายชื่อไอเทม vanilla ที่ระบบ RPG Affinity รู้จัก
//
// v1.5.0: เพิ่ม bow, crossbow, shield เข้า WEAPON_ITEMS
// สำหรับระบบ Affinity (ความเชี่ยวชาญจากการเล่นจริง)
//
// การเพิ่มไอเทมใหม่: เพิ่ม typeId เข้า WEAPON_ITEMS หรือ ARMOR_ITEMS
// แล้วเพิ่ม mapping ใน data/affinityItems.js
// =========================

// อาวุธ — ทั้งหมดที่ถือแล้วโจมตีได้ (melee + ranged + shield)
export const WEAPON_ITEMS = new Set([
  // swords
  "minecraft:wooden_sword",
  "minecraft:stone_sword",
  "minecraft:iron_sword",
  "minecraft:golden_sword",
  "minecraft:diamond_sword",
  "minecraft:netherite_sword",
  // axes
  "minecraft:wooden_axe",
  "minecraft:stone_axe",
  "minecraft:iron_axe",
  "minecraft:golden_axe",
  "minecraft:diamond_axe",
  "minecraft:netherite_axe",
  // shovels
  "minecraft:wooden_shovel",
  "minecraft:stone_shovel",
  "minecraft:iron_shovel",
  "minecraft:golden_shovel",
  "minecraft:diamond_shovel",
  "minecraft:netherite_shovel",
  // hoes
  "minecraft:wooden_hoe",
  "minecraft:stone_hoe",
  "minecraft:iron_hoe",
  "minecraft:golden_hoe",
  "minecraft:diamond_hoe",
  "minecraft:netherite_hoe",
  // bow + crossbow + shield (v1.5.0)
  "minecraft:bow",
  "minecraft:crossbow",
  "minecraft:shield"
]);

// เกราะ — 4 slots (Head / Chest / Legs / Feet)
export const ARMOR_ITEMS = new Set([
  // leather
  "minecraft:leather_helmet",
  "minecraft:leather_chestplate",
  "minecraft:leather_leggings",
  "minecraft:leather_boots",
  // chainmail
  "minecraft:chainmail_helmet",
  "minecraft:chainmail_chestplate",
  "minecraft:chainmail_leggings",
  "minecraft:chainmail_boots",
  // iron
  "minecraft:iron_helmet",
  "minecraft:iron_chestplate",
  "minecraft:iron_leggings",
  "minecraft:iron_boots",
  // golden
  "minecraft:golden_helmet",
  "minecraft:golden_chestplate",
  "minecraft:golden_leggings",
  "minecraft:golden_boots",
  // diamond
  "minecraft:diamond_helmet",
  "minecraft:diamond_chestplate",
  "minecraft:diamond_leggings",
  "minecraft:diamond_boots",
  // netherite
  "minecraft:netherite_helmet",
  "minecraft:netherite_chestplate",
  "minecraft:netherite_leggings",
  "minecraft:netherite_boots"
]);

// EquipmentSlot ที่เป็นเกราะ (ใช้กับ equippable.getEquipment/setEquipment)
export const ARMOR_SLOTS = [
  "Head",
  "Chest",
  "Legs",
  "Feet"
];