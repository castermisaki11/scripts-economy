// =========================
// UIFramework.js
// จุดเดียวในทั้งแอดออนที่สร้าง ActionFormData / ModalFormData ตรง ๆ
// ไฟล์เมนูอื่นห้ามเรียก 2 คลาสนี้เอง (หน้าจอยืนยัน/MessageFormData แยกไปอยู่
// confirmDialog.js แล้ว — showConfirm() เป็นจุดเดียวที่สร้าง MessageFormData)
//
// นี่คือกลไกที่บังคับกฎของ Design System จริง ๆ:
// - ปุ่ม "กลับ" อยู่ท้ายสุดเสมอ (createListMenu จัดการเอง)
// - ทุกสถานะที่สื่อด้วยสี ต้องมีไอคอนกำกับ (createResultMessage จัดการเอง)
// - ทุกสตริงผ่าน t() ไม่มี hardcoded ข้อความในไฟล์เมนู
// =========================

import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { t } from "../locale/index";
import { PAGE_SIZE, ICONS, COLORS } from "../../config/uiConfig";
import { NavigationManager } from "./NavigationManager";
import { filterEnabledItems } from "../../core/menuVisibility";
import { playClick, playCancel } from "../../core/soundUtils";
import { showError } from "../../core/messageUtils";

/* =========================
   PAGINATION (pure, no UI — ใช้ภายใน createListMenu)
========================= */

/**
 * ตัด items ให้เหลือแค่หน้าที่ขอ พร้อมบอกว่ามีหน้าก่อน/ถัดไปไหม
 * @param {any[]} items
 * @param {number} page  เริ่มที่ 0
 */
export function createPagedList(items, page = 0) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = clampedPage * PAGE_SIZE;
  return {
    pageItems: items.slice(start, start + PAGE_SIZE),
    page: clampedPage,
    totalPages,
    hasPrev: clampedPage > 0,
    hasNext: clampedPage < totalPages - 1
  };
}

/* =========================
   LIST MENU
========================= */

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{
 *   titleKey: string, titleVars?: object,
 *   bodyKey?: string, bodyVars?: object,
 *   items: { id: any, labelKey: string, labelVars?: object, icon?: string }[],
 *   menuGroup?: string,
 *   onSelect: (item: any) => void,
 *   page?: number,
 *   showBack?: boolean,
 *   showExit?: boolean,
 *   onCancel?: () => void
 * }} opts
 */
export async function createListMenu(player, opts) {
  if (!player?.isValid) return;
  const {
    titleKey,
    titleVars,
    bodyKey,
    bodyVars,
    items,
    menuGroup,
    onSelect,
    page = 0,
    showBack = true,
    showExit = true,
    onCancel
  } = opts;

  // เมนูทุกระดับสามารถระบุ menuGroup ได้จากจุดสร้างหน้าจอเดียวกัน
  // ทำให้เมนูย่อยใช้ระบบตั้งค่าเดียวกับเมนูหลัก โดยไม่ต้องกรองซ้ำในทุกไฟล์
  const visibleItems = menuGroup ? filterEnabledItems(menuGroup, items) : items;
  const { pageItems, hasPrev, hasNext } = createPagedList(visibleItems, page);

  const form = new ActionFormData().title(t(titleKey, titleVars));
  if (bodyKey) form.body(t(bodyKey, bodyVars));

  for (const item of pageItems) {
    form.button(t(item.labelKey, item.labelVars), item.icon);
  }
  if (hasPrev) form.button(t("ui.prevPage"), ICONS.prevPage);
  if (hasNext) form.button(t("ui.nextPage"), ICONS.nextPage);
  if (showBack) form.button(t("ui.back"), ICONS.back); // กฎ: ปุ่มกลับอยู่ท้ายสุดเสมอ
  // กฎ: ปุ่ม "ออกเมนู" (ปิดทั้งสแตกทันที) อยู่ล่างสุดเสมอ — ต่ำกว่าปุ่ม
  // "กลับ" เสมอ (ไม่ใช่แค่ท้ายรายการไอเทม แต่ท้ายกว่าปุ่มกลับด้วย)
  if (showExit) form.button(t("ui.exitMenu"), ICONS.exit);

  const res = await form.show(player).catch(() => null);
  NavigationManager.logEvent(player, "screen-entered", titleKey);

  // ปิดฟอร์มด้วยปุ่ม X ของระบบ (res.canceled) ต้องมีพฤติกรรมเดียวกับกด "กลับ"
  // เสมอ ไม่ว่าจะมีปุ่ม "กลับ" ให้เห็นบนหน้าจอหรือไม่ (showBack ควบคุมแค่การ
  // แสดงปุ่ม ไม่ควรควบคุมว่าการปิดฟอร์มจะนำทางหรือไม่) — X ยังคงเทียบเท่า
  // "กลับ" เหมือนเดิม ไม่เทียบเท่า "ออกเมนู" (ผู้เล่นต้องกดปุ่ม "ออกเมนู"
  // เองเท่านั้นถึงจะปิดทั้งสแตกทันที)
  if (!res || res.canceled || res.selection === undefined) {
    // เสียงปิด/ยกเลิก — จุดเดียวครอบทุกเมนูที่ผ่าน createListMenu
    playCancel(player);
    return onCancel ? onCancel() : NavigationManager.back(player);
  }

  let idx = res.selection;

  if (idx < pageItems.length) {
    // เสียงกดปุ่ม — จุดเดียวครอบทุกเมนูที่ผ่าน createListMenu (ปุ่มรายการ/
    // หน้า/กลับ/ออก ต่างกันแค่ idx ที่ถูกจัดการด้านล่าง)
    playClick(player);
    try {
      return await onSelect(pageItems[idx]);
    } catch (error) {
      console.warn("[UIFramework] onSelect error:", error);
      showError(player, t("ui.errorOccurred"));
      return NavigationManager.close(player);
    }
  }
  idx -= pageItems.length;

  if (hasPrev) {
    if (idx === 0) {
      playClick(player);
      return createListMenu(player, { ...opts, page: page - 1 });
    }
    idx -= 1;
  }
  if (hasNext) {
    if (idx === 0) {
      playClick(player);
      return createListMenu(player, { ...opts, page: page + 1 });
    }
    idx -= 1;
  }
  if (showBack) {
    // บั๊ก: เดิมปุ่ม "กลับ" ที่มองเห็นได้เรียก NavigationManager.back()
    // ตรง ๆ เสมอ ไม่สนใจ onCancel ที่ผู้เรียกกำหนดเอง (ต่างจากปุ่ม X ด้าน
    // บนที่เช็ค onCancel ก่อน) — เมนูที่ไม่เคย push ตัวเองเข้าสแตกแต่ใช้
    // onCancel bypass แทน (เช่น showShoppingMenu ใน mainUi.js) จะเจอสแตก
    // ว่างพอดีตอนกด "กลับ" แล้วตกไป NavigationManager.close() ปิดทั้งเมนู
    // ทั้งที่กด X ที่จุดเดียวกันกลับทำงานถูกต้อง ตอนนี้ให้ปุ่ม "กลับ" เช็ค
    // onCancel ก่อนเหมือนปุ่ม X ทุกประการ เพื่อให้สองปุ่มพฤติกรรมตรงกันเสมอ
    if (idx === 0) {
      playCancel(player);
      return onCancel ? onCancel() : NavigationManager.back(player);
    }
    idx -= 1;
  }
  // เหลือแค่ปุ่ม "ออกเมนู" — ปิดทั้งสแตกทันที ไม่ว่าจะกำลังอยู่ลึกแค่ไหน
  if (showExit) {
    playCancel(player);
    return NavigationManager.close(player);
  }

  // กันไว้เฉย ๆ ไม่ควรมาถึงจุดนี้ได้ (ปุ่มทั้งหมดถูกจัดการครบแล้วด้านบน)
  return NavigationManager.back(player);
}

/* =========================
   CONFIRM DIALOG
   ย้ายไปอยู่ที่ confirmDialog.js แล้ว (export ชื่อ showConfirm) — เพื่อให้
   เหมือน pattern เดียวกับ economyUtils.js / soundUtils.js / messageUtils.js
   ที่แยกไฟล์ของตัวเอง อย่า import createConfirmDialog จากที่นี่อีก
========================= */

/* =========================
   RESULT MESSAGE
========================= */

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{
 *   type: "success" | "error" | "warning",
 *   titleKey?: string,
 *   messageKey: string, messageVars?: object
 * }} opts
 */
export async function createResultMessage(player, opts) {
  if (!player?.isValid) return;
  const { type = "success", titleKey = "ui.result", messageKey, messageVars } = opts;

  const icon = ICONS.status[type] ?? "";
  const color = COLORS.status[type] ?? "";

  const form = new ActionFormData()
    .title(t(titleKey))
    .body(`${color}${icon} ${t(messageKey, messageVars)}`)
    .button(t("ui.ok"));

  await form.show(player).catch(() => {});
}

/* =========================
   MODAL HELPER (ยังไม่อยู่ในสเปกเดิม แต่ทุกไฟล์ที่ migrate จะต้องใช้
   ModalFormData แบบ text field เดียวสำหรับ "จำนวนที่ต้องการ" —
   รวมไว้ที่นี่แทนที่จะให้แต่ละไฟล์เรียก ModalFormData เอง)
========================= */

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{
 *   titleKey: string, titleVars?: object,
 *   promptKey: string, promptVars?: object,
 *   placeholder?: string,
 *   onSubmit: (value: string) => void,
 *   onCancel?: () => void
 * }} opts
 */
export async function createAmountPrompt(player, opts) {
  if (!player?.isValid) return;
  const { titleKey, titleVars, promptKey, promptVars, placeholder = "", onSubmit, onCancel } = opts;

  const form = new ModalFormData()
    .title(t(titleKey, titleVars))
    .textField(t(promptKey, promptVars), placeholder, { defaultValue: "" });

  const res = await form.show(player).catch(() => null);
  if (!res || res.canceled) {
    return onCancel ? onCancel() : NavigationManager.back(player);
  }

  return onSubmit(res.formValues[0]);
}

/* =========================
   TOGGLES PROMPT (เพิ่มสำหรับ autoCollect.js — ModalFormData แบบ
   toggle หลายตัวในฟอร์มเดียว รวมไว้ที่นี่เหมือน createAmountPrompt
   แทนที่จะให้ autoCollect.js เรียก ModalFormData เอง)
========================= */

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{
 *   titleKey: string, titleVars?: object,
 *   toggles: { labelKey: string, labelVars?: object, defaultValue?: boolean }[],
 *   onSubmit: (values: boolean[]) => void,
 *   onCancel?: () => void
 * }} opts
 */
export async function createTogglesPrompt(player, opts) {
  if (!player?.isValid) return;
  const { titleKey, titleVars, toggles, onSubmit, onCancel } = opts;

  const form = new ModalFormData().title(t(titleKey, titleVars));
  for (const toggle of toggles) {
    form.toggle(t(toggle.labelKey, toggle.labelVars), { defaultValue: toggle.defaultValue ?? false });
  }

  const res = await form.show(player).catch(() => null);
  if (!res || res.canceled) {
    return onCancel ? onCancel() : NavigationManager.back(player);
  }

  return onSubmit(res.formValues);
}

/* =========================
   MIXED MODAL PROMPT (เพิ่มสำหรับ adminUi.js — ฟอร์มที่มีฟิลด์ผสมกัน
   หลายชนิดในฟอร์มเดียว เช่น slider + toggle หลายตัว (showTPAllOptionsUI)
   รวมไว้ที่นี่เหมือน createAmountPrompt / createTogglesPrompt แทนที่จะ
   ให้แต่ละไฟล์เรียก ModalFormData เอง — ใช้แทน createTogglesPrompt ได้
   ในกรณีที่ต้องผสม field ชนิดอื่นด้วย)
========================= */

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{
 *   titleKey: string, titleVars?: object,
 *   fields: Array<
 *     | { type: "toggle", labelKey: string, labelVars?: object, defaultValue?: boolean }
 *     | { type: "slider", labelKey: string, labelVars?: object, min: number, max: number, step?: number, defaultValue?: number }
 *     | { type: "textField", labelKey: string, labelVars?: object, placeholder?: string, defaultValue?: string }
 *     | { type: "dropdown", labelKey: string, labelVars?: object, optionKeys: string[], defaultIndex?: number }
 *   >,
 *   onSubmit: (values: any[]) => void,
 *   onCancel?: () => void
 * }} opts
 */
export async function createModalPrompt(player, opts) {
  if (!player?.isValid) return;
  const { titleKey, titleVars, fields, onSubmit, onCancel } = opts;

  const form = new ModalFormData().title(t(titleKey, titleVars));
  for (const field of fields) {
    const label = t(field.labelKey, field.labelVars);
    switch (field.type) {
      case "toggle":
        form.toggle(label, { defaultValue: field.defaultValue ?? false });
        break;
      case "slider":
        form.slider(label, field.min, field.max, {
          valueStep: field.step ?? 1,
          defaultValue: field.defaultValue ?? field.min
        });
        break;
      case "textField":
        form.textField(label, field.placeholder ?? "", { defaultValue: field.defaultValue ?? "" });
        break;
      case "dropdown":
        form.dropdown(label, field.optionKeys.map(k => t(k)), { defaultValueIndex: field.defaultIndex ?? 0 });
        break;
    }
  }

  const res = await form.show(player).catch(() => null);
  if (!res || res.canceled) {
    return onCancel ? onCancel() : NavigationManager.back(player);
  }

  return onSubmit(res.formValues);
}
