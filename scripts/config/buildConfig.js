// =========================
// config/buildConfig.js
// ค่าที่ CI เปลี่ยนตอน build — ไม่ใช่การตั้งค่า runtime
//
// ADMIN_FEATURES_ENABLED:
//   true  = เวอร์ชันเต็ม (มีระบบ admin ครบ: เมนู Admin, เช็คผู้เล่น,
//           ownerSetup แจกแท็ก, ปุ่ม admin ตามระบบ)
//   false = เวอร์ชัน no-admin ที่ tools/make-variants.mjs rewrite เป็น false
//           ตอน package .mcpack — isAdmin() คืน false เสมอ คำสั่ง
//           /prakan:admin, /prakan:checkplayer ไม่ถูกลงทะเบียน และ
//           ownerSetup ไม่แจกแท็ก "admin" ให้ใครเลย
//
// ห้าม hardcode ค่า false ที่นี่ใน repo — เวอร์ชันเต็มต้องเป็น true เสมอ
// (ไฟล์ no-admin ถูกสร้างขึ้นเฉพาะตอน build ใน CI เท่านั้น)
// =========================

export const ADMIN_FEATURES_ENABLED = true;
