// =========================
// questSystem.js — FACADE
// ระบบเควส — Bounty / Daily / Weekly / Achievement / Chain
//
// ไฟล์นี้เคยเป็นโมดูลเดียว ~1,700 บรรทัด (Phase 1-4A) — ตอนนี้ถูกแยกเป็น
// หลายไฟล์ภายใต้ systems/quests/ แบบ pure code-motion (ไม่เปลี่ยน logic
// ใด ๆ) เพื่อให้ตรงกับกฎ "แยกไฟล์ใหญ่" ของ CONTRIBUTING.md:
//
//   quests/jobBridge.js      — DI bridge กับ jobSystem (กัน Circular Import)
//   quests/storage.js        — default shapes, sanitizers, migrate, read/save
//   quests/generation.js     — random helpers, Bounty gen, generic gen
//   quests/reset.js          — lazy Daily/Weekly reset (Bangkok timezone)
//   quests/display.js        — format helpers, progress feedback (action bar)
//   quests/progression.js    — payReward, grantQuestReward, achievements,
//                              lifetime counters (ผูกกันเป็นลูกโซ่จึงรวมไฟล์)
//   quests/engine.js         — tryProgressQuest, advance*, advanceQuests
//                              (Central Dispatcher)
//   quests/chains.js         — Chain progress + startChain/abandonChain/
//                              getChainStatuses
//   quests/rerollEngine.js   — reroll Daily/Weekly slot (engine side)
//   quests/reportApi.js      — report* API สำหรับระบบอื่นเรียก
//   quests/events.js         — world event hooks (mine/kill/playerSpawn)
//   quests/ui/*.js           — UI ทุกหน้าจอของระบบเควส
//
// ไฟล์นี้ re-export Public API ชุดเดิมทั้งหมด — ไฟล์ที่ import
// "../systems/questSystem" อยู่แล้ว (mainUi, questCommands, shopSystem,
// marketUi, jobSystem, homeSystem) "ไม่ต้องแก้อะไร"
//
// สถาปัตยกรรมเดิมยังคงเดิมทุกประการ (ดูคอมเมนต์เต็มในแต่ละโมดูล):
// - ไม่สร้าง ActionFormData/MessageFormData ตรง ๆ (ผ่าน UIFramework.js /
//   confirmDialog.js เท่านั้น)
// - นำทางผ่าน NavigationManager (ผู้เรียกต้อง push ก่อนเสมอ)
// - ทุกสตริงผ่าน t()
// - เงินผ่าน economyUtils.js (addMoney) จุดเดียว
// - ค่าตั้งค่าทั้งหมดมาจาก config/questConfig.js
// - Anti-Abuse: Quest Reward ห้ามย้อนกลับมานับเป็น Quest Progress ของ
//   เควสอื่น (ห้าม hook ทั่วไปใน economyUtils.js)
// =========================

import "./quests/events";

export { registerJobBridge } from "./quests/jobBridge";
export { generateQuest, generateUniqueQuest } from "./quests/generation";
export { REROLL_FAIL_REASON, rerollDailySlot, rerollWeeklySlot } from "./quests/rerollEngine";
export { advanceQuests } from "./quests/engine";
export {
  CHAIN_FAIL_REASON,
  startChain,
  abandonChain,
  getChainStatuses
} from "./quests/chains";
export {
  reportItemSold,
  reportItemBought,
  reportMarketSold,
  reportJobExpGained,
  reportJobLevelUp,
  reportHomeTeleport
} from "./quests/reportApi";
export { openQuestUI } from "./quests/ui/rootMenu";
