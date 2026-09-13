// =========================
// confirmDialog.js
// ศูนย์รวม flow "หน้าจอยืนยัน" (ใช่/ไม่ใช่) ทั้งหมดของแอดออน — ก่อนหน้านี้
// createConfirmDialog() ถูกฝังอยู่ใน ui/UIFramework.js รวมกับ list menu /
// amount prompt / result message ทำให้ไม่มีจุดเดียวที่มองเห็น "หน้าจอยืนยัน"
// ทั้งหมดของแอดออนได้ในไฟล์เดียว ต่างจาก economy (economyUtils.js), เสียง
// (soundUtils.js) และข้อความ (messageUtils.js) ที่แยกไฟล์ของตัวเองอยู่แล้ว
//
// ทุกโมดูลที่มีหน้าจอยืนยัน (shopSystem.js, shopEffect.js, tpBankSystem.js,
// playerMarket.js, economy.js ฯลฯ) ควร import showConfirm() จากไฟล์นี้แทนการ
// เขียน MessageFormData ยืนยัน/ยกเลิกเองซ้ำ — ยังคงใช้ locale key
// (titleKey/bodyKey ผ่าน t()) เหมือนส่วนอื่นของ UI ทั้งหมด ไม่ใช้ literal
// string ตรง ๆ เพื่อให้ยังคง i18n จุดเดียวผ่าน ui/locale/ เหมือนเดิม
// =========================

import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { t } from "../ui/locale/index";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { CONFIRM_DIALOG_DEFAULTS, ICONS } from "../config/uiConfig";
import { safeAsync } from "./asyncUtils";

/**
 * แสดงหน้าจอยืนยัน (ปุ่มยืนยัน/ยกเลิก) แบบมาตรฐานเดียวกันทั้งแอดออน
 *
 * @param {{
 *   player: import("@minecraft/server").Player,
 *   titleKey: string, titleVars?: object,
 *   bodyKey: string, bodyVars?: object,
 *   confirmKey?: string, cancelKey?: string,
 *   onConfirm: () => void,
 *   onCancel?: () => void
 * }} opts
 */
export const showConfirm = safeAsync(async (opts) => {
  const {
    player,
    titleKey, titleVars, bodyKey, bodyVars,
    confirmKey = CONFIRM_DIALOG_DEFAULTS.confirmKey, cancelKey = CONFIRM_DIALOG_DEFAULTS.cancelKey,
    onConfirm, onCancel
  } = opts;

  if (!player?.isValid) return;

  const form = new MessageFormData()
    .title(t(titleKey, titleVars))
    .body(t(bodyKey, bodyVars))
    .button1(t(confirmKey))
    .button2(t(cancelKey));

  const res = await form.show(player).catch(() => null);

  // ปิดฟอร์มด้วย X หรือกดปุ่มที่สอง = ยกเลิก
  if (!res || res.canceled || res.selection === 1) {
    NavigationManager.logEvent(player, "dialog-cancelled", titleKey);
    return onCancel ? onCancel() : NavigationManager.back(player);
  }

  NavigationManager.logEvent(player, "dialog-confirmed", titleKey);
  return onConfirm();
}

/* =========================
   ICON CONFIRM DIALOG
   MessageFormData (ที่ showConfirm() ใช้) ไม่รองรับ icon บนปุ่มเลย —
   ตาม API ของ Bedrock icon บนปุ่มมีแค่ ActionFormData เท่านั้น ฟังก์ชันนี้
   เลยสร้างหน้าจอยืนยันแบบเดียวกัน (title/body/ปุ่มยืนยัน+ยกเลิก, ปิดฟอร์ม
   หรือกดปุ่มที่สอง = ยกเลิก) แต่ใช้ ActionFormData แทน เพื่อให้ปุ่มยืนยัน
   ใส่ icon ของไอเทม/เอฟเฟกต์ที่กำลังซื้อ-โอนได้ — ใช้เฉพาะจุดที่ต้องการ
   โชว์ icon กำกับ (คำสั่งซื้อ/ขาย/โอนเงิน) จุดอื่นที่ไม่ต้องการ icon ยังใช้
   showConfirm() เดิมได้ตามปกติ
========================= */

/**
 * @param {{
 *   player: import("@minecraft/server").Player,
 *   titleKey: string, titleVars?: object,
 *   bodyKey: string, bodyVars?: object,
 *   confirmKey?: string, cancelKey?: string,
 *   confirmIcon?: string,
 *   onConfirm: () => void,
 *   onCancel?: () => void
 * }} opts
 */
export const showIconConfirm = safeAsync(async (opts) => {
  const {
    player,
    titleKey, titleVars, bodyKey, bodyVars,
    confirmKey = CONFIRM_DIALOG_DEFAULTS.confirmKey, cancelKey = CONFIRM_DIALOG_DEFAULTS.cancelKey,
    confirmIcon,
    onConfirm, onCancel
  } = opts;

  if (!player?.isValid) return;

  const form = new ActionFormData()
    .title(t(titleKey, titleVars))
    .body(t(bodyKey, bodyVars))
    .button(t(confirmKey), confirmIcon)
    .button(t(cancelKey), ICONS.back);

  const res = await form.show(player).catch(() => null);

  // ปิดฟอร์มด้วย X หรือกดปุ่มที่สอง (ยกเลิก) = ยกเลิก — พฤติกรรมเดียวกับ
  // showConfirm() ทุกประการ
  if (!res || res.canceled || res.selection === 1) {
    NavigationManager.logEvent(player, "dialog-cancelled", titleKey);
    return onCancel ? onCancel() : NavigationManager.back(player);
  }

  NavigationManager.logEvent(player, "dialog-confirmed", titleKey);
  return onConfirm();
}
