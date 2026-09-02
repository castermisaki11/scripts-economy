// =========================
// SearchService.js
// ตัวจับคู่การค้นหาที่ใช้ร่วมกันระหว่าง Shop / Sell / Player Market
// ตาม amendment 4: matching logic (substring + alias) ต้องเหมือนกัน
// ทุกจุดที่มีการค้นหา ไม่ใช่แยกกันคนละไฟล์
//
// หมายเหตุเรื่องขอบเขต: ฟังก์ชันหลัก searchItems(query, source) เป็น
// pure function รับ "รายการที่ค้นหาได้" (source) ที่ normalize มาแล้ว
// เข้ามาตรง ๆ แทนที่จะให้ SearchService ไปรู้จักฟอร์แมตข้อมูลดิบของ
// data/items.js / playerMarket.js เอง — เพื่อไม่ให้ไฟล์นี้ผูกกับ
// โครงสร้างข้อมูลของโมดูลที่ยังไม่ได้ migrate (playerMarket.js)
//
// getDatabaseSearchSource() คือ adapter พร้อมใช้สำหรับ "database" source
// (อ่านจาก data/items.js อย่างเดียว ไม่แก้ไขไฟล์นั้น)
//
// getMarketSearchSource() คือ adapter สำหรับ "market" source (playerMarket.js)
// — เพิ่มตอน migrate playerMarket.js แล้ว รับ listings เป็นพารามิเตอร์ตรง ๆ
// (ไม่ import playerMarket.js เข้ามาเอง) เพื่อกัน circular import เพราะ
// playerMarket.js เป็นฝ่าย import SearchService.js ไปใช้ค้นหา
// =========================

import { getItemsByCategory, getItemDisplayName } from "../../data/items";

// ตัดวรรณยุกต์ไทย (ไม้เอก/โท/ตรี/จัตวา, ไม้ไต่คู้, ไม้หันอากาศ, การันต์,
// นิคหิต) ออกก่อนเทียบ เพื่อให้พิมพ์วรรณยุกต์ผิด/ไม่ใส่วรรณยุกต์เลยก็ยัง
// ค้นเจอ — ครอบคลุมเฉพาะ diacritic ที่ "ผิดแล้วยังอ่านออกเสียงใกล้เดิม"
// ไม่แตะสระ/พยัญชนะหลัก เพราะจะเปลี่ยนคำไปเป็นคำอื่นได้
const THAI_TONE_MARKS = /[\u0E47-\u0E4E]/g;

function normalize(str) {
  return String(str ?? "")
    .trim()
    .toLowerCase()
    .replace(THAI_TONE_MARKS, "")
    .replace(/\s+/g, " ");
}

// Levenshtein edit distance (จำนวนตัวอักษรที่ต้องเพิ่ม/ลบ/แทนน้อยที่สุด
// เพื่อให้ a กลายเป็น b) — ใช้ทำ fuzzy fallback ตอน substring หาไม่เจอเลย
// รายการค้นหาของแอดออนนี้มีจำนวนน้อย (ไอเทม/ของในตลาด) จึง implement แบบ
// ตรงไปตรงมา (DP O(n*m)) พอเพียง ไม่ต้อง optimize เพิ่ม
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,      // ลบตัวอักษร
        currRow[j - 1] + 1,  // เพิ่มตัวอักษร
        prevRow[j - 1] + cost // แทนที่ตัวอักษร
      );
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

// เพดาน edit distance ที่ยอมรับได้ ผูกกับความยาว query — คำสั้นเกินไป
// (1-2 ตัวอักษร) ไม่ยอม fuzzy เลย เพราะระยะห่าง 1 จะจับคู่มั่วได้ง่ายมาก
function maxAllowedDistance(queryLength) {
  if (queryLength <= 2) return 0;
  if (queryLength <= 5) return 1;
  return 2;
}

// ระยะห่างที่ใกล้ที่สุดระหว่าง query กับ "คำย่อย" ของ text (เทียบทั้งคำ
// เต็มและแยกคำด้วยช่องว่าง) กันกรณีชื่อยาวหลายคำแต่ query ตรงแค่คำเดียว
function closestDistance(query, text) {
  if (!text) return Infinity;
  let best = levenshtein(query, text);
  for (const word of text.split(" ")) {
    if (!word) continue;
    best = Math.min(best, levenshtein(query, word));
  }
  return best;
}

/**
 * ค้นหา items ที่ตรงกับ query บน name และ aliases
 * ลำดับความสำคัญ: substring match ก่อน (พฤติกรรมเดิมทุกประการ) —
 * ถ้าไม่เจอ substring เลยสักรายการ ค่อย fallback ไปหา fuzzy match
 * (พิมพ์ผิด/วรรณยุกต์ผิดเล็กน้อย) เรียงตามความใกล้เคียงจากมากไปน้อย
 * query ว่าง = คืนทั้งหมด (ยังไม่กรอง)
 * @param {string} query
 * @param {{ id: any, name: string, aliases?: string[] }[]} source  รายการที่ normalize แล้ว
 * @returns {{ id: any, name: string, aliases?: string[] }[]}
 */
export function searchItems(query, source) {
  const items = Array.isArray(source) ? source : [];
  const q = normalize(query);
  if (!q) return items;

  const exact = items.filter(item => {
    if (normalize(item.name).includes(q)) return true;
    const aliases = item.aliases ?? [];
    return aliases.some(alias => normalize(alias).includes(q));
  });
  if (exact.length > 0) return exact;

  const maxDist = maxAllowedDistance(q.length);
  if (maxDist === 0) return [];

  const scored = [];
  for (const item of items) {
    const aliases = item.aliases ?? [];
    let best = closestDistance(q, normalize(item.name));
    for (const alias of aliases) {
      best = Math.min(best, closestDistance(q, normalize(alias)));
    }
    if (best <= maxDist) scored.push({ item, best });
  }

  return scored
    .sort((a, b) => a.best - b.best)
    .map(entry => entry.item);
}

/**
 * Adapter: แปลงฐานข้อมูลไอเทม (data/items.js) ให้เป็นรูปแบบที่
 * searchItems() ใช้ได้ — ใช้ getItemsByCategory() ซึ่งกรองไอเทมที่ปิด
 * ใช้งาน (enabled: false) ออกให้อัตโนมัติอยู่แล้ว จึงไม่มีทางค้นเจอไอเทมที่
 * ปิดใช้งาน (ตรงกับกติกาข้อ 6: ไอเทมที่ปิดใช้งานต้องไม่โผล่ในระบบค้นหา)
 * ปัจจุบันยังไม่มีฟิลด์ alias ให้ไอเทมใด ๆ จึงส่ง aliases: [] เสมอ — ถ้าจะ
 * เพิ่ม alias ภาษาไทยให้ไอเทม ต้องเพิ่มฟิลด์ใน data/items.js ก่อน (นอก
 * ขอบเขตงานนี้)
 * @param {string} [category]  ไม่ใส่ = ทุกหมวดหมู่
 */
export function getDatabaseSearchSource(category) {
  return getItemsByCategory(category)
    .map(id => ({ id, name: getItemDisplayName(id), aliases: [] }));
}

/**
 * Adapter: แปลง listing ของตลาดผู้เล่น (ผลลัพธ์จาก getMarket() ใน
 * playerMarket.js) ให้เป็นรูปแบบที่ searchItems() ใช้ได้
 * ปัจจุบัน listing ไม่มีฟิลด์ alias จึงส่ง aliases: [] เสมอ เหมือนฝั่ง
 * database — ถ้าจะเพิ่ม alias ให้สินค้าที่ลงขาย ต้องเพิ่มฟิลด์ใน
 * itemData ตอน serializeItemStack() ก่อน (นอกขอบเขตงานนี้)
 * @param {{ id: any, displayName: string, seller?: string }[]} listings
 */
export function getMarketSearchSource(listings) {
  const items = Array.isArray(listings) ? listings : [];
  return items.map(listing => ({ id: listing.id, name: listing.displayName, aliases: [] }));
}
