// =========================
// data/index.js
// จุดเดียวสำหรับ import ข้อมูลทุกหมวด — โมดูลอื่นสามารถ
// import { getItemData, getEffectById, ... } from "../data" แทนการไล่
// import ทีละไฟล์ย่อยถ้าต้องใช้มากกว่าหนึ่งหมวดในไฟล์เดียว
//
// ไฟล์นี้ยังเป็นจุดที่รัน "การตรวจสอบฐานข้อมูล" ครั้งเดียวตอนโหลดโมดูล —
// ถ้าข้อมูลไอเทม/เอฟเฟกต์ผิดพลาด (ราคาไม่ใช่ตัวเลข, ไม่มี icon, category
// ไม่รู้จัก ฯลฯ) จะ log เป็น console.error ที่อ่านง่ายทันทีตอนโลกโหลด แทนที่
// จะปล่อยผ่านเงียบ ๆ แล้วไปพังใน UI ภายหลัง — ไม่ throw เพื่อไม่ให้ไอเทม
// ตัวเดียวที่ผิดพลาดทำทั้งแอดออนพัง
// =========================

import { t } from "../ui/locale/index";

import {
  ITEMS,
  hasItem,
  isItemEnabled,
  getItemData,
  getSellPrice,
  getBuyPrice,
  getItemIcon,
  getItemsByCategory,
  getItemDisplayName,
  validateItems
} from "./items";

import {
  SHOP_CATEGORIES,
  getShopCategories,
  getCategoryLabelKey,
  getCategoryIcon,
  isValidCategory
} from "./shops";

import { EFFECTS, getEffectById, validateEffects } from "./effects";

import { REWARD_RULES } from "./rewards";

import { JOBS, getJobs, getJobById, isValidJob, getJobRewardEntry, validateJobs } from "./jobs";

export {
  ITEMS,
  hasItem,
  isItemEnabled,
  getItemData,
  getSellPrice,
  getBuyPrice,
  getItemIcon,
  getItemsByCategory,
  getItemDisplayName,
  SHOP_CATEGORIES,
  getShopCategories,
  getCategoryLabelKey,
  getCategoryIcon,
  isValidCategory,
  EFFECTS,
  getEffectById,
  REWARD_RULES,
  JOBS,
  getJobs,
  getJobById,
  isValidJob,
  getJobRewardEntry
};

function runValidation() {
  const issues = [
    ...validateItems(isValidCategory),
    ...validateEffects(t),
    ...validateJobs()
  ];

  if (issues.length === 0) return;

  console.error(`[data] พบปัญหาข้อมูลทั้งหมด ${issues.length} รายการ:`);
  for (const issue of issues) console.error(`  - ${issue}`);
}

runValidation();
