// =========================
// combatAttributes.js
// คำนวณดาเมจ/ความเร็วเดินจริงของผู้เล่นจากแต้มสเตตัส RPG (STR/AGI/VIT —
// systems/statSystem.js ผ่าน core/statUtils.js) + เอฟเฟกต์ (speed/slowness)
// รวมเป็นค่า multiplier เดียว
//
// เดิมไฟล์นี้ยังอ่านโบนัสเพิ่มจาก lore ของไอเทมที่สวมใส่ (ระบบ "reforge"
// เดิม — reforgingTable.js + itemAttributes.js) ด้วย แต่ระบบนั้นถูกลบออก
// ทั้งหมดแล้ว (ทั้งโต๊ะตีเรียงใหม่และ auto-roll) ตอนนี้แหล่งเดียวของโบนัส
// การต่อสู้คือแต้มสเตตัสเท่านั้น
//
// *** จุดเชื่อมกับระบบแต้มสเตตัส (statSystem.js) ***
// getStatBonuses() (core/statUtils.js) คือจุดเดียวที่ไฟล์นี้ดึงโบนัส
// attackDamage / projectileDamage / criticalChance / movementSpeed /
// damageReduction / criticalDamage / blockChance / parryChance /
// evasionChance จากแต้มสเตตัสมาคูณดาเมจ/ความเร็วจริง
//
// หมายเหตุ: blockChance / parryChance / evasionChance / criticalDamage
// (เกิน 1.5 พื้นฐาน) เดิมมาจาก item lore เท่านั้น (ระบบ reforge เดิมที่ถูก
// ลบไปแล้ว) ตอนนี้แต้มสเตตัสย่อย vitBlock / agiParry / agiEvasion /
// strCritDmg (ดู config/statConfig.js) เป็นแหล่งเดียวที่ตั้งค่าพวกนี้ได้
// แทน — getStatBonuses() มีฟิลด์เหล่านี้แล้ว จึงมีผลจริงในสูตรดาเมจ (ดู
// DAMAGE FORMULA) ทันทีที่ผู้เล่นลงแต้ม
// =========================

import { world, system, EntityComponentTypes } from "@minecraft/server";
import { getStatBonuses } from "../core/statUtils";
import { STAT_CONFIG } from "../config/statConfig";
import { t } from "../ui/locale/index";
import { showActionBar } from "../core/messageUtils";
import { subscribeSafe } from "../core/eventGuard";
import { getInventoryContainer } from "../core/itemUtils";
import { WEAPON_ITEMS } from "../data/equipmentWhitelist";
import {
  playParryProc, playEvasionProc, playBlockProc
} from "../core/soundUtils";
import { recordCrit, clearCritState } from "../core/combatState";

// v1.4.24: แพร์รี่ต้องถืออาวุธ (จาก data/equipmentWhitelist.js WEAPON_ITEMS)
// อยู่ในมือหลักเท่านั้น — มือเปล่า/ไอเทมอื่นที่ไม่ใช่อาวุธแพร์รี่ไม่ได้
function isHoldingWeapon(player) {
  const container = getInventoryContainer(player);
  if (!container) return false;
  const held = container.getItem(player.selectedSlotIndex ?? 0);
  return !!held && WEAPON_ITEMS.has(held.typeId);
}

function createDefaultAttributes() {
  return {
    attackDamage: 1,
    projectileDamage: 1,
    criticalChance: 0,
    criticalDamage: 1.5,
    blockChance: 0,
    parryChance: 0,
    damageReduction: 1,
    evasionChance: 0,
    movementSpeed: 1,
    lifestealChanceBonus: 0,
    thornPercentBonus: 0
  };
}

// Frozen default — ใช้เป็น source สำหรับ clone แทนสร้างใหม่ทุกครั้ง
const DEFAULT_ATTRIBUTES = Object.freeze(createDefaultAttributes());

// Per-tick cache สำหรับ getAttributes() — key = playerId, value = { tick, result }
const attributeCache = new Map();

/* =========================
   PROC FEEDBACK (v1.4.0) — action bar + เสียงตอนคริ/หลบ/แพร์รี่/บล็อก
   trigger จริง กันสแปมด้วย cooldown ต่อผู้เล่น (PROC_COOLDOWN_TICKS) —
   เช่นยิงฝูงลูกธนูโดนคริรัว ๆ จะได้แจ้งแค่รอบเดียวต่อ 0.5 วิ
========================= */
const PROC_COOLDOWN_TICKS = 10;
const lastProcTick = new Map();

subscribeSafe(["playerLeave"], (event) => {
  try {
    lastProcTick.delete(event.playerId);
    attributeCache.delete(event.playerId);
    clearCritState(event.playerId);
  } catch (error) {
    console.warn("[CombatAttributes] playerLeave handler error:", error);
  }
}, "CombatAttributes");

// Particle ประกอบ proc (v1.4.4) — spawn ที่ตัวผู้เสีย/ผู้เกี่ยวข้อง คนรอบข้าง
// เห็นด้วย; ชื่อ particle ที่ runtime ไม่รู้จัก = throw -> ครอบ try/catch เงียบ ๆ
function spawnProcParticles(entity, key) {
  if (!STAT_CONFIG.PROC_PARTICLES?.ENABLED) return;
  const name = STAT_CONFIG.PROC_PARTICLES.NAMES[key];
  if (!name || !entity?.isValid) return;
  try {
    entity.dimension.spawnParticle(name, entity.location);
  } catch {
    // particle ชื่อนี้ไม่มีใน runtime นี้ — ข้ามเงียบ ๆ (เสียง/action bar ยังทำงาน)
  }
}

function procFeedback(player, messageKey, playSound, particleKey) {
  if (!player?.isValid) return;
  const now = system.currentTick;
  const last = lastProcTick.get(player.id) ?? -Infinity;
  if (now - last < PROC_COOLDOWN_TICKS) return;
  lastProcTick.set(player.id, now);
  showActionBar(player, t(messageKey), "combat");
  playSound(player);
  // particle spawn ที่ตัวผู้เสีย/ผู้เกี่ยวข้อง (คนรอบข้างเห็นด้วย)
  if (particleKey) spawnProcParticles(player, particleKey);
}

/** ฮีลผ่าน health component ตรง ๆ (clamp ที่ max) — ไม่ trigger event */
function healEntity(entity, amount) {
  if (!(amount > 0) || !entity?.isValid) return;
  const health = entity.getComponent(EntityComponentTypes.Health);
  if (!health) return;
  const maxHealth = typeof health.effectiveMax === "number" ? health.effectiveMax : 20;
  health.setCurrentValue(Math.min(maxHealth, health.currentValue + amount));
}

/**
 * Thorn (v1.4.0) — สะท้อนดาเมจ melee กลับหาผู้โจมตีผ่าน health component
 * ตรง ๆ (ไม่ใช่ applyDamage ที่จะ trigger entityHurt ซ้อน = loop) — clamp
 * ที่เลือดปัจจุบันขั้นต่ำ 0
 */
function reflectDamage(target, amount) {
  if (!(amount > 0) || !target?.isValid) return;
  const health = target.getComponent(EntityComponentTypes.Health);
  if (!health) return;
  health.setCurrentValue(Math.max(0, health.currentValue - amount));
}

/**
 * รวม attribute จากเอฟเฟกต์ + แต้มสเตตัส RPG เข้ากับค่าเริ่มต้นใน
 * attributes (มักสร้างจาก DEFAULT_ATTRIBUTES) — ใช้ per-tick cache เพื่อ
 * ไม่คำนวณซ้ำภายใน tick เดียวกัน
 * @param {import("@minecraft/server").Player} player
 */
function getAttributes(player) {
  // Per-tick cache — dynamic properties/effects ไม่เปลี่ยนภายใน tick เดียว
  const cached = attributeCache.get(player.id);
  if (cached && cached.tick === system.currentTick) return cached.result;

  // Clone จาก frozen default แทน spread input
  const attributes = { ...DEFAULT_ATTRIBUTES };

  const speedEffect = player.getEffect("speed");
  if (speedEffect !== void 0) {
    attributes.movementSpeed = (attributes.movementSpeed * 100 + (speedEffect.amplifier + 1) * 20) / 100;
  }
  const slownessEffect = player.getEffect("slowness");
  if (slownessEffect !== void 0) {
    attributes.movementSpeed = (attributes.movementSpeed * 100 - (slownessEffect.amplifier + 1) * 15) / 100;
  }

  // === RPG STAT BONUS ===
  // รวมโบนัสจากแต้มสเตตัส STR/AGI/VIT (systems/statSystem.js ผ่าน
  // core/statUtils.js) เข้ากับค่าเริ่มต้น — เฉพาะ typeId player เท่านั้น
  // (getAttributes() ในไฟล์นี้ถูกเรียกกับผู้เล่นเสมอ แต่กันไว้เผื่ออนาคตมี
  // จุดเรียกกับ entity อื่น)
  if (player.typeId === "minecraft:player") {
    const statBonuses = getStatBonuses(player);
    attributes.attackDamage = (attributes.attackDamage * 100 + statBonuses.attackDamageBonus + (statBonuses.affinityAttackDamageBonus ?? 0)) / 100;
    attributes.projectileDamage = (attributes.projectileDamage * 100 + statBonuses.projectileDamageBonus + (statBonuses.affinityProjectileDamageBonus ?? 0)) / 100;
    attributes.criticalChance = (attributes.criticalChance * 100 + statBonuses.criticalChanceBonus + (statBonuses.affinityCriticalChanceBonus ?? 0)) / 100;
    attributes.movementSpeed = (attributes.movementSpeed * 100 + statBonuses.movementSpeedBonus + (statBonuses.affinityMovementSpeedBonus ?? 0)) / 100;
    attributes.damageReduction = (attributes.damageReduction * 100 - statBonuses.damageReductionBonus - (statBonuses.affinityDamageReductionBonus ?? 0)) / 100;
    attributes.criticalDamage = (attributes.criticalDamage * 100 + statBonuses.criticalDamageBonus + (statBonuses.affinityCriticalDamageBonus ?? 0)) / 100;
    attributes.blockChance = (attributes.blockChance * 100 + statBonuses.blockChanceBonus + (statBonuses.affinityBlockBonus ?? 0)) / 100;
    attributes.parryChance = (attributes.parryChance * 100 + statBonuses.parryChanceBonus + (statBonuses.affinityParryBonus ?? 0)) / 100;
    attributes.evasionChance = (attributes.evasionChance * 100 + statBonuses.evasionChanceBonus + (statBonuses.affinityEvasionBonus ?? 0)) / 100;
    attributes.lifestealChanceBonus = statBonuses.lifestealChanceBonus + (statBonuses.affinityLifestealBonus ?? 0);
    attributes.thornPercentBonus = statBonuses.thornPercentBonus;

    // v1.4.18: cap evasion/parry/block ไม่เกิน DEFENSE_CAP_PERCENT% แต่ละตัว
    // (กัน stat + gear tier รวมกันแล้วโหดเกินไป) — แต่ละ cap แยก
    const defenseCapFraction = (STAT_CONFIG.DEFENSE_CAP_PERCENT ?? 70) / 100;
    const critCapFraction = (STAT_CONFIG.CRITICAL_CHANCE_CAP_PERCENT ?? 100) / 100;
    attributes.criticalChance = Math.min(attributes.criticalChance, critCapFraction);
    attributes.evasionChance = Math.min(attributes.evasionChance, defenseCapFraction);
    attributes.parryChance = Math.min(attributes.parryChance, defenseCapFraction);
    attributes.blockChance = Math.min(attributes.blockChance, defenseCapFraction);

    // v1.4.24: ไม่ถืออาวุธ (มือเปล่า/ถือไอเทมอื่น) = แพร์รี่ไม่ได้ ไม่ว่าจะ
    // มีแต้ม agiParry หรือ tier bonus สะสมมาเท่าไหร่ก็ตาม — เช็คทีหลังสุด
    // หลัง cap เพื่อให้ผลลัพธ์สุดท้ายเป็น 0 เสมอเมื่อไม่ถืออาวุธ
    if (!isHoldingWeapon(player)) {
      attributes.parryChance = 0;
    }
  }

  if (attributes.attackDamage < 0) attributes.attackDamage = 0;
  if (attributes.projectileDamage < 0) attributes.projectileDamage = 0;
  if (attributes.criticalChance < 0) attributes.criticalChance = 0;
  if (attributes.criticalDamage < 1) attributes.criticalDamage = 1;
  if (attributes.damageReduction < 0) attributes.damageReduction = 0;
  if (attributes.movementSpeed < 0) attributes.movementSpeed = 0;

  attributeCache.set(player.id, { tick: system.currentTick, result: attributes });
  return attributes;
}

function applyAdjustedHealth(health, currentHealth) {
  if (!health) return;
  const maxHealth = typeof health.effectiveMax === "number" ? health.effectiveMax : 20;
  health.setCurrentValue(Math.min(maxHealth, Math.max(0, currentHealth)));
}


/**
 * Apply full defense pipeline (evasion -> parry -> block -> reduction)
 * ให้ผู้เล่น พร้อม damage taken display และ thorn reflect
 * ใช้ร่วมกันระหว่าง Branch A (player vs player) และ Branch B (entity vs player)
 */
function applyPlayerDefense({ finalDamage, hurtEntity, hurtAttributes, damageSource }) {
  if (Math.random() < hurtAttributes.evasionChance) {
    finalDamage = 0;
    procFeedback(hurtEntity, "combat.procEvasion", playEvasionProc, "evasion");
  } else if (Math.random() < hurtAttributes.parryChance) {
    const reflectedDamage = finalDamage * 1.5;
    finalDamage = 0;
    if (damageSource.damagingEntity?.isValid) {
      reflectDamage(damageSource.damagingEntity, reflectedDamage);
    }
    procFeedback(hurtEntity, "combat.procParry", playParryProc, "parry");
  } else if (Math.random() < hurtAttributes.blockChance) {
    finalDamage = finalDamage / 2;
    procFeedback(hurtEntity, "combat.procBlock", playBlockProc, "block");
  }
  finalDamage = finalDamage * hurtAttributes.damageReduction;

  if (STAT_CONFIG.DAMAGE_DISPLAY.ENABLED && STAT_CONFIG.DAMAGE_DISPLAY.SHOW_TAKEN && finalDamage > 0) {
    const shown = Math.round(finalDamage * 10) / 10;
    showActionBar(hurtEntity, t("combat.damageTaken", { damage: shown }), "combat");
  }

  if (damageSource.cause === "entityAttack" && hurtAttributes.thornPercentBonus > 0 && finalDamage > 0 && damageSource.damagingEntity) {
    const reflected = Math.round(finalDamage * hurtAttributes.thornPercentBonus / 100 * 10) / 10;
    reflectDamage(damageSource.damagingEntity, reflected);
    // แสดง thornReflect แทน procThorn เพื่อไม่ให้ action bar ทับกัน
    if (STAT_CONFIG.DAMAGE_DISPLAY.ENABLED && STAT_CONFIG.DAMAGE_DISPLAY.SHOW_THORN) {
      procFeedback(hurtEntity, "combat.thornReflect", playBlockProc, "thorn");
    }
  }
  return finalDamage;
}

/**
 * ปรับ health ของผู้โดนตีตามดาเมจที่เปลี่ยนแปลง
 */
function applyDamageToHealth(hurtEntity, eventDamage, finalDamage) {
  if (finalDamage === eventDamage) return;
  const health = hurtEntity.getComponent(EntityComponentTypes.Health);
  applyAdjustedHealth(health, health.currentValue + eventDamage - finalDamage);
}

/* =========================
   DAMAGE FORMULA
========================= */

subscribeSafe(["entityHurt"], (event) => {
  try {
    handleEntityHurt(event);
  } catch (error) {
    console.warn("[CombatAttributes] entityHurt handler error:", error);
  }
}, "CombatAttributes");

function handleEntityHurt(event) {
  if (event.damage <= 0) return;

  // ผู้โจมตีเป็นผู้เล่น: ดาเมจออก (attack/projectile) + คริ ตามแต้มผู้โจมตี
  if (event.damageSource.damagingEntity?.typeId === "minecraft:player") {
    let finalDamage = event.damage;
    const damagingEntityAttributes = getAttributes(event.damageSource.damagingEntity);
    let critted = false;

    if (event.damageSource.cause === "entityAttack") {
      finalDamage = finalDamage * damagingEntityAttributes.attackDamage;
    }
    if (event.damageSource.cause === "projectile") {
      finalDamage = finalDamage * damagingEntityAttributes.projectileDamage;
    }
    if (Math.random() < damagingEntityAttributes.criticalChance && damagingEntityAttributes.criticalDamage > 1) {
      finalDamage = finalDamage * damagingEntityAttributes.criticalDamage;
      critted = true;
      recordCrit(event.damageSource.damagingEntity.id);
    }

    if (event.hurtEntity.typeId === "minecraft:player") {
      const hurtEntityAttributes = getAttributes(event.hurtEntity);
      finalDamage = applyPlayerDefense({ finalDamage, hurtEntity: event.hurtEntity, hurtAttributes: hurtEntityAttributes, damageSource: event.damageSource });
    }

    // Lifesteal — ฮีลตาม % ของดาเมจที่ผ่านการป้องกันจริง (melee/projectile)
    if (
      damagingEntityAttributes.lifestealChanceBonus > 0 &&
      finalDamage > 0 &&
      event.damageSource.damagingEntity.id !== event.hurtEntity.id
    ) {
      const healed = Math.round(finalDamage * damagingEntityAttributes.lifestealChanceBonus / 100 * 10) / 10;
      healEntity(event.damageSource.damagingEntity, healed);
      if (STAT_CONFIG.DAMAGE_DISPLAY.ENABLED && STAT_CONFIG.DAMAGE_DISPLAY.SHOW_LIFESTEAL) {
        showActionBar(event.damageSource.damagingEntity, t("combat.lifestealHeal", { amount: healed }), "combat");
      }
    }

    // Damage dealt (v1.4.x) — คริรวมอยู่ในข้อความเดียวกัน กัน action bar
    // ถูก proc ⚔คริ เขียนทับตัวเลขใน tick เดียวกัน
    if (STAT_CONFIG.DAMAGE_DISPLAY.ENABLED && finalDamage > 0) {
      const shown = Math.round(finalDamage * 10) / 10;
      showActionBar(
        event.damageSource.damagingEntity,
        critted
          ? t("combat.critDamageDealt", { damage: shown })
          : t("combat.damageDealt", { damage: shown }),
        "combat"
      );
    }

    // crit particle — spawn ที่ตัวเป้าหมาย (คนรอบข้างเห็น) ไม่ผูกกับ
    // DAMAGE_DISPLAY toggle เพราะเป็น event effect ของคริโดยตรง
    if (critted && finalDamage > 0) {
      spawnProcParticles(event.hurtEntity, "crit");
    }

    applyDamageToHealth(event.hurtEntity, event.damage, finalDamage);
    return;
  }

  // ผู้โจมตีเป็น entity อื่น (มอนสเตอร์ ฯลฯ) โจมตีผู้เล่น: ลดดาเมจตาม
  // damageReduction/block/parry/evasion ของผู้เล่นที่โดนตี
  if (event.damageSource.damagingEntity !== void 0 && event.hurtEntity.typeId === "minecraft:player") {
    const hurtEntityAttributes = getAttributes(event.hurtEntity);
    const finalDamage = applyPlayerDefense({ finalDamage: event.damage, hurtEntity: event.hurtEntity, hurtAttributes: hurtEntityAttributes, damageSource: event.damageSource });
    applyDamageToHealth(event.hurtEntity, event.damage, finalDamage);
    return;
  }

  // ไม่มีผู้โจมตี (ดาเมจสิ่งแวดล้อม เช่น ตกที่สูง/ไฟ/จมน้ำ) โดนผู้เล่น:
  // ลดดาเมจตาม damageReduction เท่านั้น (ไม่มีบล็อก/หลบ/แพร์รี่)
  if (event.damageSource.damagingEntity === void 0 && event.hurtEntity.typeId === "minecraft:player") {
    const hurtEntityAttributes = getAttributes(event.hurtEntity);
    const finalDamage = event.damage * hurtEntityAttributes.damageReduction;
    applyDamageToHealth(event.hurtEntity, event.damage, finalDamage);
    return;
  }
}

/* =========================
   MOVEMENT SPEED
========================= */

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      if (!player?.isValid) continue;
      const movement = player.getComponent(EntityComponentTypes.Movement);
      if (!movement) continue;
      const playerAttributes = getAttributes(player);
      if (player.isSprinting) {
        movement.setCurrentValue(Math.max(0.03, 0.12999999523162842 * playerAttributes.movementSpeed));
      } else {
        movement.setCurrentValue(Math.max(0.03, 0.10000000149011612 * playerAttributes.movementSpeed));
      }
    } catch (error) {
      console.warn("[CombatAttributes] movement speed handler error:", error);
    }
  }
}, 5); // ทุก 5 ticks (4 ครั้ง/วินาที) แทนทุก tick — movement speed ไม่เปลี่ยนเร็วขนาดนั้น
