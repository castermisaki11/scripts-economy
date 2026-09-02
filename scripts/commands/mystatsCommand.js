// =========================
// commands/mystatsCommand.js
// คำสั่งแชท /prakan:mystats — แสดงค่า stats ของผู้เล่นคนนั้นทันที (action bar)
//
// ต่างจาก /prakan:stats (statCommands.js) ตรงที่:
//   - /prakan:stats → เปิดเมนูจัดสรรแต้ม (form, กดเลือก stat)
//   - /prakan:mystats → action bar ข้อความอย่างเดียว ไม่เปิดเมนู เห็นเลย
//
// ใช้ showActionBar (messageUtils.js) ซึ่งมี actionbar throttle/queue
// อยู่แล้ว (ดู messageUtils.js) เพื่อกันข้อความทับกับ damage/feedback อื่น
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { getStatBonuses, getPlayerClass } from "../core/statUtils";
import { STAT_CONFIG } from "../config/statConfig";
import { getMoney } from "../core/economyUtils";
import { showActionBar } from "../core/messageUtils";

const CLASS_NAME = {
  warrior: "§cนักรบ",
  archer: "§aนักธนู",
  adventurer: "§bนักผจญภัย"
};

definePlayerCommand({
  name: "prakan:mystats",
  description: "แสดงค่า stats ทั้งหมดของผู้เล่น (action bar)",
  execute(source) {
    system.run(() => {
      const b = getStatBonuses(source);
      const classId = getPlayerClass(source);
      const classLabel = CLASS_NAME[classId] ?? "§7ไม่มีคลาส";
      const money = getMoney(source);

      // แปลง bonus field เป็น % หรือ HP — ใช้ Math.floor เพื่อให้ action bar สั้น
      const hp = Math.floor(b.maxHealthBonus);
      const atk = Math.floor(b.attackDamageBonus);
      const crit = Math.floor(b.criticalChanceBonus);
      const dodge = Math.floor(b.evasionChanceBonus);
      const parry = Math.floor(b.parryChanceBonus);
      const block = Math.floor(b.blockChanceBonus);
      const lifesteal = Math.floor(b.lifestealChanceBonus);

      const text =
        `${classLabel} §8| §aHP §f+${hp} §7| §cATK §f+${atk}% §7| ` +
        `§eCrit §f+${crit}% §7| §bDodge §f${dodge}% §7| ` +
        `§dParry §f${parry}% §7| §6Block §f${block}% §7| ` +
        `§5LS §f${lifesteal}% §7| §f$${money}`;

      showActionBar(source, text, "stats");
    });
  }
});
