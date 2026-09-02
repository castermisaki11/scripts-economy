// =========================
// data/quests.js
// รายการเป้าหมายที่เควสแบบ "ขุด/ทำลายบล็อก" และ "ฆ่ามอนสเตอร์" สุ่มได้ —
// เควสแบบ "ขายไอเทม" ไม่มีตารางของตัวเองที่นี่ เพราะดึงจาก data/items.js
// (getItemsByCategory()) ตรง ๆ อยู่แล้ว — เป็นแหล่งความจริงเดียวของไอเทม
// ขายได้ทั้งหมด ไม่ต้องมีตารางซ้ำ
//
// เพิ่ม/ลดเป้าหมายเควส mine/kill แก้ที่นี่จุดเดียว ไม่ต้องแตะ
// systems/quests/ (pool ถูกอ้างผ่าน questObjectives.js เท่านั้น)
// =========================

/** เป้าหมายเควส "ขุด/ทำลายบล็อก" — typeId ของบล็อก (มี "minecraft:" นำหน้า) */
export const MINE_POOL = [
  "minecraft:stone",
  "minecraft:cobblestone",
  "minecraft:dirt",
  "minecraft:sand",
  "minecraft:gravel",
  "minecraft:oak_log",
  "minecraft:coal_ore",
  "minecraft:copper_ore",
  "minecraft:iron_ore",
  "minecraft:gold_ore",
  "minecraft:redstone_ore",
  "minecraft:lapis_ore",
  "minecraft:diamond_ore",
  "minecraft:emerald_ore",
  "minecraft:deepslate_coal_ore",
  "minecraft:deepslate_iron_ore",
  "minecraft:deepslate_gold_ore",
  "minecraft:deepslate_diamond_ore",
  "minecraft:deepslate_emerald_ore",
  "minecraft:ancient_debris",
  "minecraft:nether_gold_ore",
  "minecraft:nether_quartz_ore"
];

/** เป้าหมายเควส "ฆ่ามอนสเตอร์" — typeId ของเอนทิตี้ (มี "minecraft:" นำหน้า) */
export const KILL_POOL = [
  "minecraft:zombie",
  "minecraft:skeleton",
  "minecraft:spider",
  "minecraft:cave_spider",
  "minecraft:creeper",
  "minecraft:enderman",
  "minecraft:witch",
  "minecraft:drowned",
  "minecraft:husk",
  "minecraft:stray",
  "minecraft:phantom",
  "minecraft:silverfish",
  "minecraft:slime",
  "minecraft:pillager",
  "minecraft:blaze",
  "minecraft:ghast",
  "minecraft:piglin_brute",
  "minecraft:vindicator",
  "minecraft:evoker",
  "minecraft:zombified_piglin",
  "minecraft:guardian",
  "minecraft:ravager",
  "minecraft:breeze",
  "minecraft:wither_skeleton",
  "minecraft:piglin"
];
