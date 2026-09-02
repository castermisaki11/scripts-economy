// =========================
// ownerSetup.js
// ให้แท็ก "admin" อัตโนมัติกับผู้เล่นเจ้าของ/แอดมินหลักตามชื่อที่กำหนด
// ทันทีที่เข้าเกมครั้งแรก (initial spawn) — กันไม่ต้องพิมพ์คำสั่ง
// /tag <player> add admin เองทุกครั้งที่โลกถูกสร้างใหม่หรือทดสอบใหม่
//
// เพิ่ม/แก้รายชื่อผู้เล่นที่ควรได้ admin อัตโนมัติ แก้ที่ config/ownerConfig.js
// (OWNER_PLAYER_NAMES) จุดเดียว — ไม่กระทบผู้เล่นคนอื่น และไม่แทนที่ระบบ
// แจก tag "player" เดิมใน systems/newPlayerRewards.js (ทำงานคู่ขนานกัน
// ไม่ชนกัน เพราะเช็คคนละเงื่อนไข)
// =========================

import { world } from "@minecraft/server";
import { ADMIN_TAG } from "../core/constants";
import { OWNER_PLAYER_NAMES } from "../config/ownerConfig";
import { ADMIN_FEATURES_ENABLED } from "../config/buildConfig";
import { subscribeSafe } from "../core/eventGuard";

// build no-admin — ไม่แจกแท็ก admin ให้ใครเลย (isAdmin() ปิดอยู่แล้ว
// ผ่าน playerUtils.js แต่ตัดที่ต้นทางด้วย กันแท็กค้างใน world ถ้าเอา
// world เดิมไปเล่นกับ no-admin build)
if (ADMIN_FEATURES_ENABLED) {
  subscribeSafe(["playerSpawn"], event => {
    try {
      const player = event.player;
      if (!event.initialSpawn) return;
      if (!OWNER_PLAYER_NAMES.includes(player.name)) return;
      if (player.hasTag(ADMIN_TAG)) return;
      player.addTag(ADMIN_TAG);
    } catch (error) {
      console.warn("[OwnerSetup] playerSpawn handler error:", error);
    }
  });
}
