# AGENTS.md — scripts-economy

Minecraft Bedrock Economy Addon (Script API). Pure JS — no transpile, no bundler.
Git remote: `origin` → `github.com/castermisaki11/scripts-economy`

## Version management
- **Single source of truth**: `package.json` → `"version": "x.y.z"`
- Sync to 2 files: `manifest.json` (`header.version`) + `scripts/core/constants.js` (`ADDON_VERSION`)
- **Always** run `npm run version:sync` after changing version in `package.json`
- Never edit `manifest.json` or `constants.js` version manually

## Build commands
```bash
npm run version:sync   # sync version: package.json → manifest.json + constants.js
npm run build          # creates dist/*.mcpack (full + no-admin)
npm run lint           # loads all JS files to check syntax
```

## .mcpack packaging
`npm run build` produces 2 files in `dist/`:
- `scripts-economy-v{x.y.z}.mcpack` — full (admin features enabled)
- `scripts-economy-v{x.y.z}-no-admin.mcpack` — no admin (ADMIN_FEATURES_ENABLED = false)

`.mcpack` = zip file with `manifest.json` at root + `scripts/` tree. Install by importing into Minecraft.

## Git workflow
- **ทุก commit ที่ push ต้องทำ release เสมอ** — push ตรงไม่ tag ไม่ได้
- Bump version → `npm run version:sync` → commit → tag → push + push tags
- ห้าม `git push` อย่างเดียวโดยไม่มี tag
- `*.mcpack`, `dist/`, `node_modules/` are gitignored
- Do NOT commit `dist/*.mcpack` files

## Commit message conventions
- ทุก commit ต้องเขียน message อธิบายสั้นๆ ว่าแก้อะไร เพิ่มอะไร เป็นอะไร
- ใช้ format: `type: description`
  - `fix:` — แก้ bug
  - `feat:` — เพิ่มฟีเจอร์ใหม่
  - `hotfix:` — แก้ด่วน
  - `docs:` — แก้เอกสาร
  - `ci:` — แก้ CI/CD
- ตัวอย่าง:
  ```
  fix: add missing ); closing safeAsync() in UIFramework.js
  hotfix v1.6.3: fix missing ); in 60 safeAsync() closures across 15 files
  feat: add build tooling — .mcpack packaging + version sync
  ci: add GitHub Actions — auto build .mcpack on tag push
  docs: add known issues / past bugs section to AGENTS.md
  ```

## GitHub Actions (auto build .mcpack)
- Workflow: `.github/workflows/build.yml`
- Trigger: push tag `v*` (e.g. `git tag v1.7.0 && git push --tags`)
- Flow: checkout → node 20 → npm ci → version:sync → build → create Release พร้อม .mcpack แนบ
- Release assets: `scripts-economy-v{x.y.z}.mcpack` + `scripts-economy-v{x.y.z}-no-admin.mcpack`
- ใช้ `softprops/action-gh-release@v2` สร้าง Release อัตโนมัติ

## Release workflow
```bash
# bump version
vim package.json          # เปลี่ยน "version": "1.7.0"
npm run version:sync
git add . && git commit -m "bump v1.7.0"
git tag v1.7.0
git push && git push --tags
# → GitHub Actions: build + create Release v1.7.0 พร้อม .mcpack แนบ
```

## Project structure
```
scripts/
  index.js                    # Entry point — imports all systems
  config/                     # Centralized config (economyConfig, shopConfig, etc.)
  core/                       # Shared utils (economyUtils, playerUtils, constants, etc.)
  commands/                   # prakan: custom commands
  data/                       # Static data (shops, jobs, quests, items)
  database/                   # Persistence layer (Database, Storage, Cache)
  systems/                    # Game logic (economy, jobs, quests, market, combat)
  ui/                         # UI framework + components + Thai locale
  test/                       # validate.js
tools/
  bump-version.mjs            # Version sync script
  build-mcpack.mjs            # .mcpack builder
manifest.json                 # Minecraft addon manifest (format_version 2)
```

## Key conventions
- `scripts/core/constants.js` — shared constants used by2+ modules only (ADMIN_TAG, BANK_KEY, etc.)
- `scripts/config/buildConfig.js` — `ADMIN_FEATURES_ENABLED` must stay `true` in source (no-admin is only in build output)
- All file comments are in Thai. Commands namespace: `prakan:`
- Dependencies: `@minecraft/server` v2.9.0, `@minecraft/server-ui` v2.1.0

## Known issues / past bugs
- **UIFramework.js safeAsync missing `);`** — ทุกฟังก์ชันที่ห่อด้วย `safeAsync(async (...) => { ... })` ต้องปิดด้วย `});` ไม่ใช่แค่ `}` — ถ้าหาย `);` จะ error `SyntaxError: expecting ','` ตอน load ใน Minecraft (v1.4.43 พบ bug นี้)
- **`npm run lint` ไม่ cover ทุก error** — lint ใช้ dynamic import ซึ่งไม่ detect syntax บางชนิด ให้เช็คด้วย `node --check <file>` ด้วยเสมอ
- **version sync ต้องทำทุกครั้ง** — ถ้าแก้ version ใน `package.json` แล้วลืม `npm run version:sync` manifest.json กับ constants.js จะไม่ตรงกัน → addon โหลดผิดเวอร์ชัน
