// =========================
// itemUtils.js
// ศูนย์รวมฟังก์ชันช่วยเรื่อง "ไอเทมในกระเป๋าผู้เล่น" ที่ใช้ร่วมกันหลาย
// โมดูล — เช่น เปิด inventory container, นับ/ลบไอเทมตาม typeId, ใส่ไอเทม
// เข้ากระเป๋าแบบปลอดภัย (ไม่ throw ออกไปนอกฟังก์ชัน) — รวมมาจาก
// shopSystem.js / playerMarket.js / autoCollect.js / newPlayerRewards.js ที่แต่ก่อนต่างคน
// ต่างเปิด inventory component + เขียน try/catch รอบ container.addItem()
// เองซ้ำกันคนละไฟล์
//
// ฟังก์ชันระดับ container (countItemInInventory / removeItemFromInventory)
// ยังอยู่ที่ economyUtils.js เหมือนเดิม (ย้ายมาจากที่นั่นตั้งแต่รอบรวม
// เศรษฐกิจ) — ไฟล์นี้ห่อเป็นฟังก์ชันระดับ "player" ให้เรียกง่ายขึ้น (ไม่ต้อง
// เปิด container เองก่อนทุกครั้ง) แทนที่จะเขียน logic นับ/ลบไอเทมซ้ำอีกชุด
//
// ทุกโมดูลที่ต้องนับ/ลบ/ให้ไอเทมผู้เล่น ควร import จากไฟล์นี้แทนการเขียนเอง
// ซ้ำ ตามสถาปัตยกรรมเดียวกับ economyUtils.js / soundUtils.js /
// messageUtils.js / confirmDialog.js / playerUtils.js
//
// หมายเหตุการรวม:
//   - getInventoryContainer(): เดิม shopSystem.js / autoCollect.js เปิดผ่าน
//     component id เต็ม "minecraft:inventory" ส่วน playerMarket.js เปิดผ่าน
//     รูปย่อ "inventory" — ทั้งสองรูปแบบชี้ไปที่ component เดียวกัน (แค่คนละ
//     สไตล์การเขียน) ไฟล์นี้ใช้รูปเต็ม "minecraft:inventory" เป็นมาตรฐาน
//     เดียวเหมือนที่ shopSystem.js/autoCollect.js ใช้อยู่แล้ว ไม่กระทบ
//     พฤติกรรมเกม
//   - giveItems(): ครอบ container.addItem() ด้วย try/catch มาตรฐานเดียว
//     (คืน true/false แทนการปล่อยให้ exception หลุดออกไป) ตรงกับที่
//     playerMarket.js เขียน try/catch แบบเดียวกันนี้ซ้ำ 3 จุด (claim ของค้าง
//     รับ / ซื้อของตลาด / ยกเลิกลงขาย)
// =========================

import { countItemInInventory, removeItemFromInventory } from "./economyUtils";
import { INVENTORY_COMPONENT } from "./constants";

// เปิด inventory container ของผู้เล่น — คืน null ถ้าไม่มี (กันไว้เฉย ๆ ตาม
// ของเดิม ในทางปฏิบัติผู้เล่นที่ valid มี component นี้เสมอ)
export function getInventoryContainer(player) {
  return player?.getComponent(INVENTORY_COMPONENT)?.container ?? null;
}

// นับจำนวนไอเทมชนิดเดียวกันทั้งหมดในกระเป๋าผู้เล่น
export function countItem(player, itemId) {
  const container = getInventoryContainer(player);
  return container ? countItemInInventory(container, itemId) : 0;
}

// เช็คว่าผู้เล่นมีไอเทมชนิดนี้ครบตามจำนวนที่ต้องการไหม
export function hasEnoughItems(player, itemId, amount) {
  return countItem(player, itemId) >= amount;
}

// เอาไอเทมออกจากกระเป๋าผู้เล่นตามจำนวนที่ระบุ คืนค่าจำนวนที่เอาออกได้จริง
export function removeItems(player, itemId, amount) {
  const container = getInventoryContainer(player);
  return container ? removeItemFromInventory(container, itemId, amount) : 0;
}

// ใส่ ItemStack (พร้อม enchant/lore/durability ที่ตั้งมาแล้ว) เข้ากระเป๋า
// ผู้เล่น คืน true ถ้าใส่ได้ (ไม่มี exception หลุดออกมา), false ถ้าใส่ไม่ได้
// (เช่นกระเป๋าเต็ม หรือไม่มี container) — ต่างจาก addItemToInventory ใน
// economyUtils.js ตรงที่รับ ItemStack สำเร็จรูปมาตรง ๆ (ไม่แบ่งสแตก 64 เอง)
// ใช้กับกรณีที่ต้องคง NBT/enchant ของ ItemStack เดิมไว้ (ของค้างรับ,
// ซื้อ/ยกเลิกของในตลาดผู้เล่น, แจกไอเทมเริ่มต้น)
export function giveItems(player, itemStack) {
  const container = getInventoryContainer(player);
  if (!container) return false;
  try {
    container.addItem(itemStack);
    return true;
  } catch (e) {
    return false;
  }
}

// หาสแตกแรกของไอเทมชนิดนี้ในกระเป๋าผู้เล่น คืน ItemStack หรือ null ถ้าไม่มี
// (ยังไม่มีจุดไหนเรียกใช้จริงตอนนี้ เตรียมไว้ให้โมดูลอื่นในอนาคตใช้แทนการ
// วนลูป container เองเหมือน countItem/removeItems)
export function findItemStack(player, itemId) {
  const container = getInventoryContainer(player);
  if (!container) return null;

  const size = container.size ?? 36;
  for (let i = 0; i < size; i++) {
    const stack = container.getItem(i);
    if (stack?.typeId === itemId) return stack;
  }
  return null;
}

// ไอคอน "เดา" จาก typeId ตรง ๆ (ตัด namespace "minecraft:" ออกแล้วชี้ไปที่
// textures/items/<ชื่อ>) — ใช้กับไอเทมที่ไม่ได้ลงทะเบียนไว้ใน data/items.js
// เช่น ไอเทมใด ๆ ในกระเป๋าผู้เล่นที่ระบบยังไม่รู้จัก (inventoryUi.js ดูกระเป๋า
// ผู้เล่นคนอื่น, playerMarket.js ลงขายของในตลาด) — เดิม playerMarket.js มี
// ฟังก์ชันนี้เป็น local ของตัวเอง (getItemIconPath) ย้ายมารวมไว้ที่นี่แทน
// ให้ inventoryUi.js เรียกใช้ร่วมกันได้ ไม่ต้องเขียนซ้ำ (พฤติกรรมเดิมทุกประการ)
// หมายเหตุ: เป็นการเดาแบบง่าย ไม่ครอบคลุมไอเทมที่ชื่อ texture ไม่ตรงกับ
// typeId เป๊ะ ๆ (เช่นไอเทมที่ผ่านการปรุงอาหาร/บล็อก) — ถ้าไอเทมนั้น
// ลงทะเบียนไว้ใน data/items.js แล้วให้ใช้ getItemIcon() จากที่นั่นแทน
// เพราะแม่นยำกว่า
export function getGenericItemIcon(typeId) {
  if (!typeId) return "";
  const itemName = typeId.includes(":") ? typeId.split(":")[1] : typeId;
  return `textures/items/${itemName}`;
}
