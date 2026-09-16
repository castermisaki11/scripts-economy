// =========================
// constants.js
// ค่าคงที่ที่ใช้ "ร่วมกันจริง" ระหว่างมากกว่าหนึ่งโมดูลในแอดออนเท่านั้น —
// ย้ายมาจากไฟล์ต่าง ๆ ที่เดิมประกาศค่าเดียวกันซ้ำกันคนละไฟล์:
//   - ADMIN_TAG: playerUtils.js (isAdmin) กับ newPlayerRewards.js (itemRules) เช็ค
//     แท็กเดียวกัน
//   - INVENTORY_COMPONENT: itemUtils.js (getInventoryContainer) กับ
//     inventoryUi.js (เปิดกระเป๋าของ target ตรง ๆ) ใช้ component id เดียวกัน
//   - BANK_DYNAMIC_PROPERTY_KEY: economy.js กับ playerMarket.js อ่าน/เขียน
//     world dynamic property "ธนาคารกลาง" ตัวเดียวกัน
//   - MENU_BOOK_ITEM_ID / MENU_BOOK_NAME_TAG: newPlayerRewards.js (ตอนแจกไอเทม) กับ
//     mainUi.js (ตอนเช็คไอเทมที่ใช้เปิดเมนู) ต้องตรงกันทั้งสองไฟล์
//   - TICKS_PER_SECOND: ตัวคูณ 20 tick/วินาทีของ Minecraft ที่ tpBankSystem.js /
//     economy.js / scoreboard.js ต่างคำนวณ timeout/cooldown ของตัวเองด้วย
//     สูตร "20 * N วินาที" ซ้ำกันคนละไฟล์
//
// ค่าคงที่ที่ใช้แค่ไฟล์เดียว (เช่น MAX_MARKET_LISTINGS / LISTING_EXPIRE_DAYS
// ใน playerMarket.js, TRANSFER_DISTANCE ใน economy.js, EFFECTS ใน
// shopEffect.js, TP_REQUEST_TIMEOUT ใน tpBankSystem.js ฯลฯ) ยังคงอยู่ใน
// ไฟล์นั้นตามเดิมโดยเจตนา — ไม่ย้ายมาที่นี่ เพื่อไม่ให้ constants.js กลาย
// เป็นที่เก็บทุกอย่างแบบไม่มีความหมาย "ใช้ร่วมกัน" จริง ๆ
// =========================

/** จำนวน tick ต่อวินาทีของ Minecraft — ใช้แปลง "กี่วินาที" เป็น tick
 *  สำหรับสูตรคำนวณ timeout/cooldown ของแต่ละโมดูล (ค่า timeout/cooldown
 *  จริงยังคงเป็นค่าเฉพาะของแต่ละไฟล์เหมือนเดิม มีแค่ตัวคูณนี้ที่ใช้ร่วมกัน) */
export const TICKS_PER_SECOND = 20;

/** แท็กผู้เล่นที่ใช้เช็คสิทธิ์ admin ทั่วทั้งแอดออน */
export const ADMIN_TAG = "admin";

/** component id ของกระเป๋าผู้เล่น */
export const INVENTORY_COMPONENT = "minecraft:inventory";

/** คีย์ world dynamic property ของธนาคารกลาง (ภาษีที่หักเข้าคลัง) —
 *  ต้องตรงกันระหว่าง economy.js กับ playerMarket.js */
export const BANK_DYNAMIC_PROPERTY_KEY = "bank";

/** typeId ของไอเทม "สมุดเมนู" ที่ newPlayerRewards.js แจกให้ผู้เล่น และ mainUi.js
 *  เช็คตอนเปิดเมนู — ต้องตรงกันทั้งสองไฟล์ */
export const MENU_BOOK_ITEM_ID = "minecraft:paper";

/** nameTag ของไอเทม "สมุดเมนู" — ต้องตรงกันระหว่าง newPlayerRewards.js (ตอนแจก) กับ
 *  mainUi.js (ตอนเช็ค) */
export const MENU_BOOK_NAME_TAG = "ZEN";

/** เวอร์ชันของแอดออน — worldLoad.js ใช้โชว์บน console ตอน world โหลด
 *  ต้อง bump พร้อมกันทั้ง 3 ไฟล์ทุกครั้ง: manifest.json (header + modules),
 *  package.json และไฟล์นี้ (Bedrock scripting import manifest.json ตรง ๆ
 *  ไม่ได้ จึงต้อง hardcode ไว้ในสคริปต์) */
export const ADDON_VERSION = "1.6.3";
