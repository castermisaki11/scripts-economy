// =========================
// systems/playerLevel.js
// ระบบเลเวล/EXP ของผู้เล่น (RPG v1.4.0) — ส่วน "จัดการ EXP + Level Up"
// สูตรคำนวณอยู่ที่ core/levelUtils.js (pure) และ props เก็บผ่าน
// core/statUtils.js เท่านั้น
//
// แหล่ง EXP:
//   - kill: entityDie + resolveAttacker (pattern เดียวกับ scoreboard.js)
//     EXP ต่อการฆ่า "ต่างกันตามความยากของมอบ" — ดูตาราง/เพดานที่
//     data/mobExpTable.js (getMobKillExp) ไม่ใช่ค่าคงที่เดียวอีกต่อไป
//   - mine: playerBlockBreak
//   - sell: hook จาก quests/reportApi.js reportItemSold() (ขายร้าน NPC)
//   - quest: hook จาก quests/progression.js grantQuestReward()
//
// Level up = แต้มฟรี LEVEL.POINTS_PER_LEVEL ต่อเลเวล (pool rpg:points เดิม —
// ไม่แยกแหล่ง) + milestone ทุก LEVEL.MILESTONE_EVERY เลเวลได้เงินโบนัส
// ทุกอย่างแจ้งทางแชท + เสียง playJobLevelUp() (เสียงฉลองเดียวกับอาชีพ)
// =========================

import { world, system } from "@minecraft/server";
import { getLevel, getExp, setLevelState, setPoints, getPoints } from "../core/statUtils";
import { addExp, isMilestone } from "../core/levelUtils";
import { STAT_CONFIG } from "../config/statConfig";
import { resolveAttacker } from "../core/playerUtils";
import { showSuccess } from "../core/messageUtils";
import { playJobLevelUp } from "../core/soundUtils";
import { addMoney } from "../core/economyUtils";
import { t } from "../ui/locale/index";
import { subscribeSafe, BLOCK_BREAK_EVENTS } from "../core/eventGuard";
import { TICKS_PER_SECOND } from "../core/constants";
import { getMobKillExp } from "../data/mobExpTable";
import { getLastAttacker, clearLastAttacker, resolveLastAttacker } from "../core/lastAttackerTracker";

/**
 * ใส่ EXP ให้ผู้เล่น — จัดการ level up ทั้งหมด (แต้มฟรี/milestone/แจ้งเตือน)
 * เรียกได้จาก event ภายในไฟล์นี้ หรือ cross-module hooks (reportApi/
 * progression)
 *
 * ⚠️ Hardening (v1.4.1): body ถูกครอบ try/catch เสมอ — ระบบ EXP/level พัง
 * (เช่น import ขาด, prop เพี้ยน) ต้องไม่มีวันดึงการขาย/เควส/ฆ่า/ขุดที่เป็น
 * caller ล้มลงด้วย — error หลุดแค่ console.warn ให้ไล่แก้
 *
 * @param {import("@minecraft/server").Player} player
 * @param {number} amount
 */
export function addPlayerExp(player, amount) {
  if (!player?.isValid) return;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return;

  try {
    applyPlayerExp(player, amount);
  } catch (error) {
    console.warn("[PlayerLevel] addPlayerExp error:", error);
  }
}

function applyPlayerExp(player, amount) {
  const result = addExp({ level: getLevel(player), exp: getExp(player) }, amount);
  if (result.levelsGained.length === 0) {
    setLevelState(player, result.level, result.exp);
    return;
  }

  // === LEVEL UP ===
  const oldLevel = result.level - result.levelsGained.length;
  setLevelState(player, result.level, result.exp);

  // แต้มฟรีต่อเลเวล — pool เดิม (rpg:points) ผู้เล่นเอาไปลงเองในเมนู
  const freePoints = result.levelsGained.length * STAT_CONFIG.LEVEL.POINTS_PER_LEVEL;
  setPoints(player, getPoints(player) + freePoints);

  // milestone นับเฉพาะเลเวลใหม่ที่ขึ้นในครั้งนี้
  let milestoneMoney = 0;
  for (const newLevel of result.levelsGained) {
    if (!isMilestone(newLevel)) continue;
    milestoneMoney += STAT_CONFIG.LEVEL.MILESTONE_MONEY;
  }
  if (milestoneMoney > 0) addMoney(player, milestoneMoney);

  playJobLevelUp(player);
  showSuccess(player, t("level.upSuccess", {
    level: result.level,
    points: freePoints,
    bonus: milestoneMoney > 0 ? t("level.milestoneBonus", { money: milestoneMoney.toLocaleString() }) : ""
  }));

  // mirror objective กระดานอันดับ (Top Level) — sync ผ่าน setter กลาง
  updateLevelMirror(player);
}

/* =========================
   MIRROR OBJECTIVE ("level") — ใช้โชว์ Top Level ใน /prakan:score
   ทำแบบ lazy import ไม่ได้ (ES module) — scoreboard.js export ฟังก์ชัน
   ensureObjective ให้เรียกตรง ๆ (objective สร้างตอน onWorldLoad แล้ว)
========================= */
import { getScoreboardObjective, setScoreboardScore } from "./scoreboard";

function updateLevelMirror(player) {
  try {
    setScoreboardScore(getScoreboardObjective("level"), player, getLevel(player));
  } catch {
    // objective ยังไม่พร้อม (ก่อน worldLoad) — ข้าม จะถูก sync รอบ level up ถัดไป
  }
}

/* =========================
   EVENT SOURCES
========================= */

// kill — attacker ต้องเป็นผู้เล่นและไม่ใช่ฆ่าตัวเอง (resolveAttacker แก้
// projectile -> owner ให้แล้ว pattern เดียวกับ scoreboard.js/jobSystem.js)
//
// ⚠️ Bugfix (v1.4.24): combatAttributes.js ปรับดาเมจตามสเตตัส RPG โดยเขียน
// health ผ่าน health.setCurrentValue() ตรง ๆ (ไม่ใช่ applyDamage()) — เมื่อ
// มอบตายจากการปรับเลือดแบบนี้ event.damageSource ที่มากับ entityDie จะไม่มี
// damagingEntity ที่ถูกต้อง (หลุด attribution ของวานิลา) ทำให้ resolveAttacker()
// บน entityDie ตรง ๆ คืนค่า undefined — EXP เลยขึ้นเฉพาะตอนโดนดาเมจวานิลา
// ล้วน ๆ (ไม่ผ่านการปรับของ combatAttributes.js) เท่านั้น
//
// แก้แบบเดียวกับที่ scoreboard.js เคยแก้ไปแล้ว: จำ "ผู้โจมตีล่าสุด" ของแต่ละ
// entity ไว้ตอน entityHurt (ที่ damageSource ยังสมบูรณ์อยู่) แล้วดึงมาใช้ตอน
// entityDie แทนที่จะพึ่ง event.damageSource ตรง ๆ
const LAST_HIT_TIMEOUT = TICKS_PER_SECOND * 10;

subscribeSafe(["entityDie"], event => {
  try {
    const dead = event.deadEntity;
    if (dead.typeId === "minecraft:player") return;

    let attacker = resolveAttacker(event.damageSource);
    if (attacker?.typeId !== "minecraft:player" || attacker.id === dead.id) {
      attacker = resolveLastAttacker(dead.id, system.currentTick);
    }
    clearLastAttacker(dead.id);

    if (attacker?.typeId !== "minecraft:player" || attacker.id === dead.id) return;
    addPlayerExp(attacker, getMobKillExp(dead.typeId));
  } catch (error) {
    console.warn("[PlayerLevel] entityDie handler error:", error);
  }
}, "PlayerLevel");

// mine — ทุกบล็อกให้ EXP เท่ากัน (ความยากต่างกันอยู่ที่เวลาขุดอยู่แล้ว)
// BLOCK_BREAK_EVENTS = playerBlockBreak / playerBreakBlock ตาม runtime
subscribeSafe(BLOCK_BREAK_EVENTS, event => {
  try {
    addPlayerExp(event.player, STAT_CONFIG.LEVEL.EXP_PER_BLOCK);
  } catch (error) {
    console.warn("[PlayerLevel] playerBlockBreak handler error:", error);
  }
}, "PlayerLevel");

/* =========================
   SPAWN — sync mirror ครั้งแรกตอนเข้าเกม (กัน objective หลุดจาก world เก่า)
========================= */
subscribeSafe(["playerSpawn"], event => {
  try {
    if (!event.initialSpawn) return;
    updateLevelMirror(event.player);
  } catch (error) {
    console.warn("[PlayerLevel] playerSpawn handler error:", error);
  }
});
