import { getCache, setCache, markDirty, isDirty, clearDirty, clearCache, getAllDirty } from "./Cache";
import { loadData, saveData } from "./Storage";
import { world } from "@minecraft/server";
import { onWorldLoad } from "../core/worldLoad";

// Configuration
const AUTO_SAVE_INTERVAL_MS = 5000; // 5 seconds
const MAX_SAVE_PER_TICK = 5; // limit saves per tick to avoid spikes

let saveQueue = [];
let lastFlush = Date.now();

function queueSave(player) {
  const pid = player.id;
  if (!saveQueue.includes(pid)) saveQueue.push(pid);
}

function processQueue() {
  const now = Date.now();
  const toSave = [];
  while (toSave.length < MAX_SAVE_PER_TICK && saveQueue.length) {
    const pid = saveQueue.shift();
    const data = getCache(pid);
    if (data && isDirty(pid)) {
      toSave.push({ pid, data });
    }
  }
  toSave.forEach(({ pid, data }) => {
    const player = world.getAllPlayers().find(p => p.id === pid);
    if (player) {
      const success = saveData(player, data);
      if (success) clearDirty(pid);
    }
  });
  lastFlush = now;
}

// Public API
export const Database = {
  // ---------- Load / Save ----------
  load(player) {
    if (!player?.isValid) return false;
    const existing = getCache(player.id);
    if (existing) return true; // already loaded
    const data = loadData(player);
    if (data) setCache(player.id, data);
    return !!data;
  },
  save(player) {
    if (!player?.isValid) return false;
    const pid = player.id;
    if (!isDirty(pid)) return true;
    const data = getCache(pid);
    if (!data) return false;
    const success = saveData(player, data);
    if (success) clearDirty(pid);
    return success;
  },
  // ---------- CRUD ----------
  get(player, key) {
    const data = getCache(player.id);
    return data ? data[key] : undefined;
  },
  set(player, key, value) {
    let data = getCache(player.id);
    if (!data) data = {};
    data[key] = value;
    setCache(player.id, data);
    markDirty(player.id);
  },
  update(player, key, fn) {
    let data = getCache(player.id);
    if (!data) data = {};
    const old = data[key];
    const updated = fn(old);
    data[key] = updated;
    setCache(player.id, data);
    markDirty(player.id);
    return updated;
  },
  has(player, key) {
    const data = getCache(player.id);
    return data ? Object.prototype.hasOwnProperty.call(data, key) : false;
  },
  delete(player, key) {
    const data = getCache(player.id);
    if (!data) return false;
    const existed = delete data[key];
    if (existed) markDirty(player.id);
    return existed;
  },
  // ---------- Lifecycle ----------
  isLoaded(player) {
    return !!getCache(player.id);
  },
  isDirty(player) {
    return isDirty(player.id);
  },
  clear(player) {
    clearCache(player.id);
  },
  // ---------- Flush ----------
  flush() {
    const now = Date.now();
    if (now - lastFlush < AUTO_SAVE_INTERVAL_MS) return;
    // Queue all dirty players
    getAllDirty().forEach(pid => {
      const player = world.getAllPlayers().find(p => p.id === pid);
      if (player) queueSave(player);
    });
    processQueue();
  }
};

// Hook into world events
onWorldLoad(() => {
  // periodic autosave loop
  setInterval(() => Database.flush(), AUTO_SAVE_INTERVAL_MS);
});

// Export for convenience
export default Database;
