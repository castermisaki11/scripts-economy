// =========================
// core/scoreboardUtils.js
// helper อ่าน "Top N + อันดับของผู้เล่น" จาก world.scoreboard objective
// ใดก็ได้ (mined / kills / deaths ฯลฯ) — แยกจาก economyUtils.js ที่มีแค่
// ของกระดานเงิน (prakan_money) เพราะเวอร์ชัน generic นี้ใช้ร่วมกับ UI
// อันดับหลายหมวด (ui/components/moneyScoreboardUi.js) โดยไม่พึ่งระบบเงิน
//
// เหมือน economyUtils: นับเฉพาะ participant ของผู้เล่นที่ออนไลน์อยู่จริง
// (displayName ตรงชื่อผู้เล่นออนไลน์) กัน fake player/ขยะใน objective
// =========================

import { world } from "@minecraft/server";

// ปลอดภัยต่อการเรียน getScore() — v2 API throw ถ้า target ยังไม่มี score
// entry (เหมือน safeGetScore ใน economyUtils.js ที่ไม่ export มา จึงทำซ้ำ
// ที่นี่แบบ self-contained)
export function safeGetScore(objective, target) {
  try {
    const score = objective.getScore(target);
    return typeof score === "number" ? score : undefined;
  } catch {
    return undefined;
  }
}

export function getOnlinePlayerNames() {
  return new Set(world.getPlayers().map((player) => player.name));
}

/**
 * Top N ของ objective (เฉพาะผู้เล่นออนไลน์) — [{name, score, rank}] เรียงจาก
 * มากไปน้อย; objective ไม่มีอยู่ (ก่อน worldLoad) = []
 * @param {string} objectiveName
 * @param {number} limit
 * @param {Set<string>} [onlineNames] pre-computed online names set (ถ้ามีจะ reuse)
 */
export function getTopObjective(objectiveName, limit = 10, onlineNames) {
  const objective = world.scoreboard.getObjective(objectiveName);
  if (!objective) return [];
  const names = onlineNames ?? getOnlinePlayerNames();
  return objective
    .getParticipants()
    .filter((identity) => names.has(identity.displayName))
    .map((identity) => ({ name: identity.displayName, score: safeGetScore(objective, identity) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/**
 * อันดับ + score ของผู้เล่นเดียวใน objective (rank เริ่ม 1, เท่ากัน = อันดับ
 * เดียวกัน) — null ถ้า objective ไม่พร้อม/ผู้เล่น invalid
 * @param {string} objectiveName
 * @param {import("@minecraft/server").Player} player
 * @param {Set<string>} [onlineNames] pre-computed online names set
 */
export function getObjectiveRank(objectiveName, player, onlineNames) {
  const objective = world.scoreboard.getObjective(objectiveName);
  if (!objective || !player?.isValid) return null;
  const myScore = safeGetScore(objective, player) ?? 0;
  const names = onlineNames ?? getOnlinePlayerNames();
  const participants = objective
    .getParticipants()
    .filter((identity) => names.has(identity.displayName));
  let rank = 1;
  for (const identity of participants) {
    if (identity.displayName === player.name) continue;
    if ((safeGetScore(objective, identity) ?? 0) > myScore) rank++;
  }
  return { rank, score: myScore, total: participants.length };
}
