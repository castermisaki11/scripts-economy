// =========================
// data/questChains.js
// Quest Chain (สายเควสหลายด่าน) — Phase 3C
//
// ต่างจาก Bounty/Daily/Weekly ตรงที่ "ไม่สุ่ม" — เป็นเนื้อหาคงที่ (Fixed
// Content) แบบเดียวกับ data/jobs.js ผู้เล่นต้อง "เริ่ม" เองก่อน (opt-in —
// ดู startChain() ใน systems/quests/chains.js) ถึงจะเริ่ม Progress ได้ ไม่มี
// วันหมดอายุ ไม่มีปุ่ม Reroll (สายเควสคงที่ ไม่ใช่เนื้อหาสุ่ม) และทำสำเร็จ
// ได้ครั้งเดียวถาวรต่อคน (เช็คกับ questData.chains.completed ที่
// systems/quests/storage.js — ห้าม progress/รับรางวัลซ้ำของสายที่ทำจบไปแล้ว)
//
// โครงสร้างของแต่ละสาย:
//   id:        string      รหัสสาย (คีย์ที่เก็บใน questData.chains.active/
//                           completed) ต้องไม่ซ้ำกันในไฟล์นี้
//   stages:    Array<Stage> ลำดับด่านที่ต้องทำให้ครบตามลำดับ (ทำด่านถัดไป
//                           ไม่ได้จนกว่าด่านปัจจุบันจะสำเร็จก่อน)
//
// โครงสร้างของแต่ละ Stage (รูปแบบเดียวกับ Quest ปกติที่ตัดฟิลด์ที่ไม่
// เกี่ยวข้องออก — ไม่มี difficulty/completed เพราะสายเควสไม่ได้สุ่ม):
//   type:            string        Objective Type จาก data/questObjectives.js
//                                  (ต้องเป็น type ที่ลงทะเบียนไว้ที่นั่นเท่านั้น
//                                  — engine ใช้ tryProgressQuest() ตัวเดียวกับ
//                                  Bounty/Daily/Weekly ทุกประการ ไม่มี Path
//                                  แยกสำหรับ Chain)
//   targetId:        string | null เป้าหมายเฉพาะเจาะจง — null = เป้าหมายใดก็ได้
//                                  (เหมือน Objective ที่ getPool() คืน [null])
//   amountRequired:  number        จำนวนที่ต้องทำให้ครบของด่านนี้
//   reward:          { money, exp } รางวัลตอนด่านนี้สำเร็จ (Shape เดียวกับ
//                                  Quest.reward ปกติ — จ่ายผ่าน payReward()
//                                  เส้นทางเดียวกับ Bounty/Daily/Weekly/
//                                  Achievement ไม่มี item reward ในเฟสนี้
//                                  เช่นเดียวกับ Achievement — ดูคอมเมนต์
//                                  data/questAchievements.js)
//
// targetId ของ mine/kill ต้องมาจาก data/quests.js (MINE_POOL/KILL_POOL)
// เท่านั้น — ไม่สร้างตารางเป้าหมายแยกของตัวเอง (Single Source of Truth
// เดียวกับที่ data/questObjectives.js ยึดไว้)
// =========================

export const QUEST_CHAINS = [
  // --- สายผู้ขุด: ขุดแร่ไล่ระดับตั้งแต่ถ่านหินไปจนถึงเพชร ---
  {
    id: "miner_path",
    stages: [
      { type: "mine", targetId: "minecraft:coal_ore", amountRequired: 64, reward: { money: 3000, exp: 150 } },
      { type: "mine", targetId: "minecraft:iron_ore", amountRequired: 64, reward: { money: 8000, exp: 350 } },
      { type: "mine", targetId: "minecraft:diamond_ore", amountRequired: 16, reward: { money: 40000, exp: 1500 } }
    ]
  },

  // --- สายนักล่า: ฆ่ามอนสเตอร์ไล่ระดับความอันตราย ---
  {
    id: "hunter_path",
    stages: [
      { type: "kill", targetId: "minecraft:zombie", amountRequired: 50, reward: { money: 3000, exp: 150 } },
      { type: "kill", targetId: "minecraft:skeleton", amountRequired: 50, reward: { money: 8000, exp: 350 } },
      { type: "kill", targetId: "minecraft:enderman", amountRequired: 20, reward: { money: 40000, exp: 1500 } }
    ]
  },

  // --- สายพ่อค้า: ต้องมีผู้ซื้อจริงในตลาดผู้เล่นก่อนจึงจะผ่านด่านแรก —
  // ใช้ targetId: null (เป้าหมายใดก็ได้) ทุกด่าน เพราะเจตนาให้ทำได้ด้วย
  // ไอเทมอะไรก็ได้ ไม่ผูกกับไอเทมชิ้นเดียว
  {
    id: "market_tycoon_path",
    stages: [
      { type: "market_sell", targetId: null, amountRequired: 20, reward: { money: 4000, exp: 150 } },
      { type: "market_sell", targetId: null, amountRequired: 20, reward: { money: 10000, exp: 400 } },
      { type: "sell", targetId: null, amountRequired: 200, reward: { money: 50000, exp: 1800 } }
    ]
  },

  // --- สายนักผจญภัย: ผสมผสาน home_teleport/job_exp/job_levelup — ทดสอบว่า
  // Chain Engine ใช้ Objective Type ต่างกันคนละด่านในสายเดียวกันได้จริง
  // (ไม่ต้องเป็น Type เดียวกันทั้งสาย)
  {
    id: "explorer_path",
    stages: [
      { type: "home_teleport", targetId: null, amountRequired: 30, reward: { money: 2000, exp: 100 } },
      { type: "job_exp", targetId: null, amountRequired: 2000, reward: { money: 6000, exp: 0 } },
      { type: "job_levelup", targetId: null, amountRequired: 5, reward: { money: 30000, exp: 0 } }
    ]
  },

  // --- สายนักล่าสมบัติ: แร่หรูหราที่ miner_path (ถ่าน/เหล็ก/เพชร) ไม่ครอบ —
  // ทอง → redstone → มรกต ไล่ระดับตามความหายากในธรรมชาติ
  {
    id: "treasure_hunter",
    stages: [
      { type: "mine", targetId: "minecraft:gold_ore", amountRequired: 32, reward: { money: 8000, exp: 350 } },
      { type: "mine", targetId: "minecraft:redstone_ore", amountRequired: 32, reward: { money: 15000, exp: 600 } },
      { type: "mine", targetId: "minecraft:emerald_ore", amountRequired: 16, reward: { money: 28000, exp: 1050 } }
    ]
  },

  // --- สายนักปราบ: มอนสเตอร์เสี่ยงภัยสูงที่ hunter_path (ซอมบี้/โครงกระดูก/
  // เอนเดอร์แมน) ไม่ครอบ — creeper ระเบิดใส่ / witch โพชัน / phantom โจมตีจากอากาศ
  {
    id: "monster_bounty",
    stages: [
      { type: "kill", targetId: "minecraft:creeper", amountRequired: 40, reward: { money: 8000, exp: 350 } },
      { type: "kill", targetId: "minecraft:witch", amountRequired: 25, reward: { money: 18000, exp: 700 } },
      { type: "kill", targetId: "minecraft:phantom", amountRequired: 15, reward: { money: 27000, exp: 1050 } }
    ]
  },

  // --- สายนักช้อป: ซื้อของจากร้าน NPC สะสมจำนวน (targetId null = ไอเทมใดก็ได้
  // เหมือน market_tycoon_path) — chain สายเดียวที่ใช้ objective type "buy"
  // (progress ผ่าน reportItemBought() ที่ shopSystem.js เรียกตอนซื้อสำเร็จ)
  {
    id: "shopaholic",
    stages: [
      { type: "buy", targetId: null, amountRequired: 150, reward: { money: 5000, exp: 250 } },
      { type: "buy", targetId: null, amountRequired: 300, reward: { money: 16000, exp: 550 } },
      { type: "buy", targetId: null, amountRequired: 600, reward: { money: 42000, exp: 1100 } }
    ]
  },

  // --- สายยุคหิน: ขุดบล็อกพื้นฐานจำนวนมาก — สายเริ่มต้นสำหรับผู้เล่นใหม่
  // (เป้าหมายจาก MINE_POOL เดิม ไม่ใช่แร่หรู)
  {
    id: "stone_age",
    stages: [
      { type: "mine", targetId: "minecraft:stone", amountRequired: 256, reward: { money: 4000, exp: 200 } },
      { type: "mine", targetId: "minecraft:cobblestone", amountRequired: 192, reward: { money: 9000, exp: 400 } },
      { type: "mine", targetId: "minecraft:dirt", amountRequired: 128, reward: { money: 18000, exp: 700 } }
    ]
  },

  // --- สายปราบอันเดด: มอนสเตอร์กลุ่ม undead ที่ hunter_path (zombie/skeleton/
  // enderman) ไม่ครอบ — เพิ่ม husk (ทะเลทราย) เข้ามา
  {
    id: "undead_purge",
    stages: [
      { type: "kill", targetId: "minecraft:zombie", amountRequired: 60, reward: { money: 5000, exp: 250 } },
      { type: "kill", targetId: "minecraft:skeleton", amountRequired: 60, reward: { money: 11000, exp: 450 } },
      { type: "kill", targetId: "minecraft:husk", amountRequired: 40, reward: { money: 24000, exp: 900 } }
    ]
  },

  // --- สายพ่อค้าครบวงจร: ขายร้าน -> ซื้อร้าน -> ตลาดผู้เล่น ไล่ครบทุกช่องทาง
  // การค้า (targetId null = ไอเทมใดก็ได้ทุกด่าน)
  {
    id: "merchant_grind",
    stages: [
      { type: "sell", targetId: null, amountRequired: 300, reward: { money: 6000, exp: 300 } },
      { type: "buy", targetId: null, amountRequired: 200, reward: { money: 14000, exp: 550 } },
      { type: "market_sell", targetId: null, amountRequired: 50, reward: { money: 35000, exp: 1200 } }
    ]
  }
];

/** รายชื่อสายเควสทั้งหมดที่ลงทะเบียนไว้ในระบบ */
export function getAllChains() {
  return QUEST_CHAINS;
}

/** ข้อมูลสายเควสจาก id — undefined ถ้าไม่รู้จัก id นี้ */
export function getChainById(id) {
  return QUEST_CHAINS.find((chain) => chain.id === id);
}

/** true ถ้า id นี้เป็นสายเควสที่ลงทะเบียนไว้จริง */
export function isValidChainId(id) {
  return QUEST_CHAINS.some((chain) => chain.id === id);
}

/** ด่านที่ stageIndex ของสายเควส (chainDef ต้องเป็นค่าที่ได้จาก getChainById
 *  แล้ว) — undefined ถ้า stageIndex เกินขอบเขต (สายจบแล้ว/ index ผิด) */
export function getChainStage(chainDef, stageIndex) {
  if (!chainDef || !Array.isArray(chainDef.stages)) return undefined;
  return chainDef.stages[stageIndex];
}
