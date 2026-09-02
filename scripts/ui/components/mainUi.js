import { world, system, Player } from '@minecraft/server';

import { AutoCollector } from '../../systems/autoCollect';
import { OreScanner } from '../../systems/oreScanner';
import { openSellMenu, openBuyCategoryPicker } from "../../systems/shopSystem";
import { openShopMenu } from "../../systems/shopEffect";
import { AdminUI } from "./adminUi";
import { inv } from "./inventoryUi";
import { openTransferUI } from "../../systems/economy";
import { openTpUI } from "../../systems/tpBankSystem";
import { openHomeUI } from "../../systems/homeSystem";
import { openMarketUI } from "./marketUi";
import { openJobUI } from "../../systems/jobSystem";
import { openQuestUI } from "../../systems/questSystem";
import { openStatUI } from "../../systems/statSystem";
import { openAffinityUI } from "../../systems/affinitySystem";
import { openMoneyScoreboardUI } from "./moneyScoreboardUi";
import { createListMenu } from "../framework/UIFramework";
import { NavigationManager } from "../framework/NavigationManager";
import { isAdmin } from "../../core/playerUtils";
import { MENU_BOOK_ITEM_ID, MENU_BOOK_NAME_TAG } from "../../core/constants";
import { hasConfiguredSettings, getOrderedMainMenuItems, openUISettings } from "../settings/uiSettings";
import { ICONS, SHOP_MENU_ITEMS } from "../../config/uiConfig";
import { filterEnabledItems } from "../../core/menuVisibility";

// =========================
// === MIGRATED to scripts/ui/ framework ===
// เมนูที่ไฟล์นี้วาดเอง (main menu, shopping menu) ผ่าน UIFramework.js /
// NavigationManager.js / t() แล้ว — ไฟล์นี้ไม่สร้าง ActionFormData ตรง ๆ
// อีกต่อไป
//
// ช่วงเปลี่ยนผ่าน (สำคัญ ถ้าจะแก้โค้ดส่วนนี้):
// โมดูลปลายทางทุกตัว migrate มาใช้ NavigationManager แล้ว (shopSystem.js,
// playerMarket.js, shopEffect.js, economy.js, tpBankSystem.js, adminUi.js,
// inventoryUi.js, autoCollect.js) — เรียกโมดูลไหนก็ตาม ต้อง
// NavigationManager.push(...) ตัวเองก่อนเสมอ ไม่งั้นปุ่ม "กลับ"/X ฝั่งนั้น
// จะ close ทั้งหมดแทนที่จะกลับมาที่นี่
//
// autoCollect.js เป็นกรณีพิเศษ: หน้านั้นเป็นฟอร์มโมดัลเดียวจบ ไม่มี
// "หน้าจอ" ย่อยให้เดินต่อ แต่ก็ยัง push เหมือนโมดูลอื่นเพื่อให้ "บันทึก"
// สำเร็จย้อนกลับมาเมนูหลักได้ — ส่วนกด X ยกเลิกฟอร์ม ไฟล์นั้นกำหนด
// onCancel เอง (NavigationManager.close() ตรง ๆ) เพื่อให้ยกเลิก = ปิดเมนู
// ทั้งหมดทันที ตรงกับพฤติกรรมเดิมก่อน migrate ทุกประการ (ดูหมายเหตุใน
// autoCollect.js)
// =========================

const MainMenu = function () {
  this.uiOpenMap = new Map();
  this.autoCollector = new AutoCollector();
  // oreScanner: instance เดียวเหมือน autoCollector — สร้าง/initialize()
  // ที่นี่จุดเดียว แล้วส่งให้ AdminUI ใช้เรียก showSettingsForm() เท่านั้น
  // (เมนู admin-only จาก MAIN_MENU_ITEMS.admin.adminOnly คุมสิทธิ์ให้แล้ว)
  this.oreScanner = new OreScanner();
  this.adminUI = new AdminUI(this.uiOpenMap, this.oreScanner);
  this.invUI = new inv(this.uiOpenMap); // [OK] เพิ่ม

  // =========================
  //   ADMIN CHECK
  //   ย้ายไปอยู่ที่ playerUtils.js แล้ว (isAdmin ที่นี่ delegate ไปตัวกลาง
  //   ให้ยังเรียก self.isAdmin(player) ได้เหมือนเดิมทุกจุด)
  // =========================
  this.isAdmin = isAdmin;

  this.initialize = function () {
    this.autoCollector.initialize();
    this.oreScanner.initialize();
    this.listenForMenuItemUse();
    console.warn('[MainUi] MainMenu initialized');
  };

  this.listenForMenuItemUse = function () {
    const self = this;
    world.beforeEvents.itemUse.subscribe(event => {
      const { itemStack, source } = event;

      if (
        source instanceof Player &&
        source.isValid &&
        itemStack?.typeId === MENU_BOOK_ITEM_ID &&
        itemStack.nameTag === MENU_BOOK_NAME_TAG &&
        // key ด้วย player.id — id เสถียรตลอดการเชื่อมต่อ ส่วน name เปลี่ยนได้
        // (กฎใน CONTRIBUTING.md: "คีย์ด้วย player.id เสมอ ห้ามใช้ player.name")
        !self.uiOpenMap.get(source.id)
      ) {
        event.cancel = true;
        self.uiOpenMap.set(source.id, true);
        system.run(() => {
          self.openUI(source);
        });
      }
    });
  };

  // -------------------------
  //   ENTRY POINT (เช็ค UI Settings ก่อนเข้าเมนูหลัก)
  //   ผู้เล่นที่ยังไม่เคยบันทึกลำดับเมนู (per-player Dynamic Property)
  //   ต้องจัดลำดับเมนูก่อน ถึงจะเข้าเมนูหลักได้ — เช็คทุกครั้งที่เปิด UI
  //   (ไม่ใช่แค่ครั้งแรกที่ world โหลด) เพราะ Dynamic Property ผูกกับ
  //   ผู้เล่นแต่ละคน ไม่ใช่ session
  // -------------------------
  this.openUI = function (player) {
    const self2 = this;
    if (!player?.isValid) return self2.resetUIState(player);

    // ลงทะเบียนไว้ทุกครั้งที่เปิดเมนู — ให้แน่ใจว่า uiOpenMap ถูกเคลียร์
    // เสมอเมื่อเมนูทั้งหมดปิดจริง (NavigationManager.close()) ไม่ว่าจะปิด
    // จากทางไหน (ปุ่ม "ออกเมนู", ปุ่ม "กลับ" ที่สแตกว่างพอดี, ทำรายการเสร็จ
    // ในระบบย่อยต่าง ๆ) — แก้ปัญหาเดิมที่พึ่งแค่ onCancel/onSelect ของ
    // showMainMenu() เอง ซึ่งปุ่ม "กลับ"/"ออกเมนู" ที่กดตรง ๆ บนเมนูราก
    // ไม่เคยผ่าน onCancel/onSelect เลย
    NavigationManager.setCloseHandler(player, () => self2.resetUIState(player));

    if (!hasConfiguredSettings(player)) {
      return openUISettings(player, {
        isFirstTime: true,
        onSaved: () => self2.showMainMenu(player),
        // ปิดฟอร์ม/กด "กลับ" ตอนบังคับตั้งค่าครั้งแรก = ยังไม่บันทึก จึงยัง
        // เข้าเมนูหลักไม่ได้ — แค่ปิด UI ไปเฉย ๆ (เปิดใหม่จะเจอหน้านี้อีก)
        onCancel: () => self2.resetUIState(player)
      });
    }

    return self2.showMainMenu(player);
  };

  // -------------------------
  //       MAIN MENU
  // -------------------------
  // -------------------------
  //   SUB-MENU OPEN HELPERS
  //   กฎของ framework: ก่อนเปิดหน้าจอย่อยต้อง NavigationManager.push(...)
  //   หน้าปัจจุบันก่อนเสมอ (ไม่งั้นปุ่ม "กลับ" ฝั่งหน้าย่อยจะ close ทั้งหมด
  //   แทนที่จะย้อนมาที่เมนูนี้) — เดิมแต่ละ case ใน onSelect เขียน push เอง
  //   ~10 จุด boilerplate ซ้ำ ๆ จึงรวมเป็น helper สองตัวนี้:
  //     openFromMainMenu  — กลับมาที่เมนูหลัก
  //     openFromShopMenu  — กลับมาที่เมนูการเงิน (showShoppingMenu)
  // -------------------------
  this.openFromMainMenu = (player, openFn) => {
    NavigationManager.push(player, () => this.showMainMenu(player));
    return openFn();
  };

  this.openFromShopMenu = (player, openFn) => {
    NavigationManager.push(player, () => this.showShoppingMenu(player));
    return openFn();
  };

  this.showMainMenu = function (player) {
    const self = this;
    if (!player?.isValid) return self.resetUIState(player);

    const hasAdmin = self.isAdmin(player);

    // ลำดับเมนู (ยกเว้น "ตั้งค่าเมนู") เรียงตาม UI Settings ส่วนตัวของ
    // ผู้เล่นคนนี้ — กรอง admin-only ออกอัตโนมัติถ้าไม่ใช่ admin จากนั้น
    // กรองรายการที่ Admin ปิดไว้จากหน้า "จัดการเมนู" (ทั้งเซิร์ฟเวอร์ —
    // ดู core/menuVisibility.js) ออกอีกชั้นหนึ่ง
    const ordered = getOrderedMainMenuItems(player, hasAdmin);
    const items = filterEnabledItems("main", ordered);
    // ปุ่ม "ตั้งค่าเมนู" ไม่ใช่ส่วนหนึ่งของลำดับที่จัดเรียงได้/เปิด-ปิดได้ —
    // อยู่ท้ายสุดเสมอ (ก่อนปุ่ม "กลับ" มาตรฐานของ framework)
    items.push({ id: "settings", labelKey: "main.settings", icon: ICONS.settings });

    return createListMenu(player, {
      titleKey: "main.title",
      bodyKey: "main.body",
      items,
      // เดิม: ปุ่ม "ปิด" แยกจาก X ของฟอร์ม — ตอนนี้ทั้งคู่ใช้พฤติกรรม
      // เดียวกันตามกฎ framework (ปุ่ม "กลับ" มาตรฐาน = ปิดเมนู เพราะนี่คือ
      // เมนูรากที่ไม่มีอะไรให้ "กลับ" ไปหาอีกแล้ว)
      onCancel: () => {
        self.resetUIState(player);
        return NavigationManager.close(player);
      },
      onSelect: (item) => {
        // เดิม: resetUIState ถูกเรียกทันทีที่ฟอร์ม resolve ก่อนเช็ค
        // selection ใด ๆ — ย้ายมาไว้ต้น onSelect/onCancel แทน (จังหวะ
        // เดียวกันในทางปฏิบัติ เพราะ UIFramework เรียกสองอย่างนี้ทันที
        // หลัง resolve เหมือนกัน)
        self.resetUIState(player);

        switch (item.id) {
          case "autoCollect":
            // autoCollect.js เป็นฟอร์มโมดัลใบเดียวจบ แต่ก็ push ไว้ก่อนเสมอ:
            // กด "บันทึก" สำเร็จ -> ย้อนกลับมาเมนูหลัก, กด X ยกเลิก ->
            // onCancel ของไฟล์นั้น close() ตรง ๆ = ปิดเมนูทั้งหมด (ตามพฤติกรรม
            // เดิมก่อน migrate)
            return self.openFromMainMenu(player, () => self.autoCollector.showToggleForm(player));

          case "finance":
            return self.showShoppingMenu(player);

          case "tp":
            return self.openFromMainMenu(player, () => openTpUI(player));

          case "home":
            return self.openFromMainMenu(player, () => openHomeUI(player));

          case "market":
            return self.openFromMainMenu(player, () => openMarketUI(player));

          case "job":
            return self.openFromMainMenu(player, () => openJobUI(player));

          case "quest":
            return self.openFromMainMenu(player, () => openQuestUI(player));

          case "stats":
            return self.openFromMainMenu(player, () => openStatUI(player));

          case "affinity":
            return self.openFromMainMenu(player, () => openAffinityUI(player));

          case "scoreboard":
            return self.openFromMainMenu(player, () => openMoneyScoreboardUI(player));

          case "admin":
            return self.openFromMainMenu(player, () => self.adminUI.showMainMenu(player));

          case "checkPlayer":
            return self.openFromMainMenu(player, () => self.invUI.showMainMenu(player));

          case "settings":
            // uiSettings.js ไม่ push สแตกของตัวเอง (แค่วาดหน้าจอเดิมใหม่ตอน
            // เลื่อนขึ้น/ลง) — push ที่นี่แล้วกลับด้วย NavigationManager.back()
            return self.openFromMainMenu(player, () =>
              openUISettings(player, {
                onSaved: () => NavigationManager.back(player),
                onCancel: () => NavigationManager.back(player)
              })
            );
        }
      }
    }).catch(() => self.resetUIState(player));
  };

  // -------------------------
  //    SHOP MENU ONLY
  // -------------------------
  this.showShoppingMenu = function (player) {
    const self = this;
    if (!player?.isValid) return;

    // ปุ่มทั้งหมดของหน้านี้ย้ายไปอยู่ config/uiConfig.js (SHOP_MENU_ITEMS)
    // แล้ว — กรองรายการที่ถูกปิดไว้จากหน้า "จัดการเมนู" ของ Admin ออกก่อน
    // แสดงผล (ทั้งเซิร์ฟเวอร์ ดู core/menuVisibility.js)
    const items = filterEnabledItems("shopMenu", SHOP_MENU_ITEMS);

    return createListMenu(player, {
      titleKey: "shop.title",
      bodyKey: "shop.body",
      items,
      // เมนูนี้ไม่เคยถูก push เข้า NavigationManager ตอนเข้ามา (showMainMenu
      // เรียกตรง ๆ) เพราะงั้น "กลับ" ก็เรียก showMainMenu ตรง ๆ เหมือนกัน
      // ไม่ใช้ NavigationManager.back()
      onCancel: () => self.showMainMenu(player),
      onSelect: (item) => {
        switch (item.id) {
          case "transfer":
            return self.openFromShopMenu(player, () => openTransferUI(player));

          case "buy":
            return self.openFromShopMenu(player, () => openBuyCategoryPicker(player));

          case "sell":
            return self.openFromShopMenu(player, () => openSellMenu(player));

          case "effectShop":
            return self.openFromShopMenu(player, () => openShopMenu(player));
        }
      }
    }).catch(() => self.resetUIState(player));
  };

  // -------------------------
  //     UI STATE RESET
  // -------------------------
  this.resetUIState = function (player) {
    if (player?.id) this.uiOpenMap.delete(player.id);
  };
};

globalThis.mainMenu = new MainMenu();
globalThis.mainMenu.initialize();

// Accessor กลางสำหรับคำสั่ง/โมดูลอื่นที่ต้องเรียกเข้าเมนูหลัก — คืน instance
// จริงหรือ null ถ้ายังไม่ initialize (ผู้เรียกต้อง guard ก่อนใช้ เพราะ
// globalThis.mainMenu ถูกสร้างตอนโหลดโมดูล mainUi.js ซึ่งอาจยังไม่เกิดใน
// บางลำดับการ import)
export function getMainMenu() {
  return globalThis.mainMenu ?? null;
}
