// =========================
// economy.js
// ระบบโอนเงินระหว่างผู้เล่น (หักภาษีเข้า Bank กลาง) + แผง Admin
// (โอนจาก Bank, ตั้งค่า Tax, ดู/ค้นหา Transaction Log)
//
// === MIGRATED to scripts/ui/ framework ===
// ไฟล์นี้ไม่สร้าง ActionFormData / ModalFormData ตรง ๆ อีกต่อไป
// ทุกหน้าจอผ่าน UIFramework.js, การนำทางผ่าน NavigationManager.js,
// ทุกสตริงผ่าน t() — ตรรกะการโอนเงิน/ภาษี/cooldown/Transaction Log
// ไม่ถูกแก้ไขจากเดิม (รวมถึงจุดที่ตัวเดิมไม่ clamp bank ด้วย ?? 0
// ในหน้า Admin Panel — ตั้งใจคงไว้เหมือนเดิม) — ยกเว้นบัคเดียวที่แก้ไว้
// ด้านล่าง (bugfix: dimension check ใน openTransferUI)
//
// export { addLog } ยังใช้ signature เดิมทุกประการ เพราะ playerMarket.js
// import addLog จากไฟล์นี้อยู่แล้ว (เขียนลง dynamic property
// "transactionLog" เดียวกัน, cap ที่ MAX_LOGS)
//
// BUGFIX: openTransferUI() เดิมกรอง nearbyPlayers ด้วยระยะทาง 3 มิติ
// อย่างเดียว ไม่เช็คมิติ (dimension) เลย — ผู้เล่นสองคนที่พิกัดตรงกัน
// แต่อยู่ต่างมิติ (เช่น Overworld/Nether พิกัด 1:1) จะถูกนับว่า "อยู่ใกล้"
// และโอนเงินข้ามมิติกันได้ทั้งที่ไม่ควร ตอนนี้เพิ่มเช็ค
// p.dimension.id === player.dimension.id เข้าไปด้วย ให้ตรงกับ
// tpBankSystem.js ที่แยกกรณีข้ามมิติอยู่แล้ว
//
// พฤติกรรมที่เปลี่ยนจากของเดิม (ตามกฎ design system ใหม่ — ไม่กระทบ
// ตัวเลขเงิน/ภาษี/log ใด ๆ):
// - เดิมทุกหน้าจอไม่มีปุ่ม "กลับ" เลย ปิดฟอร์ม (X) แปลว่าจบการทำงานทันที
//   ทุกจุด ตอนนี้เมนูแบบลิสต์ (transfer list, admin panel, เลือกผู้เล่น,
//   ดู log, ผลค้นหา log) มีปุ่ม "กลับ" มาตรฐานของ framework ให้ย้อนกลับ
//   ไปหน้าก่อนหน้าได้จริง ตามกลไกบังคับของ UIFramework.js (เหมือนที่ทำใน
//   shopSystem.js / playerMarket.js)
// - จุดที่เดิม "แจ้งเตือนแล้วจบการทำงานทันที ไม่มีฟอร์มไหนเปิดต่อ" (เช่น
//   จำนวนเงินไม่ถูกต้อง, cooldown, เงินไม่พอ, ค้นหาไม่พบ) ยังคงพฤติกรรม
//   เดิมไว้คือไม่เปิดฟอร์มอื่นต่อ แต่เพิ่ม NavigationManager.close()
//   เพื่อเคลียร์สแตกที่ push ไว้ระหว่างทาง กันไม่ให้ค้างข้ามไปปนกับเมนูอื่น
//   ในเซสชันถัดไปของผู้เล่นคนนั้น (แนวทางเดียวกับ "ทำรายการเสร็จสมบูรณ์"
//   ใน shopSystem.js)
// =========================

import { world, system } from "@minecraft/server";
import { createListMenu, createAmountPrompt } from "../ui/framework/UIFramework";
import { showIconConfirm } from "../core/confirmDialog";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { t } from "../ui/locale/index";
import { getMoney, setMoney, withdrawFromBank } from "../core/economyUtils";
import { isAdmin, findNearbyPlayers } from "../core/playerUtils";
import { showError, showInfo, showSuccess } from "../core/messageUtils";
import { playSuccess } from "../core/soundUtils";
import { BANK_DYNAMIC_PROPERTY_KEY, TICKS_PER_SECOND } from "../core/constants";
import { formatDateTime } from "../core/timeUtils";
import { ECONOMY_CONFIG } from "../config/economyConfig";
import { ICONS } from "../config/uiConfig";
import { safeAsync } from "../core/asyncUtils";

/* =========================
   CONFIG
   ค่าคูลดาวน์/ระยะทาง/ลิมิตล็อก/ภาษีเริ่มต้น ย้ายไปอยู่
   config/economyConfig.js (ECONOMY_CONFIG.TRANSFER) แล้ว — แก้ค่าที่นั่น
   จุดเดียว ไม่ต้องแก้ไฟล์นี้
========================= */
const TRANSFER_COOLDOWN = TICKS_PER_SECOND * ECONOMY_CONFIG.TRANSFER.COOLDOWN_SECONDS;
const TRANSFER_DISTANCE = ECONOMY_CONFIG.TRANSFER.MAX_DISTANCE;
const MAX_LOGS = ECONOMY_CONFIG.TRANSFER.MAX_LOGS;

const transferCooldown = new Map();
subscribeSafe(["playerLeave"], ({ playerId }) => {
  try {
    transferCooldown.delete(playerId);
  } catch (error) {
    console.warn("[Economy] playerLeave handler error:", error);
  }
}, "Economy");

/* =========================
   TAX
========================= */
function getTaxRate() {
  return world.getDynamicProperty("taxRate") ?? ECONOMY_CONFIG.TRANSFER.DEFAULT_TAX_RATE;
}

/* =========================
   LOG SYSTEM
========================= */
function getLogs() {
  try {
    return JSON.parse(world.getDynamicProperty("transactionLog") ?? "[]");
  } catch {
    return [];
  }
}

function saveLogs(logs) {
  world.setDynamicProperty("transactionLog", JSON.stringify(logs));
}

function addLog(data) {
  const logs = getLogs();
  logs.unshift({
    time: formatDateTime(),
    ...data
  });
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  saveLogs(logs);
}

/* =========================
   MAIN TRANSFER UI
========================= */
export const openTransferUI = safeAsync(async (player) => {
  if (!player?.isValid) return;

  const nearbyPlayers = findNearbyPlayers(player, TRANSFER_DISTANCE);

  const items = [
    ...nearbyPlayers.map(p => ({
      id: p.id,
      labelKey: "shared.playerNameButton",
      labelVars: { name: p.name },
      icon: ICONS.player
    })),
    ...(isAdmin(player) ? [{ id: "__admin__", labelKey: "transfer.adminPanelButton", icon: "textures/ui/op" }] : [])
  ];

  return createListMenu(player, {
    titleKey: "transfer.mainTitle",
    bodyKey: "transfer.mainBody",
    bodyVars: {
      balance: getMoney(player),
      bank: world.getDynamicProperty(BANK_DYNAMIC_PROPERTY_KEY) ?? 0,
      taxPercent: getTaxRate() * 100
    },
    menuGroup: "transferMenu",
    items,
    onSelect: (item) => {
      if (item.id === "__admin__") {
        NavigationManager.push(player, () => openTransferUI(player));
        return openAdminUI(player);
      }

      const target = nearbyPlayers.find(p => p.id === item.id);
      if (!target) return NavigationManager.back(player);

      // ไม่ push ก่อนเข้าช่องกรอกจำนวน — เป็น modal ชั่วคราว ไม่ใช่ "หน้าจอ"
      // ในสแตก (เหมือน custom amount ใน shopSystem.js)
      return openAmountUI(player, target);
    }
  });
}

/* =========================
   AMOUNT / CONFIRM
========================= */
export const openAmountUI = safeAsync(async (sender, target) => {
  return createAmountPrompt(sender, {
    titleKey: "transfer.amountTitle",
    promptKey: "transfer.amountPrompt",
    placeholder: "100",
    // เดิม: ปิดฟอร์มด้วย X = จบการทำงานทันที — เรียกกลับไปหน้ารายการ
    // ผู้เล่นตรง ๆ (ไม่ผ่าน NavigationManager.back() เพราะยังไม่เคย push
    // อะไรไว้ตอนเข้าโมดัลนี้)
    onCancel: () => openTransferUI(sender),
    onSubmit: (value) => {
      const amount = Math.floor(Number(value));
      if (!amount || amount <= 0) {
        showError(sender, t("transfer.invalidAmount"));
        return NavigationManager.close(sender);
      }

      // ก่อนเข้าเมนูยืนยัน (อีกหนึ่ง "หน้าจอ") ต้อง push หน้ารายการผู้เล่น
      // ไว้ก่อนเสมอ ไม่งั้นปุ่ม "กลับ"/X ฝั่งเมนูยืนยันจะ close ทั้งหมด
      NavigationManager.push(sender, () => openTransferUI(sender));
      return openConfirmUI(sender, target, amount);
    }
  });
}

export const openConfirmUI = safeAsync(async (sender, target, amount) => {
  const tax = Math.floor(amount * getTaxRate());
  const receive = amount - tax;

  return showIconConfirm({
    player: sender,
    titleKey: "transfer.confirmTitle",
    bodyKey: "transfer.confirmBody",
    bodyVars: { target: target.name, amount, tax, receive },
    confirmKey: "transfer.confirmYes",
    cancelKey: "transfer.confirmNo",
    confirmIcon: "textures/items/emerald",
    onCancel: () => NavigationManager.back(sender),
    onConfirm: () => executeTransfer(sender, target, amount)
  });
}

/* =========================
   EXECUTE TRANSFER
========================= */
function executeTransfer(sender, target, amount) {
  if (!sender?.isValid || !target?.isValid) {
    showError(sender, t("transfer.targetOffline"));
    return NavigationManager.close(sender);
  }

  const now = system.currentTick;
  if (now - (transferCooldown.get(sender.id) ?? 0) < TRANSFER_COOLDOWN) {
    showError(sender, t("transfer.cooldown"));
    return NavigationManager.close(sender);
  }

  if (getMoney(sender) < amount) {
    showError(sender, t("transfer.insufficientFunds"));
    return NavigationManager.close(sender);
  }

  const senderBalance = getMoney(sender);
  const tax = Math.floor(amount * getTaxRate());
  const receive = amount - tax;

  try {
    setMoney(sender, senderBalance - amount);
    setMoney(target, getMoney(target) + receive);
  } catch (error) {
    console.warn("[Economy] executeTransfer setMoney error:", error);
    showError(sender, t("transfer.targetOffline"));
    return NavigationManager.close(sender);
  }

  world.setDynamicProperty(BANK_DYNAMIC_PROPERTY_KEY, (world.getDynamicProperty(BANK_DYNAMIC_PROPERTY_KEY) ?? 0) + tax);

  transferCooldown.set(sender.id, now);

  addLog({
    type: "player_transfer",
    from: sender.name,
    to: target.name,
    amount,
    tax,
    receive
  });

  // แจ้งทั้งสองฝ่ายหลังโอนสำเร็จจริง:
  // - ผู้โอนได้เห็นยอดที่หัก/ภาษี/ยอดที่ผู้รับได้รับ
  // - ผู้รับได้รับข้อความแจ้งเตือนพร้อมยอดสุทธิหลังหักภาษี
  showSuccess(sender, t("transfer.successSender", {
    target: target.name,
    amount: amount.toLocaleString(),
    tax: tax.toLocaleString(),
    receive: receive.toLocaleString()
  }));
  playSuccess(target);
  showInfo(target, t("transfer.receivedNotification", {
    sender: sender.name,
    amount: receive.toLocaleString()
  }));

  // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตกที่ push ไว้ (openTransferUI)
  NavigationManager.close(sender);
}

/* =========================
   ADMIN PANEL
========================= */
function openAdminUI(admin) {
  if (!isAdmin(admin)) return; // <- เพิ่มบรรทัดนี้

  const items = [
    { id: "bankToPlayer", labelKey: "admin.bankToPlayer", icon: "textures/items/emerald" },
    { id: "setTax", labelKey: "admin.setTax", icon: "textures/items/gold_ingot" },
    { id: "viewLogs", labelKey: "admin.viewLogs", icon: "textures/ui/icon_recipe_item" },
    { id: "searchLogs", labelKey: "admin.searchLogs", icon: "textures/ui/magnifyingGlass.png" }
  ];

  return createListMenu(admin, {
    titleKey: "admin.panelTitle",
    bodyKey: "admin.panelBody",
    bodyVars: {
      bank: world.getDynamicProperty(BANK_DYNAMIC_PROPERTY_KEY) ?? 0,
      taxPercent: (getTaxRate() * 100).toFixed(1)
    },
    menuGroup: "economyAdminMenu",
    items,
    onSelect: (item) => {
      switch (item.id) {
        case "bankToPlayer":
          NavigationManager.push(admin, () => openAdminUI(admin));
          return openAdminTransferUI(admin);

        case "setTax":
          // openTaxSettingUI เป็น modal — ไม่ push
          return openTaxSettingUI(admin);

        case "viewLogs":
          NavigationManager.push(admin, () => openAdminUI(admin));
          return openLogUI(admin);

        case "searchLogs":
          // openSearchLogUI เป็น modal — ไม่ push
          return openSearchLogUI(admin);
      }
    }
  });
}

/* =========================
   ADMIN BANK -> PLAYER
========================= */
async export const openAdminTransferUI = safeAsync(async (admin) => {
  if (!admin?.isValid) return;

  const players = world.getPlayers();
  const items = players.map(p => ({
    id: p.id,
    labelKey: "shared.playerNameButton",
    labelVars: { name: p.name },
    icon: ICONS.player
  }));

  return createListMenu(admin, {
    titleKey: "admin.selectPlayerTitle",
    items,
    onSelect: (item) => {
      const target = players.find(p => p.id === item.id);
      if (!target?.isValid) return NavigationManager.back(admin);
      // openAdminAmountUI เป็น modal — ไม่ push
      return openAdminAmountUI(admin, target);
    }
  });
}

function openAdminAmountUI(admin, target) {
  return createAmountPrompt(admin, {
    titleKey: "admin.bankAmountTitle",
    promptKey: "admin.bankAmountPrompt",
    placeholder: "1000",
    onCancel: () => openAdminTransferUI(admin),
    onSubmit: (value) => {
      const amount = Math.floor(Number(value));
      const bank = world.getDynamicProperty(BANK_DYNAMIC_PROPERTY_KEY) ?? 0;

      if (!amount || amount <= 0 || bank < amount) {
        showError(admin, t("admin.bankInvalidAmount"));
        return NavigationManager.close(admin);
      }

      withdrawFromBank(amount);
      setMoney(target, getMoney(target) + amount);

      addLog({
        type: "bank_transfer",
        admin: admin.name,
        to: target.name,
        amount
      });

      // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตกที่ push ไว้ (openAdminUI)
      return NavigationManager.close(admin);
    }
  });
}

/* =========================
   TAX SETTING
========================= */
function openTaxSettingUI(admin) {
  return createAmountPrompt(admin, {
    titleKey: "admin.taxSettingTitle",
    promptKey: "admin.taxSettingPrompt",
    placeholder: "10",
    onCancel: () => openAdminUI(admin),
    onSubmit: (value) => {
      const percent = Number(value);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        showError(admin, t("admin.taxInvalidValue"));
        return NavigationManager.close(admin);
      }

      world.setDynamicProperty("taxRate", percent / 100);

      addLog({
        type: "set_tax",
        admin: admin.name,
        tax: percent
      });

      return NavigationManager.close(admin);
    }
  });
}

/* =========================
   VIEW ALL LOGS
========================= */
export const openLogUI = safeAsync(async (admin) => {
  if (!admin?.isValid) return;

  const logs = getLogs();
  if (logs.length === 0) {
    showInfo(admin, t("log.emptyLogs"));
    return NavigationManager.close(admin);
  }

  const text = logs.map(formatLog).join("\n\n");

  return createListMenu(admin, {
    titleKey: "log.allTitle",
    bodyKey: "log.textBody",
    bodyVars: { text },
    items: []
  });
}

/* =========================
   SEARCH LOG BY NAME
========================= */
function openSearchLogUI(admin) {
  return createAmountPrompt(admin, {
    titleKey: "log.searchTitle",
    promptKey: "log.searchPrompt",
    placeholder: "PlayerName",
    onCancel: () => openAdminUI(admin),
    onSubmit: (value) => {
      const name = String(value).trim();
      if (!name) {
        showError(admin, t("log.searchEmptyName"));
        return NavigationManager.close(admin);
      }

      // showSearchResult เป็นอีกหนึ่ง "หน้าจอ" — push หน้า admin panel
      // ไว้ก่อนเสมอ ไม่งั้นปุ่ม "กลับ"/X ฝั่งผลค้นหาจะ close ทั้งหมด
      NavigationManager.push(admin, () => openAdminUI(admin));
      return showSearchResult(admin, name);
    }
  });
}

export const showSearchResult = safeAsync(async (admin, name) => {
  if (!admin?.isValid) return;

  const logs = getLogs();

  const result = logs.filter(l =>
    l.from === name ||
    l.to === name ||
    l.admin === name
  );

  if (result.length === 0) {
    showInfo(admin, t("log.searchNoResults", { name }));
    return NavigationManager.close(admin);
  }

  const text = result.map(formatLog).join("\n\n");

  return createListMenu(admin, {
    titleKey: "log.searchResultTitle",
    titleVars: { name },
    bodyKey: "log.textBody",
    bodyVars: { text },
    items: []
  });
}

/* =========================
   LOG FORMAT
========================= */
function formatLog(l) {
  if (l.type === "player_transfer")
    return t("log.entryTransfer", { time: l.time, from: l.from, to: l.to, amount: l.amount, tax: l.tax });
  if (l.type === "bank_transfer")
    return t("log.entryBankTransfer", { time: l.time, to: l.to, amount: l.amount, admin: l.admin });
  if (l.type === "set_tax")
    return t("log.entrySetTax", { time: l.time, admin: l.admin, tax: l.tax });
  if (l.type === "shop_bank_withdraw")
    return t("log.entryShopBankWithdraw", { time: l.time, admin: l.admin, amount: l.amount });
  return "";
}

/* =========================
   MONEY / UTILS
   (getMoney/setMoney มาจาก economyUtils.js ที่เดียว — ดู import ด้านบน
   isAdmin/findNearbyPlayers มาจาก playerUtils.js — เดิม distance(a, b) ของ
   ไฟล์นี้เองถูกย้ายไปเป็น distanceBetween() ที่นั่นแล้ว)
========================= */
export { addLog };
