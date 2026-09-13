import { subscribeSafe } from "../core/eventGuard";
import Database from "./Database";

// Load player data on first spawn
subscribeSafe(["playerSpawn"], (event) => {
  const player = event.player;
  // Only load on initial spawn (not respawn after death)
  if (event.initialSpawn) {
    Database.load(player);
  }
});

// Save and clear cache when player leaves
subscribeSafe(["playerLeave"], ({ playerId }) => {
  const player = world.getAllPlayers().find(p => p.id === playerId);
  if (player) {
    Database.save(player);
  }
  // Remove from cache regardless of player object availability
  Database.clear({ id: playerId });
});
