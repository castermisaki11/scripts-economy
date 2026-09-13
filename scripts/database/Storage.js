import { world } from "@minecraft/server";
import { migrate } from "./Schema";

const PREFIX = "player"; // base key prefix

function playerKey(id, chunk) {
  return `${PREFIX}:${id}:${chunk}`;
}

export function loadData(player) {
  const id = player.id;
    const raw = Database.get(player, playerKey(id, "core"));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (e) {
    console.warn(`Failed to parse player data for ${id}:`, e);
    return null;
  }
}

export function saveData(player, data) {
  const id = player.id;
  try {
    const serialized = JSON.stringify(data);
    Database.set(player, playerKey(id, "core"), serialized);
    return true;
  } catch (e) {
    console.warn(`Failed to save player data for ${id}:`, e);
    return false;
  }
}

// Helper to split large objects into chunks if needed (placeholder)
export function splitAndSave(player, data) {
  // For now, store whole object in one key
  return saveData(player, data);
}
