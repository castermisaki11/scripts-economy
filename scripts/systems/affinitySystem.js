// =========================
// affinitySystem.js
// ระบบ Affinity — ความเชี่ยวชาญจากการเล่นจริง
//
// รับเหตุการณ์จาก combatAttributes.js (entityHurt) เพื่อคำนวณ EXP
// Anti-farming: diminishing returns + cooldown
// Stat growth: คำนวณทุก tick และเก็บใน dynamic property
// =========================

import { world, system, EntityComponentTypes } from "@minecraft/server";
import { AFFINITY_CONFIG } from "../config/affinityConfig";
import { WEAPON_AFFINITY_MAP, ARMOR_AFFINITY_MAP } from "../data/affinityItems";
import {
  addAffinityExp,
  getAffinityLevel,
  getAffinityCategory as getAffEntry,
  getAffinityProgress,
  recordAffinityHit,
  getAntiFarmMultiplier,
  calculateStatGrowth,
  calculatePassiveBonuses,
  expToNextLevel
} from "../core/affinityUtils";
import { createListMenu } from "../ui/framework/UIFramework";
import { t } from "../ui/locale/index";
import { getMoney, addMoney } from "../core/economyUtils";
import { showSuccess } from "../core/messageUtils";
import { playJobLevelUp } from "../core/soundUtils";
import { subscribeSafe } from "../core/eventGuard";
import { getInventoryContainer } from "../core/itemUtils";
import { wasCriticalThisTick } from "../core/combatState";

// Per-tick cache for stat growth + passives
const affinityCache = new Map();

// Per-tick cache for getAffinityBonuses — ป้องกัน JSON parse ซ้ำใน tick เดียวกัน
const affinityBonusesCache = new Map();

// =========================
// WEAPON AFFINITY GAIN
// =========================

function gainWeaponAffinity(player, heldItem, event) {
  if (!heldItem || !WEAPON_AFFINITY_MAP.hasOwnProperty(heldItem.typeId)) return;

  const category = WEAPON_AFFINITY_MAP[heldItem.typeId];
  const entityId = event.hurtEntity?.id ?? "unknown";

  // Anti-farming check
  const afk = getAntiFarmMultiplier(player, category, entityId);
  if (afk.shouldSkip) return;

  let expGain = AFFINITY_CONFIG.GAIN.WEAPON_HIT;

  // Kill bonus
  if (event.hurtEntity?.isValid && event.hurtEntity.getComponent(EntityComponentTypes.Health)?.currentValue <= 0) {
    expGain += AFFINITY_CONFIG.GAIN.WEAPON_KILL;
  }

  // Critical hit bonus
  if (wasCriticalThisTick(player.id)) {
    expGain += AFFINITY_CONFIG.GAIN.WEAPON_CRIT;
  }

  // Apply diminishing returns
  expGain = Math.round(expGain * afk.multiplier);

  // Record hit
  recordAffinityHit(player, category, entityId);

  // Add exp
  const result = addAffinityExp(player, "weapon", category, expGain);

  // Level up notification
  if (result.leveledUp) {
    showSuccess(player, `§a${category} Affinity เลเวล ${result.level}!`);
    playJobLevelUp(player);
  }
}

// =========================
// ARMOR AFFINITY GAIN
// =========================

function gainArmorAffinity(player, event) {
  // Check what armor the player is wearing
  const equippable = player.getComponent("minecraft:equippable");
  if (!equippable) return;

  // Collect all armor pieces worn
  const wornCategories = new Set();
  for (const slot of ["Head", "Chest", "Legs", "Feet"]) {
    const item = equippable.getEquipment(slot);
    if (item && ARMOR_AFFINITY_MAP.hasOwnProperty(item.typeId)) {
      const cat = ARMOR_AFFINITY_MAP[item.typeId];
      wornCategories.add(cat);
    }
  }

  if (wornCategories.size === 0) return;

  // Anti-farming check
  const entityId = event.damageSource?.damagingEntity?.id ?? "unknown";

  // Armor gain is shared across worn categories
  const baseGain = AFFINITY_CONFIG.GAIN.ARMOR_HIT;
  const expPerCategory = Math.max(1, Math.round(baseGain / wornCategories.size));

  for (const category of wornCategories) {
    const afk = getAntiFarmMultiplier(player, category, entityId);
    if (afk.shouldSkip) continue;

    let expGain = expPerCategory;

    // Kill bonus
    if (event.damageSource?.damagingEntity?.typeId === "minecraft:player") {
      expGain += AFFINITY_CONFIG.GAIN.ARMOR_KILL;
    }

    expGain = Math.round(expGain * afk.multiplier);
    recordAffinityHit(player, category, entityId);

    const result = addAffinityExp(player, "armor", category, expGain);

    if (result.leveledUp) {
      showSuccess(player, `§a${category} Armor Affinity เลเวล ${result.level}!`);
      playJobLevelUp(player);
    }
  }
}

// =========================
// STAT GROWTH APPLY
// =========================

/**
 * Apply stat growth + passives to player every tick
 * Stored in dynamic property "affinity:growth" for statUtils.js to read
 */
function applyStatGrowth(player) {
  const statGrowth = calculateStatGrowth(player);
  const passiveBonuses = calculatePassiveBonuses(player);

  // Combine all bonuses into one object
  const allBonuses = { ...statGrowth, ...passiveBonuses };

  player.setDynamicProperty("affinity:growth", JSON.stringify(allBonuses));
}

// =========================
// EVENT WIRING
// =========================

subscribeSafe(["entityHurt"], (event) => {
  try {
    handleEntityHurt(event);
  } catch (error) {
    console.warn("[AffinitySystem] entityHurt handler error:", error);
  }
}, "AffinitySystem");

function handleEntityHurt(event) {
  if (!event.damageSource || event.damage <= 0) return;

  // Weapon affinity: attacker is a player holding a weapon
  if (event.damageSource.damagingEntity?.typeId === "minecraft:player") {
    const attacker = event.damageSource.damagingEntity;
    const container = getInventoryContainer(attacker);
    if (container) {
      const held = container.getItem(attacker.selectedSlotIndex ?? 0);
      if (held && WEAPON_AFFINITY_MAP.hasOwnProperty(held.typeId)) {
        gainWeaponAffinity(attacker, held, event);
      }
    }
  }

  // Armor affinity: hurt entity is a player wearing armor
  if (event.hurtEntity?.typeId === "minecraft:player") {
    gainArmorAffinity(event.hurtEntity, event);
  }
}

// =========================
// TICK LOOP — Apply stat growth + refresh passives
// =========================

let tickCounter = 0;
system.runInterval(() => {
  tickCounter = (tickCounter + 1) % 1000000;
  for (const player of world.getPlayers()) {
    try {
      if (!player?.isValid) continue;

      // Apply stat growth + passives every 20 ticks (1 second)
      if (tickCounter % AFFINITY_CONFIG.CHECK_INTERVAL_TICKS === 0) {
        applyStatGrowth(player);
      }
    } catch (error) {
      console.warn("[AffinitySystem] tick handler error:", error);
    }
  }
}, 20);

// =========================
// PLAYER LEAVE — Clear cache
// =========================

subscribeSafe(["playerLeave"], (event) => {
  try {
    affinityCache.delete(event.playerId);
    affinityBonusesCache.delete(event.playerId);
  } catch (error) {
    console.warn("[AffinitySystem] playerLeave handler error:", error);
  }
}, "AffinitySystem");

// =========================
// READ GROWTH DATA (for statUtils.js)
// =========================

/**
 * คืน affinity growth + passive bonuses ที่คำนวณไว้
 * เรียกจาก statUtils.js getStatBonuses()
 */
export function getAffinityBonuses(player) {
  // Per-tick cache — dynamic property ไม่เปลี่ยนภายใน tick เดียว
  const cached = affinityBonusesCache.get(player.id);
  if (cached && cached.tick === system.currentTick) return cached.bonuses;

  try {
    const raw = player.getDynamicProperty("affinity:growth");
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      affinityBonusesCache.set(player.id, { tick: system.currentTick, bonuses: parsed });
      return parsed;
    }
  } catch {}
  return {};
}

/**
 * คืน affinity level ทั้งหมด (สำหรับ UI)
 */
export function getAffinityLevels(player) {
  const data = { weapon: {}, armor: {} };
  const WEAPON_CATS = Object.keys(AFFINITY_CONFIG.WEAPON_CATEGORIES);
  const ARMOR_CATS = Object.keys(AFFINITY_CONFIG.ARMOR_CATEGORIES);

  for (const cat of WEAPON_CATS) {
    data.weapon[cat] = getAffinityLevel(player, "weapon", cat);
  }
  for (const cat of ARMOR_CATS) {
    data.armor[cat] = getAffinityLevel(player, "armor", cat);
  }
  return data;
}

/**
 * คืน affinity progress เป็น % ทั้งหมด
 */
export function getAffinityProgresses(player) {
  const data = { weapon: {}, armor: {} };
  const WEAPON_CATS = Object.keys(AFFINITY_CONFIG.WEAPON_CATEGORIES);
  const ARMOR_CATS = Object.keys(AFFINITY_CONFIG.ARMOR_CATEGORIES);

  for (const cat of WEAPON_CATS) {
    data.weapon[cat] = {
      level: getAffinityLevel(player, "weapon", cat),
      progress: 0
    };
  }
  for (const cat of ARMOR_CATS) {
    data.armor[cat] = {
      level: getAffinityLevel(player, "armor", cat),
      progress: 0
    };
  }
  return data;
}

/* =========================
   UI — เมนู Affinity (ความเชี่ยวชาญ)
======================== */

export function openAffinityUI(player) {
  if (!player?.isValid) return;

  const levels = getAffinityLevels(player);

  const weaponItems = Object.entries(AFFINITY_CONFIG.WEAPON_CATEGORIES).map(([key, cat]) => ({
    id: `weapon:${key}`,
    labelKey: cat.nameKey,
    icon: cat.icon,
    badge: `Lv.${levels.weapon[key] ?? 1}`
  }));

  const armorItems = Object.entries(AFFINITY_CONFIG.ARMOR_CATEGORIES).map(([key, cat]) => ({
    id: `armor:${key}`,
    labelKey: cat.nameKey,
    icon: cat.icon,
    badge: `Lv.${levels.armor[key] ?? 1}`
  }));

  const items = [
    ...weaponItems,
    ...armorItems
  ];

  return createListMenu(player, {
    titleKey: "affinity.title",
    items,
    onSelect: (item) => {
      const [type, category] = item.id.split(":");
      return openAffinityDetail(player, type, category);
    }
  });
}

function openAffinityDetail(player, type, category) {
  if (!player?.isValid) return;

  const entry = getAffEntry(player, type, category);
  const progress = getAffinityProgress(player, type, category);
  const expNext = expToNextLevel(entry.level);
  const catConfig = type === "weapon"
    ? AFFINITY_CONFIG.WEAPON_CATEGORIES[category]
    : AFFINITY_CONFIG.ARMOR_CATEGORIES[category];

  // Passive bonuses for this category
  const passives = AFFINITY_CONFIG.PASSIVES[category] ?? [];
  const passiveLines = passives.map(p => {
    const unlocked = entry.level >= p.level;
    const bonusText = Object.entries(p.bonuses)
      .map(([k, v]) => `+${v}% ${k}`)
      .join(", ");
    return unlocked ? `§aLv.${p.level}: ${bonusText}` : `§8Lv.${p.level}: ${bonusText} (ล็อค)`;
  }).join("\n");

  // Stat growth for this category
  const growthList = AFFINITY_CONFIG.STAT_GROWTH[category] ?? [];
  const growthLines = growthList.map(g => {
    const unlocked = entry.level >= g.level;
    const statParts = [];
    if (g.strBonus) statParts.push(`+${g.strBonus} STR`);
    if (g.agiBonus) statParts.push(`+${g.agiBonus} AGI`);
    if (g.vitBonus) statParts.push(`+${g.vitBonus} VIT`);
    const text = statParts.join(", ");
    return unlocked ? `§aLv.${g.level}: ${text}` : `§8Lv.${g.level}: ${text} (ล็อค)`;
  }).join("\n");

  return createListMenu(player, {
    titleKey: "affinity.weaponCategory",
    titleVars: { name: t(catConfig.nameKey) },
    bodyKey: "affinity.detailBody",
    bodyVars: {
      name: t(catConfig.nameKey),
      level: entry.level,
      maxLevel: 50,
      progress,
      exp: entry.exp,
      expNext,
      passives: passiveLines || "§8ไม่มี",
      statGrowth: growthLines || "§8ไม่มี"
    },
    items: [],
    onCancel: () => openAffinityUI(player)
  });
}