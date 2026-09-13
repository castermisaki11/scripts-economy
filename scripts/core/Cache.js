// Persistent flexible cache
class CacheClass {
  constructor() {
    this.map = new Map();
    this.filePath = `${process.env.HOME}/storage/cache.json`;
    this._load();
    // periodic cleanup of expired entries every minute
    setInterval(() => this._clearExpired(), 60_000);
  }

  _now() { return Date.now(); }

  _load() {
    try {
      const data = require('fs').readFileSync(this.filePath, 'utf8');
      const obj = JSON.parse(data || '{}');
      for (const [k, v] of Object.entries(obj)) {
        if (v.expiresAt && v.expiresAt < this._now()) continue;
        this.map.set(k, { value: v.value, expiresAt: v.expiresAt || null });
      }
    } catch (e) {
      // file may not exist – ignore
    }
  }

  _save() {
    const obj = {};
    for (const [k, entry] of this.map.entries()) {
      if (entry.expiresAt && entry.expiresAt < this._now()) continue;
      obj[k] = { value: entry.value, expiresAt: entry.expiresAt };
    }
    try {
      require('fs').writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      // ignore write errors
    }
  }

  _clearExpired() {
    const now = this._now();
    let changed = false;
    for (const [k, entry] of this.map.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.map.delete(k);
        changed = true;
      }
    }
    if (changed) this._save();
  }

  set(key, value, ttlMs) {
    const expiresAt = ttlMs ? this._now() + ttlMs : null;
    this.map.set(key, { value, expiresAt });
    this._save();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt <= this._now()) {
      this.map.delete(key);
      this._save();
      return undefined;
    }
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    const existed = this.map.delete(key);
    if (existed) this._save();
    return existed;
  }

  clear() {
    this.map.clear();
    this._save();
  }
}

// Export a singleton instance
module.exports = new CacheClass();
