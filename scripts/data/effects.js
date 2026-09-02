// =========================
// data/effects.js
// ฐานข้อมูลเอฟเฟกต์ (potion effect) ของร้านค้าเอฟเฟกต์ — แทนที่ EFFECTS /
// SINGLE_LEVEL_EFFECTS ที่เคย hardcode อยู่ใน systems/shopEffect.js
//
// เพิ่มเอฟเฟกต์ใหม่ = เพิ่ม 1 รายการที่นี่เท่านั้น ไม่ต้องแก้
// systems/shopEffect.js — labelKey ต้องมี locale key จริงใน
// ui/locale/th.js (เช่น "effect.name.speed")
//
// singleLevel: true  = เอฟเฟกต์นี้มีแค่ตัวเลือก "ระยะเวลา" (ไม่มีระดับ)
//                       ใช้ SHOP_CONFIG.EFFECT_SHOP.SINGLE_LEVEL_DURATIONS
// singleLevel: false = เอฟเฟกต์นี้มีทั้งตัวเลือก "ระดับ" และ "ระยะเวลา"
//                       ใช้ SHOP_CONFIG.EFFECT_SHOP.LEVELED_AMPS / LEVELED_DURATIONS
// (เดิมเก็บเป็นรายชื่อ id แยกไว้อีก array หนึ่ง — ย้ายมาเป็นฟิลด์ของแต่ละ
// เอฟเฟกต์โดยตรงแทน ค่าไม่เปลี่ยนจากเดิม เพียงย้ายที่เก็บให้ดูคู่กันง่ายขึ้น)
// =========================

export const EFFECTS = [
  { id: "invisibility", labelKey: "effect.name.invisibility", cost: 500, singleLevel: true },
  { id: "jump_boost", labelKey: "effect.name.jump_boost", cost: 500, singleLevel: false },
  { id: "speed", labelKey: "effect.name.speed", cost: 700, singleLevel: false },
  { id: "water_breathing", labelKey: "effect.name.water_breathing", cost: 700, singleLevel: true },
  { id: "night_vision", labelKey: "effect.name.night_vision", cost: 1000, singleLevel: true },
  { id: "slow_falling", labelKey: "effect.name.slow_falling", cost: 1000, singleLevel: true },
  { id: "fire_resistance", labelKey: "effect.name.fire_resistance", cost: 1000, singleLevel: true },
  { id: "conduit_power", labelKey: "effect.name.conduit_power", cost: 1400, singleLevel: true },
  { id: "haste", labelKey: "effect.name.haste", cost: 2000, singleLevel: false },
  { id: "village_hero", labelKey: "effect.name.village_hero", cost: 5000, singleLevel: false },
  { id: "strength", labelKey: "effect.name.strength", cost: 20000, singleLevel: false },
  { id: "regeneration", labelKey: "effect.name.regeneration", cost: 20000, singleLevel: false },
  { id: "resistance", labelKey: "effect.name.resistance", cost: 20000, singleLevel: false },
  { id: "health_boost", labelKey: "effect.name.health_boost", cost: 20000, singleLevel: false }
];

const EFFECT_BY_ID = new Map(EFFECTS.map(e => [e.id, e]));

/** คืนข้อมูลเอฟเฟกต์ตาม id (หรือ null ถ้าไม่มีในฐานข้อมูล) */
export function getEffectById(id) {
  return EFFECT_BY_ID.get(id) ?? null;
}

/**
 * ตรวจสอบความถูกต้องของฐานข้อมูลเอฟเฟกต์ — คืน array ของข้อความปัญหาที่พบ
 * @param {(key: string) => string} translate  ฟังก์ชัน t() จาก ui/locale
 *   (ส่งเข้ามาเป็นพารามิเตอร์แทนการ import ตรง เพื่อความสมมาตรกับ
 *   validateItems() และเลี่ยงพึ่งพา locale โดยตรงในไฟล์ข้อมูล)
 */
export function validateEffects(translate) {
  const issues = [];

  for (const effect of EFFECTS) {
    if (!effect.id || typeof effect.id !== "string") {
      issues.push(`effect "${effect.id}": id ต้องเป็น string ที่ไม่ว่าง`);
    }
    if (typeof effect.cost !== "number" || !Number.isFinite(effect.cost) || effect.cost < 0) {
      issues.push(`effect "${effect.id}": cost ต้องเป็นตัวเลข >= 0 (ได้ ${JSON.stringify(effect.cost)})`);
    }
    if (typeof effect.singleLevel !== "boolean") {
      issues.push(`effect "${effect.id}": singleLevel ต้องเป็น true/false`);
    }
    if (typeof effect.labelKey !== "string" || effect.labelKey.trim() === "") {
      issues.push(`effect "${effect.id}": ต้องกำหนด labelKey`);
    } else if (typeof translate === "function" && translate(effect.labelKey) === effect.labelKey) {
      issues.push(`effect "${effect.id}": labelKey "${effect.labelKey}" ไม่พบใน locale`);
    }
  }

  return issues;
}
