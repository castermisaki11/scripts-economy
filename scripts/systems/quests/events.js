// =========================
// quests/events.js
// ย้ายมาจาก questSystem.js เดิม (หัวข้อ EVENT HOOKS — mine / kill /
// playerSpawn) แบบคงเดิมทุกประการ
//
// ไฟล์นี้ต้องถูก import เสมอ (ผ่าน facade questSystem.js) เพราะลงทะเบียน
// world event subscriptions ตอนโหลดโมดูล
// =========================

import { world, system } from "@minecraft/server";
import { subscribeSafe, BLOCK_BREAK_EVENTS } from "../../core/eventGuard";
import { resolveAttackingPlayer } from "../../core/playerUtils";
import { advanceQuests } from "./engine";
import { readQuestData } from "./storage";
import { ensureQuestResets } from "./reset";
import { reportMarketSold } from "./reportApi";
import { getPendingQuestMarketSales, clearPendingQuestMarketSales } from "../playerMarket";
import { getLastAttacker, clearLastAttacker } from "../../core/lastAttackerTracker";

/* =========================
   EVENT HOOKS (mine / kill) — ผ่าน advanceQuests() เป็น Central Dispatcher
   รักษา Logic เดิมทุกอย่าง (redstone lit block normalization,
   resolveAttackingPlayer(), player validity checks)
========================= */

subscribeSafe(BLOCK_BREAK_EVENTS, (event) => {
  try {
    const { player, brokenBlockPermutation } = event;
    if (!player?.isValid) return;

    let typeId = brokenBlockPermutation?.type?.id;
    if (!typeId) return;
    if (typeId === "minecraft:lit_redstone_ore") typeId = "minecraft:redstone_ore";
    else if (typeId === "minecraft:lit_deepslate_redstone_ore") typeId = "minecraft:deepslate_redstone_ore";

    advanceQuests(player, "mine", typeId, 1);
  } catch (error) {
    console.warn("[QuestSystem] playerBreakBlock handler error:", error);
  }
}, "QuestSystem");

// Last attacker fallback — using shared lastAttackerTracker
// (ไม่ต้อง maintain Map/event handler ของตัวเองอีกต่อไป)

subscribeSafe(["entityDie"], (event) => {
  try {
    const { damageSource, deadEntity } = event;
    if (deadEntity.typeId === "minecraft:player") return;

    let attacker = resolveAttackingPlayer(damageSource);
    if (attacker?.typeId !== "minecraft:player" || attacker.id === deadEntity.id) {
      attacker = getLastAttacker(deadEntity.id);
    }
    clearLastAttacker(deadEntity.id);

    if (!attacker || attacker.typeId !== "minecraft:player" || attacker.id === deadEntity.id) return;

    advanceQuests(attacker, "kill", deadEntity.typeId, 1);
  } catch (error) {
    console.warn("[QuestSystem] entityDie handler error:", error);
  }
}, "QuestSystem");

/* =========================
   EVENT HOOKS (Player Spawn) — จุด Lazy Reset ที่ 3 ตามสเปค (3.4/3.5): ตรวจ
   Daily/Weekly Reset ทันทีตอนผู้เล่นเข้าเกม ไม่ต้องรอ Progress Event หรือ
   เปิด Quest UI ก่อน
========================= */

subscribeSafe(["playerSpawn"], (event) => {
  try {
    if (!event.initialSpawn) return;
    const player = event.player;
    if (!player?.isValid) return;

    const data = readQuestData(player);
    ensureQuestResets(player, data);

    // เควส market_sell ค้างส่ง (ผู้ขายออฟไลน์ตอนของขายได้ในตลาด — ดู
    // marketUi.js confirmPurchase()) — flush ตอนเจ้าของ spawn เข้าเกมจริง
    // เท่านั้น (ตรงกับที่ addPendingQuestMarketSale() คอมเมนต์ไว้ว่าจะ flush
    // จุดไหน) เคลียร์คิวก่อนแจ้ง Progress กันซ้ำถ้า reportMarketSold() ด้านล่าง
    // throw หรือ player กลาย invalid กลางคัน (ไม่อยากให้รายการเดิมค้างวน
    // นับซ้ำไม่รู้จบ ยอมรับความเสี่ยงเควสหายมากกว่าเควสถูกนับซ้ำ)
    const pendingSales = getPendingQuestMarketSales(player);
    if (pendingSales.length > 0) {
      clearPendingQuestMarketSales(player);
      for (const sale of pendingSales) {
        reportMarketSold(player, sale.itemId, sale.amount);
      }
    }
  } catch (error) {
    console.warn("[QuestSystem] playerSpawn handler error:", error);
  }
});
