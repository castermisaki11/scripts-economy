// =========================
// quests/jobBridge.js
// ย้ายมาจาก questSystem.js เดิม (Phase 2) แบบคงเดิมทุกประการ
//
// PHASE 2: JOB <-> QUEST BRIDGE (Dependency Injection)
// ไฟล์นี้เดิมอยู่ใน questSystem.js — ต้องเรียก applyJobExp()/getCurrentJobId()
// ของ jobSystem.js ตอนเควสสำเร็จแล้วมี EXP เป็นรางวัล (ดู grantQuestReward()
// ใน progression.js) แต่ห้าม import jobSystem.js ตรง ๆ — jobSystem.js เองก็
// import reportJobExpGained/reportJobLevelUp/registerJobBridge จาก facade
// questSystem.js อยู่แล้ว (ทิศทางเดียวกับที่ shopSystem.js import
// reportItemSold ตั้งแต่ Phase 1) ถ้าไฟล์นี้ import jobSystem.js กลับไปด้วย
// จะเกิด Circular Import ทันที
// ทางแก้: jobSystem.js เป็นฝ่าย "ยื่น" ฟังก์ชันของตัวเองเข้ามาเก็บไว้ที่นี่
// ผ่าน registerJobBridge() (เรียกครั้งเดียวตอนโหลดโมดูล jobSystem.js เอง) —
// Module Graph เป็นทิศทางเดียวเสมอ: jobSystem.js -> questSystem.js เท่านั้น
// =========================

let jobBridge = null;

export function registerJobBridge(bridge) {
  jobBridge = bridge;
}

export function getJobBridge() {
  return jobBridge;
}
