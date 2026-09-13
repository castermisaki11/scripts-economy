# Scripts Economy v1.6.2

**Note:** All player‑level persistence now goes through `scripts/database/Database.js`. Direct calls to `player.getDynamicProperty` and `player.setDynamicProperty` have been removed (except for world‑level properties). The Database layer provides in‑memory caching, dirty‑flag tracking, and autosave (~5 s interval).

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