// =========================
// statConfig.js
// ค่าตั้งค่าระบบจัดสรรแต้มสเตตัส (RPG Stat Allocation) ทั้งหมด — แก้ตัวเลข
// ที่นี่จุดเดียว ไม่ต้องแก้ systems/statSystem.js หรือ core/statUtils.js
//
// สเตตัสหลัก 3 หมวด แต่ละหมวดแตกเป็น "สเตตัสย่อย" ลงแต้มแยกอิสระจากกัน
// (คนละแต้ม คนละ Dynamic Property) ไม่ผูกรวมกันเหมือนเดิมที่ 1 แต้ม STR
// ให้ทั้งสองผลพร้อมกัน:
//   - STR (Strength)
//       - strAtk    -> เพิ่ม % Attack Damage
//       - strProj   -> เพิ่ม % Projectile Damage
//       - strCritDmg -> เพิ่ม % Critical Damage (ทวีคูณจากฐาน 1.5)
//   - AGI (Agility)
//       - agiSpd     -> เพิ่ม % Movement Speed
//       - agiCrit    -> เพิ่ม % Critical Chance
//       - agiEvasion -> เพิ่ม % Evasion Chance (หลบดาเมจทั้งหมด)
//       - agiParry   -> เพิ่ม % Parry Chance (สะท้อนดาเมจทั้งหมด)
//   - VIT (Vitality)
//       - vitHp    -> เพิ่ม Max Health (flat, ผ่าน health_boost effect)
//       - vitRed   -> เพิ่ม % Damage Reduction
//       - vitBlock -> เพิ่ม % Block Chance (ลดดาเมจครึ่งหนึ่ง)
//
// strCritDmg/agiEvasion/agiParry/vitBlock คือ 4 สเตตัสย่อยที่เพิ่มเข้ามา
// ทดแทนโบนัส criticalDamage/evasionChance/parryChance/blockChance ที่เดิม
// มาจาก item lore เท่านั้น (ระบบ reforge เดิมถูกลบไปแล้ว) — ตอนนี้แต้ม
// สเตตัสเป็นแหล่งเดียวที่ตั้งค่าพวกนี้ได้ (ดู core/statUtils.js
// getStatBonuses() และ systems/combatAttributes.js getAttributes())
//
// agiEvasion/agiParry/vitBlock มี MAX_PERCENT (เพดานสูงสุด) เพราะผลลัพธ์
// คือ "ดาเมจเป็น 0 ทั้งหมด" (evasion/parry) หรือ "ลดดาเมจครึ่งหนึ่ง"
// (block) ไม่ใช่แค่ %โบนัสเพิ่ม/ลดเหมือนสเตตัสอื่น — ถ้าไม่มีเพดานผู้เล่นที่
// ซื้อแต้มด้วยเงินได้ไม่จำกัดจะอัดแต้มจนหลบดาเมจได้เกือบตลอดได้ เพดานถูก
// clamp ที่ getStatBonuses() (core/statUtils.js) ไม่ใช่ที่นี่ — ลงแต้มเกิน
// จุดที่ถึงเพดานแล้วจะไม่มีผลเพิ่มอะไรอีก (แต้มไม่ถูกคืนอัตโนมัติ)
// =========================

export const STAT_CONFIG = {
  STARTING_POINTS: 2,  // แต้มเริ่มต้นตอนเข้าเกมครั้งแรก

  // =========================
  // PLAYER LEVEL (v1.4.0) — EXP/เลเวลของผู้เล่น (ระบบ playerLevel.js)
  // แหล่ง EXP: ฆ่ามอนสเตอร์ / ขุดบล็อก / ขายของในร้าน / เควสสำเร็จ
  // expToNext(level) = floor(BASE_EXP * level^EXPONENT) — pure function
  // อยู่ที่ core/levelUtils.js (unit test ได้)
  // Level up = ได้แต้มฟรี POINTS_PER_LEVEL แต้ม (pool rpg:points เดิม)
  // + ทุก MILESTONE_EVERY เลเวลได้เงินโบนัส MILESTONE_MONEY
  // =========================
  LEVEL: {
    // v1.4.24: EXP ต่อการฆ่าไม่ใช้ค่าคงที่นี้แล้ว — เปลี่ยนไปใช้
    // data/mobExpTable.js (getMobKillExp) ที่ให้ EXP ต่างกันตามความยากของ
    // มอบแต่ละชนิด (บอส 1,000 / มอบทั่วไปไม่เกิน 50) เก็บค่านี้ไว้เป็น
    // fallback ค่าเริ่มต้นของมอบที่ไม่มีในตาราง (DEFAULT_MOB_EXP อ้างอิงตรง
    // นี้แทนที่จะซ้ำตัวเลข)
    EXP_PER_KILL: 5,
    EXP_PER_BLOCK: 1,
    // EXP_PER_SELL ถูกถอดออก (v1.4.6) — การขายของคือ "การหาเงิน" ไม่ให้ EXP
    // RPG แล้ว; EXP มาจากเควส/kill/ขุด เท่านั้น
    EXP_PER_QUEST: 20,
    BASE_EXP: 100,
    EXPONENT: 0.9,
    POINTS_PER_LEVEL: 1,
    MILESTONE_EVERY: 10,
    MILESTONE_MONEY: 10000
  },

  // =========================
  // CLASS SYSTEM (v1.4.0) — เลือกคลาสครั้งแรกฟรี เปลี่ยนภายหลังเสียเงิน
  // MULTIPLIER_VALUE คูณ "โบนัสจากแต้ม" ของหมวดที่คลาสถนัด (ไม่คูณฐานเกม
  // และไม่มี penalty หมวดอื่น) — คูณที่ getStatBonuses() จุดเดียว จึงมีผล
  // ทั้งเมนูสเตตัสและสูตรดาเมจจริงพร้อมกันเสมอ
  // PERKS = โบนัสฟลัตเสริมประจำคลาส (key ตรงกับ field ของ getStatBonuses())
  // =========================
  CLASS: {
    CHANGE_COST: 50000,
    MULTIPLIER_VALUE: 1.25,
    CLASSES: {
      warrior: { groups: ["str"] },
      archer: { groups: ["agi"] },
      adventurer: { groups: ["vit"] }
    },
    PERKS: {
      warrior: { lifestealChanceBonus: 2 },
      archer: { criticalChanceBonusPercent: 3 },
      adventurer: { thornPercentBonus: 5 }
    }
  },

  STR_ATK: {
    ATTACK_DAMAGE_PER_POINT: 2,     // % ต่อแต้ม
    MAX_PERCENT: 100                // เพดาน v1.4.0 — กันทุบ balance ด้วยเงินล้วน ๆ
  },
  STR_PROJ: {
    PROJECTILE_DAMAGE_PER_POINT: 1, // % ต่อแต้ม
    MAX_PERCENT: 100
  },
  AGI_SPD: {
    MOVEMENT_SPEED_PER_POINT: 1,   // % ต่อแต้ม
    MAX_PERCENT: 50                // ความเร็วเกินนี้ควบคุมยาก/ผ่านกำแพง hitbox
  },
  AGI_CRIT: {
    CRITICAL_CHANCE_PER_POINT: 0.5, // % ต่อแต้ม
    MAX_PERCENT: 60                 // คริเกินครึ่ง = ปกติของทุกการตี
  },
  VIT_HP: {
    MAX_HEALTH_PER_POINT: 0.5,        // HP (flat) ต่อแต้ม (nerf v1.4.20: 2 → 0.5, ลด 75%)
    MAX_PERCENT: 20                   // เพดาน bonus HP สูงสุด (total = 20 base + 20 = 40)
  },
  VIT_RED: {
    DAMAGE_REDUCTION_PER_POINT: 1,  // % ต่อแต้ม
    MAX_PERCENT: 40                 // ลดดาเมจ >40% = บอสตีไม่เจ็บ
  },
  STR_CRITDMG: {
    CRITICAL_DAMAGE_PER_POINT: 1,   // % ต่อแต้ม (บวกเข้าฐานทวีคูณ 150%)
    MAX_PERCENT: 150                // คริสูงสุด ~3x ฐาน
  },
  AGI_EVASION: {
    EVASION_CHANCE_PER_POINT: 1,     // % ต่อแต้ม — หลบดาเมจทั้งหมด จึงตั้งอัตราต่ำ
    MAX_PERCENT: 10                  // เพดานสูงสุด (กันอัดแต้มจนหลบได้เกือบตลอด)
  },
  AGI_PARRY: {
    PARRY_CHANCE_PER_POINT: 1,       // % ต่อแต้ม — สะท้อนดาเมจ150% จึงตั้งอัตราต่ำ
    MAX_PERCENT: 10                  // เพดานสูงสุด
  },
  VIT_BLOCK: {
    BLOCK_CHANCE_PER_POINT: 1.5,     // % ต่อแต้ม — ลดดาเมจแค่ครึ่งหนึ่ง จึงตั้งอัตราสูงกว่า evasion/parry ได้
    MAX_PERCENT: 10                  // เพดานสูงสุด
  },

  // LIFESTEAL (v1.4.0 — หมวด STR) — ฮีล % ของ finalDamage ที่ปะทะผู้เล่น
  // (melee/projectile) เข้าตัวผู้โจมตี
  STR_LIFESTEAL: {
    LIFESTEAL_PER_POINT: 0.25,       // % ต่อแต้ม
    MAX_PERCENT: 10                  // 10% ของดาเมจที่ตี = ยังไม่อมตะ
  },

  // THORN (v1.4.0 — หมวด VIT) — สะท้อน % ของ finalDamage กลับไปหาผู้โจมตี
  // melee เท่านั้น (projectile/สิ่งแวดล้อมไม่สะท้อน) สะท้อนผ่าน health
  // component ตรง ๆ ไม่ trigger entityHurt ซ้ำ (ไม่มี loop)
  VIT_THORN: {
    THORN_PER_POINT: 2,              // % ต่อแต้ม
    MAX_PERCENT: 10
  },

  // REGENERATION (v1.4.15) — VIT-ฟื้นเลือด passive HP regen ผ่าน regeneration effect
  // amplifier 0 = +1 HP/2.5s, amplifier 1 = +1 HP/1.25s (เร็ว 2 เท่าต่อ amplifier)
  // ผู้เล่นลง 1 แต้ม = 0.5 amplifier ต่อวินาที (floor → 1 แต้มไม่เพิ่ม amplifier)
  // amplifier ดิบ = Math.floor(points / 2) - 1 (ถ้า points >= 4) → clamp ที่ MAX
  VIT_REGEN: {
    HEALTH_PER_POINT: 0.25,            // HP/2s ต่อแต้ม (nerf v1.4.20: 1 → 0.25, ลด 75%)
    MAX_PERCENT: 2,                    // เพดาน (2 แต้ม)
    REGEN_CHECK_INTERVAL_TICKS: 20,     // refresh ทุก 20 วินาที
    REGEN_DURATION_TICKS: 12000        // buff duration 10 นาที
  },

  // JUMP BOOST (v1.4.15) — AGI-กระโดด passive jump ผ่าน jump_boost effect
  // amplifier 1 ของ jump_boost = +1 บล็อกกระโดดสูงขึ้น
  // ผู้เล่นลง 1 แต้ม = 0.5 amplifier (floor → ต้องลง 2 แต้มจึงเห็นผล)
  AGI_JUMP: {
    JUMP_BOOST_PER_POINT: 0.125,        // amplifier/point (nerf v1.4.20: 0.5 → 0.125, ลด 75%)
    MAX_PERCENT: 5,                    // เพดาน = amplifier 5 = +2.5 บล็อก
    JUMP_CHECK_INTERVAL_TICKS: 20,      // refresh ทุก 20 วินาที
    JUMP_DURATION_TICKS: 12000          // buff duration 10 นาที
  },

  // EXECUTE (v1.4.15) — STR-สังหาร: crit damage bonus เมื่อ HP ผู้เล่น <= threshold
  // ใช้ strength effect ผ่าน buffManager — มีผลจริงโดยไม่ต้องแก้ combatAttributes.js
  // ผู้เล่นลง 1 แต้ม = 0.5 amplifier (strength มีตั้งแต่ amplifier 0 = +3 HP melee)
  // apply เมื่อ HP ปัจจุบัน <= threshold, revoke เมื่อ HP > threshold
  STR_EXECUTE: {
    EXECUTE_PER_POINT: 1,              // % crit damage bonus ต่อแต้ม
    MAX_PERCENT: 30,                   // เพดาน (30 แต้ม)
    EXECUTE_THRESHOLD: 0.3,            // HP threshold = 30%
    EXECUTE_AMPLIFIER_DIVISOR: 2,       // points / 2 = amplifier level (จำนวนเต็ม)
    EXECUTE_CHECK_INTERVAL_TICKS: 20,   // เช็ค HP ทุก 20 วินาที
    EXECUTE_DURATION_TICKS: 600        // buff duration 10 วินาที (refresh ทุก 1 วิ)
  },

  // DAMAGE DISPLAY (v1.4.x) — action bar โชว์ตัวเลขดาเมจตอนตี/ถูกตี
  // ENABLED   = ดาเมจที่ "ตี" ออกไป (ผู้เล่นเป็นฝ่ายโจมตี)
  // SHOW_TAKEN = ดาเมจที่ "โดน" (ผู้เล่นเป็นฝ่ายถูกตี — หัก block/reduction
  //              แล้ว; environmental เช่น ไฟ/ตกสูงไม่แสดง) เปิด/ปิดแยกกัน
  // หมายเหตุ: action bar เป็น slot เดียวของจอ — ตัวเลขจะทับ bar อื่นชั่วครู่
  // (kills-deaths/time/quest progress) ตามธรรมชาติของ Bedrock
  DAMAGE_DISPLAY: {
    ENABLED: true,
    SHOW_TAKEN: true,
    SHOW_LIFESTEAL: true,
    SHOW_THORN: true
  },

  // PROC PARTICLES (v1.4.4) — particle ประกอบตอน proc trigger (คริ/หลบ/
  // แพร์รี่/บล็อก/หนาม) spawn ที่ location ของผู้เสีย/ผู้เกี่ยวข้อง —
  // คนรอบข้างเห็นด้วย (dimension.spawnParticle) โดยโดน throttle 0.5s
  // ชุดเดียวกับ action bar proc feedback
  // หมายเหตุ: ชื่อ particle ที่ runtime ไม่รู้จัก = เงียบ ๆ (try/catch)
  // ปรับชื่อได้ที่ NAMES ทั้งหมด
  PROC_PARTICLES: {
    ENABLED: true,
    NAMES: {
      crit: "minecraft:critical_hit_emitter",
      block: "minecraft:splash_spell_emitter",
      parry: "minecraft:knockback_roar_particle",
      evasion: "minecraft:basic_smoke_particle",
      thorn: "minecraft:villager_angry"
    }
  },

  // health_boost effect เพิ่มเลือดทีละ 4 HP ต่อ amplifier level (นับจาก 0)
  // — ระบบ apply ซ้ำเป็นระยะกันกรณี effect หมดอายุตอนผู้เล่นอยู่นาน ๆ
  HEALTH_BOOST_CHECK_INTERVAL_TICKS: 20,  // เช็คทุกกี่ tick ของ runInterval หลัก (1 วิ/รอบ) — 20 = ทุก 20 วินาที
  HEALTH_BOOST_DURATION_TICKS: 12000,     // ระยะเวลา buff เลือดต่อการ apply 1 ครั้ง (10 นาที)

  // v1.4.18: cap สูงสุดของ evasion/parry/block (รวมจาก stat + gear tier)
  // แต่ละตัว cap แยกกันที่ 70% — ใช้ใน combatAttributes.js:getAttributes()
  DEFENSE_CAP_PERCENT: 70,

  // v1.6.1: cap แยกสำหรับ criticalChance (ไม่ใช้ DEFENSE_CAP_PERCENT)
  CRITICAL_CHANCE_CAP_PERCENT: 100
};
