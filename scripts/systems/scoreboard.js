import { world, system } from "@minecraft/server";
import { showActionBar } from "../core/messageUtils";
import { TICKS_PER_SECOND } from "../core/constants";
import { t } from "../ui/locale/index";
import { onWorldLoad } from "../core/worldLoad";
import { subscribeSafe, BLOCK_BREAK_EVENTS } from "../core/eventGuard";
import { resolveLastAttacker, clearLastAttacker } from "../core/lastAttackerTracker";
import { safeGetScore } from "../core/scoreboardUtils";

/* ======================
   CONFIG
====================== */
const SHOW_TIME = TICKS_PER_SECOND * 5;

/* ======================
   MAPS
====================== */
const actionbarUntil = new Map();

/* ======================
   SCOREBOARD
====================== */
function ensureObjective(name, displayName) {
  let obj = world.scoreboard.getObjective(name);
  if (!obj) {
    obj = world.scoreboard.addObjective(name, displayName);
    console.warn(`[Scoreboard] Created objective: ${name}`);
  }
  return obj;
}

let killsObj;
let deathsObj;
let minedObj;

onWorldLoad(() => {
  killsObj = ensureObjective("kills", "Kills");
  deathsObj = ensureObjective("deaths", "Deaths");
  minedObj = ensureObjective("mined", "Blocks Mined");
  ensureObjective("level", "Player Level");
});

export function getScoreboardObjective(name) {
  return world.scoreboard.getObjective(name);
}

export function setScoreboardScore(objective, target, score) {
  if (!objective) return;
  try {
    objective.setScore(target, score);
  } catch {
  }
}

subscribeSafe(BLOCK_BREAK_EVENTS, event => {
  try {
    minedObj?.addScore(event.player, 1);
  } catch (error) {
    console.warn("[Scoreboard] playerBlockBreak handler error:", error);
  }
}, "Scoreboard");

subscribeSafe(["playerLeave"], (event) => {
  try {
    actionbarUntil.delete(event.playerId);
  } catch (error) {
    console.warn("[Scoreboard] playerLeave handler error:", error);
  }
}, "Scoreboard");

subscribeSafe(["entityDie"], event => {
  try {
    const dead = event.deadEntity;

    if (dead.typeId === "minecraft:player") {
      deathsObj?.addScore(dead, 1);
      actionbarUntil.set(dead.id, system.currentTick + SHOW_TIME);
    }

    const attacker = resolveLastAttacker(dead.id, system.currentTick);
    clearLastAttacker(dead.id);

    if (attacker && attacker.id !== dead.id) {
      killsObj?.addScore(attacker, 1);
      actionbarUntil.set(attacker.id, system.currentTick + SHOW_TIME);
    }
  } catch (error) {
    console.warn("[Scoreboard] entityDie handler error:", error);
  }
}, "Scoreboard");

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const endTick = actionbarUntil.get(player.id);
    if (!endTick) continue;

    if (system.currentTick > endTick) {
      actionbarUntil.delete(player.id);
      continue;
    }

    const kills = safeGetScore(killsObj, player) ?? 0;
    const deaths = safeGetScore(deathsObj, player) ?? 0;

    showActionBar(
      player,
      t("scoreboard.actionBarKillsDeaths", { kills, deaths }),
      "scoreboard"
    );
  }
}, 5);
