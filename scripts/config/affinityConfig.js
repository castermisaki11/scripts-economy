// =========================
// affinityConfig.js
// ค่าตั้งค่าระบบ Affinity (ความเชี่ยวชาญจากการเล่นจริง) ทั้งหมด
// ผู้เล่นใช้อาวุธ/เกราะประเภทไหนบ่อย → Affinity ประเภทนั้นสูงขึ้น
// → ได้ Passive + Stat Growth อัตโนมัติ
//
// โครงสร้าง:
//   Player
//   ├── Level (เดิม)
//   ├── Stats (เดิม - STR/AGI/VIT)
//   └── Affinity
//       ├── Weapon: blade, axe, tool, bow, crossbow, shield
//       └── Armor: light, medium, heavy
//
// ข้อมูลเก็บที่ Dynamic Property "affinity:data"
// Anti-farming เก็บที่ "affinity:afk"
// =========================

export const AFFINITY_CONFIG = {
  // =========================
  // EXP CURVE
  // =========================
  EXP: {
    BASE: 100,
    EXPONENT: 1.2,
    // expToNext(level) = floor(BASE * level^EXPONENT)
  },

  // =========================
  // WEAPON AFFINITY CATEGORIES
  // =========================
  WEAPON_CATEGORIES: {
    blade:    { nameKey: "affinity.weapon.blade",    icon: "textures/items/diamond_sword" },
    axe:      { nameKey: "affinity.weapon.axe",      icon: "textures/items/diamond_axe" },
    tool:     { nameKey: "affinity.weapon.tool",     icon: "textures/items/diamond_shovel" },
    bow:      { nameKey: "affinity.weapon.bow",      icon: "textures/items/bow_standby" },
    crossbow: { nameKey: "affinity.weapon.crossbow", icon: "textures/items/crossbow" },
    shield:   { nameKey: "affinity.weapon.shield",   icon: "textures/items/shield" }
  },

  // =========================
  // ARMOR AFFINITY CATEGORIES
  // =========================
  ARMOR_CATEGORIES: {
    light:  { nameKey: "affinity.armor.light",  icon: "textures/items/leather_helmet" },
    medium: { nameKey: "affinity.armor.medium", icon: "textures/items/iron_helmet" },
    heavy:  { nameKey: "affinity.armor.heavy",  icon: "textures/items/diamond_helmet" }
  },

  // =========================
  // PASSIVE UNLOCKS
  // โบนัสที่ปลดทุกๆ Level ในแต่ละ Affinity category
  // field ตรงกับ field ใน getStatBonuses() (statUtils.js)
  // ค่าเป็น % หรือ flat bonus ขึ้นอยู่กับ field
  // =========================
  PASSIVES: {
    // --- Blade ---
    blade: [
      { level: 5,  bonuses: { criticalChanceBonus: 1 } },
      { level: 10, bonuses: { criticalDamageBonus: 2 } },
      { level: 20, bonuses: { lifestealChanceBonus: 2 } },
      { level: 30, bonuses: { criticalChanceBonus: 3 } },
      { level: 50, bonuses: { criticalDamageBonus: 5 } }
    ],
    // --- Axe ---
    axe: [
      { level: 5,  bonuses: { attackDamageBonus: 2 } },
      { level: 10, bonuses: { criticalDamageBonus: 1 } },
      { level: 20, bonuses: { attackDamageBonus: 3 } },
      { level: 30, bonuses: { lifestealChanceBonus: 2 } },
      { level: 50, bonuses: { attackDamageBonus: 5 } }
    ],
    // --- Tool ---
    tool: [
      { level: 5,  bonuses: { movementSpeedBonus: 1 } },
      { level: 10, bonuses: { movementSpeedBonus: 2 } },
      { level: 20, bonuses: { movementSpeedBonus: 3 } },
      { level: 30, bonuses: { criticalChanceBonus: 1 } },
      { level: 50, bonuses: { movementSpeedBonus: 5 } }
    ],
    // --- Bow ---
    bow: [
      { level: 5,  bonuses: { projectileDamageBonus: 1 } },
      { level: 10, bonuses: { criticalChanceBonus: 1 } },
      { level: 20, bonuses: { projectileDamageBonus: 2 } },
      { level: 30, bonuses: { criticalDamageBonus: 2 } },
      { level: 50, bonuses: { projectileDamageBonus: 5 } }
    ],
    // --- Crossbow ---
    crossbow: [
      { level: 5,  bonuses: { projectileDamageBonus: 1 } },
      { level: 10, bonuses: { criticalChanceBonus: 1 } },
      { level: 20, bonuses: { projectileDamageBonus: 2 } },
      { level: 30, bonuses: { criticalChanceBonus: 2 } },
      { level: 50, bonuses: { projectileDamageBonus: 5 } }
    ],
    // --- Shield ---
    shield: [
      { level: 5,  bonuses: { blockChanceBonus: 1 } },
      { level: 10, bonuses: { damageReductionBonus: 1 } },
      { level: 20, bonuses: { blockChanceBonus: 2 } },
      { level: 30, bonuses: { damageReductionBonus: 2 } },
      { level: 50, bonuses: { blockChanceBonus: 3, damageReductionBonus: 3 } }
    ],
    // --- Light Armor ---
    light: [
      { level: 5,  bonuses: { movementSpeedBonus: 1 } },
      { level: 10, bonuses: { evasionChanceBonus: 1 } },
      { level: 20, bonuses: { movementSpeedBonus: 2 } },
      { level: 30, bonuses: { evasionChanceBonus: 2 } },
      { level: 50, bonuses: { evasionChanceBonus: 3 } }
    ],
    // --- Medium Armor ---
    medium: [
      { level: 5,  bonuses: { blockChanceBonus: 1 } },
      { level: 10, bonuses: { damageReductionBonus: 1 } },
      { level: 20, bonuses: { blockChanceBonus: 2 } },
      { level: 30, bonuses: { damageReductionBonus: 2 } },
      { level: 50, bonuses: { blockChanceBonus: 3, damageReductionBonus: 3 } }
    ],
    // --- Heavy Armor ---
    heavy: [
      { level: 5,  bonuses: { damageReductionBonus: 1 } },
      { level: 10, bonuses: { maxHealthBonus: 2 } },
      { level: 20, bonuses: { damageReductionBonus: 2 } },
      { level: 30, bonuses: { maxHealthBonus: 2 } },
      { level: 50, bonuses: { damageReductionBonus: 3, maxHealthBonus: 3 } }
    ]
  },

  // =========================
  // NATURAL STAT GROWTH
  // ทุกๆ Level ใน Affinity จะได้ Stat เพิ่ม (flat bonus ต่อครั้ง)
  // สะสมทุก Level ที่ถึง - ไม่ต้องลงทุนแต้ม
  // =========================
  STAT_GROWTH: {
    blade:    [ { level: 10, strBonus: 1 }, { level: 20, agiBonus: 1 }, { level: 30, strBonus: 1 }, { level: 40, agiBonus: 1 }, { level: 50, strBonus: 2 } ],
    axe:      [ { level: 10, strBonus: 1 }, { level: 20, vitBonus: 1 }, { level: 30, strBonus: 1 }, { level: 40, vitBonus: 1 }, { level: 50, strBonus: 2 } ],
    tool:     [ { level: 10, agiBonus: 1 }, { level: 20, agiBonus: 1 }, { level: 30, agiBonus: 1 }, { level: 40, agiBonus: 1 }, { level: 50, agiBonus: 2 } ],
    bow:      [ { level: 10, agiBonus: 1 }, { level: 20, strBonus: 1 }, { level: 30, agiBonus: 1 }, { level: 40, strBonus: 1 }, { level: 50, agiBonus: 2 } ],
    crossbow: [ { level: 10, agiBonus: 1 }, { level: 20, strBonus: 1 }, { level: 30, agiBonus: 1 }, { level: 40, strBonus: 1 }, { level: 50, agiBonus: 2 } ],
    shield:   [ { level: 10, vitBonus: 1 }, { level: 20, vitBonus: 1 }, { level: 30, vitBonus: 1 }, { level: 40, vitBonus: 1 }, { level: 50, vitBonus: 2 } ],
    light:    [ { level: 10, agiBonus: 1 }, { level: 20, agiBonus: 1 }, { level: 30, agiBonus: 1 }, { level: 40, agiBonus: 1 }, { level: 50, agiBonus: 2 } ],
    medium:   [ { level: 10, vitBonus: 1 }, { level: 20, strBonus: 1 }, { level: 30, vitBonus: 1 }, { level: 40, strBonus: 1 }, { level: 50, strBonus: 1, vitBonus: 1 } ],
    heavy:    [ { level: 10, vitBonus: 1 }, { level: 20, vitBonus: 1 }, { level: 30, vitBonus: 1 }, { level: 40, vitBonus: 1 }, { level: 50, vitBonus: 2 } ]
  },

  // =========================
  // ANTI-FARMING
  // =========================
  ANTI_FARM: {
    cooldownTicks: 20,         // 1 วินาที ระหว่าง gain แต่ละ category
    maxTrackEntities: 10,      // ติดตาม entity ล่าสุด 10 ตัว
    // Diminishing returns: จำนวนครั้งที่โจมตี entity เดียวก่อนจะลด
    // รูปแบบ: [threshold, multiplier]
    diminishingReturns: [
      [3, 1.0],    // 1-3 ครั้ง = 100%
      [5, 0.5],    // 4-5 ครั้ง = 50%
      [8, 0.25]    // 6+ ครั้ง = 25%
    ]
  },

  // =========================
  // EXP GAIN VALUES
  // =========================
  GAIN: {
    WEAPON_HIT: 1,             // โจมตีด้วย weapon type → +1 EXP
    WEAPON_KILL: 5,            // ฆ่าด้วย weapon type → +5 EXP
    WEAPON_CRIT: 2,            // คริติคอล → +2 EXP
    ARMOR_HIT: 1,              // รับ damage ขณะสวม armor → +1 EXP
    ARMOR_KILL: 3,             // ฆ่าขณะสวม armor → +3 EXP
    BASE_WEAPON_KILL: 2,       // ฆ่าพื้นฐาน (ไม่ระบุ weapon) → +2 EXP
    BASE_ARMOR_HIT: 1          // รับ damage พื้นฐาน → +1 EXP
  },

  // =========================
  // REFRESH INTERVAL
  // =========================
  CHECK_INTERVAL_TICKS: 20    // ทุก 1 วินาที
};