import { world, ItemStack } from "@minecraft/server";
import { createListMenu, createModalPrompt } from "../framework/UIFramework";
import { NavigationManager } from "../framework/NavigationManager";
import { t } from "../locale/index";
import { showSuccess, showError } from "../../core/messageUtils";
import { INVENTORY_COMPONENT } from "../../core/constants";
import { getGenericItemIcon } from "../../core/itemUtils";
import { ICONS } from "../../config/uiConfig";

export class inv {
  constructor(uiOpenMap) {
    this.uiOpenMap = uiOpenMap;
  }

  // =========================
  // ADMIN MAIN MENU
  // =========================
  // MIGRATED: ไม่รับ backCallback แยกอีกต่อไป — เหมือนโมดูลอื่นที่ migrate
  // แล้วทุกประการ (homeSystem.js, tpBankSystem.js, playerMarket.js, adminUi.js
  // ฯลฯ) ผู้เรียก (mainUi.js) ต้อง NavigationManager.push() ก่อนเรียกเข้ามา
  // เสมอ — ปุ่ม "กลับ"/X จากหน้ารากนี้จึงใช้ NavigationManager.back(player)
  // ตรง ๆ ได้เลย (จะไปโผล่ที่ฟังก์ชันที่ถูก push ไว้ก่อนหน้าโดยอัตโนมัติ)
  showMainMenu(player) {
    if (!player?.isValid) return;

    const items = [
      { id: "selectPlayer", labelKey: "inv.selectPlayer", icon: "textures/ui/magnifyingGlass.png" }
    ];

    return createListMenu(player, {
      titleKey: "inv.mainTitle",
      bodyKey: "inv.mainBody",
      menuGroup: "inventoryMenu",
      items,
      onCancel: () => NavigationManager.back(player),
      onSelect: (item) => {
        if (item.id === "selectPlayer") {
          NavigationManager.push(player, () => this.showMainMenu(player));
          return this.selectPlayerUI(player);
        }
      }
    });
  }

  // =========================
  // SELECT PLAYER
  // =========================
  selectPlayerUI(admin) {
    if (!admin?.isValid) return;

    const players = [...world.getPlayers()];
    const items = players.map(p => ({
      id: p.id,
      labelKey: "shared.playerNameButton",
      labelVars: { name: p.name },
      icon: ICONS.player
    }));

    return createListMenu(admin, {
      titleKey: "inv.selectPlayerTitle",
      bodyKey: "inv.selectPlayerBody",
      items,
      onSelect: (item) => {
        const target = players.find(p => p.id === item.id);
        if (!target) return NavigationManager.back(admin);

        NavigationManager.push(admin, () => this.selectPlayerUI(admin));
        return this.selectItemUI(admin, target);
      }
    });
  }

  // =========================
  // SELECT ITEM
  // =========================
  selectItemUI(admin, target) {
    if (!admin?.isValid || !target?.isValid) return NavigationManager.back(admin);

    const inv = target.getComponent(INVENTORY_COMPONENT).container;
    const items = [];

    for (let i = 0; i < inv.size; i++) {
      const item = inv.getItem(i);
      if (item) {
        items.push({
          id: i,
          labelKey: "inv.itemButton",
          labelVars: {
            slot: i,
            id: item.typeId.replace("minecraft:", ""),
            amount: item.amount
          },
          icon: getGenericItemIcon(item.typeId)
        });
      }
    }

    return createListMenu(admin, {
      titleKey: "inv.selectItemTitle",
      titleVars: { name: target.name },
      bodyKey: "inv.selectItemBody",
      items,
      onSelect: (item) => {
        NavigationManager.push(admin, () => this.selectItemUI(admin, target));
        return this.itemActionUI(admin, target, item.id);
      }
    });
  }

  // =========================
  // ITEM ACTION
  // =========================
  itemActionUI(admin, target, slot) {
    if (!admin?.isValid || !target?.isValid) return NavigationManager.back(admin);

    const items = [
      { id: "remove", labelKey: "inv.actionRemove", icon: "textures/ui/cancel" },
      { id: "edit", labelKey: "inv.actionEdit", icon: "textures/ui/icon_recipe_item" },
      { id: "replace", labelKey: "inv.actionReplace", icon: "textures/ui/icon_import" }
    ];

    return createListMenu(admin, {
      titleKey: "inv.actionTitle",
      bodyKey: "inv.actionBody",
      bodyVars: { name: target.name, slot },
      menuGroup: "inventoryActionMenu",
      items,
      onSelect: (item) => {
        switch (item.id) {
          case "remove":
            return this.removeItem(admin, target, slot);
          case "edit":
            return this.editAmountUI(admin, target, slot);
          case "replace":
            return this.replaceItemUI(admin, target, slot);
        }
      }
    });
  }

  // =========================
  // REMOVE
  // =========================
  removeItem(admin, target, slot) {
    if (!admin?.isValid || !target?.isValid) return NavigationManager.back(admin);

    const inv = target.getComponent(INVENTORY_COMPONENT).container;
    inv.setItem(slot, undefined);

    showSuccess(admin, t("inv.removeSuccess", { slot, name: target.name }));
    // ทำรายการเสร็จ ให้ย้อนกลับ 1 ขั้น (กลับไปหน้าเลือกไอเทม)
    return NavigationManager.back(admin);
  }

  // =========================
  // EDIT AMOUNT
  // =========================
  editAmountUI(admin, target, slot) {
    if (!admin?.isValid || !target?.isValid) return NavigationManager.back(admin);

    const inv = target.getComponent(INVENTORY_COMPONENT).container;
    const item = inv.getItem(slot);

    // ป้องกันกรณีที่ไอเทมหายไประหว่างนั้น
    if (!item) return NavigationManager.back(admin);

    return createModalPrompt(admin, {
      titleKey: "inv.editTitle",
      fields: [
        {
          type: "textField",
          labelKey: "inv.editPrompt",
          placeholder: `1-${item.maxStackSize ?? 64}`,
          defaultValue: item.amount.toString()
        }
      ],
      onSubmit: ([amountStr]) => {
        const amount = parseInt(amountStr);
        const maxSize = item.maxStackSize ?? 64;
        if (isNaN(amount) || amount < 1 || amount > maxSize) {
          showError(admin, t("inv.editInvalid"));
          return NavigationManager.back(admin);
        }

        item.amount = amount;
        inv.setItem(slot, item);
        showSuccess(admin, t("inv.editSuccess"));

        return NavigationManager.back(admin);
      }
    });
  }

  // =========================
  // REPLACE ITEM
  // =========================
  replaceItemUI(admin, target, slot) {
    if (!admin?.isValid || !target?.isValid) return NavigationManager.back(admin);

    const inv = target.getComponent(INVENTORY_COMPONENT).container;

    return createModalPrompt(admin, {
      titleKey: "inv.replaceTitle",
      fields: [
        {
          type: "textField",
          labelKey: "inv.replaceIdPrompt",
          placeholder: t("inv.replaceIdPlaceholder")
        },
        {
          type: "textField",
          labelKey: "inv.replaceAmountPrompt",
          placeholder: t("inv.replaceAmountPlaceholder"),
          defaultValue: "1"
        }
      ],
      onSubmit: ([id, amountStr]) => {
        const amount = parseInt(amountStr);

        if (!id?.startsWith("minecraft:") || isNaN(amount)) {
          showError(admin, t("inv.replaceInvalid"));
          return NavigationManager.back(admin);
        }

        try {
          inv.setItem(slot, new ItemStack(id, amount));
          showSuccess(admin, t("inv.replaceSuccess"));
        } catch (e) {
          showError(admin, t("inv.replaceInvalid"));
        }

        return NavigationManager.back(admin);
      }
    });
  }

  reset(player) {
    // key ด้วย player.id ตามกฎ CONTRIBUTING.md (เดิมใช้ player.name)
    this.uiOpenMap?.delete(player.id);
  }
}

