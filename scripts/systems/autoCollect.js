// =========================
// autoCollect.js
// ระบบเก็บของอัตโนมัติ: เก็บไอเทมจากมอบดรอป, ดูด XP, ดูดไอเทมรอบตัว,
// ส่งของที่เก็บได้ไปพิกัดที่ตั้งไว้ (แทนกระเป๋าผู้เล่น)
// แต่ละอย่างหักเงิน/วิ ต่อเนื่องขณะเปิดใช้งาน
//
// === MIGRATED to scripts/ui/ framework ===
// หน้าตั้งค่า (showToggleForm) ไม่สร้าง ModalFormData ตรง ๆ อีกต่อไป
// ใช้ createModalPrompt ของ UIFramework.js แทน (เดิมใช้ createTogglesPrompt
// แต่เปลี่ยนมาใช้ createModalPrompt เพื่อผสม textField พิกัด x/y/z เข้ากับ
// toggle เดิมในฟอร์มเดียวกัน) ทุกสตริงที่ผู้เล่นเห็น (ทั้งฟอร์มและ
// actionbar/sendMessage ของระบบหักเงิน) ผ่าน t() แล้ว — ตรรกะเก็บของ/ดูด
// XP/หักเงินต่อวินาทีเดิม (item/xp/vacuum) ไม่ถูกแก้ไข มีแค่เพิ่มโหมด
// "ส่งไปพิกัด" (xyz) เข้าไปตามแพทเทิร์นเดียวกัน
//
// ฟีเจอร์ "ส่งไปพิกัด" (xyz):
// - ช่องกรอกพิกัด X/Y/Z ในฟอร์มเดียวกัน คือ "ปุ่มที่ 1" ที่ผู้เล่นใช้ตั้ง/
//   แก้พิกัดปลายทาง (บันทึกลง xyzCoordMap ก็ต่อเมื่อกรอกครบและเป็นตัวเลข
//   จริงเท่านั้น) ค่าที่เคยบันทึกไว้จะถูกเติมเป็นค่าเริ่มต้นให้เอง ไม่ต้อง
//   พิมพ์ใหม่ทุกครั้ง
// - toggle "ส่งของไปพิกัดที่ตั้งไว้" คือ "ปุ่มที่ 2" (xyz เริ่มต้น) เปิด/ปิด
//   ระบบส่งของไปพิกัดอัตโนมัติต่อเนื่อง (ทุกครั้งที่เก็บของได้จาก
//   collectItemsAround ไม่ว่าจะมาจาก kill-drop หรือ item vacuum) เปิดไม่ได้
//   ถ้ายังไม่เคยมีพิกัดที่ใช้ได้ (ฟอร์มจะบังคับปิดกลับให้พร้อมแจ้งเตือน)
// - หักเงิน/วิ แยกตัวเองผ่าน ECONOMY_CONFIG.AUTO_COLLECT.XYZ_SEND_COST_PER_SECOND
//   ตามแพทเทิร์นเดียวกับโหมดอื่น รวมถึงถูกปิดอัตโนมัติถ้าเงินไม่พอเหมือนกัน
//
// เพิ่มเติม: ค่าใช้จ่าย/วิ ตอนนี้ปรับตาม tag ของผู้เล่นได้ (ลด/เพิ่มราคา)
// ผ่าน ECONOMY_CONFIG.AUTO_COLLECT.TAG_PRICE_MODIFIERS + getTagPriceMultiplier()
// ใน economyUtils.js — เพิ่ม/แก้ tag ใหม่แค่แก้ config array ที่เดียว ไม่ต้อง
// แตะไฟล์นี้ (ดูหมายเหตุใน economyConfig.js) ถ้าส่วนลดหักจนราคาเหลือ 0 หรือ
// ต่ำกว่า จะเปิดใช้งานฟรีโดยไม่หักเงินเลย ไม่ใช่ error
//
// หมายเหตุเรื่อง NavigationManager: หน้านี้เป็นฟอร์มโมดัลเดียวจบ (ไม่มี
// หน้าย่อยให้เดินต่อ) แต่ mainUi.js push เมนูหลักไว้ก่อนเรียกเข้ามาเสมอแล้ว
// (เหมือนโมดูลอื่นที่ migrate) — กด "บันทึก" สำเร็จ (หรือ validation error
// จาก submit) จะ NavigationManager.back(player) กลับไปเมนูหลักให้เอง ส่วน
// กด X ยกเลิกฟอร์ม (onCancel) ตั้งใจ NavigationManager.close(player) ตรง ๆ
// แทนที่จะปล่อยให้ตกไปที่ back() ปกติ (ซึ่งตอนนี้จะเจอเมนูหลักที่ push ไว้
// แล้วเปิดเมนูหลักขึ้นมาแทน) — เพื่อให้ยกเลิกฟอร์มนี้ = ปิดเมนูทั้งหมดทันที
// เหมือนพฤติกรรมเดิมก่อน migrate ทุกประการ
// =========================

import { system, world } from "@minecraft/server";
import { createModalPrompt } from "../ui/framework/UIFramework";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { t } from "../ui/locale/index";
import { getMoney, changeMoney, getTagPriceMultiplier, depositToBank } from "../core/economyUtils";
import { showSuccess, showError, showActionBar } from "../core/messageUtils";
import { getInventoryContainer } from "../core/itemUtils";
import { ECONOMY_CONFIG } from "../config/economyConfig";
import { subscribeSafe } from "../core/eventGuard";

// =========================
// AUTO COLLECTOR
// =========================
export class AutoCollector {
  constructor() {
    this.lastHitMap = new Map();

    this.itemToggleMap = new Map();        // เก็บไอเทมจากดรอป
    this.xpToggleMap = new Map();          // ดูด XP
    this.itemVacuumToggleMap = new Map();  // ดูดไอเทมทุก 1 วิ

    // === ส่งของไปพิกัด (xyz) ===
    this.xyzToggleMap = new Map();  // playerId -> boolean (เปิด/ปิดระบบส่งไปพิกัด)
    this.xyzCoordMap = new Map();   // playerId -> { x, y, z } พิกัดปลายทางล่าสุดที่บันทึกไว้
  }

  // -------------------------
  // INIT
  // -------------------------
  initialize() {
    this.registerEvents();
    this.startXPInterval();
    this.startItemVacuumInterval();
    this.startMoneyDrainInterval();
  }

  // -------------------------
  // UI
  // -------------------------
  async showToggleForm(player) {
    if (!player?.isValid) return;

    // พิกัดที่เคยบันทึกไว้ (ถ้ามี) ใช้เติมค่าเริ่มต้นในช่องกรอก เพื่อไม่ต้อง
    // พิมพ์ใหม่ทุกครั้งที่เปิดฟอร์ม — แค่แก้ค่าหรือกดปุ่มเปิด/ปิดแล้ว submit
    const coord = this.xyzCoordMap.get(player.id);

    return createModalPrompt(player, {
      titleKey: "autoCollect.title",
      fields: [
        { type: "toggle", labelKey: "autoCollect.toggleItems", defaultValue: this.itemToggleMap.get(player.id) ?? false },
        { type: "toggle", labelKey: "autoCollect.toggleXp", defaultValue: this.xpToggleMap.get(player.id) ?? false },
        { type: "toggle", labelKey: "autoCollect.toggleVacuum", defaultValue: this.itemVacuumToggleMap.get(player.id) ?? false },
        // ปุ่มที่ 2: เปิด/ปิดระบบส่งของไปพิกัด (ทำงานทุกครั้งที่เก็บของได้
        // ขณะเปิดอยู่ ไม่ใช่ครั้งเดียวจบ)
        { type: "toggle", labelKey: "autoCollect.toggleXyz", defaultValue: this.xyzToggleMap.get(player.id) ?? false },
        // ปุ่มที่ 1: ช่องกรอกพิกัดปลายทาง (x/y/z) — บันทึกค่าไว้ใช้ตอนส่งของ
        { type: "textField", labelKey: "autoCollect.xyzFieldX", placeholder: "0", defaultValue: coord ? String(coord.x) : "" },
        { type: "textField", labelKey: "autoCollect.xyzFieldY", placeholder: "0", defaultValue: coord ? String(coord.y) : "" },
        { type: "textField", labelKey: "autoCollect.xyzFieldZ", placeholder: "0", defaultValue: coord ? String(coord.z) : "" }
      ],
      onCancel: () => NavigationManager.close(player),
      onSubmit: ([item, xp, vacuum, xyzOn, xStr, yStr, zStr]) => {
        this.itemToggleMap.set(player.id, item);
        this.xpToggleMap.set(player.id, xp);
        this.itemVacuumToggleMap.set(player.id, vacuum);

        // พิกัดใช้ได้ก็ต่อเมื่อกรอกครบทั้งสามช่องและเป็นตัวเลขจริง ๆ เท่านั้น
        const x = parseFloat(xStr);
        const y = parseFloat(yStr);
        const z = parseFloat(zStr);
        const hasValidCoord =
          xStr.trim() !== "" && yStr.trim() !== "" && zStr.trim() !== "" &&
          Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);

        if (hasValidCoord) {
          this.xyzCoordMap.set(player.id, { x, y, z });
        }

        if (xyzOn && !this.xyzCoordMap.has(player.id)) {
          // เปิดระบบไว้แต่ยังไม่เคยมีพิกัดที่ใช้ได้เลย -> บังคับปิดไว้ก่อน
          this.xyzToggleMap.set(player.id, false);
          showError(player, t("autoCollect.xyzInvalidCoord"));
          return NavigationManager.back(player);
        }

        this.xyzToggleMap.set(player.id, xyzOn);

        showSuccess(player, t("autoCollect.updateSuccess"));
        return NavigationManager.back(player);
      }
    });
  }

  // -------------------------
  // EVENTS
  // -------------------------
  registerEvents() {
    subscribeSafe(["entityHurt"], e => {
      try { this.onEntityHurt(e); } catch (error) { console.warn("[AutoCollect] entityHurt handler error:", error); }
    });
    subscribeSafe(["entityDie"], e => {
      try { this.onEntityDeath(e); } catch (error) { console.warn("[AutoCollect] entityDie handler error:", error); }
    });
    subscribeSafe(["playerLeave"], e => {
      try { this.onPlayerLeave(e); } catch (error) { console.warn("[AutoCollect] playerLeave handler error:", error); }
    });
  }

  // ล้างสถานะต่อผู้เล่นตอนออกจากเซิร์ฟเวอร์ — ไม่ใช่ memory leak ร้ายแรง
  // เพราะขนาดถูกจำกัดด้วยจำนวนผู้เล่นอยู่แล้ว แต่เป็น practice ที่ดีไม่ให้
  // ค้าง Map ไว้เกินเวลาที่ผู้เล่นยังอยู่จริง (เหมือนแนวทาง cleanup ที่ใช้
  // ในไฟล์อื่นของแอดออน)
  //
  // หมายเหตุเรื่อง lastHitMap: คีย์คือ id ของ "ผู้ถูกตี" (hurtEntity) ไม่ใช่
  // ผู้เล่นที่ตี ดังนั้นการลบด้วย playerId ที่นี่จะเคลียร์ได้เฉพาะกรณีที่
  // ผู้เล่นที่ออกไปเป็นฝั่งถูกตีเอง (ตัว entity id ตรงกับ player.id) —
  // ส่วนกรณีที่ผู้เล่นคนนั้นเป็นฝั่งตีคนอื่นไว้ (ถูกเก็บเป็น value ของคีย์อื่น)
  // จะยังถูกเคลียร์เองอยู่แล้วภายใน 300 tick จาก system.runTimeout ใน
  // onEntityHurt() ด้านบน
  onPlayerLeave({ playerId }) {
    this.itemToggleMap.delete(playerId);
    this.xpToggleMap.delete(playerId);
    this.itemVacuumToggleMap.delete(playerId);
    this.lastHitMap.delete(playerId);
    // หมายเหตุ: ไม่ลบ xyzCoordMap ตอนออกจากเซิร์ฟเวอร์ ตั้งใจให้พิกัดที่
    // เคยตั้งไว้ยังอยู่ตอนกลับมาเข้าเซิร์ฟเวอร์ใหม่ (เหมือนของที่บันทึกไว้
    // ถาวร) — ลบแค่สถานะเปิด/ปิดเพื่อไม่ให้ระบบส่งของทำงานเงียบ ๆ ระหว่าง
    // ที่ผู้เล่นออกจากเกมไปแล้ว
    this.xyzToggleMap.delete(playerId);
  }

  onEntityHurt({ damageSource, hurtEntity }) {
    const attacker = damageSource?.damagingEntity;
    if (attacker?.typeId === "minecraft:player" && hurtEntity?.isValid) {
      this.lastHitMap.set(hurtEntity.id, attacker);
      system.runTimeout(() => this.lastHitMap.delete(hurtEntity.id), 300);
    }
  }

  onEntityDeath({ deadEntity }) {
    const player = this.lastHitMap.get(deadEntity.id);
    if (!player?.isValid) return;

    if (!this.itemToggleMap.get(player.id)) return;

    this.collectItemsAround(deadEntity.location, player);
    this.lastHitMap.delete(deadEntity.id);
  }

  // -------------------------
  // ITEM COLLECT (KILL DROP)
  // -------------------------
  collectItemsAround(location, player) {
    const dimension = player.dimension;
    const inventory = getInventoryContainer(player);
    if (!inventory) return;

    // ถ้าเปิดระบบ "ส่งไปพิกัด" และมีพิกัดที่ใช้ได้อยู่ -> ของที่เก็บได้ทุก
    // ชิ้นจากรอบนี้ (ไม่ว่าจะมาจาก kill-drop หรือ item vacuum) จะถูกส่งไป
    // โผล่ที่พิกัดปลายทางแทนที่จะเข้ากระเป๋าผู้เล่น — ใช้มิติปัจจุบันของ
    // ผู้เล่นเป็นมิติปลายทางเสมอ (พิกัดที่ตั้งไว้ตีความในมิติที่ผู้เล่นอยู่
    // ตอนเก็บของ ไม่ใช่มิติตอนตั้งค่า)
    const sendToXyz = (this.xyzToggleMap.get(player.id) ?? false) && this.xyzCoordMap.has(player.id);
    const targetLocation = sendToXyz ? this.xyzCoordMap.get(player.id) : null;

    const items = dimension.getEntities({
      location,
      type: "minecraft:item",
      maxDistance: 8,
    });

    for (const entity of items) {
      const stack = entity.getComponent("minecraft:item")?.itemStack;
      if (!stack || !entity.isValid) continue;

      if (sendToXyz) {
        dimension.spawnItem(stack, targetLocation);
        entity.remove();
        continue;
      }

      let hasSpace = false;
      for (let i = 0; i < inventory.size; i++) {
        const slot = inventory.getItem(i);
        if (!slot || (slot.typeId === stack.typeId && slot.amount < slot.maxAmount)) {
          hasSpace = true;
          break;
        }
      }

      if (hasSpace) {
        dimension.spawnItem(stack, player.location);
        entity.remove();
      }
    }
  }

  // -------------------------
  // XP VACUUM
  // -------------------------
  startXPInterval() {
    system.runInterval(() => {
      for (const player of world.getPlayers()) {
        if (!this.xpToggleMap.get(player.id)) continue;

        const orbs = player.dimension.getEntities({
          location: player.location,
          type: "minecraft:xp_orb",
          maxDistance: 8,
        });

        for (const orb of orbs) {
          if (!orb.isValid) continue;
          const loc = orb.location;
          const dx = player.location.x - loc.x;
          const dy = player.location.y - loc.y;
          const dz = player.location.z - loc.z;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (len < 0.1) continue;
          const force = 1.5 / len;
          orb.applyImpulse({ x: dx * force, y: dy * force + 0.1, z: dz * force });
        }
      }
    }, 5);
  }

  // -------------------------
  // ITEM VACUUM (EVERY 1 SEC)
  // -------------------------
  startItemVacuumInterval() {
    system.runInterval(() => {
      for (const player of world.getPlayers()) {
        if (!this.itemVacuumToggleMap.get(player.id)) continue;
        this.collectItemsAround(player.location, player);
      }
    }, 20);
  }

  // -------------------------
  // MONEY + ACTIONBAR
  // -------------------------
  startMoneyDrainInterval() {
    system.runInterval(() => {
      for (const player of world.getPlayers()) {
        const item   = this.itemToggleMap.get(player.id) ?? false;
        const xp     = this.xpToggleMap.get(player.id) ?? false;
        const vacuum = this.itemVacuumToggleMap.get(player.id) ?? false;
        const xyz    = (this.xyzToggleMap.get(player.id) ?? false) && this.xyzCoordMap.has(player.id);

        // ค่าใช้จ่ายต่อวินาทีของแต่ละโหมด ย้ายไปอยู่ config/economyConfig.js
        // (ECONOMY_CONFIG.AUTO_COLLECT) แล้ว — แก้ค่าที่นั่นจุดเดียว
        let cost = 0;
        if (item) cost += ECONOMY_CONFIG.AUTO_COLLECT.ITEM_COST_PER_SECOND;
        if (xp) cost += ECONOMY_CONFIG.AUTO_COLLECT.XP_COST_PER_SECOND;
        if (vacuum) cost += ECONOMY_CONFIG.AUTO_COLLECT.VACUUM_COST_PER_SECOND;
        if (xyz) cost += ECONOMY_CONFIG.AUTO_COLLECT.XYZ_SEND_COST_PER_SECOND;

        if (cost === 0) continue; // ไม่มีโหมดไหนเปิดอยู่เลย ข้ามผู้เล่นคนนี้

        // ปรับราคาตาม tag ของผู้เล่น (ลด/เพิ่มราคาตาม
        // ECONOMY_CONFIG.AUTO_COLLECT.TAG_PRICE_MODIFIERS — แก้/เพิ่ม tag ได้
        // ที่ config จุดเดียว ไม่ต้องแก้ตรงนี้) ปัดเป็นจำนวนเต็มเพราะ
        // getMoney()/changeMoney() ทำงานกับจำนวนเต็มเท่านั้น
        cost = Math.round(cost * getTagPriceMultiplier(player, ECONOMY_CONFIG.AUTO_COLLECT.TAG_PRICE_MODIFIERS));

        const money = getMoney(player);

        if (cost <= 0 || money >= cost) {
          // changeMoney() คืนยอดใหม่หลังหักมาให้เลย (delta = -cost) — ไม่ต้อง
          // คำนวณ left เองแล้วเขียน dynamic property ตรง ๆ เหมือนเดิม
          // (cost <= 0 = ส่วนลดจาก tag หักจนเหลือฟรีพอดี ไม่ต้องหักเงินเลย)
          const left = cost > 0 ? changeMoney(player, -cost) : money;
          // ค่าดูดไอเทม/exp อัตโนมัติที่หักทุกวินาที เข้าธนาคารกลางเหมือนกัน
          if (cost > 0) depositToBank(cost);

          showActionBar(player, t("autoCollect.drainActionBar", { cost, left }), "autoCollect");
        } else {
          this.itemToggleMap.set(player.id, false);
          this.xpToggleMap.set(player.id, false);
          this.itemVacuumToggleMap.set(player.id, false);
          this.xyzToggleMap.set(player.id, false);

          showActionBar(player, t("autoCollect.disabledActionBar"), "autoCollect");
          showError(player, t("autoCollect.disabledMessage"));
        }
      }
    }, 20);
  }
}

// -------------------------
// หมายเหตุ: ไม่สร้าง/initialize instance ที่นี่แล้ว
// เพราะ mainUi.js เป็นคนสร้าง instance เดียว (this.autoCollector)
// และเรียก initialize() ให้อยู่แล้ว — ถ้าสร้างซ้ำที่นี่จะทำให้
// event listener และ system.runInterval() ทำงานซ้ำสองชุด
// -------------------------
