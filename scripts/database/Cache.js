const cache = new Map();
const dirty = new Set();
let autosaveTimer = null;

function startAutosave() {
  if (autosaveTimer) return;
  autosaveTimer = setInterval(() => {
    // flush will be called by Database.flush()
  }, 5000);
}

export function getCache(playerId) {
  return cache.get(playerId);
}

export function setCache(playerId, data) {
  cache.set(playerId, data);
  dirty.add(playerId);
}

export function markDirty(playerId) {
  dirty.add(playerId);
}

export function isDirty(playerId) {
  return dirty.has(playerId);
}

export function clearDirty(playerId) {
  dirty.delete(playerId);
}

export function clearCache(playerId) {
  cache.delete(playerId);
  dirty.delete(playerId);
}

export function getAllDirty() {
  return Array.from(dirty);
}

export function start() {
  startAutosave();
}
