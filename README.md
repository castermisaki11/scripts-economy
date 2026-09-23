# Scripts Economy v1.6.2

**Note:** All player‑level persistence now goes through `scripts/database/Database.js`. Direct calls to `player.getDynamicProperty` and `player.setDynamicProperty` have been removed (except for world‑level properties). The Database layer provides in‑memory caching, dirty‑flag tracking, and autosave (~5 s interval).

# Scripts Economy v1.6.2

แอดออนเศรษฐกิจสำหรับ Minecraft Bedrock — งาน, เควส, ร้านค้า, ตลาดผู้เล่น, teleport bank, ระบบค่าสถานะ

**Custom command namespace:** `prakan:` | **API:** `@minecraft/server` v2.9.0, `@minecraft/server-ui` v2.1.0