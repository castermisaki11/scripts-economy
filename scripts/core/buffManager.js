// =========================
// buffManager.js
// ระบบกลางสำหรับ "ให้เอฟเฟกต์" (potion effect) แก่ผู้เล่น — จุดประสงค์คือ
// ให้ทุกระบบในแอดออนนี้ (ร้านเอฟเฟกต์, เพิร์คอาชีพ, สเตตัส VIT ฯลฯ) และ
// เอฟเฟกต์จาก addon อื่นที่ติดตั้งอยู่ในโลกเดียวกัน "ซ้อนกัน" ได้ถูกต้อง
// แทนที่จะทับกันเหลือแค่ตัวล่าสุด (เดิมแต่ละระบบเรียก player.addEffect()
// หรือ runCommand("effect ...") ตรง ๆ ของตัวเอง — ถ้าสองแหล่งให้เอฟเฟกต์
// ชนิดเดียวกันพร้อมกัน เช่น addon อื่นให้ speed level 1 อยู่ก่อนแล้ว แล้ว
// ร้านค้าเราขาย speed level 1 เพิ่ม ผลที่ควรได้คือ speed level 2 (ซ้อนกัน)
// แต่เดิมจะได้แค่ level 1 เพราะ addEffect ล่าสุดทับของเดิมไปเฉย ๆ)
//
// *** ข้อจำกัดของ Script API ที่ระบบนี้ออกแบบมารองรับ ***
// Minecraft เก็บสถานะเอฟเฟกต์ที่ตัว entity เป็น "ค่าเดียว" ต่อเอฟเฟกต์หนึ่ง
// ชนิด (amplifier + duration รวมกันเป็นก้อนเดียว) ไม่ได้แยกเก็บว่าใครเป็น
// คนให้บ้าง — ระบบนี้จึงต้องเก็บบัญชี "ใครให้เท่าไหร่" (sourceId) ไว้เอง
// ฝั่งสคริปต์ แล้วคำนวณยอดรวมทุกครั้งที่มีการให้/ยกเลิก/หมดอายุ ก่อนเซ็ต
// ค่าเดียวนั้นกลับไปที่ entity ด้วย player.addEffect()
//
// ส่วนที่ระบบนี้ "แยกไม่ได้จริง ๆ" คือเอฟเฟกต์ที่มาจาก addon อื่นที่ไม่ผ่าน
// ระบบนี้เลย (เราไม่มีทาง import ฟังก์ชันของ behavior pack อื่นได้ ทั้งสอง
// pack เห็นกันแค่ผ่านสถานะเอฟเฟกต์บน entity เท่านั้น) — วิธีแก้ที่ใช้คือ
// ทุกครั้งก่อนคำนวณยอดใหม่ จะอ่านค่าที่ "สังเกตได้จริง" บน entity
// (player.getEffect) แล้วลบด้วยยอดที่ระบบนี้เพิ่งใส่ไปล่าสุดเอง
// (lastAppliedTotal) — ส่วนต่างที่เหลือถือว่าเป็นของ "แหล่งภายนอก" แล้ว
// บวกกลับเข้าไปในยอดรวมใหม่เสมอ วิธีนี้แม่นเมื่อแหล่งภายนอกไม่เปลี่ยนแปลง
// เร็วกว่ารอบ reconcile ของเรา (ดูด้านล่าง) — เป็นวิธี best-effort ที่ดี
// ที่สุดเท่าที่ Script API เปิดให้ทำได้ ไม่ใช่การ track ที่แม่นยำ 100%
//
// *** หน่วยที่ API นี้ใช้: "level" (เริ่มที่ 1) ไม่ใช่ amplifier ดิบ ***
// ให้ตรงกับที่ shopEffect.js ใช้อยู่แล้ว (แสดงเป็นเลขโรมันในเมนู) —
// level 1 = amplifier 0 ในสัญญาของ Script API เอง แปลงให้ตอนเรียก
// player.addEffect()/getEffect() เท่านั้น ผู้เรียก grantBuff/revokeBuff ไม่
// ต้องคิดเรื่อง amplifier 0-based เอง
//
// *** สถานะที่เก็บ ***
// Map<playerId, Map<effectId, { sources: Map<sourceId, { level, expireTick }>,
//                               lastAppliedTotal: number }>>
// คีย์ด้วย player.id (ตามธรรมเนียมเดียวกับ NavigationManager/autoCollect —
// ดู CONTRIBUTING.md) *ไม่* เคลียร์ทิ้งตอน playerLeave (เอฟเฟกต์จริงบน
// entity คงอยู่ต่อเนื่องข้ามการออก-เข้า world/server เดียวกัน ล้าง state
// ทิ้งไปเฉย ๆ ตอนนั้นจะทำให้บัฟถูกนับซ้อนเป็นสองเท่าตอนกลับเข้ามาใหม่ —
// ดูคำอธิบายเต็มที่ท้ายไฟล์ตรงรอบ reconcile) แทนที่ด้วยการ purge/เก็บกวาด
// เฉพาะ source ที่หมดอายุจริงในรอบ reconcile แม้ผู้เล่นจะออฟไลน์อยู่ก็ตาม
//
// *** phase 2 (เสร็จแล้ว): ผูก 3 ระบบเข้ากับไฟล์นี้แล้ว ***
// shopEffect.js (sourceId "shopEffect"), jobSystem.js (sourceId
// "job:" + job.id ต่อเพิร์คของแต่ละอาชีพ), statSystem.js (sourceId
// "stat:vit" สำหรับ health_boost จากแต้ม VIT) เรียก grantBuff()/
// revokeBuff() แทน player.addEffect()/removeEffect()/runCommand("effect
// ...") ตรง ๆ ของตัวเองทั้งหมดแล้ว
//
// *** phase 3 (เสร็จแล้ว): persist state ข้ามการรีสตาร์ตโลก/เซิร์ฟเวอร์ ***
// ปัญหาเดิม: playerBuffs อยู่ใน memory ล้วน ๆ พอ world/server รีสตาร์ต
// (ปิด-เปิดโลกใหม่ ไม่ใช่แค่ผู้เล่นออก-เข้า) script environment จะโดนสร้าง
// ใหม่ทั้งหมด ทำให้ Map นี้ว่างเปล่า แต่เอฟเฟกต์จริงบน entity ยังถูกเซฟ
// ไว้ในโลกเหมือนเดิม พอระบบใดเรียก grantBuff() อีกครั้งหลังรีสตาร์ต (เช่น
// statSystem.js ตอนผู้เล่น spawn) lastAppliedTotal ที่รีเซ็ตเป็น 0 จะทำให้
// getExternalLevel() เข้าใจผิดว่าเอฟเฟกต์เดิม (ที่จริงเป็นของระบบนี้เอง)
// เป็น "แหล่งภายนอก" แล้วบวกยอดใหม่ทับเข้าไปอีกชั้น — บัฟเพิ่มเป็น 2 เท่า
// ทุกครั้งที่ปิด-เปิดโลก
//
// วิธีแก้: เขียน state ของแต่ละผู้เล่นลง player dynamic property
// (BUFF_DYNAMIC_PROPERTY_KEY) ทุกครั้งที่มีการเปลี่ยนแปลง (grant/revoke/
// purge/reconcile) แล้วโหลดกลับตอนแตะ state ของผู้เล่นคนนั้นเป็นครั้งแรก
// ในรอบ session นี้ (ดู ensurePlayerStateLoaded) — เก็บเวลาหมดอายุเป็น
// เวลาจริง (epoch ms, expireAt) แทน currentTick ดิบ เพราะ system.currentTick
// รีเซ็ตเป็น 0 ทุกครั้งที่ script environment ถูกสร้างใหม่ ใช้ tick ดิบข้าม
// รีสตาร์ตไม่ได้ ตอนโหลดกลับจะแปลง expireAt -> expireTick โดยอิงกับ
// currentTick ของ session ปัจจุบันแทน
// =========================

import { world, system } from "@minecraft/server";
import { TICKS_PER_SECOND } from "./constants";

/** รอบ reconcile (ตรวจ source ที่หมดอายุแล้วคำนวณยอดรวมใหม่) — ใช้เฉพาะ
 *  ไฟล์นี้ไฟล์เดียว จึงไม่ย้ายไป constants.js (ดูเหตุผลใน constants.js) */
const RECONCILE_INTERVAL_TICKS = TICKS_PER_SECOND; // ทุก 1 วินาที

const BUFF_DYNAMIC_PROPERTY_KEY = "buffManagerState";

/** @type {Map<string, Map<string, { sources: Map<string, { level: number, expireTick: number }>, lastAppliedTotal: number }>>} */
const playerBuffs = new Map();

/** playerId ที่โหลด state จาก dynamic property มาแล้วใน session นี้ —
 *  กันโหลดซ้ำทับ state ที่กำลังใช้งานอยู่ในรอบเดียวกัน */
const loadedFromStorage = new Set();

/**
 * แปลง state ในหน่วยที่เก็บถาวร (expireAt เป็น epoch ms) กลับมาเป็นหน่วยที่
 * ใช้งานจริงระหว่าง session (expireTick อิงกับ currentTick ปัจจุบัน) —
 * source ที่ expireAt ผ่านไปแล้วจะถูกทิ้งตั้งแต่ตอนโหลดเลย
 */
function deserializePlayerState(raw, currentTick) {
  const playerMap = new Map();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return playerMap;
  }
  if (!parsed || typeof parsed !== "object") return playerMap;

  const now = Date.now();
  for (const [effectId, savedState] of Object.entries(parsed)) {
    if (!savedState || typeof savedState !== "object" || typeof savedState.sources !== "object") continue;

    const sources = new Map();
    for (const [sourceId, src] of Object.entries(savedState.sources)) {
      if (!src || typeof src.level !== "number" || typeof src.expireAt !== "number") continue;
      const remainingMs = src.expireAt - now;
      if (remainingMs <= 0) continue; // หมดอายุไปแล้วระหว่างที่โลกปิดอยู่ — ไม่ต้องเก็บ
      const remainingTicks = Math.ceil((remainingMs / 1000) * TICKS_PER_SECOND);
      sources.set(sourceId, { level: src.level, expireTick: currentTick + remainingTicks, hidden: !!src.hidden });
    }

    if (sources.size > 0) {
      playerMap.set(effectId, {
        sources,
        lastAppliedTotal: typeof savedState.lastAppliedTotal === "number" ? savedState.lastAppliedTotal : 0
      });
    }
  }
  return playerMap;
}

/** แปลง state ปัจจุบัน (expireTick) เป็นหน่วยที่เก็บถาวรได้ (expireAt) แล้ว
 *  เขียนลง player dynamic property */
function persistPlayerState(player, playerMap) {
  if (!player?.isValid) return;

  const currentTick = system.currentTick;
  const now = Date.now();
  const out = {};

  for (const [effectId, state] of playerMap) {
    if (state.sources.size === 0) continue;
    const sources = {};
    for (const [sourceId, src] of state.sources) {
      const remainingTicks = src.expireTick - currentTick;
      sources[sourceId] = { level: src.level, expireAt: now + (remainingTicks / TICKS_PER_SECOND) * 1000, hidden: !!src.hidden };
    }
    out[effectId] = { sources, lastAppliedTotal: state.lastAppliedTotal };
  }

  try {
    Database.set(player, BUFF_DYNAMIC_PROPERTY_KEY, JSON.stringify(out));
  } catch {
    // dynamic property เกินขนาดที่อนุญาต หรือ player ไม่ valid แล้ว —
    // ปล่อยผ่าน ครั้งถัดไปที่ state เปลี่ยนจะพยายามเขียนใหม่อีกครั้ง
  }
}

/** โหลด state จาก dynamic property มาใส่ playerBuffs ถ้ายังไม่เคยโหลดมา
 *  ก่อนใน session นี้ — เรียกก่อนแตะ state ของผู้เล่นคนนั้นทุกครั้ง (ทั้ง
 *  grant/revoke/reconcile) เพื่อให้ session ที่เพิ่งเริ่ม (หลังรีสตาร์ต
 *  โลก) เห็น source เดิมที่ยังไม่หมดอายุแทนที่จะเริ่มจาก baseline ว่าง */
function ensurePlayerStateLoaded(player) {
  if (!player?.isValid || loadedFromStorage.has(player.id)) return;
  loadedFromStorage.add(player.id);

    const raw = Database.get(player, BUFF_DYNAMIC_PROPERTY_KEY);
  if (typeof raw !== "string") return;

  const restored = deserializePlayerState(raw, system.currentTick);
  if (restored.size === 0) return;

  // ไม่ทับ state ที่มีอยู่แล้วใน memory (เผื่อกรณีที่ระบบอื่น grantBuff
  // ไปแล้วก่อนโหลด) — merge เฉพาะ effectId ที่ยังไม่มีใน memory
  const playerMap = getOrCreatePlayerMap(player.id);
  for (const [effectId, state] of restored) {
    if (!playerMap.has(effectId)) playerMap.set(effectId, state);
  }
}

function getOrCreatePlayerMap(playerId) {
  let m = playerBuffs.get(playerId);
  if (!m) {
    m = new Map();
    playerBuffs.set(playerId, m);
  }
  return m;
}

function getOrCreateEffectState(player, effectId) {
  ensurePlayerStateLoaded(player);
  const playerMap = getOrCreatePlayerMap(player.id);
  let state = playerMap.get(effectId);
  if (!state) {
    state = { sources: new Map(), lastAppliedTotal: 0 };
    playerMap.set(effectId, state);
  }
  return state;
}

/** ยอด level ที่ "สังเกตได้จริง" บน entity ตอนนี้ (0 ถ้าไม่มีเอฟเฟกต์นั้นเลย) */
function getObservedLevel(player, effectId) {
  const eff = player.getEffect(effectId);
  return eff !== undefined ? eff.amplifier + 1 : 0;
}

/** ส่วนที่ถือว่ามาจากแหล่งภายนอก (addon อื่น) ณ ขณะนี้ — ดูคำอธิบายวิธีคิด
 *  ที่หัวไฟล์ */
function getExternalLevel(player, effectId, state) {
  return Math.max(0, getObservedLevel(player, effectId) - state.lastAppliedTotal);
}

/** ลบ source ที่หมดอายุแล้วออกจาก state (ไม่แตะ entity) — คืนค่า true ถ้ามี
 *  การลบเกิดขึ้นจริงอย่างน้อย 1 รายการ */
function purgeExpiredSources(state, currentTick) {
  let purged = false;
  for (const [sourceId, src] of state.sources) {
    if (src.expireTick <= currentTick) {
      state.sources.delete(sourceId);
      purged = true;
    }
  }
  return purged;
}

/**
 * คำนวณยอดรวม (แหล่งภายนอก ณ ขณะนี้ + source ทั้งหมดของระบบนี้ที่ยังไม่
 * หมดอายุ) แล้วเซ็ตกลับไปที่ entity ด้วยการเรียกครั้งเดียว — ใช้ร่วมกันทั้ง
 * grantBuff() / revokeBuff() / รอบ reconcile อัตโนมัติ
 */
function recomputeAndApply(player, effectId, state, currentTick) {
  const externalLevel = getExternalLevel(player, effectId, state);
  const playerMap = playerBuffs.get(player.id);

  if (state.sources.size === 0) {
    // ไม่มี source ของระบบนี้เหลือแล้ว — ไม่มีข้อมูลพอจะรู้ duration ที่
    // ควรใช้ถ้ายอดที่เหลือเป็นของแหล่งภายนอกล้วน ๆ จึง "ไม่แตะ" เอฟเฟกต์
    // บน entity เลยในกรณีนี้ (ปล่อยให้เป็นไปตามที่แหล่งภายนอกตั้งไว้เอง)
    // แค่รีเซ็ตบัญชีของเราไว้เป็น baseline สำหรับรอบถัดไป แล้วเลิก track
    // effectId นี้ของผู้เล่นคนนี้ (กันแผนที่โตเรื่อย ๆ โดยไม่จำเป็น)
    playerMap?.delete(effectId);
    if (playerMap) persistPlayerState(player, playerMap);
    return;
  }

  let ourTotal = 0;
  let maxRemainingTicks = 0;
  let anyHidden = false;
  for (const src of state.sources.values()) {
    ourTotal += src.level;
    anyHidden = anyHidden || !!src.hidden;
    maxRemainingTicks = Math.max(maxRemainingTicks, src.expireTick - currentTick);
  }

  const newTotal = externalLevel + ourTotal;

  player.addEffect(effectId, maxRemainingTicks, {
    amplifier: newTotal - 1,
    showParticles: false,
    hidden: anyHidden
  });

  state.lastAppliedTotal = newTotal;
  if (playerMap) persistPlayerState(player, playerMap);
}

/**
 * ให้เอฟเฟกต์แก่ผู้เล่นผ่านระบบกลาง — ถ้าผู้เล่นมีเอฟเฟกต์ชนิดเดียวกันอยู่
 * แล้ว (ไม่ว่าจากระบบอื่นในแอดออนนี้ที่เรียกผ่านไฟล์นี้เหมือนกัน หรือจาก
 * addon อื่นที่สังเกตได้จาก entity) จะ "บวกซ้อน" แทนการทับ
 *
 * @param {import("@minecraft/server").Player} player
 * @param {string} effectId เช่น "speed", "haste"
 * @param {number} level ระดับ เริ่มที่ 1 (ตรงกับ amplifier 0 ของ Script API)
 * @param {number} durationTicks ระยะเวลาของ "source นี้" เป็น tick
 * @param {string} sourceId ตัวระบุแหล่งที่ให้ เช่น "shopEffect", "job:miner",
 *   "stat:vit" — เรียกซ้ำด้วย sourceId เดิมจะ "แทนที่" (ต่ออายุ) source นั้น
 *   ไม่ใช่บวกซ้อนกับตัวเอง
 * @param {boolean} [hidden=false] ซ่อนไอคอน effect บน HUD สำหรับ source นี้
 *   (ใช้กับสเตตัส VIT-เลือด ที่อยากซ่อนไอคอน health_boost)
 * @returns {number} ยอด level รวมที่ถูกใส่ให้ entity จริงหลังคำนวณ
 */
export function grantBuff(player, effectId, level, durationTicks, sourceId, hidden = false) {
  if (!player?.isValid) return 0;
  if (!(level >= 1) || !(durationTicks > 0) || !sourceId) return 0;

  const currentTick = system.currentTick;
  const state = getOrCreateEffectState(player, effectId);

  purgeExpiredSources(state, currentTick);
  state.sources.set(sourceId, { level, expireTick: currentTick + durationTicks, hidden: !!hidden });

  recomputeAndApply(player, effectId, state, currentTick);
  return state.lastAppliedTotal;
}

/**
 * ยกเลิก source หนึ่งก่อนเวลาหมดอายุ (เช่น ผู้เล่นเปลี่ยนอาชีพ, รีเซ็ตแต้ม
 * สเตตัส) — ยอดรวมบน entity จะลดลงตามส่วนของ source นี้ทันที ส่วนของ
 * source อื่น (รวมถึงแหล่งภายนอก) ไม่ถูกกระทบ
 */
export function revokeBuff(player, effectId, sourceId) {
  if (!player?.isValid) return;

  ensurePlayerStateLoaded(player);
  const playerMap = playerBuffs.get(player.id);
  const state = playerMap?.get(effectId);
  if (!state || !state.sources.has(sourceId)) return;

  state.sources.delete(sourceId);
  recomputeAndApply(player, effectId, state, system.currentTick);
}

/** ยอด level รวมที่ระบบนี้กำลัง track ให้ผู้เล่นคนนี้ของเอฟเฟกต์ชนิดนี้
 *  (ไม่รวมส่วนที่ยังไม่เคยเรียก grantBuff เลยแม้จะสังเกตเห็นบน entity) —
 *  ใช้เช็คสถานะ ไม่มีผลข้างเคียงกับ entity */
export function getManagedBuffLevel(player, effectId) {
  if (player?.isValid) ensurePlayerStateLoaded(player);
  const state = playerBuffs.get(player.id)?.get(effectId);
  return state?.lastAppliedTotal ?? 0;
}

/**
 * ล้างบัญชี "ใครให้เอฟเฟกต์อะไรอยู่เท่าไหร่" ของผู้เล่นคนนี้ทิ้งทั้งหมด
 * (ทุก effectId, ทุก sourceId) — ไม่แตะเอฟเฟกต์จริงบน entity เอง (ผู้เรียก
 * ต้องล้างฝั่ง entity เองแยกต่างหาก เช่น player.runCommand("effect @s
 * clear")) มีไว้ให้ฟีเจอร์ "ล้างเอฟเฟกต์ทั้งหมดตอนเข้า/ออกโลก" เรียกคู่กับ
 * การล้างจริงเสมอ — ถ้าล้างแค่ entity โดยไม่ล้างบัญชีนี้ด้วย รอบ reconcile
 * ถัดไป (ทุก 1 วินาที ด้านล่าง) จะเห็นว่า source เดิมของระบบนี้ยังไม่
 * หมดอายุ แล้วใส่เอฟเฟกต์ที่เพิ่งล้างกลับเข้า entity ทันที (อาการเดียวกับ
 * บั๊ก "บัฟเพิ่มเป็นสองเท่า" ที่อธิบายไว้ด้านล่าง — purgeAllBuffs() คือทาง
 * ล้าง state ที่ปลอดภัย ต่างจากการ playerBuffs.delete() ตรง ๆ แบบเดิมตรงที่
 * เรียกจากจุดที่ตั้งใจล้างเอฟเฟกต์จริงคู่กันเสมอ ไม่ใช่ตอน playerLeave
 * เฉย ๆ โดยไม่มีการล้าง entity คู่กัน)
 */
export function purgeAllBuffs(player) {
  if (!player?.id) return;
  playerBuffs.delete(player.id);
  loadedFromStorage.delete(player.id);
  try {
    if (player.isValid) Database.set(player, BUFF_DYNAMIC_PROPERTY_KEY, undefined);
  } catch {
    // player ไม่ valid แล้ว (เช่นระหว่าง afterEvents.playerLeave) — ปล่อยผ่าน
  }
}

// =========================
// รอบ reconcile อัตโนมัติ — จำเป็นเพราะ entity มีได้แค่ duration เดียวต่อ
// เอฟเฟกต์หนึ่งชนิด (ดูคำอธิบายที่หัวไฟล์) ถ้า source ที่ duration สั้นกว่า
// หมดอายุก่อน แต่ entity ยังนับเวลาของ source ที่ duration ยาวกว่าอยู่
// (เพราะเราใส่ maxRemainingTicks ตอน grant) amplifier จะไม่ลดลงเองจนกว่า
// เราจะคำนวณใหม่แล้วเซ็ตกลับไป — รอบนี้ทำหน้าที่นั้นให้ทุกผู้เล่น/ทุก
// เอฟเฟกต์ที่ยัง track อยู่
// =========================
system.runInterval(() => {
  const currentTick = system.currentTick;

  for (const [playerId, effectMap] of playerBuffs) {
    const player = world.getEntity(playerId);

    if (!player?.isValid) {
      // ผู้เล่นออฟไลน์อยู่ตอนนี้ (ออกจากโลกไปแล้วแต่ world/server ยังรันอยู่
      // ต่อเนื่อง — ดูเหตุผลที่ห้ามล้าง state ทั้งก้อนตอน playerLeave ด้านล่าง)
      // ไม่มี entity ให้เขียนกลับ จึง purge ได้แค่ฝั่ง bookkeeping เท่านั้น
      // (ไม่เรียก recomputeAndApply/getObservedLevel ซึ่งต้องมี entity จริง)
      // แล้วเก็บกวาด map ทิ้งเฉพาะตอนไม่เหลือ source ใดค้างอยู่แล้วจริง ๆ
      // กันไม่ให้ playerBuffs โตค้างไปเรื่อย ๆ สำหรับผู้เล่นที่ไม่กลับมาอีก
      for (const [effectId, state] of effectMap) {
        purgeExpiredSources(state, currentTick);
        if (state.sources.size === 0) effectMap.delete(effectId);
      }
      if (effectMap.size === 0) playerBuffs.delete(playerId);
      continue;
    }

    for (const [effectId, state] of effectMap) {
      if (purgeExpiredSources(state, currentTick)) {
        recomputeAndApply(player, effectId, state, currentTick);
      }
    }
  }
}, RECONCILE_INTERVAL_TICKS);

// *** เดิมไฟล์นี้เคยมี world.afterEvents.playerLeave.subscribe() ที่สั่ง
// playerBuffs.delete(playerId) ทิ้งทั้งก้อนตอนผู้เล่นออกจากโลก — ถอดออกแล้ว
// เพราะเป็นสาเหตุของบัค "บัฟถูกเพิ่มเข้าไปอีกตอนออกโลกแล้วเข้าใหม่":
// เอฟเฟกต์ (potion effect) ของผู้เล่นจะ "คงอยู่ต่อเนื่อง" ข้ามการออก-เข้า
// โลก/เซิร์ฟเวอร์เดียวกัน (ตราบที่ world ไม่ได้ถูกปิด/รีสตาร์ตไปด้วย) —
// ไม่ได้หายไปเองตามที่ comment เดิมสันนิษฐานไว้ พอ playerBuffs ถูกล้างทิ้ง
// แต่ entity ยังมีค่าเดิมติดอยู่ พอผู้เล่นเข้ามาใหม่แล้วระบบ (เช่น VIT
// health_boost ใน statSystem.js) เรียก grantBuff() อีกครั้ง lastAppliedTotal
// ที่ถูกรีเซ็ตเป็น 0 ทำให้ getExternalLevel() มองว่าเอฟเฟกต์เดิม (ที่จริง
// เป็นของเราเอง) เป็น "แหล่งภายนอก" แล้วบวกยอดใหม่ทับเข้าไปอีกชั้น — บัฟจึง
// เพิ่มเป็นสองเท่าทุกครั้งที่ออก-เข้า ตอนนี้ปล่อยให้ state ของผู้เล่นที่
// ออฟไลน์อยู่ค้างไว้ใน playerBuffs ต่อไป (purge เฉพาะ source ที่หมดอายุจริง
// ตาม tick ด้านบน) เพื่อให้ lastAppliedTotal ยังตรงกับ entity เดิมตอนคำนวณ
// รอบถัดไปหลังผู้เล่นกลับเข้ามา
//
// *** ทำไมแค่นั้นยังไม่พอ — ทำไมต้อง persist ลง dynamic property ด้วย (phase 3) ***
// วิธีข้างบนแก้ได้แค่กรณี "ผู้เล่นออกจากโลกแล้วเข้าใหม่ แต่ world/server
// process เดิมยังรันอยู่ต่อเนื่อง" (playerBuffs ไม่เคยถูกล้าง) — แต่ถ้า
// world/server เอง "รีสตาร์ต" จริง ๆ (ปิด-เปิดโลก, รีโหลด behavior pack,
// เซิร์ฟเวอร์ crash แล้วเด้งขึ้นใหม่) script environment ทั้งกระบวนการจะ
// ถูกสร้างขึ้นใหม่ playerBuffs (แค่ variable ใน memory) จะกลายเป็น Map
// ว่างเปล่าเหมือนบั๊กเดิมทุกประการ ทั้งที่เอฟเฟกต์จริงบน entity ยังอยู่
// (ถูกเซฟไว้ในไฟล์โลกแยกต่างหาก ไม่ใช่ใน memory ของ script) กรณีนี้แก้
// ด้วย logic ในหน่วยความจำอย่างเดียวไม่ได้ ต้อง persist state ลง player
// dynamic property (ดู BUFF_DYNAMIC_PROPERTY_KEY, ensurePlayerStateLoaded,
// persistPlayerState ด้านบน) ซึ่งอยู่รอดข้ามการรีสตาร์ตเพราะเก็บไว้ในไฟล์
// โลกเดียวกับตัวเอฟเฟกต์เอง แล้วโหลดกลับมาคำนวณ baseline (lastAppliedTotal)
// ให้ตรงกับของเดิมตั้งแต่ก่อนที่ระบบใดจะเรียก grantBuff() ครั้งแรกใน
// session ใหม่
