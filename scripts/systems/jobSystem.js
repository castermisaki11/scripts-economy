// =========================
// jobSystem.js
// ระบบอาชีพ (Job Framework): เลือกอาชีพ, เปลี่ยนอาชีพ (คูลดาวน์ + ค่าธรรมเนียม),
// รับเงินรางวัลอัตโนมัติตามอาชีพ (ขุดแร่ / ตัดไม้ / ฆ่ามอนสเตอร์), ระบบ
// เลเวล/exp แยกต่ออาชีพต่อผู้เล่น (สลับอาชีพไปมาไม่เสีย progress เดิม),
// และเพิร์คพิเศษต่ออาชีพ (เอฟเฟกต์ passive ที่ปลดล็อกตามเลเวล — ดูหัวข้อ
// "PERK" ด้านล่าง)
//
// สถาปัตยกรรมเดียวกับระบบอื่นในแอดออน:
// - ไม่สร้าง ActionFormData/ModalFormData/MessageFormData ตรง ๆ (ผ่าน
//   UIFramework.js / confirmDialog.js เท่านั้น)
// - นำทางผ่าน NavigationManager (ผู้เรียกต้อง push ก่อนเข้าไฟล์นี้เสมอ —
//   ดูรูปแบบเดียวกับ economy.js/homeSystem.js)
// - ทุกสตริงผ่าน t()
// - เงินผ่าน economyUtils.js (changeMoney/getMoney) จุดเดียว ไม่เขียน
//   dynamic property "money" ตรงเอง
//
// เก็บข้อมูลผู้เล่น: dynamic property เดียว "jobData" (JSON) ต่อผู้เล่น
//   { currentJob: string|null, changedAt: number (tick ตอนเปลี่ยนล่าสุด),
//     jobs: { [jobId]: { exp: number, level: number } } }
// =========================

import { world, system } from "@minecraft/server";
import { createListMenu } from "../ui/framework/UIFramework";
import { showConfirm } from "../core/confirmDialog";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { t } from "../ui/locale/index";
import { getMoney, changeMoney, depositToBank } from "../core/economyUtils";
import { showSuccess, showError, showActionBar, showTitle } from "../core/messageUtils";
import { playSuccess, playError, playCancel, playJobLevelUp } from "../core/soundUtils";
import { TICKS_PER_SECOND } from "../core/constants";
import { JOB_CONFIG } from "../config/jobConfig";
import { getJobs, getJobById, getJobRewardEntry } from "../data/jobs";
import { resolveAttackingPlayer, resolveAttacker } from "../core/playerUtils";
import { getPlayerRankTag, getVipMoneyMultiplier, getVipExpMultiplier } from "../core/rankUtils";
import { grantBuff } from "../core/buffManager";
import { getLastAttacker, clearLastAttacker, resolveLastAttacker } from "../core/lastAttackerTracker";
// Phase 2: Job <-> Quest Integration — jobSystem.js เป็นฝ่าย import จาก
// questSystem.js ทิศทางเดียว (เหมือน shopSystem.js ที่ import reportItemSold
// อยู่แล้วตั้งแต่ Phase 1) questSystem.js เองไม่ import jobSystem.js กลับมา
// เลย (ใช้ registerJobBridge() แบบ Dependency Injection แทน) จึงไม่มี
// Circular Import ระหว่างสองไฟล์นี้ — ดูรายละเอียดที่ registerJobBridge()
// ตรงท้ายไฟล์นี้
import { reportJobExpGained, reportJobLevelUp, registerJobBridge } from "./questSystem";
import { subscribeSafe, BLOCK_BREAK_EVENTS } from "../core/eventGuard";

const JOB_DYNAMIC_PROPERTY_KEY = "jobData";

/* =========================
   STORAGE
========================= */

function readJobData(player) {
  try {
    const raw = Database.get(player, JOB_DYNAMIC_PROPERTY_KEY);
    if (typeof raw !== "string") return { currentJob: null, changedAt: 0, jobs: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { currentJob: null, changedAt: 0, jobs: {} };
    return {
      currentJob: typeof parsed.currentJob === "string" ? parsed.currentJob : null,
      changedAt: typeof parsed.changedAt === "number" ? parsed.changedAt : 0,
      jobs: typeof parsed.jobs === "object" && parsed.jobs !== null ? parsed.jobs : {}
    };
  } catch {
    return { currentJob: null, changedAt: 0, jobs: {} };
  }
}

function saveJobData(player, data) {
  if (!player?.isValid) return;
    Database.set(player, JOB_DYNAMIC_PROPERTY_KEY, JSON.stringify(data));
}

// exp/level ปัจจุบันของผู้เล่นในอาชีพหนึ่ง ๆ — ค่าเริ่มต้น {exp:0, level:1}
// ถ้าผู้เล่นยังไม่เคยมี progress ในอาชีพนั้นมาก่อน
function getProgress(data, jobId) {
  return data.jobs[jobId] ?? { exp: 0, level: 1 };
}

// Phase 2: อ่าน "อาชีพปัจจุบัน" ของผู้เล่น — จุดเดียวที่ questSystem.js ใช้
// (ผ่าน registerJobBridge() ด้านล่างไฟล์นี้ ไม่ import jobSystem.js ตรง ๆ)
// เพื่อตัดสินใจว่าเควสที่ให้ EXP เป็นรางวัลจะส่งเข้าอาชีพไหน — คืน null ถ้า
// ผู้เล่นยังไม่มีอาชีพ (เหมือน readJobData().currentJob เดิมทุกประการ)
export function getCurrentJobId(player) {
  if (!player?.isValid) return null;
  return readJobData(player).currentJob;
}

/* =========================
   LEVEL / EXP FORMULA
========================= */

// exp ที่ต้องใช้เพื่อเลื่อนจาก level ไป level+1
function expNeededForLevel(level) {
  return Math.round(JOB_CONFIG.LEVEL.BASE_EXP * Math.pow(JOB_CONFIG.LEVEL.GROWTH, level - 1));
}

// ตัวคูณโบนัสเงินจากเลเวลปัจจุบัน
function getMoneyMultiplier(level) {
  return 1 + (level - 1) * JOB_CONFIG.LEVEL.MONEY_BONUS_PER_LEVEL;
}

/* =========================
   VIP (ตัวคูณเงิน/exp เพิ่มพิเศษจาก tag — ดู JOB_CONFIG.VIP)
   ย้าย getVipMoneyMultiplier()/getVipExpMultiplier() ไปเป็น utility กลาง
   ที่ core/rankUtils.js แล้ว (import ด้านบน) เพื่อให้ระบบอื่นเรียกใช้ตัวคูณ
   VIP แบบเดียวกันได้โดยไม่ต้องเขียนตัวแปลง TAG_MODIFIERS ซ้ำเอง
========================= */

/* =========================
   PERK (เอฟเฟกต์ passive ตามอาชีพ+เลเวล)
========================= */

// เพิร์คระดับสูงสุดที่ปลดล็อกแล้วที่เลเวลนี้ — ไล่จาก tier สูงสุดลงมา คืน
// tier แรกที่ level ถึงเกณฑ์ (JOB_CONFIG.PERK.TIERS เรียงจากน้อยไปมากเสมอ)
// คืน null ถ้ายังไม่ถึงเกณฑ์ต่ำสุดเลย (ยังไม่ปลดล็อกเพิร์คใด ๆ)
function getActivePerkTier(level) {
  const tiers = JOB_CONFIG.PERK.TIERS;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (level >= tiers[i].level) return tiers[i];
  }
  return null;
}

// รอบรีเฟรชเอฟเฟกต์ให้ผู้เล่นออนไลน์ทุกคนที่มีอาชีพ+ปลดล็อกเพิร์คแล้ว —
// ให้ effect ใหม่ทับของเดิมทุก REFRESH_INTERVAL_TICKS (ระยะเวลาเอฟเฟกต์
// EFFECT_DURATION_TICKS นานกว่ารอบรีเฟรชเสมอ กันกระพริบ/หมดอายุระหว่าง
// รอยต่อ) — พอเปลี่ยน/เลิกอาชีพ ไม่มีการรีเฟรชอีก เอฟเฟกต์จะค่อย ๆ หมดไป
// เองภายในไม่กี่วินาที ไม่ต้องเคลียร์เอฟเฟกต์ตรง ๆ ตอนเปลี่ยนอาชีพ
// (เหมือนหลักการ ACTIONBAR LOOP ใน scoreboard.js — วนทุกคนที่ออนไลน์)
if (JOB_CONFIG.PERK.ENABLED) {
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      if (!player?.isValid) continue;

      const data = readJobData(player);
      if (!data.currentJob) continue;

      const job = getJobById(data.currentJob);
      if (!job?.perkEffect) continue;

      const progress = getProgress(data, job.id);
      const tier = getActivePerkTier(progress.level);
      if (!tier) continue; // ยังไม่ถึงเลเวลปลดล็อกเพิร์คแรก

      // ให้ผ่านระบบกลาง (core/buffManager.js) แทน player.addEffect() ตรง ๆ
      // sourceId ผูกกับ job.id เฉพาะเจาะจง — พอเปลี่ยน/เลิกอาชีพ รอบนี้จะ
      // เลิกเรียก grantBuff ด้วย sourceId นี้ไปเอง source เดิมจึงหมดอายุ
      // ไปเองภายใน EFFECT_DURATION_TICKS โดยไม่ต้อง revokeBuff ตรง ๆ
      // (พฤติกรรมเดิมทุกประการ) — tier.amplifier เป็น amplifier ดิบ (0-based)
      // ต้อง +1 ก่อนส่งเข้า grantBuff ซึ่งรับหน่วย level (เริ่มที่ 1)
      grantBuff(player, job.perkEffect, tier.amplifier + 1, JOB_CONFIG.PERK.EFFECT_DURATION_TICKS, "job:" + job.id);
    }
  }, JOB_CONFIG.PERK.REFRESH_INTERVAL_TICKS);
}

/* =========================
   EXP / LEVEL-UP CORE (Phase 2: แยกออกมาจาก grantReward() เดิม)
   รับ EXP ที่ "คำนวณ/คูณตัวคูณเสร็จแล้ว" จากผู้เรียก (grantReward() คูณ
   EXP_RATE + VIP ให้เสร็จก่อนส่งเข้ามา — จุดเดียวในระบบที่คูณตัวคูณพวกนี้
   ดู "VIP EXP Multiplier" ด้านล่าง) หน้าที่ของฟังก์ชันนี้คือ: อ่าน jobData ->
   บวก EXP -> ไล่เลเวลอัป (สูตร expNeededForLevel() เดิมทุกประการ) -> จำกัด
   ที่ MAX_LEVEL -> บันทึก jobData -> ปลดล็อกเพิร์ค (ถ้าเลเวลอัปข้าม tier) ->
   โชว์ข้อความ/เสียงเลเวลอัป (เหมือนเดิมทุกประการ) -> รายงานเข้า Quest System
   (Report API จาก Phase 1 — reportJobExpGained/reportJobLevelUp)
   ใช้ได้ทั้งจาก grantReward() (Job Action ปกติ) และจาก questSystem.js
   (เควสสำเร็จแล้วให้ EXP อาชีพเป็นรางวัล) — ผู้เรียกทั้งสองฝั่งได้ผลลัพธ์
   เดียวกันเป๊ะ ไม่มีสูตร EXP ใหม่ซ้ำซ้อน
   คืนค่า { level, leveledUp } ให้ผู้เรียกใช้ต่อ (เช่น grantReward() เอาไป
   ใส่ใน earnActionBar ที่ต้องโชว์ level ล่าสุดหลังบวก exp แล้ว)
========================= */

export function applyJobExp(player, jobId, exp, preloadedData) {
  if (!player?.isValid) return { level: 1, leveledUp: false };

  const data = preloadedData ?? readJobData(player);
  const progress = getProgress(data, jobId);
  const levelBeforeReward = progress.level;

  const safeExp = Math.max(0, Math.round(exp));
  let leveledUp = false;
  const maxLevel = JOB_CONFIG.LEVEL.MAX_LEVEL;

  if (progress.level < maxLevel) {
    progress.exp += safeExp;
    while (progress.level < maxLevel && progress.exp >= expNeededForLevel(progress.level)) {
      progress.exp -= expNeededForLevel(progress.level);
      progress.level += 1;
      leveledUp = true;
    }
    if (progress.level >= maxLevel) progress.exp = 0; // ชนเลเวลสูงสุด — ไม่สะสม exp เกินความจำเป็นอีก
  }

  data.jobs[jobId] = progress;
  saveJobData(player, data);

  const job = getJobById(jobId);
  const jobName = t(job?.nameKey ?? "");

  if (leveledUp) {
    playJobLevelUp(player);
    showSuccess(player, t("job.levelUp", { job: jobName, level: progress.level }));

    // เลเวลอัปรอบนี้ข้ามเกณฑ์ปลดล็อกเพิร์ค tier ไหนไปบ้างไหม (ปกติข้ามทีละ
    // 1 เลเวล แต่ exp ก้อนใหญ่ก้อนเดียวอาจทำให้เลเวลขึ้นหลายขั้นพร้อมกันได้
    // จึงเช็คทุก tier ที่อยู่ในช่วง (levelBeforeReward, progress.level] แทน
    // เทียบแค่ level ปัจจุบันกับ tier เดียว) — โชว์ title กลางจอ เด่นกว่า
    // ข้อความแชทธรรมดา เพราะเป็นโมเมนต์พิเศษที่อยากให้สังเกตเห็นชัด ๆ
    if (job?.perkEffect) {
      const unlockedTier = JOB_CONFIG.PERK.TIERS.find(
        (tier) => tier.level > levelBeforeReward && tier.level <= progress.level
      );
      if (unlockedTier) {
        showTitle(
          player,
          t("job.perkUnlockTitle"),
          t("job.perkUnlockSubtitle", {
            effect: t(`job.perkEffect.${job.perkEffect}`),
            tier: formatPerkTier(unlockedTier.amplifier)
          })
        );
      }
    }
  }

  // Report เข้า Quest System จุดเดียว (ห้ามให้ grantReward()/ผู้เรียกอื่น
  // report ซ้ำอีก — ดูคอมเมนต์ที่ grantReward() ด้านล่าง) — report เฉพาะตอน
  // exp ที่ใส่จริง > 0 เท่านั้น (reportJobExpGained() เองก็มี guard exp<=0
  // อยู่แล้วจาก Phase 1 แต่เช็คซ้ำที่นี่กันงานเปล่าเรื่อง save/JSON.stringify
  // ฝั่ง questSystem.js ด้วย)
  if (safeExp > 0) {
    reportJobExpGained(player, jobId, safeExp);
    // นับเป็น "1 ครั้งเลเวลอัป" ต่อการเรียก applyJobExp() 1 ครั้งเท่านั้น
    // (ไม่ว่ารอบนี้จะข้ามกี่เลเวลก็ตาม) —ตรงกับ semantics ของ
    // reportJobLevelUp()/job_levelup objective ที่ Phase 1 ออกแบบไว้แล้ว
    // (นับ "เหตุการณ์เลเวลอัป" ไม่ใช่ "จำนวนเลเวลที่ข้าม")
    if (leveledUp) reportJobLevelUp(player, jobId);
  }

  return { level: progress.level, leveledUp };
}

/* =========================
   REWARD (เรียกจาก event handler ด้านล่าง)
========================= */

function grantReward(player, jobId, entry) {
  if (!player?.isValid) return;

  const data = readJobData(player);
  const progress = getProgress(data, jobId);

  // ตัวคูณเงิน/exp (level bonus + VIP tag) คำนวณจาก level "ก่อน" exp รอบนี้
  // เสมอ (เหมือนพฤติกรรมเดิมทุกประการ — ไม่ใช้ level หลังเลเวลอัปมาคูณย้อน)
  const money = Math.max(0, Math.round(entry.money * getMoneyMultiplier(progress.level) * getVipMoneyMultiplier(player)));
  if (money > 0) changeMoney(player, money);

  // exp ฐานของ reward (data/jobs.js) -> คูณ EXP_RATE รวมทั้งระบบ
  // (JOB_CONFIG.LEVEL.EXP_RATE) -> คูณ VIP tag เพิ่มอีกที (ถ้ามี) — ปัดเป็น
  // จำนวนเต็มครั้งเดียวตรงนี้ ใช้ค่าเดียวกันทั้งสะสม exp และโชว์ actionbar —
  // จุดเดียวในทั้งระบบที่คูณ EXP_RATE/VIP (applyJobExp() ไม่คูณซ้ำ กัน Double
  // Multiplication ตาม Phase 2 สเปคข้อ 4 — EXP จากเควส (questSystem.js เรียก
  // applyJobExp() ตรง ๆ) จึงไม่โดนตัวคูณ VIP ของระบบอาชีพนี้ซ้ำด้วยเช่นกัน
  // เพราะเควสมีค่า EXP รางวัลเป็นของตัวเองอยู่แล้วจาก config/questConfig.js)
  const exp = Math.max(0, Math.round(entry.exp * JOB_CONFIG.LEVEL.EXP_RATE * getVipExpMultiplier(player)));

  const { level } = applyJobExp(player, jobId, exp, data);

  const job = getJobById(jobId);
  const jobName = t(job?.nameKey ?? "");

  showActionBar(player, t("job.earnActionBar", { money, exp, job: jobName, level }), "job");
}

/* =========================
   EVENT HOOKS
   - block: ทุบบล็อกที่อยู่ในตารางของอาชีพปัจจุบัน (playerBreakBlock)
   - entity: ฆ่ามอบที่อยู่ในตารางของอาชีพปัจจุบัน (entityDie — รองรับ
     projectile owner เหมือนแพทเทิร์นเดียวกับ scoreboard.js)

   ⚠️ Bugfix (v1.4.24): เหมือนบั๊กที่เจอใน playerLevel.js — combatAttributes.js
   ปรับดาเมจตามสเตตัส RPG โดยเขียน health ผ่าน health.setCurrentValue()
   ตรง ๆ (ไม่ใช่ applyDamage()) พอมอบตายจากการปรับเลือดแบบนี้
   event.damageSource ที่มากับ entityDie จะไม่มี damagingEntity ที่ถูกต้อง
   ทำให้ resolveAttackingPlayer() บน entityDie ตรง ๆ คืนค่า undefined —
   รางวัลอาชีพจากการฆ่ามอบเลยขึ้นเฉพาะตอนโดนดาเมจวานิลาล้วน ๆ เท่านั้น —
   แก้แบบเดียวกับ scoreboard.js/playerLevel.js: จำ "ผู้โจมตีล่าสุด" ไว้ตอน
   entityHurt (damageSource ยังสมบูรณ์อยู่) แล้วดึงมาใช้ fallback ตอน entityDie
========================= */

const LAST_HIT_TIMEOUT = TICKS_PER_SECOND * 10;

subscribeSafe(BLOCK_BREAK_EVENTS, (event) => {
  try {
    const { player, brokenBlockPermutation } = event;
    if (!player?.isValid) return;

    const data = readJobData(player);
    if (!data.currentJob) return;

    const job = getJobById(data.currentJob);
    if (!job || job.triggerType !== "block") return;

    const typeId = brokenBlockPermutation?.type?.id;
    if (!typeId) return;

    const entry = getJobRewardEntry(job.id, typeId);
    if (!entry) return;

    grantReward(player, job.id, entry);
  } catch (error) {
    console.warn("[JobSystem] playerBreakBlock handler error:", error);
  }
}, "JobSystem");

subscribeSafe(["entityDie"], (event) => {
  try {
    const { damageSource, deadEntity } = event;
    if (deadEntity.typeId === "minecraft:player") return;

    let attacker = resolveAttackingPlayer(damageSource);
    if (!attacker || attacker.id === deadEntity.id) {
      attacker = resolveLastAttacker(deadEntity.id, system.currentTick);
    }
    clearLastAttacker(deadEntity.id);

    if (!attacker || attacker.id === deadEntity.id) return;

    const data = readJobData(attacker);
    if (!data.currentJob) return;

    const job = getJobById(data.currentJob);
    if (!job || job.triggerType !== "entity") return;

    const entry = getJobRewardEntry(job.id, deadEntity.typeId);
    if (!entry) return;

    grantReward(attacker, job.id, entry);
  } catch (error) {
    console.warn("[JobSystem] entityDie handler error:", error);
  }
});

/* =========================
   TIME FORMAT (สำหรับข้อความคูลดาวน์)
========================= */

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  if (hours > 0) return t("job.durationHM", { h: hours, m: minutes });
  if (minutes > 0) return t("job.durationMS", { m: minutes, s: seconds });
  return t("job.durationS", { s: seconds });
}

// amplifier (0-indexed) -> เลขโรมัน สำหรับแสดงระดับเพิร์คในเมนู (I/II/III)
const PERK_TIER_ROMAN = ["I", "II", "III", "IV", "V"];
function formatPerkTier(amplifier) {
  return PERK_TIER_ROMAN[amplifier] ?? String(amplifier + 1);
}

// บรรทัดสถานะเพิร์คสำหรับแนบท้าย body ของ openJobUI() — คืนสตริงว่างถ้า
// อาชีพนี้ไม่มีเพิร์ค (ไม่มี field perkEffect ใน data/jobs.js)
function buildPerkLine(job, level) {
  if (!job?.perkEffect) return "";

  const effectName = t(`job.perkEffect.${job.perkEffect}`);
  const tier = getActivePerkTier(level);

  if (tier) {
    return t("job.perkActive", { effect: effectName, tier: formatPerkTier(tier.amplifier) });
  }

  const nextTier = JOB_CONFIG.PERK.TIERS[0];
  return t("job.perkLocked", {
    effect: effectName,
    tier: formatPerkTier(nextTier.amplifier),
    level: nextTier.level
  });
}

// แสดงบรรทัด VIP เพิ่มพิเศษในเมนู ถ้าผู้เล่นมี tag ที่ตรงกับ
// JOB_CONFIG.VIP.TAG_MODIFIERS อย่างน้อย 1 อัน (ตัวคูณ != 1 จริง ๆ) — คืน
// "" เฉย ๆ ถ้าไม่มี VIP ใช้งานอยู่ (เหมือนแพทเทิร์น buildPerkLine ด้านบน)
// จัดรูปแบบเครื่องหมาย +/- เองตรงนี้ (ไม่ hardcode "+" ใน locale string)
// เผื่อ moneyMultiplier/expMultiplier ใน config ถูกตั้งเป็นค่าลด (< 1)
function formatSignedPercent(percent) {
  return percent >= 0 ? `+${percent}` : `${percent}`;
}

function buildVipLine(player) {
  const moneyBonus = Math.round((getVipMoneyMultiplier(player) - 1) * 100);
  const expBonus = Math.round((getVipExpMultiplier(player) - 1) * 100);
  if (moneyBonus === 0 && expBonus === 0) return "";
  return t("job.vipActive", {
    moneyBonus: formatSignedPercent(moneyBonus),
    expBonus: formatSignedPercent(expBonus)
  });
}

// ป้าย rank ของผู้เล่น (ใช้แสดงในบรรทัด rewardsRankLine ด้านล่าง) — ย้ายไป
// เป็น utility กลางที่ core/rankUtils.js แล้ว เพื่อให้ระบบอื่นเรียกใช้ได้
// ด้วย (ยังอ่านจาก JOB_CONFIG.VIP.TAG_MODIFIERS เหมือนเดิมทุกประการ)

/* =========================
   UI: หน้าหลักของระบบอาชีพ
========================= */

export const openJobUI = safeAsync(async (player) => {
  if (!player?.isValid) return;

  const data = readJobData(player);
  const job = data.currentJob ? getJobById(data.currentJob) : null;

  let bodyKey, bodyVars;
  if (job) {
    const progress = getProgress(data, job.id);
    const maxLevel = JOB_CONFIG.LEVEL.MAX_LEVEL;
    const bonus = Math.round((getMoneyMultiplier(progress.level) - 1) * 100);
    const perkLine = buildPerkLine(job, progress.level);
    const vipLine = buildVipLine(player);

    bodyVars = { job: t(job.nameKey), level: progress.level, bonus, perkLine, vipLine };

    if (progress.level >= maxLevel) {
      bodyKey = "job.bodyMaxLevel";
    } else {
      bodyKey = "job.bodyWithJob";
      bodyVars.exp = progress.exp;
      bodyVars.expNeeded = expNeededForLevel(progress.level);
    }
  } else {
    bodyKey = "job.bodyNoJob";
  }

  const items = [
    { id: "change", labelKey: job ? "job.changeButton" : "job.selectButton", icon: "textures/ui/refresh_light" },
    { id: "rewards", labelKey: "job.rewardsButton", icon: "textures/ui/icon_recipe_item" }
  ];

  return createListMenu(player, {
    titleKey: "job.title",
    bodyKey,
    bodyVars,
    menuGroup: "jobMenu",
    items,
    onSelect: (item) => {
      switch (item.id) {
        case "change":
          NavigationManager.push(player, () => openJobUI(player));
          return openJobSelectUI(player);

        case "rewards":
          NavigationManager.push(player, () => openJobUI(player));
          return openJobRewardsPickerUI(player);
      }
    }
  });
}

/* =========================
   UI: เลือก/เปลี่ยนอาชีพ
========================= */

export const openJobSelectUI = safeAsync(async (player) => {
  if (!player?.isValid) return;

  const data = readJobData(player);
  const items = getJobs()
    .filter((j) => j.id !== data.currentJob)
    .map((j) => {
      const played = j.id in data.jobs; // เคยเลือกอาชีพนี้มาก่อนไหม (มี progress เก็บไว้)
      return played
        ? { id: j.id, labelKey: "job.selectItemLabelPlayed", labelVars: { name: t(j.nameKey), level: getProgress(data, j.id).level }, icon: j.icon }
        : { id: j.id, labelKey: "job.selectItemLabelNew", labelVars: { name: t(j.nameKey) }, icon: j.icon };
    });

  return createListMenu(player, {
    titleKey: "job.selectTitle",
    items,
    onSelect: (item) => {
      const targetJob = getJobById(item.id);
      if (!targetJob) return NavigationManager.back(player);

      // ยังไม่เคยมีอาชีพมาก่อน — เลือกได้ฟรีทันที ไม่มีคูลดาวน์/ค่าธรรมเนียม
      if (!data.currentJob) {
        return showConfirm({
          player,
          titleKey: "job.selectConfirmTitle",
          bodyKey: "job.selectConfirmBody",
          bodyVars: { job: t(targetJob.nameKey), desc: t(targetJob.descKey) },
          onCancel: () => {
            playCancel(player);
            return NavigationManager.back(player);
          },
          onConfirm: () => executeJobChange(player, data, targetJob, 0)
        });
      }

      // มีอาชีพอยู่แล้ว — ต้องผ่านคูลดาวน์ + มีเงินพอค่าธรรมเนียมก่อน
      const now = system.currentTick;
      const elapsedSeconds = (now - data.changedAt) / TICKS_PER_SECOND;
      const remainingSeconds = JOB_CONFIG.CHANGE.COOLDOWN_SECONDS - elapsedSeconds;

      if (remainingSeconds > 0) {
        playError(player);
        showError(player, t("job.changeCooldown", { time: formatDuration(remainingSeconds) }));
        return NavigationManager.close(player);
      }

      const fee = JOB_CONFIG.CHANGE.FEE;
      if (getMoney(player) < fee) {
        playError(player);
        showError(player, t("job.changeInsufficientFunds", { fee }));
        return NavigationManager.close(player);
      }

      const currentJob = getJobById(data.currentJob);

      return showConfirm({
        player,
        titleKey: "job.changeConfirmTitle",
        bodyKey: "job.changeConfirmBody",
        bodyVars: {
          from: t(currentJob?.nameKey ?? ""),
          to: t(targetJob.nameKey),
          desc: t(targetJob.descKey),
          fee,
          after: getMoney(player) - fee
        },
        onCancel: () => {
          playCancel(player);
          return NavigationManager.back(player);
        },
        onConfirm: () => executeJobChange(player, data, targetJob, fee)
      });
    }
  });
}

function executeJobChange(player, data, targetJob, fee) {
  if (fee > 0) {
    changeMoney(player, -fee);
    // ค่าธรรมเนียมเปลี่ยนอาชีพ เข้าธนาคารกลางเหมือนภาษีค่าโอน/ตลาด
    depositToBank(fee);
  }

  data.currentJob = targetJob.id;
  data.changedAt = system.currentTick;
  if (!data.jobs[targetJob.id]) data.jobs[targetJob.id] = { exp: 0, level: 1 };

  saveJobData(player, data);

  playSuccess(player);
  showSuccess(player, t(fee > 0 ? "job.changeSuccess" : "job.selectSuccess", { job: t(targetJob.nameKey), fee }));

  // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตกที่ push ไว้ (openJobUI)
  return NavigationManager.close(player);
}

/* =========================
   UI: ดูตารางรางวัลของอาชีพ (read-only)
========================= */

function formatTypeIdName(typeId) {
  return typeId
    .replace("minecraft:", "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const openJobRewardsPickerUI = safeAsync(async (player) => {
  if (!player?.isValid) return;

  const items = getJobs().map((j) => ({ id: j.id, labelKey: j.nameKey, icon: j.icon }));

  return createListMenu(player, {
    titleKey: "job.rewardsPickerTitle",
    items,
    onSelect: (item) => {
      NavigationManager.push(player, () => openJobRewardsPickerUI(player));
      return openJobRewardsUI(player, item.id);
    }
  });
}

export const openJobRewardsUI = safeAsync(async (player, jobId) => {
  if (!player?.isValid) return;

  const job = getJobById(jobId);
  if (!job) return NavigationManager.back(player);

  // ใช้สูตรเดียวกับ grantReward() เป๊ะ ๆ (level bonus ของอาชีพนี้ + VIP tag)
  // เพื่อให้ตารางโชว์ "ค่าที่ได้จริง" ของผู้เล่นคนนี้ ไม่ใช่ค่าฐาน
  const data = readJobData(player);
  const progress = getProgress(data, jobId);
  const moneyLevelMultiplier = getMoneyMultiplier(progress.level);
  const vipMoneyMultiplier = getVipMoneyMultiplier(player);
  const vipExpMultiplier = getVipExpMultiplier(player);
  const rankLine = t("job.rewardsRankLine", { rank: getPlayerRankTag(player), level: progress.level });

  const entries = Object.entries(job.table);
  const text = rankLine + (entries.length === 0
    ? t("job.rewardsEmpty")
    : entries
        .map(([typeId, entry]) => {
          const money = Math.max(0, Math.round(entry.money * moneyLevelMultiplier * vipMoneyMultiplier));
          const exp = Math.max(0, Math.round(entry.exp * JOB_CONFIG.LEVEL.EXP_RATE * vipExpMultiplier));
          return t("job.rewardsEntry", { name: formatTypeIdName(typeId), money, exp });
        })
        .join("\n"));

  return createListMenu(player, {
    titleKey: "job.rewardsTitle",
    titleVars: { job: t(job.nameKey) },
    bodyKey: "log.textBody",
    bodyVars: { text },
    items: []
  });
}

/* =========================
   PHASE 2: JOB <-> QUEST BRIDGE REGISTRATION
   questSystem.js ต้องการเรียก applyJobExp()/getCurrentJobId() ตอนเควสสำเร็จ
   แล้วให้ EXP อาชีพเป็นรางวัล แต่ questSystem.js "ไม่ import jobSystem.js
   ตรง ๆ" (จะทำให้เกิด Circular Import กับ import reportJobExpGained/
   reportJobLevelUp/registerJobBridge ด้านบนไฟล์นี้ที่ jobSystem.js import
   จาก questSystem.js อยู่แล้ว) — ใช้ Dependency Injection แทน: jobSystem.js
   (ไฟล์นี้) เป็นฝ่าย "ยื่น" ฟังก์ชันของตัวเองให้ questSystem.js เก็บไว้เรียก
   ทีหลัง ผ่าน registerJobBridge() ที่ questSystem.js export ไว้ให้
   เรียกครั้งเดียวตอนโหลดโมดูลนี้ (ท้ายไฟล์ — หลัง applyJobExp()/
   getCurrentJobId() ถูกประกาศแล้วเท่านั้น) — ผลคือ Module Graph เป็นทิศทาง
   เดียว jobSystem.js -> questSystem.js (เหมือน shopSystem.js) ไม่มี Edge
   ย้อนกลับจาก questSystem.js มาไฟล์นี้เลย จึงไม่มี Circular Import จริง ๆ
========================= */
registerJobBridge({ applyJobExp, getCurrentJobId });
