// =========================
// uiSettings.js
// ระบบตั้งค่าลำดับเมนูหลักส่วนตัวของผู้เล่นแต่ละคน (per-player Dynamic
// Property) — ผู้เล่นใหม่ต้องจัดลำดับเมนูก่อนเข้าใช้งานเมนูหลักครั้งแรก
// หลังจากนั้นสามารถเปิดหน้านี้ซ้ำได้ทุกเมื่อจากปุ่ม "ตั้งค่าเมนู" ท้ายเมนูหลัก
//
// ทำตามสถาปัตยกรรมเดียวกับไฟล์เมนูอื่น ๆ ทั้งหมด:
// - ไม่สร้าง ActionFormData / ModalFormData ตรง ๆ (ใช้ createListMenu จาก
//   UIFramework.js เท่านั้น — จุดเดียวที่อนุญาตให้สร้างฟอร์มโดยตรง)
// - ทุกสตริงผ่าน t() จาก locale/index.js
// - ข้อความสำเร็จ/ผิดพลาดผ่าน messageUtils.js
// - รองรับเฉพาะ ActionFormData แบบปุ่ม (Bedrock ไม่มี drag-and-drop) —
//   การจัดลำดับทำผ่านปุ่ม "เลื่อนขึ้น" / "เลื่อนลง" ต่อรายการ แล้ววาดหน้าจอ
//   ใหม่ทันที (เหมือน pagination ใน createListMenu) จนกว่าจะกดปุ่ม "บันทึก"
//   ถึงจะเขียนลง Dynamic Property จริง
// =========================

import { createListMenu } from "../framework/UIFramework";
import { t } from "../locale/index";
import { showSuccess } from "../../core/messageUtils";
import { isAdmin } from "../../core/playerUtils";
import { MAIN_MENU_ITEMS, ACTIONBAR_CATEGORIES, ICONS } from "../../config/uiConfig";
import { getActionBarSettings, saveActionBarSettings } from "../../core/actionBarSettings";

// คีย์ Dynamic Property ต่อผู้เล่น (per-entity — ไม่ต้อง register เหมือน
// world dynamic property, ใช้ player.getDynamicProperty/setDynamicProperty
// ตรงแบบเดียวกับ economyUtils.js / tpBankSystem.js)
const SETTINGS_DYNAMIC_PROPERTY_KEY = "uiSettings";

// รายการเมนูหลักทั้งหมดที่จัดลำดับได้ ย้ายไปอยู่ config/uiConfig.js
// (MAIN_MENU_ITEMS) แล้ว — เพิ่ม/แก้เมนูหลักแก้ที่นั่นจุดเดียว mainUi.js
// ก็อ่านลำดับที่จัดแล้วผ่านฟังก์ชันของไฟล์นี้เหมือนเดิม ไม่กระทบกัน
const MENU_BY_ID = new Map(MAIN_MENU_ITEMS.map((item) => [item.id, item]));
const DEFAULT_ORDER = MAIN_MENU_ITEMS.map((item) => item.id);

/* =========================
   STORAGE (per-player Dynamic Property)
   รูปแบบที่เก็บ: { "saved": true, "order": ["shop", "market", ...] }
========================= */

function readSavedData(player) {
  try {
    const raw = Database.get(player, SETTINGS_DYNAMIC_PROPERTY_KEY);
    if (typeof raw !== "string") return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.order)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ผู้เล่นคนนี้เคยตั้งค่าลำดับเมนู (และกดบันทึก) มาก่อนหรือยัง
export function hasConfiguredSettings(player) {
  return !!readSavedData(player)?.saved;
}

// คืนลำดับ id เมนูทั้งหมด (รวม admin-only) ที่บันทึกไว้ — ถ้ายังไม่เคยบันทึก
// หรือข้อมูลเสีย คืนลำดับ default; ถ้ามี id ใหม่ที่เพิ่มเข้ามาทีหลัง (ยังไม่มี
// ในของที่บันทึกไว้เดิม) จะถูกต่อท้ายให้อัตโนมัติ
function getSavedOrder(player) {
  const data = readSavedData(player);
  if (!data) return [...DEFAULT_ORDER];
  const known = data.order.filter((id) => MENU_BY_ID.has(id));
  const missing = DEFAULT_ORDER.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

function saveOrder(player, order) {
  if (!player?.isValid) return;
  Database.set(player, SETTINGS_DYNAMIC_PROPERTY_KEY, JSON.stringify({ saved: true, order }));
}

/* =========================
   PUBLIC: เมนูหลักใช้อ่านลำดับที่บันทึกไว้
========================= */

/**
 * คืนรายการ item ของเมนูหลัก (ตรงกับ MAIN_MENU_ITEMS) เรียงตามลำดับที่
 * ผู้เล่นคนนี้ตั้งไว้ กรองรายการ admin-only ออกถ้า hasAdmin เป็น false
 * @param {import("@minecraft/server").Player} player
 * @param {boolean} hasAdmin
 */
export function getOrderedMainMenuItems(player, hasAdmin) {
  const order = getSavedOrder(player);
  return order
    .map((id) => MENU_BY_ID.get(id))
    .filter((item) => item && (!item.adminOnly || hasAdmin));
}

/* =========================
   UI SETTINGS SCREEN (จัดลำดับด้วยปุ่ม "เลื่อนขึ้น" อย่างเดียว — ไม่มีปุ่ม
   "เลื่อนลง" แล้ว เพราะการเลื่อนรายการ A ขึ้นก็คือการเลื่อนรายการที่อยู่
   เหนือมันลงไปพร้อมกันในตัวอยู่แล้ว ผู้เล่นยังจัดลำดับได้ครบทุกแบบเหมือนเดิม
   แค่ใช้ปุ่มเดียว เมนูจึงสั้นลงครึ่งหนึ่ง)
========================= */

function swap(order, id) {
  const idx = order.indexOf(id);
  if (idx <= 0) return order; // อยู่บนสุดแล้ว หรือหา id ไม่เจอ — เลื่อนขึ้นต่อไม่ได้
  const next = [...order];
  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
  return next;
}

/**
 * เปิดหน้าตั้งค่าลำดับเมนู
 * @param {import("@minecraft/server").Player} player
 * @param {{
 *   isFirstTime?: boolean,   // true = บังคับตั้งค่าก่อนเข้าเมนูหลักครั้งแรก
 *   onSaved?: () => void,    // เรียกหลังกด "บันทึก" สำเร็จ
 *   onCancel?: () => void    // เรียกเมื่อปิดฟอร์ม/กด "กลับ" โดยไม่บันทึก
 * }} [opts]
 */
export function openUISettings(player, opts = {}) {
  if (!player?.isValid) return;
  const { isFirstTime = false, onSaved, onCancel } = opts;

  // ผู้เล่นแต่ละคนมี layout ของตัวเอง — อ่านจาก Dynamic Property เฉพาะ
  // player นี้เท่านั้น ไม่มีทางเห็น/แก้ของผู้เล่นคนอื่น
  const hasAdmin = isAdmin(player);
  const visibleOrder = getSavedOrder(player).filter((id) => {
    const def = MENU_BY_ID.get(id);
    return def && (!def.adminOnly || hasAdmin);
  });

  return showReorderScreen(player, visibleOrder, { isFirstTime, onSaved, onCancel });
}

function showReorderScreen(player, order, opts) {
  if (!player?.isValid) return;
  const { isFirstTime, onSaved, onCancel } = opts;

  const orderListText = order
    .map((id, index) => `${index + 1}. ${t(MENU_BY_ID.get(id).labelKey)}`)
    .join("\n");

  const items = [];
  order.forEach((id, index) => {
    const menuDef = MENU_BY_ID.get(id);
    const name = t(menuDef.labelKey);
    // ใช้ไอคอนของเมนูตัวนั้นเอง (จาก MAIN_MENU_ITEMS) กำกับปุ่มเลื่อนขึ้น —
    // ผู้เล่นเห็นได้ทันทีว่ากำลังจัดลำดับเมนูไหนอยู่ (รายการบนสุดไม่มีปุ่ม
    // เพราะเลื่อนขึ้นต่อไม่ได้แล้ว)
    if (index > 0) {
      items.push({ id: `up:${id}`, labelKey: "uiSettings.moveUp", labelVars: { index: index + 1, name }, icon: menuDef.icon });
    }
  });
  // ปุ่มเปิดหน้าตั้งค่า action bar — อยู่ในหน้าเดียวกับการจัดลำดับเมนู
  // (ตามที่ผู้ใช้ต้องการรวมหน้า settings เข้าด้วยกัน) กดแล้วไปฟอร์ม toggle
  // แยก (ModalFormData ผ่าน createTogglesPrompt รองรับ toggle หลายตัวในฟอร์ม
  // เดียว ต่างจาก ActionFormData ที่หน้านี้ใช้อยู่ซึ่งมีแค่ปุ่มกด) แล้ววาด
  // หน้าจัดลำดับเมนูนี้กลับมาใหม่เหมือนเดิมหลังบันทึก/ยกเลิก
  items.push({ id: "actionBarSettings", labelKey: "uiSettings.actionBarSettings", icon: ICONS.actionBar });
  items.push({ id: "save", labelKey: "uiSettings.save", icon: ICONS.save });

  return createListMenu(player, {
    titleKey: "uiSettings.title",
    bodyKey: isFirstTime ? "uiSettings.bodyFirstTime" : "uiSettings.body",
    bodyVars: { list: orderListText },
    items,
    // หน้าตั้งค่านี้ไม่ผ่าน NavigationManager.push ของตัวเอง (ปุ่ม
    // เลื่อนขึ้น/ลง แค่วาดหน้าจอเดิมใหม่ ไม่ใช่การเปลี่ยนหน้าจอ) ดังนั้น
    // ปิดฟอร์ม/กด "กลับ" ต้องแจ้งผู้เรียก (onCancel) เอง ไม่เรียก
    // NavigationManager.back() ตรง ๆ
    onCancel: () => {
      if (onCancel) return onCancel();
    },
    onSelect: (item) => {
      if (item.id === "actionBarSettings") {
        // ยังไม่บันทึกลำดับเมนู (แค่กดปุ่มเปลี่ยนหน้าไปตั้งค่า action bar) —
        // ส่ง order ปัจจุบัน (ที่ยังไม่ได้ save) ต่อไปด้วย เพื่อวาดหน้าจัด
        // ลำดับเมนูกลับมาให้ตรงกับที่ผู้เล่นจัดค้างไว้ ไม่ใช่ล้างกลับไปที่
        // ลำดับที่บันทึกไว้ล่าสุด
        return showActionBarSettingsScreen(player, order, opts);
      }

      if (item.id === "save") {
        // เติม id ที่ผู้เล่นคนนี้มองไม่เห็น (เช่น เมนู admin-only สำหรับ
        // ผู้เล่นทั่วไป) ต่อท้ายตามลำดับ default เพื่อไม่ให้หายไปจากข้อมูล
        // ที่บันทึก — คนละผู้เล่นมี layout ของตัวเอง ไม่กระทบกัน
        const fullOrder = [...order, ...DEFAULT_ORDER.filter((id) => !order.includes(id))];
        saveOrder(player, fullOrder);
        showSuccess(player, t("uiSettings.saveSuccess"));
        return onSaved ? onSaved() : undefined;
      }

      const [, id] = String(item.id).split(":");
      const nextOrder = swap(order, id);
      return showReorderScreen(player, nextOrder, opts);
    }
  });
}

/* =========================
   ACTION BAR SETTINGS SCREEN (เปิด/ปิด action bar เป็นรายหัวข้อ) — เก็บค่า
   ที่ core/actionBarSettings.js (Dynamic Property คนละคีย์กับลำดับเมนู
   ด้านบน) render เป็น list menu (createListMenu) ให้แต่ละหัวข้อมี icon +
   สถานะ [เปิด]/[ปิด] — เดิมเป็น ModalFormData toggle ซึ่ง API "ใส่รูปไม่ได้"
   จึงเปลี่ยนมาวาดเป็น list กดสลับทีละหัวข้อ (กด = สลับค่า + saveActionBarSettings
   ทันที + redraw หน้าเดิม — ผลข้อมูลเหมือน modal submit ของเดิมทุกประการ)
   เข้าถึงได้จากปุ่มเดียวกับหน้าจัดลำดับเมนู ตามที่ต้องการรวมหน้า settings
   ไว้ที่เดียวกัน
========================= */

function showActionBarSettingsScreen(player, order, opts) {
  if (!player?.isValid) return;
  const current = getActionBarSettings(player);

  const items = ACTIONBAR_CATEGORIES.map((cat) => ({
    id: cat.id,
    labelKey: "actionBarSettings.toggleLabel",
    labelVars: {
      name: t(cat.labelKey),
      state: current[cat.id] ? t("actionBarSettings.stateOn") : t("actionBarSettings.stateOff")
    },
    icon: cat.icon
  }));

  return createListMenu(player, {
    titleKey: "actionBarSettings.title",
    bodyKey: "actionBarSettings.body",
    items,
    // กดหัวข้อ = สลับค่าหัวข้อนั้น บันทึกทันที แล้ววาดหน้าเดิมใหม่ให้เห็น
    // สถานะล่าสุด (ไม่ push สแตก — การสลับไม่ใช่การเปลี่ยนหน้าจอ)
    onSelect: (item) => {
      const next = { ...getActionBarSettings(player), [item.id]: !getActionBarSettings(player)[item.id] };
      saveActionBarSettings(player, next);
      showSuccess(player, t(next[item.id] ? "actionBarSettings.enabledInfo" : "actionBarSettings.disabledInfo", {
        name: t(ACTIONBAR_CATEGORIES.find((cat) => cat.id === item.id)?.labelKey ?? item.id)
      }));
      return showActionBarSettingsScreen(player, order, opts);
    },
    // ปิดฟอร์ม/กด X = กลับไปหน้าจัดลำดับเมนู (ค่าที่สลับไปแล้วถูกบันทึกแล้ว
    // ตามที่กดแต่ละครั้ง)
    onCancel: () => showReorderScreen(player, order, opts)
  });
}
