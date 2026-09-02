// =========================
// NavigationManager.js
// สแตกของ "หน้าจอ" ต่อผู้เล่นหนึ่งคน แทนที่การส่ง backCallback
// เป็นพารามิเตอร์ไปทุกฟังก์ชันแบบเดิม
//
// แต่ละรายการในสแตกคือฟังก์ชันที่เรียกแล้ว "วาดหน้าจอเดิมใหม่"
// เช่น () => openSellMenu(player)
//
// นี่ยังเป็นจุดเดียวที่เห็น navigation event ทุกตัว จึงเป็นที่เก็บ
// telemetry แบบ local ด้วย (ดู amendment 7)
// =========================

import { world } from "@minecraft/server";
import { TELEMETRY } from "../../config/uiConfig";
import { formatDateTime } from "../../core/timeUtils";
import { subscribeSafe } from "../../core/eventGuard";

const stacks = new Map(); // player.id -> Array<() => void | Promise<void>>
// จำกัดความลึกของสแตก — กัน infinite navigation loops จากบั๊ก
const MAX_STACK_DEPTH = 20;
// ฟังก์ชัน "เมนูทั้งหมดถูกปิดแล้ว" ต่อผู้เล่นหนึ่งคน — เรียกครั้งเดียวตอน
// close() จริง ๆ (ไม่ว่าจะมาจากไหน: ปุ่ม "ออกเมนู", ปุ่ม "กลับ" ที่สแตกว่าง
// พอดี, หรือ NavigationManager.close() ที่ระบบอื่นเรียกหลังทำรายการเสร็จ)
// ใช้แก้ปัญหาเดิมที่ mainUi.js เคลียร์ uiOpenMap ผ่าน onCancel/onSelect ของ
// ตัวเองเท่านั้น ซึ่งปุ่ม "กลับ"/"ออกเมนู" ที่กดตรง ๆ บนเมนูรากไม่เคยผ่าน
// onCancel/onSelect เลย (ดู createListMenu ใน UIFramework.js) ทำให้
// uiOpenMap ค้างเป็น true ผู้เล่นกดไอเทมเปิดเมนูซ้ำไม่ติด
const closeHandlers = new Map(); // player.id -> () => void

// คีย์ด้วย player.id (ไม่ใช่ player.name) ตาม convention เดียวกับ
// autoCollect.js (onPlayerLeave ใช้ playerId เป็นคีย์ Map อยู่แล้ว) — name
// เปลี่ยนได้ระหว่างเซสชัน/รองรับซ้ำกันได้ในบาง config ของเซิร์ฟเวอร์ ส่วน id
// เสถียรตลอดอายุการเชื่อมต่อของผู้เล่นคนนั้นจริง ๆ
function getStack(player) {
  if (!stacks.has(player.id)) stacks.set(player.id, []);
  return stacks.get(player.id);
}

// กันหน่วยความจำรั่ว: ถ้าผู้เล่นออกจากเกม (หลุด/ปิดเกม/kick) ขณะเมนูยังเปิด
// ค้างอยู่ stacks/closeHandlers ของคนนั้นจะไม่มีทางถูกลบเลยถ้าไม่มีจุดนี้
// เพราะ close() ปกติถูกเรียกจากปุ่มในเมนูเท่านั้น (ผู้เล่นที่ offline ไป
// กดปุ่มอะไรไม่ได้อีกแล้ว) — ไม่เรียก close() ตรงนี้เพราะ closeHandlers
// อาจอ้างอิงถึงตัวผู้เล่นที่ offline ไปแล้ว แค่ทิ้งข้อมูลเปล่า ๆ ทิ้งไปเฉย ๆ
subscribeSafe(["playerLeave"], ({ playerId }) => {
  try {
    stacks.delete(playerId);
    closeHandlers.delete(playerId);
  } catch (error) {
    console.warn("[NavigationManager] playerLeave handler error:", error);
  }
});

/* =========================
   TELEMETRY (local, capped rolling buffer)
   เก็บใน world dynamic property เดียวกับรูปแบบที่ economy.js
   ใช้กับ transactionLog อยู่แล้ว
========================= */
function getLogs() {
  try {
    return JSON.parse(world.getDynamicProperty(TELEMETRY.DYNAMIC_PROPERTY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveLogs(logs) {
  world.setDynamicProperty(TELEMETRY.DYNAMIC_PROPERTY_KEY, JSON.stringify(logs));
}

function addLog(entry) {
  const logs = getLogs();
  logs.unshift({ time: formatDateTime(), ...entry });
  if (logs.length > TELEMETRY.MAX_ENTRIES) logs.length = TELEMETRY.MAX_ENTRIES;
  saveLogs(logs);
}

export const NavigationManager = {
  /**
   * ผลักหน้าจอปัจจุบัน (ที่กำลังจะออกจาก) เข้าสแตก ก่อนไปหน้าถัดไป
   * เรียกจากทุก action ที่แปลว่า "ไปหน้า B"
   * @param {import("@minecraft/server").Player} player
   * @param {() => void} screenFn  ฟังก์ชันวาดหน้าจอปัจจุบันใหม่
   */
  push(player, screenFn) {
    if (!player?.isValid || typeof screenFn !== "function") return;
    const stack = getStack(player);
    // Safety net: ป้องกัน infinite navigation loops
    if (stack.length >= MAX_STACK_DEPTH) {
      console.warn("[NavigationManager] Stack depth limit reached, closing menu");
      return this.close(player);
    }
    stack.push(screenFn);
  },

  /**
   * ป๊อปหน้าจอบนสุดออกจากสแตก แล้ววาดใหม่ (ปุ่ม "กลับ")
   * ถ้าสแตกว่าง = ปิดเมนูทั้งหมด
   */
  back(player) {
    if (!player?.isValid) return;
    const stack = getStack(player);
    const prevScreen = stack.pop();
    if (prevScreen) return prevScreen();
    return this.close(player);
  },

  /**
   * ล้างสแตกทั้งหมดของผู้เล่น (ปุ่ม "ปิด")
   */
  close(player) {
    if (!player?.id) return;
    stacks.delete(player.id);

    // เรียก close handler (ถ้ามีลงทะเบียนไว้) แล้วลบทิ้งทันที — กันไม่ให้
    // เรียกซ้ำถ้ามีการเรียก close() อีกครั้งก่อนเปิดเมนูใหม่ (setCloseHandler
    // จะลงทะเบียนใหม่ทุกครั้งที่เปิดเมนูอยู่แล้ว)
    const handler = closeHandlers.get(player.id);
    if (handler) {
      closeHandlers.delete(player.id);
      handler();
    }
  },

  /**
   * ลงทะเบียนฟังก์ชันที่ต้องเรียกตอนเมนูทั้งหมดถูกปิดจริง ๆ (close())
   * ไม่ว่าการปิดนั้นจะมาจากทางไหนก็ตาม — mainUi.js เรียกตอนเปิดเมนูทุกครั้ง
   * เพื่อให้แน่ใจว่า uiOpenMap ถูกเคลียร์เสมอเมื่อเมนูปิดจริง (ดูหมายเหตุที่
   * closeHandlers ด้านบน) ส่ง fn เป็น null/undefined เพื่อยกเลิกการลงทะเบียน
   * @param {import("@minecraft/server").Player} player
   * @param {(() => void) | null} fn
   */
  setCloseHandler(player, fn) {
    if (!player?.id) return;
    if (typeof fn === "function") closeHandlers.set(player.id, fn);
    else closeHandlers.delete(player.id);
  },

  /**
   * สลับหน้าจอบนสุดโดยไม่เพิ่มความลึกของสแตก — ใช้ตอนย้ายไปหน้า
   * "พี่น้องกัน" ในระดับเดียวกัน (เช่น เปลี่ยนหมวดหมู่ในเมนูเดียวกัน)
   * ที่การกด "กลับ" ควรข้ามกลับไปหน้าก่อนหน้าตัวเดิม ไม่ใช่หน้านี้
   */
  replace(player, screenFn) {
    if (!player?.isValid || typeof screenFn !== "function") return;
    const stack = getStack(player);
    if (stack.length > 0) stack.pop();
    return screenFn();
  },

  /**
   * บันทึก event ลง telemetry log — เรียกจาก UIFramework เท่านั้น
   * ไม่ควรเรียกตรงจากไฟล์เมนู
   * @param {import("@minecraft/server").Player} player
   * @param {"screen-entered"|"dialog-confirmed"|"dialog-cancelled"} eventType
   * @param {string} screenKey  titleKey ของหน้าจอ/ไดอะล็อกนั้น
   */
  logEvent(player, eventType, screenKey) {
    addLog({
      player: player?.name ?? "unknown",
      type: eventType,
      screen: screenKey ?? "unknown"
    });
  },

  /**
   * สรุปยอดจาก telemetry log ปัจจุบัน เรียงจากมากไปน้อย
   * ใช้ทำเมนู "เมนูที่เปิดบ่อยที่สุด" / "confirm ที่ถูกยกเลิกบ่อยที่สุด" ให้ admin
   * @returns {{ screen: string, type: string, count: number }[]}
   */
  getTelemetrySummary() {
    const logs = getLogs();
    const counts = new Map();
    for (const entry of logs) {
      const key = `${entry.screen ?? "unknown"}::${entry.type}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => {
        const [screen, type] = key.split("::");
        return { screen, type, count };
      })
      .sort((a, b) => b.count - a.count);
  }
};
