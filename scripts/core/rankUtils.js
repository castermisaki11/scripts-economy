// =========================
// rankUtils.js
// จุดเดียวสำหรับ "ป้าย rank" ของผู้เล่น (เดิมเป็นฟังก์ชัน private
// getPlayerRankTag() ฝังอยู่ใน systems/jobSystem.js ใช้ได้แค่ในไฟล์เดียว —
// ย้ายมาที่นี่เพื่อให้ระบบอื่นในอนาคต (scoreboard, chat, ฯลฯ) import ไปใช้
// ได้โดยไม่ต้องพึ่ง jobSystem.js)
//
// ยังคงอ่านจาก JOB_CONFIG.VIP.TAG_MODIFIERS เหมือนเดิมทุกประการ (ไม่ได้
// แยก config ใหม่) — ผู้เล่นตั้ง tag เองผ่านคำสั่งในเกม (เช่น
// /tag <player> add vip) แล้วป้าย rank จะขึ้นตาม tag ที่ตรงกับ config นี้
// เพิ่ม/แก้ระดับ rank ยังคงแก้ที่ config/jobConfig.js (VIP.TAG_MODIFIERS)
// จุดเดียวเหมือนเดิม ไม่ต้องแก้ไฟล์นี้
// =========================

import { JOB_CONFIG } from "../config/jobConfig";
import { getTagPriceMultiplier } from "./economyUtils";

// ตัวคูณเงิน/exp พิเศษจาก tag VIP ของผู้เล่น (อ่านจาก
// JOB_CONFIG.VIP.TAG_MODIFIERS) — เดิมเป็นฟังก์ชัน private ใน
// systems/jobSystem.js (getVipMoneyMultiplier/getVipExpMultiplier) ย้ายมา
// รวมกับ getPlayerRankTag() ที่นี่ เพื่อให้ทุกระบบที่ต้องใช้ตัวคูณ VIP
// เรียกจากจุดเดียวกัน ไม่ต้องเขียนตัวแปลง TAG_MODIFIERS -> getTagPriceMultiplier()
// ซ้ำเองในแต่ละไฟล์ — ยังใช้ getTagPriceMultiplier() (economyUtils.js) ตัว
// เดียวกับที่ AUTO_COLLECT ใช้ (คูณต่อกันถ้ามีหลาย tag ตรงกันพร้อมกัน)
/**
 * @param {import("@minecraft/server").Player} player
 */
export function getVipMoneyMultiplier(player) {
  const modifiers = JOB_CONFIG.VIP.TAG_MODIFIERS.map((m) => ({ tag: m.tag, multiplier: m.moneyMultiplier }));
  return getTagPriceMultiplier(player, modifiers);
}

/**
 * @param {import("@minecraft/server").Player} player
 */
export function getVipExpMultiplier(player) {
  const modifiers = JOB_CONFIG.VIP.TAG_MODIFIERS.map((m) => ({ tag: m.tag, multiplier: m.expMultiplier }));
  return getTagPriceMultiplier(player, modifiers);
}

// ป้ายชื่อ "ระดับ" ของผู้เล่นสำหรับโชว์ใน UI — ค่าเริ่มต้นคือ "player" ถ้า
// ไม่มี tag พิเศษใด ๆ ตรงกับ JOB_CONFIG.VIP.TAG_MODIFIERS เลย ถ้ามีมากกว่า
// 1 tag พร้อมกัน ให้ถือว่ารายการที่อยู่ "ท้ายอาเรย์" เป็นระดับสูงสุด (เรียง
// จากน้อยไปมากใน config — เพิ่ม tag ระดับสูงกว่า vip ในอนาคตแค่ต่อท้าย
// อาเรย์นี้ ไม่ต้องแก้โค้ดจุดนี้) ไล่จากท้ายมาหน้า คืน tag แรกที่ผู้เล่นมี
/**
 * @param {import("@minecraft/server").Player} player
 * @returns {string}
 */
export function getPlayerRankTag(player) {
  const tags = JOB_CONFIG.VIP.TAG_MODIFIERS;
  for (let i = tags.length - 1; i >= 0; i--) {
    if (player.hasTag(tags[i].tag)) return tags[i].tag;
  }
  return "player";
}
