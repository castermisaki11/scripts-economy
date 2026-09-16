// =========================
// adminEnchant.js
// ศูนย์กลางพฤติกรรม "Admin เอนช้านต์ทั้งชุดในคลิกเดียว" — ไฟล์เดียวที่รู้จัก
// ตรรกะการใส่เอนช้านต์ทุกตัวที่ valid ลงไอเทม (adminUi.js เรียกผ่าน
// enchantPlayerAllGear() เท่านั้น ไม่เขียน logic นี้กระจายใน UI)
//
// ครอบทั้งหมดด้วย try/catch (Known Landmines #2: cross-module hook ต้อง
// self-guard) — ถ้าเกิดข้อผิดพลาดกลางทาง จะแจ้งกลับแทน crash ทั้งแอดออน
//
// ชนิดเอนช้านต์ + ระดับสูงสุดอยู่ใน data/enchantTables.js (data-driven)
// =========================

import { EnchantmentType, EquipmentSlot } from "@minecraft/server";
import { ENCHANT_MASTER_ORDER, ENCHANT_MAX_LEVEL } from "../data/enchantTables";
import { getInventoryContainer } from "../core/itemUtils";

// ใส่เอนช้านต์ทุกตัวที่ valid ลง ItemStack หนึ่งชิ้น (ที่ระดับสูงสุด) —
// ลูปตาม ENCHANT_MASTER_ORDER ตัวที่ใส่ไม่ได้ (ไม่ตรงชนิดไอเทม หรือขัดแย้ง
// กันเอง) จะถูกข้ามไป silently ต่อตัว ไอเทมที่ไม่มี component enchantable
// จะคืนค่าเดิมโดยไม่ทำอะไร
export const enchantItemStack = safeAsync(async (itemStack) => {
  if (!itemStack) return false;
  const enchantable = itemStack.getComponent("minecraft:enchantable");
  if (!enchantable) return false;

  for (const id of ENCHANT_MASTER_ORDER) {
    const level = ENCHANT_MAX_LEVEL[id] ?? 1;
    try {
      enchantable.addEnchantment({ type: new EnchantmentType(id), level });
    } catch {
      // ใส่ไม่ได้ (ไม่ตรงชนิดไอเทม หรือ conflict กับที่ใส่ไปแล้ว) — ข้าม
    }
  }
  return true;
});

// เอนช้านต์ไอเทมที่สวมอยู่ทุกช่อง + ทุกชิ้นในกระเป๋า ของผู้เล่นคนหนึ่ง —
// คืนจำนวนชิ้นที่ถูกเอนช้านต์สำเร็จ (สำหรับแจ้งผล)
// สล็อตที่สนใจ: Head / Chest / Legs / Feet / Mainhand / Offhand
// (Elytra สวมที่ Chest จึงถูกรวมในสล็อต Chest อยู่แล้ว)
export function enchantPlayerAllGear(player) {
  if (!player?.isValid) return 0;

  let enchanted = 0;
  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (equippable) {
      const slots = [
        EquipmentSlot.Head,
        EquipmentSlot.Chest,
        EquipmentSlot.Legs,
        EquipmentSlot.Feet,
        EquipmentSlot.Mainhand,
        EquipmentSlot.Offhand
      ];
      for (const slot of slots) {
        try {
          const item = equippable.getEquipment(slot);
          if (item && enchantItemStack(item)) {
            equippable.setEquipment(slot, item);
            enchanted++;
          }
        } catch {
          // ข้ามสล็อตที่อ่าน/เขียนไม่ได้
        }
      }
    }

    const container = getInventoryContainer(player);
    if (container) {
      const size = getContainerSize(container);
      for (let i = 0; i < size; i++) {
        try {
          const item = container.getItem(i);
          if (item && enchantItemStack(item)) {
            container.setItem(i, item);
            enchanted++;
          }
        } catch {
          // ข้ามช่องที่อ่าน/เขียนไม่ได้
        }
      }
    }
  } catch (err) {
    console.warn("[AdminEnchant] error:", err);
  }

  return enchanted;
}
