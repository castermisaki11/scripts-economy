// =========================
// adminUi.js
// เครื่องมือ Admin: เปลี่ยน GameMode, ตั้งค่า Gamerule, รันคอมมานตรง,
// TP ผู้เล่น -> ผู้เล่น, TP ทุกอย่างในระยะ (เลือกชนิดเอนทิตี้)
//
// === MIGRATED to scripts/ui/ framework ===
// ไฟล์นี้ไม่สร้าง ActionFormData / ModalFormData ตรง ๆ อีกต่อไป
// ทุกหน้าจอผ่าน UIFramework.js, การนำทางผ่าน NavigationManager.js,
// ทุกสตริงผ่าน t() — คำสั่งเกม/ฟิลเตอร์ TP/ค่าเริ่มต้นของฟอร์ม ไม่ถูก
// แก้ไขจากเดิมแม้แต่บรรทัดเดียว
//
// พฤติกรรมที่เปลี่ยนจากของเดิม (ตามกฎ design system ใหม่ — ไม่กระทบ
// คำสั่งเกม/ค่าที่คำนวณใด ๆ):
// - showMainMenu ไม่รับ backCallback เป็นพารามิเตอร์อีกต่อไป (เดิมปุ่ม
//   "กลับ" คือ index สุดท้ายที่เรียก backCallback() ตรง ๆ) ตอนนี้ปุ่ม
//   "กลับ" เป็นของมาตรฐาน framework ที่ NavigationManager.back() จัดการ
//   ให้เอง — ผู้เรียก (mainUi.js) ต้อง NavigationManager.push(...) ก่อน
//   เรียก showMainMenu(player) แทนการส่ง callback เข้ามา
// - เมนูแบบลิสต์ทุกจอ (main, gamemode, gamerule, เลือกผู้เล่นต้นทาง/
//   ปลายทาง) มีปุ่ม "กลับ" ย้อนตามสแตกได้จริงแล้ว (เดิมบางจอ เช่น เลือก
//   ผู้เล่น ไม่มีปุ่มกลับเลย ปิดฟอร์ม (X) = จบการทำงานเงียบ ๆ)
// - ฟอร์มโมดัลที่เป็น "ทำครั้งเดียวจบ" (Random Tick, ยืนยันลบไอเทม,
//   Command Console, ตั้งค่าการ TP ทั้งหมด) ยังคงพฤติกรรมเดิมทุกประการ
//   คือปิดฟอร์ม (X) หรือทำรายการเสร็จ = จบการทำงานทันที ไม่เปิดฟอร์มอื่น
//   ต่อ — ใช้ NavigationManager.close() เพื่อเคลียร์สแตกที่ push ไว้
//   ระหว่างทาง (แนวทางเดียวกับ shopSystem.js / economy.js)
// =========================

import { world } from "@minecraft/server";
import { createListMenu, createAmountPrompt, createTogglesPrompt, createModalPrompt } from "../framework/UIFramework";
import { NavigationManager } from "../framework/NavigationManager";
import { t } from "../locale/index";
import { showSuccess, showError } from "../../core/messageUtils";
import { ICONS, ADMIN_MENU_ITEMS, ADMIN_TP_PASSIVE_MOBS, ADMIN_TP_HOSTILE_MOBS } from "../../config/uiConfig";
import { filterEnabledItems } from "../../core/menuVisibility";
import { openMenuConfigSettings } from "../settings/menuConfigSettings";
import { showConfirm } from "../../core/confirmDialog";
import { addMoney } from "../../core/economyUtils";
import { addPlayerExp } from "../../systems/playerLevel";
import { enchantPlayerAllGear } from "../../systems/adminEnchant";

/**
 * Helper กลางสำหรับแสดง UI เลือกผู้เล่นออนไลน์ — ใช้ซ้ำในหลายฟังก์ชัน
 * @param {Player} admin - ผู้เรียก (แอดมิน)
 * @param {object} opts
 * @param {string} opts.titleKey - locale key สำหรับ title
 * @param {string} [opts.bodyKey] - locale key สำหรับ body
 * @param {Function} opts.onSelect - callback เมื่อเลือกผู้เล่น (รับ player object)
 * @param {Function} [opts.onBack] - callback เมื่อกดกลับ (ถ้าไม่ระบุใช้ NavigationManager.back)
 */
function showPlayerSelectUI(admin, { titleKey, bodyKey, onSelect, onBack }) {
  if (!admin?.isValid) return;

  const players = [...world.getPlayers()];
  const items = players.map(p => ({
    id: p.id,
    labelKey: "shared.playerNameButton",
    labelVars: { name: p.name },
    icon: ICONS.player
  }));

  return createListMenu(admin, {
    titleKey,
    bodyKey,
    items,
    onSelect: (item) => {
      const target = players.find(p => p.id === item.id);
      if (!target?.isValid) {
        showError(admin, t("reward.targetOffline"));
        return onBack ? onBack() : NavigationManager.back(admin);
      }
      return onSelect(target);
    }
  });
}

export class AdminUI {
  // oreScanner: instance เดียวของ OreScanner (systems/oreScanner.js) ที่
  // mainUi.js สร้างและ initialize() ไว้แล้ว — ส่งเข้ามาแบบเดียวกับที่
  // AutoCollector ถูกเก็บไว้ที่ MainMenu เอง (adminUi.js แค่ยืมมาเรียก
  // showSettingsForm ไม่ได้เป็นเจ้าของ instance)
  constructor(uiOpenMap, oreScanner) {
    this.uiOpenMap = uiOpenMap;
    this.oreScanner = oreScanner;
  }

  /* =========================
     Main Menu
  ========================= */
  showMainMenu(player) {
    if (!player?.isValid) return;

    // ปุ่มทั้งหมดของหน้านี้ย้ายไปอยู่ config/uiConfig.js (ADMIN_MENU_ITEMS)
    // แล้ว — กรองรายการที่ถูกปิดไว้จากหน้า "จัดการเมนู" (ทั้งเซิร์ฟเวอร์)
    // ออกก่อนแสดงผล ดู core/menuVisibility.js
    const items = filterEnabledItems("adminMenu", ADMIN_MENU_ITEMS);
    // ปุ่ม "จัดการเมนู" เอง ไม่อยู่ใน ADMIN_MENU_ITEMS — เป็นปุ่มตายตัวเปิด/
    // ปิดไม่ได้เสมอ (กันไม่ให้ Admin ปิดตัวเองจนเข้าหน้าจัดการเมนูไม่ได้)
    // อยู่ท้ายสุดเสมอเหมือนปุ่ม "ตั้งค่าเมนู" ในเมนูหลักผู้เล่น (mainUi.js)
    items.push({ id: "menuConfig", labelKey: "adminui.menuConfigButton", icon: ICONS.settings });

    return createListMenu(player, {
      titleKey: "adminui.mainTitle",
      bodyKey: "adminui.mainBody",
      items,
      onSelect: (item) => {
        switch (item.id) {
          case "gamemode":
            NavigationManager.push(player, () => this.showMainMenu(player));
            return this.showGamemodeMenu(player);

          case "gamerule":
            NavigationManager.push(player, () => this.showMainMenu(player));
            return this.showGameruleMenu(player);

          case "command":
            // showCommandUI เป็นโมดัลทำครั้งเดียวจบ ไม่ push (ดูหมายเหตุ
            // ด้านบน — X/จบการทำงาน = close() ทั้งสแตก เหมือนเดิม)
            return this.showCommandUI(player);

          case "tpPlayer":
            NavigationManager.push(player, () => this.showMainMenu(player));
            return this.showTPPlayerFromUI(player);

          case "tpAll":
            NavigationManager.push(player, () => this.showMainMenu(player));
            return this.showTPAllToPlayerSelectUI(player);

          case "oreScanner":
            // oreScanner.js เป็นฟอร์มโมดัลใบเดียวจบเหมือน autoCollect.js —
            // push ก่อนเสมอ (บันทึกสำเร็จ/validation error จะ back() กลับ
            // มาที่นี่เอง ดู onSubmit ใน oreScanner.js) ส่วนกด X ยกเลิกฟอร์ม
            // ตั้งใจ close() ทั้งสแตกตรง ๆ (ดู onCancel ใน oreScanner.js)
            NavigationManager.push(player, () => this.showMainMenu(player));
            return this.oreScanner?.showSettingsForm(player);

          case "menuConfig":
            // menuConfigSettings.js migrate ตามแนวทางเดียวกับโมดูลอื่น —
            // ต้อง push ก่อนเสมอ
            NavigationManager.push(player, () => this.showMainMenu(player));
            return openMenuConfigSettings(player);

          case "playerRewards":
            // ให้รางวัลผู้เล่น (EXP/Money) — flow หลายหน้า (เลือกผู้เล่น ->
            // เลือกชนิด -> จำนวน -> ยืนยัน) push ก่อนเสมอเหมือน gamemode
            NavigationManager.push(player, () => this.showMainMenu(player));
            return this.showPlayerRewardsSelectUI(player);

          case "enchantGear":
            // เอนช้านต์ทั้งชุด (Admin) — เลือกผู้เล่น -> ยืนยัน -> ใส่ทุกตัว
            // ที่ valid ระดับสูงสุดทั้งชุด + กระเป๋า ในคลิกเดียว
            NavigationManager.push(player, () => this.showMainMenu(player));
            return this.showEnchantTargetSelect(player);
        }
      }
    });
  }

  /* =========================
     Gamemode
  ========================= */
  showGamemodeMenu(player) {
    if (!player?.isValid) return;

    const items = [
      { id: "survival", labelKey: "adminui.gamemodeSurvival", icon: "textures/items/wheat" },
      { id: "creative", labelKey: "adminui.gamemodeCreative", icon: "textures/items/diamond" }
    ];

    return createListMenu(player, {
      titleKey: "adminui.gamemodeTitle",
      menuGroup: "adminGamemodeMenu",
      items,
      onSelect: (item) => {
        player.dimension.runCommand(`gamemode ${item.id} "${player.name}"`);
        // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตกที่ push ไว้ (showMainMenu)
        return NavigationManager.close(player);
      }
    });
  }

  /* =========================
     Gamerule
  ========================= */
  showGameruleMenu(player) {
    if (!player?.isValid) return;

    const items = [
      { id: "randomTick", labelKey: "adminui.gameruleRandomTick", icon: "textures/items/sweet_berries" },
      { id: "killItem", labelKey: "adminui.gameruleKillItem", icon: "textures/ui/cancel" }
    ];

    return createListMenu(player, {
      titleKey: "adminui.gameruleTitle",
      menuGroup: "adminGameruleMenu",
      items,
      onSelect: (item) => {
        // ทั้งสองปลายทางเป็นโมดัลทำครั้งเดียวจบ ไม่ push (เหมือน command)
        if (item.id === "randomTick") return this.showRandomTickUI(player);
        if (item.id === "killItem") return this.showKillItemConfirm(player);
      }
    });
  }

  showRandomTickUI(player) {
    return createAmountPrompt(player, {
      titleKey: "adminui.randomTickTitle",
      promptKey: "adminui.randomTickPrompt",
      placeholder: t("adminui.randomTickPlaceholder"),
      // เดิม: ปิดฟอร์มด้วย X = ไม่ทำอะไรเลย จบการทำงานทันที — เคลียร์
      // สแตกที่ push ไว้ (showMainMenu + showGameruleMenu ไม่ได้ push
      // เพราะเป็นโมดัลลูกของมัน แต่ showMainMenu ที่ push ไว้ก่อนหน้า
      // ต้องเคลียร์)
      onCancel: () => NavigationManager.close(player),
      onSubmit: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 0) {
          showError(player, t("adminui.randomTickInvalid"));
          return NavigationManager.close(player);
        }

        player.dimension.runCommand(`gamerule randomTickSpeed ${num}`);
        showSuccess(player, t("adminui.randomTickSuccess", { value: num }));

        return NavigationManager.close(player);
      }
    });
  }

  async showKillItemConfirm(player) {
    return createTogglesPrompt(player, {
      titleKey: "adminui.killItemTitle",
      toggles: [
        { labelKey: "adminui.killItemToggleLabel", defaultValue: false }
      ],
      onCancel: () => NavigationManager.close(player),
      onSubmit: async ([confirmed]) => {
        if (!confirmed) return NavigationManager.close(player);

        try {
          player.dimension.runCommand("kill @e[type=item]");
          showSuccess(player, t("adminui.killItemSuccess"));
        } catch {
          showError(player, t("adminui.commandError"));
        }

        return NavigationManager.close(player);
      }
    });
  }

  /* =========================
     Command UI
  ========================= */
  showCommandUI(player) {
    return createAmountPrompt(player, {
      titleKey: "adminui.commandTitle",
      promptKey: "adminui.commandPrompt",
      placeholder: t("adminui.commandPlaceholder"),
      onCancel: () => NavigationManager.close(player),
      onSubmit: (value) => {
        let cmd = value?.trim();
        if (!cmd) return NavigationManager.close(player);

        if (cmd.startsWith("/")) cmd = cmd.slice(1);

        try {
          player.dimension.runCommand(cmd);
          showSuccess(player, t("adminui.commandSuccess", { cmd }));
        } catch {
          showError(player, t("adminui.commandError"));
        }

        return NavigationManager.close(player);
      }
    });
  }

  /* =========================
     TP ผู้เล่น -> ผู้เล่น
  ========================= */
  /* =========================
     PLAYER REWARDS (v1.4.6) — แอดมินให้ EXP เลเวล RPG / Money แก่ผู้เล่น
     flow: เลือกผู้เล่นออนไลน์ -> เลือกชนิด -> กรอกจำนวน -> ยืนยัน
     ทุกหน้า onCancel = ย้อนไปหน้าก่อนหน้าของ flow เดียวกัน (ไม่ close stack)
  ========================= */
  showPlayerRewardsSelectUI(admin) {
    return showPlayerSelectUI(admin, {
      titleKey: "reward.selectTitle",
      bodyKey: "reward.selectBody",
      onSelect: (target) => {
        NavigationManager.push(admin, () => this.showPlayerRewardsSelectUI(admin));
        return this.showRewardTypeMenu(admin, target);
      },
      onBack: () => this.showPlayerRewardsSelectUI(admin)
    });
  }

  showRewardTypeMenu(admin, target) {
    return createListMenu(admin, {
      titleKey: "reward.typeTitle",
      bodyKey: "reward.typeBody",
      bodyVars: { name: target.name },
      items: [
        { id: "exp", labelKey: "reward.typeExp", icon: "textures/items/experience_bottle" },
        { id: "money", labelKey: "reward.typeMoney", icon: "textures/items/emerald" }
      ],
      onSelect: (item) => this.showRewardAmountPrompt(admin, target, item.id)
    });
  }

  showRewardAmountPrompt(admin, target, kind) {
    const isExp = kind === "exp";
    const typeLabel = t(isExp ? "reward.typeExp" : "reward.typeMoney");

    return createAmountPrompt(admin, {
      titleKey: "reward.amountTitle",
      promptKey: "reward.amountPrompt",
      promptVars: { name: target.name, type: typeLabel },
      placeholder: "100",
      onCancel: () => this.showRewardTypeMenu(admin, target),
      onSubmit: (value) => {
        const amount = Math.floor(Number(value));
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          showError(admin, t("reward.invalidAmount"));
          return this.showRewardTypeMenu(admin, target);
        }

        return showConfirm({
          player: admin,
          titleKey: "reward.confirmTitle",
          bodyKey: "reward.confirmBody",
          bodyVars: { name: target.name, type: typeLabel, amount },
          onCancel: () => this.showRewardTypeMenu(admin, target),
          onConfirm: () => {
            if (!target?.isValid) {
              showError(admin, t("reward.targetOffline"));
              return this.showPlayerRewardsSelectUI(admin);
            }

            if (isExp) addPlayerExp(target, amount);
            else addMoney(target, amount);

            showSuccess(admin, t("reward.successAdmin", {
              type: typeLabel,
              amount,
              name: target.name
            }));
            // แจ้งผู้รับด้วย — กัน admin ให้แล้วผู้เล่นไม่รู้ตัว
            showSuccess(target, t(isExp ? "reward.successTargetExp" : "reward.successTargetMoney", { amount }));
            return this.showPlayerRewardsSelectUI(admin);
          }
        });
      }
    });
  }

  /* =========================
     Enchant All Gear (Admin) — เอนช้านต์ทั้งชุดในคลิกเดียว
     เลือกผู้เล่น -> ยืนยัน -> ใส่เอนช้านต์ระดับสูงสุดทุกตัวที่ valid
     ลงชุดที่สวมอยู่ (Head/Chest/Legs/Feet/Mainhand/Offhand รวม Elytra
     ที่ Chest) + ทุกชิ้นในกระเป๋า ตรรกะอยู่ที่ systems/adminEnchant.js
  ========================= */
  showEnchantTargetSelect(admin) {
    return showPlayerSelectUI(admin, {
      titleKey: "adminui.enchantSelectTitle",
      bodyKey: "adminui.enchantSelectBody",
      onSelect: (target) => {
        NavigationManager.push(admin, () => this.showEnchantTargetSelect(admin));
        return this.showEnchantConfirm(admin, target);
      },
      onBack: () => this.showEnchantTargetSelect(admin)
    });
  }

  showEnchantConfirm(admin, target) {
    return showConfirm({
      player: admin,
      titleKey: "adminui.enchantConfirmTitle",
      bodyKey: "adminui.enchantConfirmBody",
      bodyVars: { name: target.name },
      onCancel: () => this.showEnchantTargetSelect(admin),
      onConfirm: () => {
        if (!target?.isValid) {
          showError(admin, t("reward.targetOffline"));
          return this.showEnchantTargetSelect(admin);
        }

        const count = enchantPlayerAllGear(target);
        showSuccess(admin, t("adminui.enchantSuccessAdmin", { name: target.name, count }));
        showSuccess(target, t("adminui.enchantSuccessTarget"));
        return this.showEnchantTargetSelect(admin);
      }
    });
  }

  showTPPlayerFromUI(player) {
    return showPlayerSelectUI(player, {
      titleKey: "adminui.tpFromTitle",
      onSelect: (fromPlayer) => {
        NavigationManager.push(player, () => this.showTPPlayerFromUI(player));
        return this.showTPPlayerTargetUI(player, fromPlayer);
      }
    });
  }

  showTPPlayerTargetUI(player, fromPlayer) {
    if (!player?.isValid) return;

    const targets = [...world.getPlayers()].filter(p => p.name !== fromPlayer.name);
    const items = targets.map(p => ({
      id: p.id,
      labelKey: "shared.playerNameButton",
      labelVars: { name: p.name },
      icon: ICONS.player
    }));

    return createListMenu(player, {
      titleKey: "adminui.tpToTitle",
      titleVars: { name: fromPlayer.name },
      items,
      onSelect: (item) => {
        const target = targets.find(p => p.id === item.id);
        if (!target) return NavigationManager.back(player);

        player.dimension.runCommand(`tp "${fromPlayer.name}" "${target.name}"`);
        // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตกที่ push ไว้ทั้งหมด
        // (showMainMenu + showTPPlayerFromUI)
        return NavigationManager.close(player);
      }
    });
  }

  /* =========================
     TP ทุกอย่างในระยะ (เลือกชนิด)
  ========================= */
  showTPAllToPlayerSelectUI(player) {
    return showPlayerSelectUI(player, {
      titleKey: "adminui.tpFromTitle",
      onSelect: (fromPlayer) => {
        NavigationManager.push(player, () => this.showTPAllToPlayerSelectUI(player));
        return this.showTPAllTargetPlayerUI(player, fromPlayer);
      }
    });
  }

  showTPAllTargetPlayerUI(player, fromPlayer) {
    if (!player?.isValid) return;

    const targets = [...world.getPlayers()].filter(p => p.name !== fromPlayer.name);
    const items = targets.map(p => ({
      id: p.id,
      labelKey: "shared.playerNameButton",
      labelVars: { name: p.name },
      icon: ICONS.player
    }));

    return createListMenu(player, {
      titleKey: "adminui.tpAllTargetTitle",
      items,
      onSelect: (item) => {
        const target = targets.find(p => p.id === item.id);
        if (!target) return NavigationManager.back(player);

        NavigationManager.push(player, () => this.showTPAllTargetPlayerUI(player, fromPlayer));
        return this.showTPAllOptionsUI(player, fromPlayer, target);
      }
    });
  }

  showTPAllOptionsUI(player, fromPlayer, target) {
    return createModalPrompt(player, {
      titleKey: "adminui.tpAllOptionsTitle",
      fields: [
        { type: "slider", labelKey: "adminui.tpAllRangeLabel", min: 1, max: 30, step: 1, defaultValue: 5 },
        { type: "toggle", labelKey: "adminui.tpAllIncludePlayers", defaultValue: true },
        { type: "toggle", labelKey: "adminui.tpAllIncludePassive", defaultValue: true },
        { type: "toggle", labelKey: "adminui.tpAllIncludeHostile", defaultValue: false },
        { type: "toggle", labelKey: "adminui.tpAllIncludeItem", defaultValue: false }
      ],
      // เดิม: ปิดฟอร์มด้วย X = ไม่ทำอะไรเลย จบการทำงานทันที
      onCancel: () => NavigationManager.close(player),
      onSubmit: ([range, includePlayers, passive, hostile, items]) => {
        this.tpWithFilters(fromPlayer, target, range, includePlayers, passive, hostile, items);
        // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตกที่ push ไว้ทั้งหมด
        // (showMainMenu + showTPAllToPlayerSelectUI + showTPAllTargetPlayerUI)
        return NavigationManager.close(player);
      }
    });
  }

  tpWithFilters(fromPlayer, target, range, players, passive, hostile, items) {
    const { x, y, z } = fromPlayer.location;
    const dim = fromPlayer.dimension;

    if (players) {
      try {
        dim.runCommand(
          `tp @a[r=${range},x=${x},y=${y},z=${z}] "${target.name}"`
        );
      } catch {}
    }

    if (passive) {
      ADMIN_TP_PASSIVE_MOBS.forEach(mobType => {
        try {
          dim.runCommand(
            `tp @e[type=${mobType},r=${range},x=${x},y=${y},z=${z}] "${target.name}"`
          );
        } catch {}
      });
    }

    if (hostile) {
      ADMIN_TP_HOSTILE_MOBS.forEach(mobType => {
        try {
          dim.runCommand(
            `tp @e[type=${mobType},r=${range},x=${x},y=${y},z=${z}] "${target.name}"`
          );
        } catch {}
      });
    }

    if (items) {
      try {
        dim.runCommand(
          `tp @e[type=item,r=${range},x=${x},y=${y},z=${z}] "${target.name}"`
        );
      } catch {}
    }

    showSuccess(fromPlayer, t("adminui.tpAllSuccess"));
  }
}
