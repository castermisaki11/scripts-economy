// =========================
// enchantTables.js
// แคตตาล็อกเอนช้านต์สำหรับระบบ Admin "เอนช้านต์ทั้งชุดในคลิกเดียว" —
// รายชื่อ + ระดับสูงสุดที่ถูกต้องของแต่ละเอนช้านต์ เก็บไว้ที่นี่จุดเดียว
// (data-driven ตาม CONTRIBUTING.md: catalog อยู่ใน data/ ไม่ hardcode
// กระจายใน systems/) ระบบที่เรียกใช้คือ systems/adminEnchant.js
//
// ENCHANT_MASTER_ORDER: ลำดับความสำคัญ (เอนช้านต์ที่ "ดีที่สุด" ของแต่ละ
//   กลุ่มความขัดแย้งอยู่หน้าสุด) — เวลาใส่จริงระบบจะลูปตามลำดับนี้ และใช้
//   try/catch ข้ามตัวที่ใส่ไม่ได้ (ชนกับชนิดไอเทม หรือขัดแย้งกันเอง เช่น
//   sharpness vs smite) ผลคือไอเทมได้เอนช้านต์ครบที่เกมอนุญาต โดยสายที่
//  อยู่หน้าสุดในลิสต์นี้จะเป็นผู้ชนะถ้ามี conflict
// ENCHANT_MAX_LEVEL: ระดับสูงสุด legit ของแต่ละตัว (hardcode ไว้ไม่พึ่งพา
//   API EnchantmentTypes ที่บาง runtime อาจไม่ตรงกัน — กันบั๊กตาม
//   Known Landmines)
// =========================

// ลำดับความสำคัญ: ดีที่สุดของแต่ละกลุ่มความขัดแย้งอยู่หน้าสุด
export const ENCHANT_MASTER_ORDER = [
  // ดาเมจอาวุธ (sharpness ชนะ smite/bane)
  "sharpness",
  "smite",
  "bane_of_arthropods",
  "fire_aspect",
  "looting",
  "knockback",
  "sweeping",
  // เกราะป้องกัน (protection ชนะ fire/blast/projectile)
  "protection",
  "fire_protection",
  "blast_protection",
  "projectile_protection",
  "thorns",
  "feather_falling",
  "depth_strider",
  "frost_walker",
  "soul_speed",
  "respiration",
  "aqua_affinity",
  "swift_sneak",
  // ตรีงอน (ไปด้วยกันได้ทั้งหมด)
  "loyalty",
  "impaling",
  "riptide",
  "channeling",
  // ธนู/หน้ามวย (multishot ชนะ piercing; infinity ชนะ mending บนธนู)
  "multishot",
  "piercing",
  "power",
  "punch",
  "flame",
  "infinity",
  // เครื่องมือ
  "fortune",
  "silk_touch",
  "efficiency",
  // สากล (ลูปท้ายสุด)
  "unbreaking",
  "mending",
  "vanishing_curse",
  "binding_curse"
];

// ระดับสูงสุดที่เกมรับได้จริง ต่อเอนช้านต์
// ตั้งทุกตัวเป็น level 10 — บางตัว game อาจ cap ไว้ ต้อง test จริง
export const ENCHANT_MAX_LEVEL = {
  sharpness: 10,
  smite: 10,
  bane_of_arthropods: 10,
  fire_aspect: 10,
  looting: 10,
  knockback: 10,
  sweeping: 10,
  protection: 10,
  fire_protection: 10,
  blast_protection: 10,
  projectile_protection: 10,
  thorns: 10,
  feather_falling: 10,
  depth_strider: 10,
  frost_walker: 10,
  soul_speed: 10,
  respiration: 10,
  aqua_affinity: 10,
  swift_sneak: 10,
  loyalty: 10,
  impaling: 10,
  riptide: 10,
  channeling: 10,
  multishot: 10,
  piercing: 10,
  power: 10,
  punch: 10,
  flame: 10,
  infinity: 10,
  fortune: 10,
  silk_touch: 10,
  efficiency: 10,
  unbreaking: 10,
  mending: 10,
  vanishing_curse: 10,
  binding_curse: 10
};
