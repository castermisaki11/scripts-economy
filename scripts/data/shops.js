// =========================
// data/shops.js
// ข้อมูลหมวดหมู่ร้านค้า (Shop categories) — ใช้ร่วมกันโดยเมนู "ซื้อ" และ
// การแสดงชื่อหมวดหมู่ทุกจุด แทนที่การ hardcode รายชื่อหมวดหมู่ไว้ใน
// systems/shopSystem.js เดิม (CATEGORY_KEYS + รายการปุ่มในหน้าเลือก
// หมวดหมู่) — เพิ่มหมวดหมู่ใหม่ = เพิ่มรายการที่นี่ + ตั้ง category ให้ตรง
// กันในไอเทมที่ data/items.js เท่านั้น ไม่ต้องแก้ systems/shopSystem.js
//
// labelKey ต้องมี locale key จริงใน ui/locale/th.js (เช่น "category.ore")
// =========================

export const SHOP_CATEGORIES = [
  { id: "ore", labelKey: "category.ore", icon: "textures/items/iron_ingot" },
  { id: "food", labelKey: "category.food", icon: "textures/items/apple" },
  { id: "crop", labelKey: "category.crop", icon: "textures/items/wheat" },
  { id: "block", labelKey: "category.block", icon: "textures/blocks/stone" },
  { id: "stone", labelKey: "category.stone", icon: "textures/blocks/stone_granite" },
  { id: "concrete", labelKey: "category.concrete", icon: "textures/blocks/concrete_white" },
  { id: "terracotta", labelKey: "category.terracotta", icon: "textures/blocks/hardened_clay_stained_orange" },
  { id: "wood", labelKey: "category.wood", icon: "textures/blocks/log_oak" },
  { id: "wool", labelKey: "category.wool", icon: "textures/blocks/wool_colored_white" },
  { id: "aquatic", labelKey: "category.aquatic", icon: "textures/items/fish_raw" },
  { id: "misc", labelKey: "category.misc", icon: "textures/items/string" }
];

const CATEGORY_BY_ID = new Map(SHOP_CATEGORIES.map(c => [c.id, c]));

/** รายการหมวดหมู่ร้านค้าทั้งหมด ตามลำดับที่ประกาศไว้ */
export function getShopCategories() {
  return SHOP_CATEGORIES;
}

/** locale key ของหมวดหมู่ — คืน "category.all" ถ้าไม่รู้จักหมวดหมู่นี้ */
export function getCategoryLabelKey(categoryId) {
  return CATEGORY_BY_ID.get(categoryId)?.labelKey ?? "category.all";
}

/** ไอคอนของหมวดหมู่ (ใช้ในหน้าเลือกหมวดหมู่ตอนซื้อ) */
export function getCategoryIcon(categoryId) {
  return CATEGORY_BY_ID.get(categoryId)?.icon ?? "";
}

/** true ถ้า categoryId นี้ถูกลงทะเบียนไว้ในหมวดหมู่ร้านค้า */
export function isValidCategory(categoryId) {
  return CATEGORY_BY_ID.has(categoryId);
}
