// =========================
// menuVisibility.js
// ระบบเปิด/ปิดเมนูแบบ "ทั้งเซิร์ฟเวอร์" (world Dynamic Property) — ต่างจาก
// ui/settings/uiSettings.js ที่เป็นการจัด "ลำดับ" เมนูหลักส่วนตัวต่อผู้เล่น
// คนเดียว ไฟล์นี้คือสวิตช์ "แสดง/ซ่อน" ปุ่มเมนูทุกระดับจากผู้เล่นทุกคน
// พร้อมกัน ตั้งค่าได้จากหน้า Admin เท่านั้น (ดู
// ui/settings/menuConfigSettings.js) รายการกลุ่ม/ปุ่มทั้งหมดที่เปิด/ปิดได้
// ดูที่ config/menuToggleConfig.js
//
// รูปแบบที่เก็บ (Dynamic Property "menuVisibilityConfig"):
//   { "<groupId>": { "<itemId>": false, ... }, ... }
// คีย์ที่ไม่มีอยู่ในข้อมูลที่บันทึกไว้ (ยังไม่เคยตั้งค่า หรือเป็นรายการใหม่
// ที่เพิ่งเพิ่มเข้ามาทีหลัง) ถือว่า "เปิด" อยู่เป็นค่า default เสมอ —
// แนวทางเดียวกับ core/actionBarSettings.js (แค่เป็น world-scoped แทน
// per-player)
// =========================

import { world, system } from "@minecraft/server";

const MENU_VISIBILITY_DYNAMIC_PROPERTY_KEY = "menuVisibilityConfig";

// Per-tick cache — world dynamic property ไม่เปลี่ยนภายใน tick เดียว
let visibilityCacheTick = -1;
let visibilityCacheData = null;

function readAll() {
  if (visibilityCacheTick === system.currentTick && visibilityCacheData !== null) {
    return visibilityCacheData;
  }
  try {
    const raw = world.getDynamicProperty(MENU_VISIBILITY_DYNAMIC_PROPERTY_KEY);
    if (typeof raw !== "string") {
      visibilityCacheData = {};
      visibilityCacheTick = system.currentTick;
      return visibilityCacheData;
    }
    const parsed = JSON.parse(raw);
    visibilityCacheData = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    visibilityCacheData = {};
  }
  visibilityCacheTick = system.currentTick;
  return visibilityCacheData;
}

function writeAll(data) {
  world.setDynamicProperty(MENU_VISIBILITY_DYNAMIC_PROPERTY_KEY, JSON.stringify(data));
  visibilityCacheTick = -1;
}

/**
 * เมนู itemId ในกลุ่ม groupId เปิดใช้งานอยู่ไหม (ทั้งเซิร์ฟเวอร์) — ยังไม่
 * เคยตั้งค่า/เป็นรายการใหม่ -> ถือว่าเปิดอยู่ (default = true)
 * @param {string} groupId
 * @param {string} itemId
 */
export function isMenuItemEnabled(groupId, itemId) {
  const all = readAll();
  const value = all[groupId]?.[itemId];
  return typeof value === "boolean" ? value : true;
}

/**
 * คืนสถานะเปิด/ปิดของทุกรายการในกลุ่ม (เติม default = true ให้รายการที่
 * ยังไม่เคยตั้งค่า) — ใช้วาดหน้าจอ menuConfigSettings.js
 * @param {string} groupId
 * @param {string[]} itemIds
 */
export function getGroupVisibility(groupId, itemIds) {
  const all = readAll();
  const saved = all[groupId] ?? {};
  const result = {};
  for (const id of itemIds) {
    result[id] = typeof saved[id] === "boolean" ? saved[id] : true;
  }
  return result;
}

/**
 * บันทึกสถานะเปิด/ปิดทุกรายการของกลุ่มนี้ (เขียนทับทั้งกลุ่ม — เรียกจากหน้า
 * ตั้งค่าเมนู Admin หลังกด "บันทึก" เท่านั้น) กลุ่มอื่นไม่ถูกแตะต้อง
 * @param {string} groupId
 * @param {Record<string, boolean>} settings
 */
export function saveGroupVisibility(groupId, settings) {
  const all = readAll();
  all[groupId] = { ...settings };
  writeAll(all);
}

/**
 * กรอง items (array ของ { id, ... } ที่ส่งเข้า createListMenu) ให้เหลือ
 * เฉพาะรายการที่เปิดใช้งานอยู่ในกลุ่ม groupId — เมนูทั่วไปควรส่ง groupId
 * ผ่าน menuGroup ให้ createListMenu จัดการอัตโนมัติ ส่วนเมนูที่ประกอบ
 * รายการพิเศษหลายแหล่งยังเรียกฟังก์ชันนี้ตรง ๆ ได้เหมือนเดิม
 * @param {string} groupId
 * @param {{ id: any }[]} items
 */
export function filterEnabledItems(groupId, items) {
  const all = readAll();
  const saved = all[groupId] ?? {};
  return items.filter((item) => {
    const value = saved[item.id];
    return typeof value === "boolean" ? value : true;
  });
}
