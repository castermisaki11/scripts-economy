// =========================
// timeUtils.js
// ระบบวันเวลากลางของแอดออน — ก่อนหน้านี้ economy.js กับ NavigationManager.js
// เรียก `new Date().toLocaleString()` แยกกันคนละไฟล์ตอนบันทึก log (Transaction
// Log / Telemetry Log) ซึ่งมีปัญหา 2 อย่าง:
//   1) toLocaleString() ไม่ได้ล็อก timezone ไว้ — ถ้าเครื่อง host ที่รันเซิร์ฟเวอร์
//      ตั้งค่า timezone ไม่ตรงกับเวลาไทย เวลาที่โชว์ให้ admin ดูใน log ก็จะเพี้ยน
//      ไปตามเครื่อง host ไม่ใช่เวลาไทยจริง
//   2) แต่ละไฟล์ format เอง ทำให้รูปแบบวันที่ไม่การันตีว่าจะตรงกันทุกจุด
//
// แนวทางที่ใช้: ไม่พึ่ง Intl.DateTimeFormat({ timeZone: ... }) เพราะ script
// engine ของ @minecraft/server ไม่การันตีว่ามี ICU/timezone database ครบ —
// คำนวณ offset จาก UTC ตรง ๆ ด้วยเลขคงที่ (TIMEZONE_OFFSET_HOURS) แทน วิธีนี้
// พกพาได้ทุกเครื่อง ไม่ขึ้นกับ locale/timezone ของเครื่อง host เลย
// =========================

/** timezone offset ของเวลาไทย (UTC+7) หน่วยเป็นชั่วโมง — จุดเดียวที่ต้องแก้
 *  ถ้าวันหลังต้องรองรับเซิร์ฟเวอร์ที่ตั้งใจให้แสดงเวลาโซนอื่น */
export const TIMEZONE_OFFSET_HOURS = 7;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const DAY_NAMES_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const MONTH_NAMES_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** timestamp ปัจจุบัน (ms since epoch) — ใช้แทน Date.now() ตรง ๆ ในจุดที่ต้อง
 *  บันทึก/เทียบเวลา เพื่อให้ทุกจุดเรียกผ่านโมดูลเดียว เผื่อวันหลังต้องแทรก
 *  logic เพิ่ม (เช่น freeze เวลาไว้ตอนเทส) โดยไม่ต้องไล่แก้ทีละไฟล์ */
export function nowMs() {
  return Date.now();
}

/**
 * คืน Date object ที่ field ต่าง ๆ (getUTCHours/getUTCDate/...) อ่านออกมาตรงกับ
 * เวลาไทยเสมอ ไม่ว่าเครื่อง host จะตั้ง timezone อะไรไว้
 *
 * ตัว Date ที่คืนกลับมา "เพี้ยน" ไปจากเวลาจริงตาม UTC โดยเจตนา (shift ไป
 * ข้างหน้า TIMEZONE_OFFSET_HOURS ชม.) เพื่อให้เรียก getUTC*() แล้วได้ค่าฟิลด์
 * แบบเวลาไทยโดยไม่ต้องพึ่ง Intl — ห้ามเอา Date ตัวนี้ไปคำนวณ diff/เทียบกับ
 * Date อื่นที่ไม่ได้ shift แบบเดียวกัน (ใช้ nowMs()/timestamp ตัวเลขเทียบกันแทน)
 * @param {number | Date} [msOrDate] เวลาตั้งต้น (ms หรือ Date) — ถ้าไม่ระบุใช้ตอนนี้
 */
export function toBangkokDate(msOrDate = Date.now()) {
  const ms = msOrDate instanceof Date ? msOrDate.getTime() : msOrDate;
  return new Date(ms + TIMEZONE_OFFSET_HOURS * MS_PER_HOUR);
}

/** วันที่แบบไทย เช่น "08/08/2026" (วัน/เดือน/ปี ค.ศ.) */
export function formatDate(msOrDate = Date.now()) {
  const d = toBangkokDate(msOrDate);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** เวลาแบบไทย เช่น "14:05:32" */
export function formatTime(msOrDate = Date.now()) {
  const d = toBangkokDate(msOrDate);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

/** วันที่ + เวลาแบบไทย เช่น "08/08/2026 14:05:32" — ใช้แทน
 *  `new Date().toLocaleString()` เดิมในทุกจุดที่บันทึก log ให้ admin อ่าน */
export function formatDateTime(msOrDate = Date.now()) {
  return `${formatDate(msOrDate)} ${formatTime(msOrDate)}`;
}

/** วันที่แบบยาวสำหรับข้อความ/ประกาศในเกม เช่น "วันเสาร์ที่ 8 สิงหาคม 2569"
 *  (ปีเป็น พ.ศ.) */
export function formatDateLongThai(msOrDate = Date.now()) {
  const d = toBangkokDate(msOrDate);
  const dayName = DAY_NAMES_TH[d.getUTCDay()];
  const monthName = MONTH_NAMES_TH[d.getUTCMonth()];
  const buddhistYear = d.getUTCFullYear() + 543;
  return `วัน${dayName}ที่ ${d.getUTCDate()} ${monthName} ${buddhistYear}`;
}

/** true ถ้าสอง timestamp ตกอยู่ "วันเดียวกัน" ตามเวลาไทย — ใช้เช็ค daily
 *  reset (รางวัลรายวัน/เควสต์รายวัน) แทนการเทียบ Date.now() ตรง ๆ ที่จะพลาด
 *  ถ้า host อยู่ต่างโซนเวลากับเวลาไทย */
export function isSameBangkokDay(msA, msB = Date.now()) {
  const a = toBangkokDate(msA);
  const b = toBangkokDate(msB);
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** เลข "วันที่ปฏิทินไทย" ของ timestamp — นับจำนวนวันเต็มตั้งแต่ epoch ตาม
 *  เวลาไทย (ไม่ใช่ ms ตรง ๆ) ใช้เป็นฐานเทียบว่า "ข้ามเที่ยงคืนไทยไปกี่วันแล้ว"
 *  โดยไม่ต้องยุ่งกับเศษวินาที/ชั่วโมงในวันนั้น */
export function bangkokDayIndex(msOrDate = Date.now()) {
  const ms = msOrDate instanceof Date ? msOrDate.getTime() : msOrDate;
  return Math.floor((ms + TIMEZONE_OFFSET_HOURS * MS_PER_HOUR) / MS_PER_DAY);
}

/** จำนวน "เที่ยงคืนไทย" ที่ผ่านไปตั้งแต่ msA จนถึง msB (ค่าเริ่มต้น: ตอนนี้) —
 *  ต่างจากการหารผลต่าง ms ด้วย 24 ชม. ตรง ๆ เพราะนับเป็น "วันปฏิทิน" ไทย
 *  จริง เช่น ลงขาย 23:59 น. วันจันทร์ แล้วเลย 00:01 น. วันอังคารไปแค่ 2 นาที
 *  ก็ถือว่าข้ามไปแล้ว 1 วัน — ใช้กับของที่อยากให้ "อายุ N วัน" นับแบบวันปฏิทิน
 *  (เช่น listing หมดอายุ) ไม่ใช่ต้องครบ N*24 ชม. เป๊ะ ๆ */
export function daysBetweenBangkok(msA, msB = Date.now()) {
  return bangkokDayIndex(msB) - bangkokDayIndex(msA);
}

/** จำนวน ms จนถึงเที่ยงคืนไทยของวันถัดไป นับจาก timestamp ที่ให้มา — ใช้ตั้ง
 *  ตัวจับเวลารีเซ็ตรายวัน (รางวัล/เควสต์/ลิมิตรายวัน) ให้ตรงเที่ยงคืนเวลาไทย
 *  เป๊ะ ๆ ไม่ขึ้นกับ timezone ของ host */
export function msUntilNextBangkokMidnight(msNow = Date.now()) {
  const d = toBangkokDate(msNow);
  const msIntoDay =
    d.getUTCHours() * MS_PER_HOUR +
    d.getUTCMinutes() * 60 * 1000 +
    d.getUTCSeconds() * 1000 +
    d.getUTCMilliseconds();
  return MS_PER_DAY - msIntoDay;
}

// สัปดาห์แบบเริ่มวันจันทร์ (ฐานเดียวกับ bangkokWeekIndex() ใน
// systems/quests/reset.js — dayIndex 0 ตรงกับวันพฤหัสบดี ตามคอมเมนต์
// bangkokDayIndex() ด้านบน จึงไล่ remainder ได้เป็น: 0=พฤหัส, 1=ศุกร์,
// 2=เสาร์, 3=อาทิตย์, 4=จันทร์, 5=อังคาร, 6=พุธ) เก็บ remainder ของวันจันทร์
// ไว้เป็นค่าคงที่จุดเดียวตรงนี้ ไม่ให้ quests/reset.js ต้องคำนวณ modular
// arithmetic ซ้ำเอง (Quest UI เรียกใช้ตัวนี้แสดง \"รีเซ็ตใน {time}\" ของ Weekly)
const MONDAY_DAY_INDEX_REMAINDER = 4;

/** จำนวน ms จนถึงเที่ยงคืนไทยของวันจันทร์ถัดไป (จุดรีเซ็ต Weekly) นับจาก
 *  timestamp ที่ให้มา — ถ้าวันนี้เป็นวันจันทร์อยู่แล้ว ถือว่ารอบของวันนี้
 *  รีเซ็ตไปแล้ว จึงนับไปวันจันทร์ถัดไป (อีก 7 วัน) ไม่ใช่ 0 */
export function msUntilNextBangkokWeekReset(msNow = Date.now()) {
  const dayIndex = bangkokDayIndex(msNow);
  const remainder = ((dayIndex % 7) + 7) % 7;
  let offsetDays = ((MONDAY_DAY_INDEX_REMAINDER - remainder) % 7 + 7) % 7;
  if (offsetDays === 0) offsetDays = 7;
  return msUntilNextBangkokMidnight(msNow) + (offsetDays - 1) * MS_PER_DAY;
}
