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

## Code style
- Indentation: **2 spaces** (ไม่ใช้ tabs)
- Semicolons: **always** — ทุก statement ต้องมี `;`
- Quotes: **double quotes** (`"`) เสมอ
- Arrow functions: **block body** `{ return x; }` เว้นแต่ callback สั้นมากใน chain
- Exports: **named only** — `export function`, `export const`, `export { }` ไม่มี `export default`
- Trailing commas: **always** — ทุก multi-line object/array/params
- Brace style: **K&R** — `{` อยู่บรรทัดเดียวกัน
- Variables: `const` เสมอ, `let` เมื่อต้อง reassign, ห้าม `var`
- Null guard: เริ่มฟังก์ชันด้วย `if (!player?.isValid) return;`
- Optional chaining: ใช้ `?.` และ `??` ตลอด
- Section separator: `// =========================` ขึ้นต้นไฟล์ + แต่ละ section

## Import conventions
- Relative paths เสมอ: `from "../core/economyUtils"` ไม่ใช้ absolute path
- Barrel exports: `config/index.js` re-export ทุก config → import จาก `"../config"`
- Locale: `import { t } from "../ui/locale/index"` — ห้าม import `th.js` ตรง
- Minecraft API: `import { world, system, Player } from "@minecraft/server"`
- Module docs: ขึ้นต้นไฟล์ด้วย comment block อธิบายหน้าที่ของโมดูล

## safeAsync pattern
ทุกฟังก์ชัน async ที่เกี่ยวข้องกับ UI ต้องห่อด้วย `safeAsync()`:
```js
import { safeAsync } from "../core/asyncUtils";

export const openMyMenu = safeAsync(async (player, opts) => {
  if (!player?.isValid) return;
  // ... logic
});
```
**กฎเหล็ก:** ต้องปิดด้วย `});` เสมอ — ห้ามแค่ `}`
ถ้าหาย `);` จะ error `SyntaxError: expecting ','` ตอน load ใน Minecraft
`safeAsync` catch error ทั้งหมด + console.warn — ป้องกัน game crash

## NavigationManager pattern
```js
import { NavigationManager } from "../ui/framework/NavigationManager";

// ไปหน้าใหม่ (push current ลง stack)
NavigationManager.push(player, () => openBuyMenu(player));

// กลับหน้าก่อนหน้า (pop จาก stack)
NavigationManager.back(player);

// ปิดทั้งหมด (clear stack)
NavigationManager.close(player);
```
**Flow ที่ถูกต้อง:**
1. กดเลือกรายการ → `NavigationManager.push(player, () => openSubMenu(player))`
2. กด "กลับ" → `NavigationManager.back(player)` (pop + วาดหน้าก่อนหน้าใหม่)
3. กด "ออกเมนู" → `NavigationManager.close(player)` (clear stack ทั้งหมด)

**ห้าม:** เรียก `openXxx()` โดยไม่ผ่าน NavigationManager — จะไม่มีปุ่ม "กลับ"

## Config system
ทุก config อยู่ใน `scripts/config/` — import จาก `config/index.js` (barrel):
```js
import { ECONOMY_CONFIG, SHOP_CONFIG } from "../config";
```
**โครงสร้าง config:**
```js
// config/economyConfig.js
export const ECONOMY_CONFIG = {
  TRANSFER: { COOLDOWN: 5, DISTANCE: 10, TAX_RATE: 0.05 },
  HOME: { MAX_HOMES: 3 },
};
```
**เพิ่ม config ใหม่:**
1. เพิ่ม key ในไฟล์ config ที่เกี่ยวข้อง (เช่น `economyConfig.js`)
2. ถ้าเป็น config ใหม่ทั้งไฟล์ → เพิ่ม export ใน `config/index.js`
3. ห้าม hardcode ค่าในระบบ — ต้องอยู่ใน config เสมอ

## Adding new features

**เพิ่มไอเทมขาย:** เพิ่มใน `data/items.js` → `RAW_ITEMS`:
```js
"minecraft:new_item": {
  sellPrice: 100,
  category: "ore",        // ต้องตรงกับ id ใน data/shops.js
  icon: "textures/items/new_item",
},
```

**เพิ่มหมวดร้านค้า:** เพิ่มใน `data/shops.js` → `SHOP_CATEGORIES`:
```js
{ id: "newcat", labelKey: "category.newcat", icon: "textures/items/icon" },
```

**เพิ่มคำสั่งใหม่:** สร้างไฟล์ `commands/myCommands.js`:
```js
import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";

definePlayerCommand({
  name: "prakan:mycommand",
  description: "คำอธิบาย",
  execute(source) {
    system.run(() => {
      // UI ต้องอยู่ใน system.run()
    });
  },
});
```
แล้วเพิ่ม 1 บรรทัดใน `commands/registerCommands.js`:
```js
import "./myCommands";
```

**เพิ่มเควส:** เพิ่มใน `data/quests.js` + locale key ใน `th.js`

**เพิ่ม quest chain:** เพิ่มใน `data/questChains.js`
**เพิ่ม achievement:** เพิ่มใน `data/questAchievements.js`

## Thai locale system
ทุก string แสดงผลผ่าน `t()` — ห้าม hardcode ภาษาไทยในโค้ด:
```js
import { t } from "../ui/locale/index";
form.title(t("shop.buy.title"));
form.body(t("shop.buy.balance", { balance: getMoney(player) }));
```
**เพิ่ม string ใหม่:** เพิ่มใน `ui/locale/th.js` (flat object, dotted keys):
```js
"mySystem.key": "ข้อความภาษาไทย",
"mySystem.greeting": "สวัสดี {name}",
```
**Key naming:** `prefix.feature.detail` (เช่น `shop.buy.title`, `quest.chain.detail`)
**Placeholders:** ใช้ `{name}` ใน string → `t("key", { name: "value" })`
**Minecraft formatting:** ใส่ `§a`, `§c`, `§7` ฯลฯ ใน string ได้เลย

## Debugging
**ดู log:** Minecraft Output Log (ไม่ใช่ chat) — ค้นหา `[SystemName]`
**Common errors:**
| Error | สาเหตุ |
|---|---|
| `SyntaxError: expecting ','` | หาย `);` ปิด `safeAsync()` |
| `[locale] Missing key:` | typo ใน key หรือไม่มีใน `th.js` |
| `[Commands] FAILED to register` | command registration error |
| `[async] error:` | safeAsync catch error — ดู stack trace ใน console |
| Version mismatch | ลืม `npm run version:sync` |

**ทดสอบ:**
1. `node --check <file>` — เช็ค syntax (เชื่อถือได้กว่า lint)
2. `npm run lint` — โหลดทุกไฟล์
3. `npm run version:sync && npm run build` — build .mcpack
4. Import .mcpack ใน Minecraft → เช็ค Output Log

## Key conventions
- `scripts/core/constants.js` — shared constants used by2+ modules only (ADMIN_TAG, BANK_KEY, etc.)
- `scripts/config/buildConfig.js` — `ADMIN_FEATURES_ENABLED` must stay `true` in source (no-admin is only in build output)
- All file comments are in Thai. Commands namespace: `prakan:`
- Dependencies: `@minecraft/server` v2.9.0, `@minecraft/server-ui` v2.1.0

## Known issues / past bugs
- **UIFramework.js safeAsync missing `);`** — ทุกฟังก์ชันที่ห่อด้วย `safeAsync(async (...) => { ... })` ต้องปิดด้วย `});` ไม่ใช่แค่ `}` — ถ้าหาย `);` จะ error `SyntaxError: expecting ','` ตอน load ใน Minecraft (v1.4.43 พบ bug นี้)
- **`npm run lint` ไม่ cover ทุก error** — lint ใช้ dynamic import ซึ่งไม่ detect syntax บางชนิด ให้เช็คด้วย `node --check <file>` ด้วยเสมอ
- **version sync ต้องทำทุกครั้ง** — ถ้าแก้ version ใน `package.json` แล้วลืม `npm run version:sync` manifest.json กับ constants.js จะไม่ตรงกัน → addon โหลดผิดเวอร์ชัน
