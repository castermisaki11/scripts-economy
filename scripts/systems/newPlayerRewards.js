import { world, ItemStack } from "@minecraft/server";
import { getInventoryContainer, giveItems } from "../core/itemUtils";
import { ADMIN_TAG } from "../core/constants";
import { REWARD_RULES } from "../data/rewards";
import { subscribeSafe } from "../core/eventGuard";

// ======================================================
//  1) แจก TAG player ให้ผู้เล่นใหม่
//     (แท็ก "admin" ต้องตั้งเองผ่านคำสั่งในเกม เช่น
//      /tag <player> add admin — ไม่มีการแจกอัตโนมัติในโค้ดนี้แล้ว)
// ======================================================

subscribeSafe(["playerSpawn"], event => {
  try {
    const player = event.player;
    if (!event.initialSpawn) return;
    if (!player.hasTag(ADMIN_TAG) && !player.hasTag("player")) {
      player.addTag("player");
    }
    handleGiveOnce(player);
  } catch (error) {
    console.warn("[NewPlayerRewards] playerSpawn handler error:", error);
  }
});

// ======================================================
//  2) กติกาการแจก ITEM (แจกครั้งเดียว)
//     ย้ายไปอยู่ data/rewards.js แล้ว (REWARD_RULES) — เพิ่ม/แก้กติกาแจก
//     ไอเทมแก้ที่นั่นจุดเดียว ไม่ต้องแก้ไฟล์นี้
// ======================================================

// ======================================================
//  3) ฟังก์ชันแจกไอเทมครั้งเดียว
// ======================================================

function handleGiveOnce(player) {
  if (!getInventoryContainer(player)) return;

  for (const rule of REWARD_RULES) {
    if (!player.hasTag(rule.role)) continue;
    if (player.hasTag(rule.givenTag)) continue;

    const item = new ItemStack(rule.itemId, rule.maxAmount);
    item.nameTag = rule.nameTag;
    giveItems(player, item);

    player.addTag(rule.givenTag);
  }
}