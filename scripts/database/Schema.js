// Default player data schema and migration logic
export const DEFAULT_SCHEMA = {
  version: 1,
  money: 0,
  level: 1,
  exp: 0,
  stats: {
    kills: 0,
    deaths: 0,
    blocksBroken: 0,
    blocksPlaced: 0
  },
  upgrades: {
    weapon: 0,
    armor: 0
  },
  quests: {},
  settings: {}
};

// Map of migration functions: oldVersion => (data) => newData
export const MIGRATIONS = {
  // example future migration
  // 2: (data) => ({ ...data, version: 2, newField: 0 })
};

/**
 * Migrate data to the latest schema version.
 * Mutates and returns the migrated object.
 */
export function migrate(data) {
  if (!data) return { ...DEFAULT_SCHEMA };
  let version = data.version ?? 0;
  while (version < DEFAULT_SCHEMA.version) {
    const next = MIGRATIONS[version + 1];
    if (typeof next === "function") {
      data = next(data);
    }
    version++;
    data.version = version;
  }
  // Ensure all default fields exist
  return { ...DEFAULT_SCHEMA, ...data };
}
