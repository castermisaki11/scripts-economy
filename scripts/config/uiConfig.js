// =========================
// uiConfig.js
// ค่าคงที่ของ Design System / UI defaults ทั้งหมด — จุดเดียวที่ควรแก้เมื่อ
// ต้องการเปลี่ยนขนาดหน้า, ไอคอน, สีของสถานะ, ลำดับเมนูหลักเริ่มต้น,
// ปุ่มยืนยัน/ยกเลิกเริ่มต้น หรือเปิด/ปิดเสียง UI
//
// ย้ายมาจาก:
//   - PAGE_SIZE / ICONS / COLORS / TELEMETRY: เดิมอยู่ที่ ui/config.js
//   - MAIN_MENU_ITEMS: เดิม hardcode อยู่ใน ui/settings/uiSettings.js
//   - SOUND: เดิม hardcode (ไม่มีสวิตช์เปิด/ปิด) อยู่ใน core/soundUtils.js
//   - CONFIRM_DIALOG_DEFAULTS: เดิม hardcode อยู่ใน core/confirmDialog.js
// =========================

// จำนวนรายการต่อหน้าในเมนูแบบแบ่งหน้า
export const PAGE_SIZE = 10;

// ไอคอนมาตรฐานของ UI framework
export const ICONS = {
  back: "textures/ui/cancel",
  close: "textures/ui/cancel",
  // ปุ่ม "ออกเมนู" (ปิดทั้งสแตกเมนูทันที) — ต่างจาก back ตรงที่ back
  // ย้อนกลับแค่หน้าเดียว แต่ปุ่มนี้ปิดทุกอย่างทีเดียว ใช้ไอคอนคนละอันกับ
  // back ให้แยกออกจากกันชัดเจนบนหน้าจอ
  exit: "textures/blocks/barrier",
  prevPage: "textures/ui/arrow_left",
  nextPage: "textures/ui/arrow_right",
  // ไอคอนใช้ซ้ำหลายไฟล์ — รวมไว้ที่นี่จุดเดียวแทนการ hardcode พาธซ้ำในทุก
  // เมนูที่ต้อง "เลือกผู้เล่นจากรายชื่อ" (adminUi.js / inventoryUi.js / economy.js)
  // หรือปุ่ม "บันทึก" (uiSettings.js)
  player: "textures/ui/multiplayer_glyph_color",
  save: "textures/ui/confirm",
  // ปุ่ม "ตั้งค่าเมนู" ในเมนูหลัก (mainUi.js) — ไม่ได้อยู่ใน MAIN_MENU_ITEMS
  // เพราะไม่ใช่รายการที่จัดลำดับได้ (อยู่ท้ายสุดตายตัวเสมอ) เดิมไม่มีไอคอน
  // กำกับเลย ต่างจากปุ่มอื่นทุกปุ่มในเมนูหลักที่มีไอคอนหมด
  settings: "textures/ui/settings_glyph_color_2x",
  // ปุ่ม "ตั้งค่า Action Bar" ในหน้าตั้งค่าเมนู (uiSettings.js) — ใช้ไอคอน
  // เฟืองเดียวกับปุ่ม "ตั้งค่าเมนู" เพราะสื่อถึงการตั้งค่าเช่นกัน
  actionBar: "textures/ui/settings_glyph_color_2x",
  // section 8-10: สถานะที่สื่อด้วยสีต้องมีไอคอนกำกับเสมอ ห้ามใช้สีอย่างเดียว
  status: {
    success: "[OK]",
    error: "[X]",
    warning: "[!]"
  }
};

// รหัสสีมาตรฐาน (Minecraft formatting codes) ของสถานะ
export const COLORS = {
  status: {
    success: "§a",
    error: "§c",
    warning: "§e"
  }
};

// การตั้งค่า telemetry แบบ local (ดู NavigationManager.js)
export const TELEMETRY = {
  MAX_ENTRIES: 100,
  DYNAMIC_PROPERTY_KEY: "uiNavigationLog"
};

// ปุ่มเริ่มต้นของหน้าจอยืนยัน (confirmDialog.js) — โมดูลที่เรียก showConfirm()
// สามารถ override เป็น key อื่นได้ต่อจุด (เช่น transfer.confirmYes)
export const CONFIRM_DIALOG_DEFAULTS = {
  confirmKey: "ui.confirm",
  cancelKey: "ui.cancel"
};

// เมนูหลักทั้งหมดที่จัดลำดับได้ (ui/settings/uiSettings.js อ่านค่านี้ไปสร้าง
// ลำดับเริ่มต้น + mainUi.js แสดงผลตามลำดับที่ผู้เล่นตั้งไว้) — เพิ่มเมนูใหม่
// แค่เพิ่มรายการที่นี่ ไม่ต้องแก้ mainUi.js / uiSettings.js
export const MAIN_MENU_ITEMS = [
  { id: "autoCollect", labelKey: "main.autoCollect", icon: "textures/ui/icon_trailer.png" },
  { id: "finance", labelKey: "main.finance", icon: "textures/items/emerald.png" },
  { id: "tp", labelKey: "main.teleport", icon: "textures/items/ender_pearl" },
  { id: "home", labelKey: "main.home", icon: "textures/items/bed_red" },
  { id: "market", labelKey: "main.market", icon: "textures/ui/trade_icon.png" },
  { id: "job", labelKey: "main.job", icon: "textures/items/diamond_pickaxe" },
  { id: "quest", labelKey: "main.quest", icon: "textures/ui/icon_book_writable" },
  { id: "stats", labelKey: "main.stats", icon: "textures/items/experience_bottle" },
  { id: "affinity", labelKey: "main.affinity", icon: "textures/items/diamond_sword" },
  { id: "scoreboard", labelKey: "main.scoreboard", icon: "textures/items/gold_ingot" },
  { id: "admin", labelKey: "main.admin", icon: "textures/ui/op", adminOnly: true },
  { id: "checkPlayer", labelKey: "main.checkPlayer", icon: "textures/ui/magnifyingGlass.png", adminOnly: true }
];

// รายการปุ่มในหน้า "การเงิน" (mainUi.js -> showShoppingMenu) — ย้ายมาจาก
// เดิม hardcode อยู่ใน mainUi.js เพื่อให้ menuToggleConfig.js อ้างอิงชุด
// เดียวกันได้ (เปิด/ปิดรายปุ่มจากหน้า Admin) — เพิ่มปุ่มใหม่ในหน้านี้แค่
// เพิ่มรายการที่นี่ ไม่ต้องแก้ mainUi.js
export const SHOP_MENU_ITEMS = [
  { id: "transfer", labelKey: "shop.transfer", icon: "textures/items/diamond.png" },
  { id: "buy", labelKey: "shop.buy", icon: "textures/items/emerald.png" },
  { id: "sell", labelKey: "shop.sell", icon: "textures/items/gold_ingot.png" },
  { id: "effectShop", labelKey: "shop.effectShop", icon: "textures/items/iron_ingot.png" }
];

// รายการปุ่มในหน้าเมนูหลักของ Admin (adminUi.js -> showMainMenu) — ย้ายมา
// จากเดิม hardcode อยู่ใน adminUi.js ด้วยเหตุผลเดียวกับ SHOP_MENU_ITEMS
// ด้านบน (ปุ่ม "จัดการเมนู" เองไม่รวมอยู่ในนี้ เพราะเป็นปุ่มตายตัวเปิด/ปิด
// ไม่ได้ เหมือนปุ่ม "ตั้งค่าเมนู" ในเมนูหลักผู้เล่น — ดู adminUi.js)
export const ADMIN_MENU_ITEMS = [
  { id: "gamemode", labelKey: "adminui.gamemodeButton", icon: "textures/items/diamond_pickaxe" },
  { id: "gamerule", labelKey: "adminui.gameruleButton", icon: "textures/items/redstone_dust" },
  { id: "command", labelKey: "adminui.commandButton", icon: "textures/items/paper" },
  { id: "tpPlayer", labelKey: "adminui.tpPlayerButton", icon: "textures/items/ender_pearl" },
  { id: "tpAll", labelKey: "adminui.tpAllButton", icon: "textures/items/ender_pearl" },
  { id: "oreScanner", labelKey: "adminui.oreScannerButton", icon: "textures/items/diamond_ore" },
  { id: "playerRewards", labelKey: "adminui.playerRewardsButton", icon: "textures/items/experience_bottle" },
  { id: "enchantGear", labelKey: "adminui.enchantGearButton", icon: "textures/items/enchanted_book", adminOnly: true }
];

// หัวข้อ (ระบบ) ทั้งหมดที่มีการยิง action bar ให้ผู้เล่น — ผู้เล่นเปิด/ปิดได้
// เป็นรายหัวข้อจากหน้าตั้งค่าเมนู (ui/settings/uiSettings.js) เก็บค่าที่
// core/actionBarSettings.js — เพิ่มหัวข้อใหม่ที่มีการยิง action bar แค่เพิ่ม
// รายการที่นี่ + ส่ง category (id ตรงนี้) เข้า showActionBar() ที่จุดยิงจริง
// (ดู core/messageUtils.js) ไม่ต้องแก้ uiSettings.js
// icon ใช้ texture วานิลลาที่โปรเจคใช้อยู่แล้ว (หน้าตั้งค่า action bar
// render เป็น list menu — ModalForm ใส่รูปไม่ได้)
export const ACTIONBAR_CATEGORIES = [
  { id: "shop", labelKey: "actionBarSettings.category.shop", icon: "textures/ui/trade_icon.png" }, // systems/shopSystem.js (ซื้อ/ขายร้านค้า)
  { id: "effectShop", labelKey: "actionBarSettings.category.effectShop", icon: "textures/items/experience_bottle" }, // systems/shopEffect.js
  { id: "tpBank", labelKey: "actionBarSettings.category.tpBank", icon: "textures/items/ender_pearl" }, // systems/tpBankSystem.js
  { id: "home", labelKey: "actionBarSettings.category.home", icon: "textures/items/bed_red" }, // systems/homeSystem.js + commands/homeCommands.js
  { id: "job", labelKey: "actionBarSettings.category.job", icon: "textures/items/iron_sword" }, // systems/jobSystem.js
  { id: "quest", labelKey: "actionBarSettings.category.quest", icon: "textures/ui/icon_book_writable" }, // systems/quests/display.js
  { id: "autoCollect", labelKey: "actionBarSettings.category.autoCollect", icon: "textures/items/emerald.png" }, // systems/autoCollect.js
  { id: "scoreboard", labelKey: "actionBarSettings.category.scoreboard", icon: "textures/items/gold_ingot", defaultEnabled: false }, // systems/scoreboard.js (Kills/Deaths loop)
  { id: "time", labelKey: "actionBarSettings.category.time", icon: "textures/items/clock_item" }, // commands/timeCommands.js
  { id: "combat", labelKey: "actionBarSettings.category.combat", icon: "textures/items/diamond_sword" } // systems/combatAttributes.js (damage numbers + proc feedback, v1.4.x)
];

// เสียงตอบสนอง UI — enabled: false ปิดเสียง UI ทั้งหมดจากจุดเดียว (ไม่กระทบ
// เสียงอื่นที่ไม่ได้ผ่าน soundUtils.js เช่น teleport/market ที่เรียก
// player.playSound() ตรงในไฟล์ของตัวเอง)
export const SOUND_CONFIG = {
  enabled: true,
  // กันเสียง UI ซ้อนกัน: เวลาต่ำสุด (ms) ที่เสียงเดียวกัน (soundId) จะถูกเล่นซ้ำ
  // สำหรับผู้เล่นคนเดียว — กดเมนูเร็ว ๆ จะได้ยินคลิกเดียวไม่ซ้อนทับกัน
  throttleMs: 100,
  sounds: {
    buySuccess: "random.levelup",
    sellSuccess: "random.orb",
    error: "note.bass",
    cancel: "random.click",
    click: "random.click",
    // jobSystem.js: อาชีพเลเวลอัป — ใช้เสียงเดียวกับ buySuccess โดยเจตนา
    // (เสียง XP อัปเลเวลของเกมเอง) แต่แยกคีย์ต่างหากให้ปรับเสียง job
    // ระบบเดียวได้โดยไม่กระทบร้านค้า
    jobLevelUp: "random.levelup",
    // quests/engine.js: ทำเควสสำเร็จ — ใช้เสียงเดียวกับ jobLevelUp โดยเจตนา
    // (เสียง XP อัปเลเวลของเกมเอง) แต่แยกคีย์ต่างหากให้ปรับเสียงเควสระบบ
    // เดียวได้โดยไม่กระทบระบบอาชีพ
    questComplete: "random.levelup",
    // combatAttributes.js (v1.4.0): เสียง proc feedback — เกิดถี่จึงเลือก
    // เสียงสั้น/เบา ปรับที่นี่จุดเดียว
    critProc: "note.pling",
    parryProc: "random.trident_hit_ground",
    evasionProc: "mob.bat.takeoff",
    blockProc: "random.wood_click",
    // shopUnlocks.js: ปลดล็อครายการสำเร็จ — ใช้เสียง anvil (สื่อถึง upgrade/ปลดล็อค)
    unlockSuccess: "random.anvil_use"
  }
};

// รายการเอนทิตี้สำหรับ TP ทั้งหมดในระยะ (adminUi.js — tpWithFilters)
// แยกไว้ที่นี่เพื่อให้ Admin ปรับแต่งได้โดยไม่ต้องแก้โค้ด
export const ADMIN_TP_PASSIVE_MOBS = [
  "cow", "pig", "sheep", "chicken", "horse",
  "donkey", "mule", "goat", "rabbit", "villager"
];

export const ADMIN_TP_HOSTILE_MOBS = [
  "zombie", "skeleton", "creeper", "spider",
  "witch", "enderman", "husk", "drowned"
];

// ค่าเริ่มต้นของ slider TP Range (adminUi.js)
export const ADMIN_TP_DEFAULT_RANGE = 5;
