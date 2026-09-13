// =========================
// economyUtils.js
// ฟังก์ชันช่วยเรื่อง "เงินผู้เล่น" และ "คลังไอเทมในกระเป๋า"
// รวมมาจาก shop.js / sellfood.js / sellex.js / shopEffect.js
// ที่แต่ก่อนต่างคนต่างเขียนฟังก์ชันเดียวกันซ้ำกันคนละไฟล์
//
// ทุกระบบเศรษฐกิจ (ร้านค้า, ธนาคาร, ตลาดผู้เล่น ฯลฯ) ควร import
// ฟังก์ชันจากไฟล์นี้แทนการเขียนฟังก์ชันเดียวกันซ้ำเอง
// =========================

import { ItemStack, world } from "@minecraft/server";
import { BANK_DYNAMIC_PROPERTY_KEY } from "./constants";
import { onWorldLoad } from "./worldLoad";
import { subscribeSafe } from "./eventGuard";
import { safeGetScore, getOnlinePlayerNames } from "./scoreboardUtils";

// ดึงยอดเงินผู้เล่น (floor + clamp ไม่ให้ติดลบ)
export function getMoney(player) {
  const data = Database.get(player, "money");
  return typeof data === "number" && data >= 0 ? Math.floor(data) : 0;
}

export function setMoney(player, value) {
  const clamped = Math.max(0, Math.floor(value));
  Database.set(player, "money", clamped);
  syncMoneyScore(player, clamped);
}

export function changeMoney(player, delta) {
  const current = getMoney(player);
  const newValue = Math.max(0, Math.floor(current + delta));
  Database.set(player, "money", newValue);
  syncMoneyScore(player, newValue);
  return newValue;
}

// นับจำนวนไอเทมชนิดเดียวกันทั้งหมดในกระเป๋า
export function countItemInInventory(container, itemId) {
    const size = getContainerSize(container);
  let total = 0;
  for (let i = 0; i < size; i++) {
    const stack = container.getItem(i);
    if (stack?.typeId === itemId) total += stack.amount;
  }
  return total;
}

// เอาไอเทมออกจากกระเป๋าตามจำนวนที่ระบุ คืนค่าจำนวนที่เอาออกได้จริง
export function removeItemFromInventory(container, itemId, amountToRemove) {
  let remaining = amountToRemove;
    const size = getContainerSize(container);

  for (let i = 0; i < size && remaining > 0; i++) {
    const stack = container.getItem(i);
    if (!stack || stack.typeId !== itemId) continue;

    if (stack.amount <= remaining) {
      container.setItem(i, undefined);
      remaining -= stack.amount;
    } else {
      const newStack = new ItemStack(stack.typeId, stack.amount - remaining);
      container.setItem(i, newStack);
      remaining = 0;
    }
  }
  return amountToRemove - remaining;
}

// เพิ่มไอเทมเข้ากระเป๋าตามจำนวนที่ระบุ (แบ่งเป็นสแต็กละสูงสุด 64 ให้อัตโนมัติ)
// คืนค่าจำนวนที่ใส่เข้ากระเป๋าได้จริง (น้อยกว่าที่ขอถ้ากระเป๋าเต็ม)
export function addItemToInventory(container, itemId, amount) {
  let remaining = Math.floor(amount);
  let added = 0;

  while (remaining > 0) {
    const chunk = Math.min(remaining, 64);
    const stack = new ItemStack(itemId, chunk);
    const leftover = container.addItem(stack);
    const notAdded = leftover ? leftover.amount : 0;

    added += chunk - notAdded;
    remaining -= chunk;

    if (notAdded > 0) break; // กระเป๋าเต็ม หยุดพยายามใส่ต่อ
  }

  return added;
}

// เพิ่มเงินผู้เล่น คืนค่ายอดเงินใหม่
export function addMoney(player, amount) {
  return changeMoney(player, Math.abs(amount));
}

// หักเงินผู้เล่น คืนค่า true ถ้าหักสำเร็จ (มีเงินพอ), false ถ้าเงินไม่พอ
export function removeMoney(player, amount) {
  const cost = Math.abs(amount);
  if (getMoney(player) < cost) return false;
  changeMoney(player, -cost);
  return true;
}

// ธนาคารกลาง (คีย์เดียวกับที่ economy.js ใช้เก็บภาษีค่าโอน กับ playerMarket.js
// ใช้เก็บภาษีค่าขายในตลาด — ผ่าน BANK_DYNAMIC_PROPERTY_KEY ตัวเดียวกันจาก
// constants.js) — รวมมาไว้ที่นี่จุดเดียว ให้ระบบอื่น ๆ ที่ "หักเงินผู้เล่น
// แล้วเงินหายไปเฉย ๆ" (ร้านค้า/ร้านเอฟเฟกต์/ค่าธรรมเนียมอาชีพ/ค่าเดินทาง)
// เอาเงินที่หักไปนั้นเข้าธนาคารกลางเหมือนกันได้ ไม่ต้องเขียน
// getDynamicProperty/setDynamicProperty ของ world ซ้ำเองอีกไฟล์
//
// เจตนา: เงินทุกบาทที่ผู้เล่นเสียไป ไม่ว่าจะเสียด้วยเหตุผลอะไร (ภาษีค่าโอน,
// ภาษีตลาด, ซื้อของร้านค้า, ซื้อเอฟเฟกต์, ค่าธรรมเนียมเปลี่ยนอาชีพ, ค่าเดินทาง
// TP/บ้าน, ค่าดูดไอเทมอัตโนมัติ ฯลฯ) ควรไหลเข้าธนาคารกลางเดียวกันหมด ไม่ใช่
// สูญไปจากระบบเศรษฐกิจเฉย ๆ — ผู้เรียกที่มี "ช่องทางคืนเงิน" ของตัวเอง (เช่น
// ยกเลิก channel เดินทางแล้วคืนเงิน) ต้องเรียก withdrawFromBank() คู่กันด้วย
// จำนวนเท่ากันตอนคืนเงิน ไม่งั้นเงินจะซ้ำ (ผู้เล่นได้คืน + ธนาคารก็ยังนับไว้)
export function depositToBank(amount) {
  if (!amount || amount <= 0) return;
  const current = world.getDynamicProperty(BANK_DYNAMIC_PROPERTY_KEY) ?? 0;
  world.setDynamicProperty(BANK_DYNAMIC_PROPERTY_KEY, current + amount);
}

// ถอนเงินออกจากธนาคารกลาง — ใช้คู่กับ depositToBank() ตอนมีการคืนเงินให้
// ผู้เล่น (เช่น ยกเลิก TP/เดินทางบ้านที่หักเงินไปแล้วตอนเริ่ม channel) เพื่อ
// ไม่ให้เงินก้อนเดียวกันถูกนับซ้ำทั้งฝั่งผู้เล่น (ได้คืน) และฝั่งธนาคาร (ยังมี)
export function withdrawFromBank(amount) {
  if (!amount || amount <= 0) return;
  const current = world.getDynamicProperty(BANK_DYNAMIC_PROPERTY_KEY) ?? 0;
  if (current - amount < 0) {
    console.warn(`[Economy] Bank over-withdrawal: requested ${amount}, available ${current}`);
  }
  world.setDynamicProperty(BANK_DYNAMIC_PROPERTY_KEY, Math.max(0, current - amount));
}

// คำนวณตัวคูณราคารวมจาก tag ของผู้เล่น เทียบกับรายการ modifiers ที่กำหนด
// (รูปแบบ { tag, multiplier }[] เช่น ECONOMY_CONFIG.AUTO_COLLECT.TAG_PRICE_MODIFIERS)
// — ระบบไหนอยากมีส่วนลด/ส่วนเพิ่มราคาตาม tag ก็เพิ่ม config array แบบนี้ของ
// ตัวเองแล้วเรียกฟังก์ชันนี้ได้เลย ไม่ต้องเขียนตัวเทียบ tag ซ้ำเอง
//
// ถ้ามีหลาย tag ที่ตรงกันพร้อมกัน จะคูณตัวคูณทุกอันต่อกันหมด (ไม่ใช่เลือกแค่
// อันเดียว) — เช่นมี tag ลด 25% กับ tag เพิ่ม 25% พร้อมกัน ผลคือ 0.75 * 1.25
export function getTagPriceMultiplier(player, modifiers) {
  if (!Array.isArray(modifiers) || modifiers.length === 0) return 1;
  let multiplier = 1;
  for (const mod of modifiers) {
    if (mod?.tag && player.hasTag(mod.tag)) {
      multiplier *= mod.multiplier ?? 1;
    }
  }
  return multiplier;
}

/* =========================
   MONEY LEADERBOARD (เมนู "อันดับเงิน" — Top 10 + อันดับตัวเอง)
   Dynamic Property "money" ที่ใช้เก็บยอดเงินจริงด้านบนอ่าน/เขียนได้เฉพาะ
   ตอนผู้เล่นออนไลน์เท่านั้น (ผูกกับ Player object) จึงมิเรอร์ยอดเงินล่าสุดเข้า
   world.scoreboard คู่ขนานไปด้วยทุกครั้งที่ setMoney()/changeMoney() (สอง
   จุดเดียวที่ยอดเงินจริงถูกเขียน) แต่ตอนสร้างรายการอันดับต้องกรองเฉพาะผู้เล่น
   ที่ออนไลน์อยู่เสมอ เพื่อไม่ให้ชื่อผู้เล่นที่ออกจากเกมยังค้างในเมนู
   scoreboard — scoreboard นี้เป็นแค่มิเรอร์สำหรับจัดอันดับ ไม่ใช่ที่เก็บยอด
   เงินจริง (ของจริงยังคงเป็น Dynamic Property "money" เหมือนเดิมทุกจุดที่เหลือ
   ในไฟล์นี้)

   เหมือน systems/scoreboard.js (kills/deaths): world.scoreboard เป็น
   native getter ที่ห้ามอ่านตอน "early execution" (ตอนโมดูลถูกโหลด) ต้อง
   รอ world.afterEvents.worldLoad ก่อนถึงจะสร้าง/อ่าน objective ได้
========================= */
const MONEY_OBJECTIVE_NAME = "prakan_money";
let moneyObj;

// ใช้ onWorldLoad() กลาง (core/worldLoad.js) — เดิม subscribe ตรง ๆ ที่นี่
onWorldLoad(() => {
  moneyObj = world.scoreboard.getObjective(MONEY_OBJECTIVE_NAME);
  if (!moneyObj) {
    moneyObj = world.scoreboard.addObjective(MONEY_OBJECTIVE_NAME, "Money");
    console.warn(`[MoneyLeaderboard] Created objective: ${MONEY_OBJECTIVE_NAME}`);
  }
});

// มิเรอร์ยอดเงินปัจจุบันเข้ากระดาน — เรียกจาก setMoney()/changeMoney()
// เท่านั้น กัน exception หลุดออกไปทำธุรกรรมเงินหลัก (ของจริง) พังไปด้วย
// เพราะกระดานนี้เป็นแค่มิเรอร์รอง
function syncMoneyScore(player, value) {
  if (!moneyObj || !player?.isValid) return;
  try {
    moneyObj.setScore(player, value);
  } catch {
    // ข้ามเงียบ ๆ — ดู comment ด้านบน
  }
}

// ให้ทุกผู้เล่นมี score entry = 0 บนกระดานเงินตั้งแต่ first join —
// กันเมนู "อันดับเงิน" crash เมื่อ world ใหม่ยังไม่มีใครเคยได้เงิน
// (getScore() ของ API v2.x throw กับ target ที่ไม่มี entry — ดู
// safeGetScore(); init 0 ตั้งแต่ต้นทำให้ทุกคนมีแถวในกระดานเสมอ)
subscribeSafe(["playerSpawn"], (event) => {
  try {
    if (!event.initialSpawn) return;
    const player = event.player;
    if (!moneyObj || !player?.isValid) return;
    if (safeGetScore(moneyObj, player) !== undefined) return;
    try {
      moneyObj.setScore(player, 0);
    } catch {
    }
  } catch (error) {
    console.warn("[MoneyLeaderboard] playerSpawn handler error:", error);
  }
});

// Top N ผู้เล่นเงินเยอะสุดที่ยังออนไลน์อยู่ เรียงมากไปน้อย
// คืน [{ rank, name, score }] — ใช้แสดงในเมนู "อันดับเงิน"
// (ui/components/moneyScoreboardUi.js)
export function getTopMoney(limit = 10, onlineNames) {
  if (!moneyObj) return [];
  const names = onlineNames ?? getOnlinePlayerNames();
  return moneyObj.getParticipants()
    .filter((identity) => names.has(identity.displayName))
    .map(identity => ({ name: identity.displayName, score: safeGetScore(moneyObj, identity) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

// อันดับ + ยอดเงินของผู้เล่นคนเดียว (rank เริ่มที่ 1) — นับเฉพาะผู้เล่น
// ที่ออนไลน์และมีเงินมากกว่าเราจริง ๆ (เท่ากัน = อันดับเดียวกัน) ใช้โชว์
// อันดับตัวเองในเมนู "อันดับเงิน" เวลาไม่ติด Top 10 — null ถ้ากระดานยัง
// ไม่พร้อม (ก่อน worldLoad)
export function getMoneyRank(player, onlineNames) {
  if (!moneyObj || !player?.isValid) return null;
  const myScore = safeGetScore(moneyObj, player) ?? 0;
  const names = onlineNames ?? getOnlinePlayerNames();
  const participants = moneyObj.getParticipants().filter((identity) => names.has(identity.displayName));
  let rank = 1;
  for (const identity of participants) {
    if (identity.displayName === player.name) continue;
    if ((safeGetScore(moneyObj, identity) ?? 0) > myScore) rank++;
  }
  return { rank, score: myScore, total: participants.length };
}
