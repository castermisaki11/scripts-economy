// =========================
// commands/aliasCommands.js
// ชื่อย่อ (alias) ของคำสั่งที่ใช้บ่อย — เพราะ "/prakan:xxx" ยาวเกินไปตอน
// พิมพ์ในแชท Custom Command API register "prakan:zen" แล้วเกมสร้าง
// "/zen" (แบบไม่มี namespace) ให้อัตโนมัติ ผู้เล่นจึงพิมพ์ได้ทั้งสองแบบ
//
// หมายเหตุ: รูปแบบสั้น ("/zen", "/ps" ฯลฯ) เป็น namespace ร่วมของทุก addon
// — addon ตัวอื่น register ชื่อเดียวกันจะชนกัน (ตัวโหลดทีหลังชนะ) จึงเลือก
// ใช้ชื่อที่ vanilla ไม่มีและเฉพาะตัวมากพอ:
//   /zen = เปิดเมนูหลัก (ชื่อเดียวกับสมุดเมนู ZEN — จำง่าย)
//   /ps  = ร้านค้า   /pq = เควส    /pj = อาชีพ
//   /ph  = เมนูบ้าน  /pm = ตลาด    /pz = กระดานอันดับ
//
// เรียก open*UI() ตัวเดียวกับคำสั่งต้นฉบับ (questCommands.js, jobCommands.js,
// marketCommands.js, homeCommands.js, scoreboardCommands.js, shopCommands.js)
// — ถ้าเปลี่ยน entry point ที่ไฟล์ต้นฉบับ ให้ sync ตรงนี้ด้วย
// =========================

import { system } from "@minecraft/server";
import { definePlayerCommand } from "../core/commandRegistry";
import { getMainMenu } from "../ui/components/mainUi";
import { showError } from "../core/messageUtils";
import { t } from "../ui/locale/index";
import { openQuestUI } from "../systems/questSystem";
import { openJobUI } from "../systems/jobSystem";
import { openMarketUI } from "../ui/components/marketUi";
import { openHomeUI } from "../systems/homeSystem";
import { openMoneyScoreboardUI } from "../ui/components/moneyScoreboardUi";

definePlayerCommand({
  name: "prakan:zen",
  description: "(ย่อ) เปิดเมนูหลัก — เหมือน /prakan:mainui",
  execute(source) {
    // custom command อ่าน-เขียน world ไม่ได้ตอน callback — ต้อง system.run()
    system.run(() => {
      const menu = getMainMenu();
      if (!menu?.openUI) {
        showError(source, t("ui.mainMenuUnavailable"));
        return;
      }
      menu.openUI(source);
    });
  },
});

definePlayerCommand({
  name: "prakan:ps",
  description: "(ย่อ) เปิดเมนูร้านค้า — เหมือน /prakan:shop",
  execute(source) {
    system.run(() => {
      const menu = getMainMenu();
      if (!menu?.showShoppingMenu) {
        showError(source, t("ui.mainMenuUnavailable"));
        return;
      }
      menu.showShoppingMenu(source);
    });
  },
});

definePlayerCommand({
  name: "prakan:pq",
  description: "(ย่อ) เปิดเมนูเควส — เหมือน /prakan:quest",
  execute(source) {
    system.run(() => {
      openQuestUI(source);
    });
  },
});

definePlayerCommand({
  name: "prakan:pj",
  description: "(ย่อ) เปิดเมนูอาชีพ — เหมือน /prakan:job",
  execute(source) {
    system.run(() => {
      openJobUI(source);
    });
  },
});

definePlayerCommand({
  name: "prakan:ph",
  description: "(ย่อ) เปิดเมนูบ้าน — เหมือน /prakan:homemenu",
  execute(source) {
    system.run(() => {
      openHomeUI(source);
    });
  },
});

definePlayerCommand({
  name: "prakan:pm",
  description: "(ย่อ) เปิดเมนูตลาดผู้เล่น — เหมือน /prakan:market",
  execute(source) {
    system.run(() => {
      openMarketUI(source);
    });
  },
});

definePlayerCommand({
  name: "prakan:pz",
  description: "(ย่อ) เปิดกระดานอันดับ — เหมือน /prakan:score",
  execute(source) {
    system.run(() => {
      openMoneyScoreboardUI(source);
    });
  },
});
