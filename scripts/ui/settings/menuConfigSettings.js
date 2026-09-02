// =========================
// menuConfigSettings.js
// หน้า Admin: เปิด/ปิดปุ่มเมนูแบบ "ทั้งเซิร์ฟเวอร์" (ทุกคนเห็นผลเหมือนกัน)
// — ต่างจาก ui/settings/uiSettings.js ที่เป็นการจัด "ลำดับ" เมนูหลักส่วนตัว
// ต่อผู้เล่นคนเดียว เข้าถึงหน้านี้ได้จากปุ่ม "จัดการเมนู" ในหน้า Admin
// (adminUi.js) เท่านั้น — ค่าที่ตั้งเก็บที่ core/menuVisibility.js (world
// Dynamic Property) และรายการกลุ่ม/ปุ่มทั้งหมดมาจาก config/menuToggleConfig.js
//
// โครงสร้างหน้าจอ: เลือกกลุ่มเมนู (main / เมนูซื้อขาย / หมวดหมู่ร้านซื้อของ /
// เมนู Admin ฯลฯ) -> ฟอร์ม toggle ของทุกปุ่มในกลุ่มนั้นในหน้าเดียว (เหมือน
// action bar settings ใน uiSettings.js) -> "ยืนยัน" บันทึกทั้งกลุ่มทีเดียว
// =========================

import { createListMenu, createTogglesPrompt } from "../framework/UIFramework";
import { NavigationManager } from "../framework/NavigationManager";
import { t } from "../locale/index";
import { showSuccess } from "../../core/messageUtils";
import { MENU_TOGGLE_GROUPS } from "../../config/menuToggleConfig";
import { getGroupVisibility, saveGroupVisibility } from "../../core/menuVisibility";

/**
 * เปิดหน้าจัดการเมนู (รายการกลุ่มเมนูทั้งหมด) — เรียกจาก adminUi.js
 * (ผู้เรียกต้อง NavigationManager.push(...) ของตัวเองก่อนเสมอ เหมือน
 * โมดูลอื่นที่ migrate มาแล้วทั้งหมด)
 * @param {import("@minecraft/server").Player} player
 */
export function openMenuConfigSettings(player) {
  if (!player?.isValid) return;
  return showGroupList(player);
}

function showGroupList(player) {
  if (!player?.isValid) return;

  const items = MENU_TOGGLE_GROUPS.map((group) => ({ id: group.id, labelKey: group.labelKey }));

  return createListMenu(player, {
    titleKey: "menuConfig.groupsTitle",
    bodyKey: "menuConfig.groupsBody",
    items,
    onSelect: (item) => {
      const group = MENU_TOGGLE_GROUPS.find((g) => g.id === item.id);
      if (!group) return showGroupList(player);

      NavigationManager.push(player, () => showGroupList(player));
      return showGroupToggles(player, group);
    }
  });
}

function showGroupToggles(player, group) {
  if (!player?.isValid) return;

  const itemIds = group.items.map((i) => i.id);
  const current = getGroupVisibility(group.id, itemIds);

  return createTogglesPrompt(player, {
    titleKey: group.labelKey,
    toggles: group.items.map((item) => ({
      labelKey: item.labelKey,
      defaultValue: current[item.id]
    })),
    onSubmit: (values) => {
      const next = {};
      group.items.forEach((item, index) => {
        next[item.id] = values[index];
      });
      saveGroupVisibility(group.id, next);
      showSuccess(player, t("menuConfig.saveSuccess"));
      // กลับไปหน้ารายการกลุ่ม (ที่ push ไว้ใน showGroupList) เหมือนหน้า
      // action bar settings ใน uiSettings.js
      return NavigationManager.back(player);
    }
    // ไม่ได้ระบุ onCancel — ปิดฟอร์ม/กด X ใช้ default ของ
    // createTogglesPrompt (NavigationManager.back(player)) กลับไปหน้า
    // รายการกลุ่มเฉย ๆ โดยไม่บันทึกอะไรเปลี่ยนแปลง
  });
}
