# Scripts Economy v1.6.2

แอดออนเศรษฐกิจสำหรับ Minecraft Bedrock — งาน, เควส, ร้านค้า, ตลาดผู้เล่น, teleport bank, ระบบค่าสถานะ

**Custom command namespace:** `prakan:` | **API:** `@minecraft/server` v2.9.0, `@minecraft/server-ui` v2.1.0

## โครงสร้างไฟล์

```
scripts-economy/
├── manifest.json
└── scripts/
    ├── index.js                 # Entry point
    ├── commands/                # Custom commands ทั้งหมด
    │   ├── registerCommands.js  # จุดรวมการลงทะเบียนคำสั่ง
    │   ├── commandRegistry.js   # Core: definePlayerCommand() + installCommands()
    │   ├── mainUiCommand.js
    │   ├── tpCommands.js
    │   ├── homeCommands.js
    │   ├── shopCommands.js
    │   ├── jobCommands.js
    │   ├── questCommands.js
    │   ├── statCommands.js
    │   ├── marketCommands.js
    │   ├── adminCommands.js
    │   └── ...
    ├── core/                    # Utilities ร่วม
    │   ├── constants.js         # Shared constants (ADMIN_TAG, ADDON_VERSION, etc.)
    │   ├── economyUtils.js      # Money management
    │   ├── playerUtils.js       # Player utilities
    │   ├── statUtils.js         # RPG stat layer
    │   ├── levelUtils.js        # EXP/level formula
    │   ├── commandRegistry.js   # Command registration system
    │   ├── buffManager.js       # Centralized effect tracking
    │   ├── messageUtils.js      # Feedback display
    │   ├── soundUtils.js        # UI sounds
    │   └── ...
    ├── systems/                 # Logic หลัก
    │   ├── economy.js           # Player-to-player transfers + tax
    │   ├── jobSystem.js         # Job framework (mining/chopping/killing)
    │   ├── questSystem.js       # Quest facade (11 sub-modules)
    │   ├── shopEffect.js        # Effect shop
    │   ├── playerMarket.js      # Player-to-player market
    │   ├── tpBankSystem.js      # Teleport request-accept
    │   ├── homeSystem.js        # Home/waypoint system
    │   ├── statSystem.js        # RPG stat allocation
    │   ├── playerLevel.js       # EXP/leveling
    │   ├── combatAttributes.js  # Damage formula engine
    │   ├── affinitySystem.js    # Equipment mastery
    │   ├── scoreboard.js        # Scoreboard tracking
    │   ├── autoCollect.js       # Auto-collect items/XP
    │   ├── oreScanner.js        # Admin ore scanner
    │   ├── newPlayerRewards.js  # Starter items
    │   ├── ownerSetup.js        # Auto-admin tag
    │   ├── effectResetOnJoinLeave.js
    │   └── quests/              # Quest sub-modules
    │       ├── engine.js        # Central dispatcher
    │       ├── generation.js    # Random quest generation
    │       ├── progression.js   # Rewards + achievements
    │       ├── storage.js       # Quest data read/write
    │       ├── chains.js        # Chain quest progress
    │       ├── rerollEngine.js  # Reroll system
    │       ├── reset.js         # Daily/Weekly reset
    │       └── ui/              # Quest UI
    ├── ui/                      # UI framework
    │   ├── framework/
    │   │   ├── UIFramework.js   # Central UI factory
    │   │   ├── NavigationManager.js  # Per-player nav stack
    │   │   └── SearchService.js # Search engine (Thai tone normalization)
    │   ├── components/
    │   │   ├── mainUi.js        # Main menu hub
    │   │   ├── adminUi.js       # Admin panel
    │   │   ├── marketUi.js      # Player market UI
    │   │   ├── moneyScoreboardUi.js  # Leaderboard
    │   │   └── inventoryUi.js   # Admin inventory viewer
    │   ├── locale/
    │   │   ├── index.js         # t() function
    │   │   └── th.js            # Thai translations (1000+ lines)
    │   └── settings/
    │       ├── uiSettings.js    # Menu reorder UI
    │       └── menuConfigSettings.js  # Sub-menu toggle
    └── data/                    # Data layer
```

---

## Custom Commands (`prakan:`)

### คำสั่งหลัก

| คำสั่ง | คำอธิบาย | สิทธิ์ |
|---|---|---|
| `prakan:mainui` | เปิด main menu (เหมือนใช้ menu book) | Any |
| `prakan:zen` | Alias ของ `/prakan:mainui` | Any |
| `prakan:shop` | เปิดร้านค้า (Transfer/Buy/Sell/Effects) | Any |
| `prakan:ps` | Alias ของ `/prakan:shop` | Any |
| `prakan:sell` | เปิดเมนูขายตรง | Any |
| `prakan:tpmenu` | เปิดเมนู teleport (เลือก player) | Any |
| `prakan:tpa <player>` | ส่ง teleport request หา player | Any |
| `prakan:tpahelp` | วิธีใช้ /prakan:tpa | Any |
| `prakan:tpaccept` | รับ teleport request | Any |
| `prakan:sethome [name]` | ตั้ง home (default: "home") | Any |
| `prakan:home [name]` | Teleport ไป home | Any |
| `prakan:delhome [name]` | ลบ home | Any |
| `prakan:homes` | รายการ homes ทั้งหมด | Any |
| `prakan:homemenu` | เปิด graphical home menu | Any |
| `prakan:homehelp` | วิธีใช้ home commands | Any |
| `prakan:job` | เปิดเมนูงาน (เลือก/เปลี่ยน job) | Any |
| `prakan:jobhelp` | วิธีใช้ job system | Any |
| `prakan:quest` | เปิดเมนูเควส | Any |
| `prakan:pq` | Alias ของ `/prakan:quest` | Any |
| `prakan:stats` | เปิดเมนู stat allocation (STR/AGI/VIT) | Any |
| `prakan:mystats` | แสดง stats บน action bar | Any |
| `prakan:timezone [bar]` | แสดงวันเวลา (Thai, UTC+7) | Any |
| `prakan:market` | เปิด Player Market | Any |
| `prakan:pm` | Alias ของ `/prakan:market` | Any |
| `prakan:score` | เปิด Leaderboard (Money/Mining/Kills/Deaths) | Any |
| `prakan:pz` | Alias ของ `/prakan:score` | Any |
| `prakan:autocollect` | เปิด Auto-Collect toggle menu | Any |
| `prakan:menusettings` | เปิด Menu Settings (จัดลำดับเมนู) | Any |
| `prakan:job` | เปิดเมนูงาน | Any |
| `prakan:pj` | Alias ของ `/prakan:job` | Any |
| `prakan:ph` | Alias ของ `/prakan:homemenu` | Any |

### Admin Commands

| คำสั่ง | คำอธิบาย | สิทธิ์ |
|---|---|---|
| `prakan:admin` | เปิด Admin panel | Admin |
| `prakan:checkplayer` | เปิด Check Player inventory | Admin |
| `prakan:addexp <player> <amount>` | ให้ RPG EXP | Admin |
| `prakan:addmoney <player> <amount>` | ให้เงิน | Admin |

---

## ระบบหลัก

### Economy (`economy.js`)

ระบบโอนเงินระหว่างผู้เล่น + ภาษีเข้าคลังกลาง
- **Transfer cooldown:** 5 วินาที
- **Tax:** 10% เข้า bank
- **Admin panel:** ถอนจาก bank, ตั้ง tax rate, ดู transaction logs

### Job System (`jobSystem.js`)

ระบบงาน — เลือก job แล้วได้เงิน+EXP อัตโนมัติตอนขุด/ตัด/kill
- **Jobs:** Miner, Lumberjack, Hunter, etc.
- **Level:** Lv1-50, +2% money/level
- **Perks:** Lv15/30/50 — effect refresh ทุก 5 วินาที
- **VIP:** tag "vip" = 1.5x money, 2.25x EXP
- **Change cooldown:** 24 ชั่วโมง, ค่าธรรมเนียม 50,000

### Quest System (`questSystem.js` + `quests/`)

ระบบเควส — 5 ประเภท
- **Bounty:**  kill หรือ collect จำนวนที่กำหนด
- **Daily:** เควสรายวัน (reset เวลา 00:00 UTC+7)
- **Weekly:** เควสรายสัปดาห์
- **Achievement:** เควสถาวร
- **Chain:** เควสต่อเนื่อง
- **Reroll:** เปลี่ยน Daily/Weekly ได้

### Shop System (`shopEffect.js` + `shopCommands.js`)

ร้านค้า — 4 ประเภท
- **Transfer:** โอนเงินระหว่างผู้เล่น
- **Buy:** ซื้อของจาก NPC shop
- **Sell:** ขายของให้ NPC shop
- **Effect Shop:** ซื้อ potion effects (speed, strength, resistance, etc.)
- **Tax:** 10% เข้า bank

### Player Market (`playerMarket.js` + `marketUi.js`)

ตลาดผู้เล่น — ซื้อขายระหว่างกัน
- **Max listings:** 200
- **Tax:** 10% เข้า bank
- **Expiry:** 1 วัน
- **Features:** search, sort (newest/price), watchlist, alerts
- **Item serialization:** 保留 enchantments, lore, durability

### Teleport System (`tpBankSystem.js`)

ระบบ teleport request-accept
- **Cost:** distance x 10 coins/block (same dimension) หรือ 10,000 (cross-dimension)
- **Request timeout:** 30 วินาที
- **Channeling:** 12 วินาทีหลัง accept — ห้ามขยับ/เปลี่ยน dimension/fight
- **Combat block:** auto-reject ถ้า target กำลัง fight

### Home System (`homeSystem.js`)

ระบบ home/waypoint ส่วนตัว
- **Max homes:** 5
- **Set cost:** 1,000 coins
- **Teleport cost:** distance x 5 coins/block (same) หรือ 10,000 (cross-dimension)
- **Channeling:** 8 วินาที

### Stat System (`statSystem.js`)

ระบบ RPG stat allocation
- **15 sub-stats** ใน 3 กลุ่ม: STR, AGI, VIT
- **Classes:** Warrior (STR), Archer (AGI), Adventurer (VIT)
- **Class multiplier:** 1.25x สำหรับกลุ่มที่ถนัด
- **Class change cost:** 50,000
- **Perks:**
  - Warrior: lifesteal +2%
  - Archer: crit +3%
  - Adventurer: thorn +5%

### Combat Attributes (`combatAttributes.js`)

ระบบ damage formula
- **Defense pipeline:** evasion -> parry (150% reflect) -> block (50% reduction) -> damage reduction
- **Lifesteal, thorn reflect**
- **Damage display** บน action bar

### Affinity System (`affinitySystem.js`)

ระบบ equipment mastery — gain EXP โดยใช้ weapons/armor ใน combat
- Anti-farming diminishing returns
- UI แสดง levels ต่อ weapon/armor category

### Auto-Collect (`autoCollect.js`)

ระบบเก็บของอัตโนมัติ
- **Modes:** item pickup, XP vacuum, item vacuum, send items to coordinates
- **Cost:** money/second (configurable per tag)

### Scoreboard (`scoreboard.js`)

ระบบ scoreboard — kills, deaths, blocks mined
- แสดงบน action bar หลัง kill/death

---

## Configuration

### Economy Config

| ค่า | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `BUY_PRICE_MULTIPLIER` | 1.4 | Buy price = sell price x 1.4 |
| `TRANSFER.COOLDOWN` | 5s | Cooldown ระหว่าง transfers |
| `TRANSFER.MAX_DISTANCE` | 150 | ระยะห่างสูงสุด |
| `TRANSFER.TAX` | 0.10 | ภาษี 10% |
| `TELEPORT.COST_PER_BLOCK` | 10 | ค่า teleport ต่อ block |
| `TELEPORT.CROSS_DIMENSION_COST` | 10000 | ค่า teleport ข้าม dimension |
| `TELEPORT.REQUEST_TIMEOUT` | 30s | เวลา request timeout |
| `TELEPORT.CHANNEL_TIME` | 12s | เวลา channeling |
| `HOME.MAX_HOMES` | 5 | จำนวน home สูงสุด |
| `HOME.SET_COST` | 1000 | ค่าตั้ง home |
| `HOME.COST_PER_BLOCK` | 5 | ค่า teleport ต่อ block |
| `AUTO_COLLECT.ITEM_COST` | 1/s | ค่า item pickup |
| `AUTO_COLLECT.XP_COST` | 1/s | ค่า XP vacuum |
| `AUTO_COLLECT.VACUUM_COST` | 10/s | ค่า item vacuum |

### Stat Config

| ค่า | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `STARTING_POINTS` | 2 | คะแนนเริ่มต้น |
| `BASE_EXP` | 100 | EXP base สำหรับ level up |
| `EXPONENT` | | 0.9 | Level formula exponent |
| `POINTS_PER_LEVEL` | | 1 | คะแนนต่อ level |
| `CLASS_CHANGE_COST` | 50000 | ค่าเปลี่ยน class |
| `CLASS_MULTIPLIER` | | 1.25x | Multiplier สำหรับกลุ่มถนัด |

### Job Config

| ค่า | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `CHANGE_COOLDOWN` | 24h | Cooldown เปลี่ยนงาน |
| `CHANGE_FEE` | 50000 | ค่าธรรมเนียมเปลี่ยนงาน |
| `MAX_LEVEL` | | 50 | Level สูงสุด |
| `MONEY_PER_LEVEL` | +2% | เงินเพิ่มต่อ level |
| `VIP.MONEY_MULTIPLIER` | 1.5x | VIP money multiplier |
| `VIP.EXP_MULTIPLIER` | 2.25x | VIP EXP multiplier |

### Shop Config

| ค่า | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `BUY_PRESETS` | [1, 3, 32, 64] | จำนวนที่เลือกซื้อได้ |
| `NPC_SHOP_TAX` | 0.10 | ภาษี NPC shop |
| `MARKET.MAX_LISTINGS` | 200 | จำนวน listing สูงสุด |
| `MARKET.TAX` | 0.10 | ภาษี market |
| `MARKET.EXPIRY_DAYS` | 1 | วันหมดอายุ listing |

---

## Locale System

- **ไฟล์:** `ui/locale/th.js` (Thai, 1000+ lines)
- **Function:** `t(key, vars)` — lookup key ใน locale table
- **Variable interpolation:** `{name}` ถูกแทนที่ด้วย `vars.name`
- **Missing keys:** คืน key เอง + log warning
- **เพิ่มภาษา:** สร้างไฟล์ใหม่ เช่น `en.js`, import ใน `index.js`

---

## Key Constants

| Constant | ค่า | คำอธิบาย |
|---|---|---|
| `ADMIN_TAG` | `"admin"` | Player tag สำหรับ admin check |
| `MENU_BOOK_ITEM_ID` | `"minecraft:paper"` | Item สำหรับเปิดเมนู |
| `MENU_BOOK_NAME_TAG` | `"ZEN"` | NameTag ของ menu book |
| `ADDON_VERSION` | `"1.6.2"` | เวอร์ชันแอดออน |
| `TICKS_PER_SECOND` | 20 | Tick ต่อวินาที |
| `BANK_DYNAMIC_PROPERTY_KEY` | `"bank"` | คีย์ dynamic property ของธนาคารกลาง |
| `INVENTORY_COMPONENT` | `"minecraft:inventory"` | Component ID ของกระเป๋า |

---

## วิธี bump เวอร์ชัน

แก้พร้อมกัน 3 ที่:
1. `manifest.json` — header.version + modules[].version
2. `scripts/core/constants.js` — `ADDON_VERSION`
3. **ปล.** ถ้ามี `package.json` ก็ต้องแก้ด้วย (แต่ปัจจุบันไม่มี)

---

## Architecture Patterns

1. **Queue Pattern:** แต่ละไฟล์คำสั่งเรียก `definePlayerCommand()` ตอน load (queue), `registerCommands.js` import ทั้งหมดแล้วเรียก `installCommands()` ครั้งเดียว
2. **Navigation Stack:** ทุก UI ใช้ `NavigationManager` (push/back/close/replace) — max depth 20
3. **Single Source of Money:** ทุก money operation ผ่าน `economyUtils.js`
4. **Central Bank:** ภาษี/ค่าธรรมเนียมทั้งหมดเข้า world dynamic property `"bank"`
5. **Buff Manager:** Centralized effect tracking ป้องกัน double-application
6. **Locale-First:** ข้อความทั้งหมดผ่าน `t()` — ไม่มี hardcoded text
7. **Event Guard:** `subscribeSafe()` wrap ทุก event handler ด้วย try/catch
