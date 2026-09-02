// =========================
// questConfig.js
// ค่าตั้งค่าของระบบเควสสุ่ม (systems/quests/) — จุดเดียวที่ควรแก้
// เพื่อปรับเงินรางวัล/จำนวนที่ต้องทำ/คูลดาวน์ ไม่ต้องแตะโมดูลระบบเควส
//
// ตามสถาปัตยกรรมเดียวกับ config/ ไฟล์อื่น (jobConfig.js, shopConfig.js
// ฯลฯ) — แยกค่าตั้งค่าออกจาก logic เสมอ
// =========================

export const QUEST_CONFIG = {
  // เงินรางวัลต่อเควส — สุ่มระหว่าง MIN_MONEY ถึง MAX_MONEY เสมอ (ทุกประเภท
  // เควสใช้ช่วงเดียวกัน ไม่แยกตามประเภท) — นี่คือจุดเดียวที่ควรแก้ถ้าอยาก
  // ปรับ "เงินสูงสุดที่ได้ต่อเควส"
  // Phase 2: เพิ่ม EXP รางวัล (แยกจากเงิน) — ส่งเข้าอาชีพปัจจุบันของผู้เล่น
  // ผ่าน applyJobExp() (jobSystem.js) ตอนเควสสำเร็จ ถ้าผู้เล่นไม่มีอาชีพจะ
  // แปลงเป็นเงินแทนด้วย EXP_TO_MONEY_RATE ด้านล่าง (ดู payReward() ที่
  // quests/progression.js) — คนละค่ากับ MIN_MONEY/MAX_MONEY ข้างบน ไม่เกี่ยวกัน
  REWARD: {
    MIN_MONEY: 50,
    MAX_MONEY: 500,
    MIN_EXP: 20,
    MAX_EXP: 150
  },

  // คูลดาวน์ (วินาที) ก่อนกดปุ่ม "สุ่มเควสใหม่" ได้อีกครั้ง — ใช้ทั้ง 3
  // กรณีเหมือนกันหมด (ยังไม่เคยมีเควสเลย / สุ่มทับเควสเดิมที่ยังไม่เสร็จ /
  // สุ่มเควสใหม่หลังทำเควสก่อนหน้าสำเร็จแล้ว) กันสแปมกดสุ่มหาเควสที่ง่าย
  // หรือรางวัลดีเป็นพิเศษ
  REROLL_COOLDOWN_SECONDS: 600, // 10 นาที

  // Auto Bounty Renew — เควส Bounty สำเร็จแล้ว "สุ่มใบใหม่ให้ทันทีอัตโนมัติ"
  // โดยไม่ต้องเข้าเมนูกดสุ่ม (ผู้เล่นไม่มีช่วงเว้นที่ bounty.active = null)
  // ปิดได้ถ้าอยากกลับไปใช้โหมด "ต้องกดสุ่มเอง" แบบเดิม
  AUTO_BOUNTY_RENEW: true,

  // ประเภทเควสที่เปิดใช้งาน (สุ่มผสมทั้งหมดที่ enabled: true) + ช่วงจำนวน
  // ที่ต้องทำให้ครบ (สุ่มในช่วง [minAmount, maxAmount] ตอนออกเควส)
  //   mine -> ทุบบล็อกที่สุ่มได้ (ดู data/quests.js MINE_POOL)
  //   kill -> ฆ่ามอนสเตอร์ที่สุ่มได้ (ดู data/quests.js KILL_POOL)
  //   sell -> ขายไอเทมที่สุ่มได้ในร้านค้า (ดึงจาก data/items.js ทุกไอเทม
  //           ที่เปิดขายอยู่ — ไม่มีตารางแยกของตัวเอง)
  TYPES: {
    mine: { enabled: true, minAmount: 16, maxAmount: 48 },
    kill: { enabled: true, minAmount: 6, maxAmount: 20 },
    sell: { enabled: true, minAmount: 8, maxAmount: 32 }
  },

  // =========================
  // Daily / Weekly Quest (เตรียม Config ไว้ให้ quests/reset.js ใช้
  // สร้าง/รีเซ็ต Daily-Weekly Quest Engine กลาง — Bounty เดิมด้านบนไม่แตะ
  // Phase 3A: เพิ่ม REROLL_COST — reroll ฟรีได้ FREE_REROLLS ครั้ง/รอบ
  // (นับตาม bangkokDay/bangkokWeek) เกินจากนั้นเสียเงิน REROLL_COST/ครั้ง
  // แทน (ไม่มีคูลดาวน์แบบ Bounty เพราะ Daily/Weekly มีรอบใหม่มาเองอยู่แล้ว)
  // ยังไม่มี UI เรียกใช้ในเฟสนี้ (Phase 4) แต่ engine ฝั่งข้อมูลพร้อมแล้ว
  // =========================

  // จำนวนช่อง (Slot) เควสต่อรอบ + จำนวนครั้งที่ Reroll ได้ฟรีก่อนรีเซ็ตรอบถัดไป
  // + ราคาต่อครั้งหลังใช้ฟรีหมด (บาท หักผ่าน removeMoney() เหมือนค่าธรรมเนียม
  // เปลี่ยนอาชีพใน jobSystem.js — ส่วนหนึ่งเข้าธนาคารกลางเป็นภาษี ดู
  // REROLL_TAX_RATE ด้านล่าง)
  DAILY: {
    SLOTS: 3,
    FREE_REROLLS: 1,
    REROLL_COST: 200
  },
  WEEKLY: {
    SLOTS: 3,
    FREE_REROLLS: 1,
    REROLL_COST: 1000
  },

  // สัดส่วนของ REROLL_COST ที่เข้าธนาคารกลางเป็นภาษี (เหมือนภาษีร้านค้า/
  // ตลาดผู้เล่น) ใช้ทั้ง Daily และ Weekly reroll ร่วมกัน
  REROLL_TAX_RATE: 0.1,

  // ตัวคูณรางวัลตามความยาก — ใช้คูณกับ REWARD_BASE ด้านล่างตอนสุ่มเควส
  // Daily/Weekly (generateQuest()) เควส Bounty เดิมไม่ใช้ค่านี้ (ยังคงสุ่ม
  // จาก REWARD.MIN_MONEY-MAX_MONEY ตรง ๆ เหมือนเดิมทุกประการ)
  DIFFICULTY: {
    easy: { multiplier: 1.0 },
    normal: { multiplier: 1.8 },
    hard: { multiplier: 3.2 },
    epic: { multiplier: 5.5 }
  },

  // เงินรางวัลพื้นฐาน (ก่อนคูณด้วย DIFFICULTY.*.multiplier) ของเควส
  // Daily/Weekly — คนละค่ากับ REWARD ด้านบนที่เป็นของ Bounty โดยเฉพาะ
  // Phase 2: EXP รางวัลพื้นฐานของ Daily/Weekly (ก่อนคูณ DIFFICULTY เหมือน
  // MIN_MONEY/MAX_MONEY ด้านบน) — คนละค่ากับ REWARD.MIN_EXP/MAX_EXP ที่เป็น
  // ของ Bounty โดยเฉพาะ
  REWARD_BASE: {
    MIN_MONEY: 50,
    MAX_MONEY: 200,
    MIN_EXP: 15,
    MAX_EXP: 60
  },

  // อัตราแปลง EXP -> เงิน — Phase 2: ใช้ตอนเควสสำเร็จแล้วมี reward.exp แต่
  // ผู้เล่น "ไม่มีอาชีพ" ให้ใส่ (ไม่มีที่ให้ลง EXP) แปลงเป็นเงินแทนแทนที่จะ
  // ทิ้ง EXP ไปเฉย ๆ (ดู payReward() ที่ quests/progression.js) — 1 EXP = ค่านี้บาท
  EXP_TO_MONEY_RATE: 5
};
