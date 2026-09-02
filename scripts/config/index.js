// =========================
// config/index.js
// จุดเดียวสำหรับ import ค่าตั้งค่าทุกหมวด — โมดูลอื่นสามารถ
// import { ECONOMY_CONFIG, SHOP_CONFIG, ... } from "../config" แทนการไล่
// import ทีละไฟล์ย่อยถ้าต้องใช้มากกว่าหนึ่งหมวดในไฟล์เดียว
// =========================

export { ECONOMY_CONFIG } from "./economyConfig";
export { SHOP_CONFIG } from "./shopConfig";
export { JOB_CONFIG } from "./jobConfig";
export { ORE_SCANNER_CONFIG } from "./oreScannerConfig";
export {
  PAGE_SIZE,
  ICONS,
  COLORS,
  TELEMETRY,
  CONFIRM_DIALOG_DEFAULTS,
  MAIN_MENU_ITEMS,
  SHOP_MENU_ITEMS,
  ADMIN_MENU_ITEMS,
  SOUND_CONFIG
} from "./uiConfig";
export { MENU_TOGGLE_GROUPS } from "./menuToggleConfig";
