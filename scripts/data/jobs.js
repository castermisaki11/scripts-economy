// =========================
// data/jobs.js
// ฐานข้อมูลอาชีพกลาง (Single Source of Truth) — เพิ่มอาชีพใหม่/แก้รางวัล
// แก้ที่ไฟล์นี้จุดเดียว ไม่ต้องแตะ systems/jobSystem.js
//
// โครงสร้างของแต่ละอาชีพ:
//   id:           string  รหัสอาชีพ (เก็บใน dynamic property ของผู้เล่น)
//   nameKey:      string  locale key ชื่ออาชีพ
//   descKey:      string  locale key คำอธิบายสั้น ๆ
//   icon:         string  ไอคอนที่ใช้แสดงในเมนู
//   triggerType:  "block" | "entity"
//                 "block"  = ได้รางวัลตอนทุบบล็อกที่อยู่ในตาราง (playerBreakBlock)
//                 "entity" = ได้รางวัลตอนฆ่ามอบที่อยู่ในตาราง (entityDie)
//   table:        { [typeId]: { money: number, exp: number } }
//                 typeId ของบล็อก/เอนทิตี้ (มี "minecraft:" นำหน้าเสมอ)
//                 money/exp คือค่า "พื้นฐาน" ก่อนคูณโบนัสเลเวล (ดู
//                 JOB_CONFIG.LEVEL.MONEY_BONUS_PER_LEVEL ใน jobConfig.js)
//   perkEffect:   string (optional) ชนิดเอฟเฟกต์ Minecraft ที่จะให้ผู้เล่น
//                 แบบ passive ระหว่างถืออาชีพนี้อยู่ (เช่น "haste",
//                 "speed", "strength") — เลเวลที่ปลดล็อกแต่ละระดับ
//                 (I/II/III) ใช้ตารางร่วมกันทุกอาชีพจาก
//                 JOB_CONFIG.PERK.TIERS ใน jobConfig.js ไม่ต้องระบุที่นี่
//                 ไม่ใส่ field นี้ = อาชีพนั้นไม่มีเพิร์ค
// =========================

export const JOBS = [
  /* =========================
     MINER — ขุดแร่
  ========================= */
  {
    id: "miner",
    nameKey: "job.miner.name",
    descKey: "job.miner.desc",
    icon: "textures/items/diamond_pickaxe",
    triggerType: "block",
    perkEffect: "haste", // ขุดไว — ชดเชยเวลาขุดหิน/แร่ที่แข็งลง
    table: {
      // ระดับพื้นฐาน
      "minecraft:coal_ore": { money: 4, exp: 2 },
      "minecraft:deepslate_coal_ore": { money: 5, exp: 2 },
      "minecraft:copper_ore": { money: 5, exp: 2 },
      "minecraft:deepslate_copper_ore": { money: 6, exp: 3 },
      "minecraft:iron_ore": { money: 8, exp: 3 },
      "minecraft:deepslate_iron_ore": { money: 9, exp: 3 },

      // ระดับกลาง
      "minecraft:gold_ore": { money: 14, exp: 5 },
      "minecraft:deepslate_gold_ore": { money: 16, exp: 5 },
      "minecraft:redstone_ore": { money: 10, exp: 4 },
      "minecraft:lit_redstone_ore": { money: 10, exp: 4 },
      "minecraft:deepslate_redstone_ore": { money: 12, exp: 4 },
      "minecraft:lit_deepslate_redstone_ore": { money: 12, exp: 4 },
      "minecraft:lapis_ore": { money: 10, exp: 4 },
      "minecraft:deepslate_lapis_ore": { money: 12, exp: 4 },
      "minecraft:nether_gold_ore": { money: 12, exp: 4 },
      "minecraft:nether_quartz_ore": { money: 9, exp: 3 },

      // ระดับสูง / หายาก
      "minecraft:diamond_ore": { money: 40, exp: 12 },
      "minecraft:deepslate_diamond_ore": { money: 45, exp: 12 },
      "minecraft:emerald_ore": { money: 45, exp: 12 },
      "minecraft:deepslate_emerald_ore": { money: 50, exp: 12 },
      "minecraft:ancient_debris": { money: 120, exp: 30 }
    }
  },

  /* =========================
     LUMBERJACK — ตัดไม้
  ========================= */
  {
    id: "lumberjack",
    nameKey: "job.lumberjack.name",
    descKey: "job.lumberjack.desc",
    icon: "textures/items/wood_axe",
    triggerType: "block",
    perkEffect: "speed", // เดินไว — เร่งเดินป่าหาต้นไม้ต้นถัดไป
    table: {
      "minecraft:oak_log": { money: 2, exp: 1 },
      "minecraft:spruce_log": { money: 2, exp: 1 },
      "minecraft:birch_log": { money: 2, exp: 1 },
      "minecraft:jungle_log": { money: 3, exp: 1 },
      "minecraft:acacia_log": { money: 3, exp: 1 },
      "minecraft:dark_oak_log": { money: 3, exp: 1 },
      "minecraft:mangrove_log": { money: 3, exp: 1 },
      "minecraft:cherry_log": { money: 3, exp: 1 },
      // เห็ดยักษ์ (นับเป็น "ไม้" ของสายนี้ด้วย)
      "minecraft:crimson_stem": { money: 4, exp: 2 },
      "minecraft:warped_stem": { money: 4, exp: 2 }
    }
  },

  /* =========================
     HUNTER — ล่าสัตว์/มอนสเตอร์
  ========================= */
  {
    id: "hunter",
    nameKey: "job.hunter.name",
    descKey: "job.hunter.desc",
    icon: "textures/items/iron_sword",
    triggerType: "entity",
    perkEffect: "strength", // แรงขึ้น — ฟันมอนสเตอร์แรงขึ้น
    table: {
      // มอบทั่วไป
      "minecraft:zombie": { money: 6, exp: 3 },
      "minecraft:husk": { money: 7, exp: 3 },
      "minecraft:drowned": { money: 7, exp: 3 },
      "minecraft:skeleton": { money: 6, exp: 3 },
      "minecraft:stray": { money: 7, exp: 3 },
      "minecraft:spider": { money: 5, exp: 2 },
      "minecraft:cave_spider": { money: 6, exp: 3 },
      "minecraft:silverfish": { money: 3, exp: 1 },
      "minecraft:slime": { money: 4, exp: 2 },
      "minecraft:creeper": { money: 8, exp: 4 },
      "minecraft:phantom": { money: 8, exp: 4 },

      // มอบระดับกลาง
      "minecraft:enderman": { money: 15, exp: 6 },
      "minecraft:witch": { money: 15, exp: 6 },
      "minecraft:pillager": { money: 12, exp: 5 },
      "minecraft:vindicator": { money: 16, exp: 6 },
      "minecraft:evoker": { money: 25, exp: 10 },
      "minecraft:vex": { money: 10, exp: 4 },
      "minecraft:blaze": { money: 18, exp: 7 },
      "minecraft:magma_cube": { money: 8, exp: 3 },
      "minecraft:ghast": { money: 25, exp: 10 },
      "minecraft:guardian": { money: 16, exp: 6 },
      "minecraft:piglin_brute": { money: 18, exp: 7 },
      "minecraft:hoglin": { money: 14, exp: 5 },
      "minecraft:zoglin": { money: 16, exp: 6 },

      // บอส / มอบระดับสูง
      "minecraft:ravager": { money: 60, exp: 20 },
      "minecraft:elder_guardian": { money: 80, exp: 25 },
      "minecraft:warden": { money: 200, exp: 60 },
      "minecraft:wither": { money: 300, exp: 80 },
      "minecraft:ender_dragon": { money: 500, exp: 150 }
    }
  },

];

const JOB_BY_ID = new Map(JOBS.map((j) => [j.id, j]));

/** รายการอาชีพทั้งหมด ตามลำดับที่ประกาศไว้ */
export function getJobs() {
  return JOBS;
}

/** ข้อมูลอาชีพตาม id — undefined ถ้าไม่รู้จัก */
export function getJobById(jobId) {
  return JOB_BY_ID.get(jobId);
}

/** true ถ้า jobId นี้ถูกลงทะเบียนไว้ในระบบอาชีพ */
export function isValidJob(jobId) {
  return JOB_BY_ID.has(jobId);
}

/**
 * ตารางรางวัลของ typeId หนึ่ง ๆ ภายใต้อาชีพที่ระบุ — undefined ถ้าอาชีพนี้
 * ไม่มีรางวัลให้ typeId นี้ (เช่น Miner ไปทุบไม้ จะได้ undefined)
 * @param {string} jobId
 * @param {string} typeId  typeId ของบล็อก/เอนทิตี้ (มี "minecraft:" นำหน้า)
 */
export function getJobRewardEntry(jobId, typeId) {
  return JOB_BY_ID.get(jobId)?.table?.[typeId];
}

/**
 * ตรวจสอบความถูกต้องของข้อมูลอาชีพทั้งหมด — เรียกจาก data/index.js ตอน
 * โลกโหลดครั้งเดียว (เหมือน validateItems/validateEffects) คืนรายการ
 * ปัญหาที่พบเป็น string[] (ไม่ throw เพื่อไม่ให้อาชีพเดียวที่ผิดพลาดทำทั้ง
 * แอดออนพัง)
 */
export function validateJobs() {
  const issues = [];
  const seenIds = new Set();

  for (const job of JOBS) {
    if (seenIds.has(job.id)) issues.push(`jobs: id ซ้ำ "${job.id}"`);
    seenIds.add(job.id);

    if (job.triggerType !== "block" && job.triggerType !== "entity") {
      issues.push(`jobs.${job.id}: triggerType ต้องเป็น "block" หรือ "entity" เท่านั้น`);
    }

    if (!job.table || Object.keys(job.table).length === 0) {
      issues.push(`jobs.${job.id}: ไม่มีตารางรางวัล (table) เลย`);
      continue;
    }

    for (const [typeId, entry] of Object.entries(job.table)) {
      if (!typeId.startsWith("minecraft:")) {
        issues.push(`jobs.${job.id}: typeId "${typeId}" ควรมี "minecraft:" นำหน้า`);
      }
      if (typeof entry?.money !== "number" || entry.money < 0) {
        issues.push(`jobs.${job.id}.${typeId}: money ต้องเป็นตัวเลข >= 0`);
      }
      if (typeof entry?.exp !== "number" || entry.exp < 0) {
        issues.push(`jobs.${job.id}.${typeId}: exp ต้องเป็นตัวเลข >= 0`);
      }
    }
  }

  return issues;
}
