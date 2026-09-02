// =========================
// data/rewards.js
// กติกาการแจกไอเทมให้ผู้เล่นแบบครั้งเดียว (Rewards) — แทนที่ itemRules ที่
// เคย hardcode อยู่ใน systems/newPlayerRewards.js
//
// เพิ่มกติกาแจกไอเทมใหม่ = เพิ่ม 1 รายการที่นี่เท่านั้น ไม่ต้องแก้
// systems/newPlayerRewards.js — แต่ละรายการ:
//   role:      string  แท็กผู้เล่นที่ต้องมีถึงจะได้รับ (ตรวจด้วย player.hasTag)
//   itemId:    string  typeId ของไอเทมที่จะแจก
//   nameTag:   string  ชื่อไอเทมที่แจก (ItemStack.nameTag)
//   maxAmount: number  จำนวนที่แจก
//   givenTag:  string  แท็กที่จะติดให้ผู้เล่นหลังแจกแล้ว (กันแจกซ้ำ)
// =========================

import { ADMIN_TAG, MENU_BOOK_ITEM_ID, MENU_BOOK_NAME_TAG } from "../core/constants";

export const REWARD_RULES = [
  {
    role: ADMIN_TAG,
    itemId: MENU_BOOK_ITEM_ID,
    nameTag: MENU_BOOK_NAME_TAG,
    maxAmount: 1,
    givenTag: "got_ui_admin"
  },
  {
    role: "player",
    itemId: MENU_BOOK_ITEM_ID,
    nameTag: MENU_BOOK_NAME_TAG,
    maxAmount: 1,
    givenTag: "got_ui_player"
  }
];
