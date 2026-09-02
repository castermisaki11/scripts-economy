// =========================
// locale/index.js
// จุดเดียวที่ไฟล์เมนูอื่น ๆ import เพื่อแปลข้อความ
// ไม่มีไฟล์เมนูใดควรเรียก locale/th.js ตรง ๆ
// =========================

import th from "./th";

const LOCALES = { th };

// ภาษาปัจจุบัน — ไทยเป็นภาษาเดียวที่มีข้อมูลตอนนี้
// เมื่อจะเพิ่มภาษาที่สอง ค่านี้ค่อยผูกกับการตั้งค่าผู้เล่น/โลก
const CURRENT_LOCALE = "th";

/**
 * แปล key เป็นข้อความที่แสดงผล พร้อมแทนค่าตัวแปรแบบ {name}
 * @param {string} key      เช่น "ui.back", "ui.sellSuccess"
 * @param {object} [vars]   เช่น { item: "เพชร", amount: 3 }
 */
export function t(key, vars) {
  if (!key) return "";
  const table = LOCALES[CURRENT_LOCALE] ?? {};
  // Dev mode warning: แจ้งเตือนเมื่อ key หายไป (ช่วยจับ typo ก่อน release)
  if (!(key in table) && typeof console !== "undefined") {
    console.warn("[locale] Missing key:", key);
  }
  let str = table[key] ?? key; // ไม่พบ key -> คืน key ตรง ๆ กันหน้าจอว่างเปล่า
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.replaceAll(`{${name}}`, String(value));
    }
  }
  return str;
}
