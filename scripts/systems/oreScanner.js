// =========================
// systems/oreScanner.js
// ระบบสแกนแร่ (Admin): สแกนก้อนบล็อกรอบตัวผู้เล่นในระยะที่ตั้งไว้ (ทรงลูกบาศก์
// รอบจุดยืน ไม่ใช่ทรงกลม) ทุก ORE_SCANNER_CONFIG.SCAN_INTERVAL_TICKS แล้วสรุป
// ผลที่พบ (จำนวนต่อชนิด + แร่ที่ใกล้ที่สุด/พิกัด XYZ/ระยะห่าง) ขึ้น action bar —
// เมนูตั้งค่า (showSettingsForm) ควบคุมได้ 3 อย่างในฟอร์มเดียว:
//   1) เปิด/ปิดระบบ (ต่อผู้เล่น)
//   2) ระยะสแกน (บล็อก) — ดูค่าเริ่มต้น/ขั้นต่ำ-สูงสุดที่ config/oreScannerConfig.js
//   3) เลือกหมวดแร่ที่จะสแกน (ทีละหมวด ดู ORE_SCANNER_CONFIG.ORE_CATEGORIES)
//
// แพทเทิร์นเดียวกับ systems/autoCollect.js: state เก็บเป็น Map ต่อ playerId,
// ล้างเฉพาะสถานะเปิด/ปิดตอนออกจากเกม (คงค่าระยะ/หมวดแร่ที่เคยตั้งไว้ไว้ให้
// เหมือนของที่บันทึกไว้ถาวร ไม่ต้องตั้งใหม่ทุกครั้ง)
//
// ไม่ใช่ระบบผูกกับ ADMIN_TAG โดยตรง — เมนูที่เรียกเข้ามา (adminUi.js) เป็น
// เมนู admin-only อยู่แล้วจาก mainUi.js (MAIN_MENU_ITEMS.admin.adminOnly)
// ระบบนี้จึงไม่ต้องเช็คสิทธิ์ซ้ำเอง เหมือนโมดูลอื่นใต้เมนู admin
// (gamemode/gamerule/command ฯลฯ)
// =========================

import { system, world } from "@minecraft/server";
import { createModalPrompt } from "../ui/framework/UIFramework";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { t } from "../ui/locale/index";
import { showSuccess, showError, showActionBar } from "../core/messageUtils";
import { ORE_SCANNER_CONFIG } from "../config/oreScannerConfig";
import { subscribeSafe } from "../core/eventGuard";

export class OreScanner {
  constructor() {
    this.enabledMap = new Map();   // playerId -> boolean (เปิด/ปิดระบบ)
    this.radiusMap = new Map();    // playerId -> number (ระยะสแกน เป็นบล็อก)
    this.selectedOresMap = new Map(); // playerId -> Set(oreCategoryId)
  }

  // -------------------------
  // INIT
  // -------------------------
  initialize() {
    this.registerEvents();
    this.startScanInterval();
  }

  registerEvents() {
    subscribeSafe(["playerLeave"], (e) => {
      try { this.onPlayerLeave(e); } catch (error) { console.warn("[OreScanner] playerLeave handler error:", error); }
    });
  }

  // ล้างแค่สถานะเปิด/ปิด ตอนออกจากเกม (เหมือน xyzToggleMap ใน autoCollect.js)
  // — ระยะ/หมวดแร่ที่เคยตั้งไว้ยังอยู่ตอนกลับมาเข้าเกมใหม่ ไม่ต้องตั้งซ้ำ
  onPlayerLeave({ playerId }) {
    this.enabledMap.delete(playerId);
  }

  // -------------------------
  // STATE HELPERS
  // -------------------------
  getRadius(playerId) {
    return this.radiusMap.get(playerId) ?? ORE_SCANNER_CONFIG.DEFAULT_RADIUS;
  }

  // ยังไม่เคยตั้งค่าเลย -> เปิดทุกหมวดเป็นค่าเริ่มต้น
  getSelectedOreIds(playerId) {
    return (
      this.selectedOresMap.get(playerId) ??
      new Set(ORE_SCANNER_CONFIG.ORE_CATEGORIES.map((c) => c.id))
    );
  }

  // -------------------------
  // UI — ฟอร์มตั้งค่า (เปิด/ปิด + ระยะ + เลือกหมวดแร่ ในฟอร์มเดียว)
  // -------------------------
  async showSettingsForm(player) {
    if (!player?.isValid) return;

    const enabled = this.enabledMap.get(player.id) ?? ORE_SCANNER_CONFIG.DEFAULT_ENABLED;
    const radius = this.getRadius(player.id);
    const selected = this.getSelectedOreIds(player.id);

    const fields = [
      { type: "toggle", labelKey: "oreScanner.toggleEnabled", defaultValue: enabled },
      {
        type: "slider",
        labelKey: "oreScanner.radiusLabel",
        min: ORE_SCANNER_CONFIG.MIN_RADIUS,
        max: ORE_SCANNER_CONFIG.MAX_RADIUS,
        step: 1,
        defaultValue: radius
      },
      // หนึ่ง toggle ต่อหนึ่งหมวดแร่ — ลำดับต้องตรงกับ ORE_CATEGORIES เสมอ
      // เพราะ onSubmit อ่านค่ากลับมาตามตำแหน่ง index
      ...ORE_SCANNER_CONFIG.ORE_CATEGORIES.map((cat) => ({
        type: "toggle",
        labelKey: cat.nameKey,
        defaultValue: selected.has(cat.id)
      }))
    ];

    return createModalPrompt(player, {
      titleKey: "oreScanner.title",
      fields,
      onCancel: () => NavigationManager.close(player),
      onSubmit: ([enabledOn, radiusVal, ...oreToggles]) => {
        const newSelected = new Set();
        ORE_SCANNER_CONFIG.ORE_CATEGORIES.forEach((cat, i) => {
          if (oreToggles[i]) newSelected.add(cat.id);
        });

        this.radiusMap.set(player.id, radiusVal);
        this.selectedOresMap.set(player.id, newSelected);

        // เปิดระบบไว้แต่ไม่เลือกหมวดแร่เลยสักหมวด -> ไม่มีอะไรให้สแกน
        // บังคับปิดกลับให้เหมือน xyz ใน autoCollect.js (เปิดไม่ได้ถ้ายัง
        // ไม่มีพิกัดที่ใช้ได้)
        if (enabledOn && newSelected.size === 0) {
          this.enabledMap.set(player.id, false);
          showError(player, t("oreScanner.noOreSelected"));
          return NavigationManager.back(player);
        }

        this.enabledMap.set(player.id, enabledOn);

        showSuccess(player, t("oreScanner.updateSuccess"));
        return NavigationManager.back(player);
      }
    });
  }

  // -------------------------
  // SCAN LOOP
  // -------------------------
  startScanInterval() {
    system.runInterval(() => {
      for (const player of world.getPlayers()) {
        if (!this.enabledMap.get(player.id)) continue;
        this.scanForPlayer(player);
      }
    }, ORE_SCANNER_CONFIG.SCAN_INTERVAL_TICKS);
  }

  scanForPlayer(player) {
    if (!player?.isValid) return;

    const radius = this.getRadius(player.id);
    const selectedIds = this.getSelectedOreIds(player.id);
    if (selectedIds.size === 0) return;

    // typeId ของบล็อก -> หมวดแร่ (เฉพาะหมวดที่เปิดอยู่) — สร้างใหม่ทุกครั้ง
    // ที่สแกนเพราะ radius/selection ปรับได้ต่อผู้เล่น ค่าใช้จ่ายเล็กน้อยเทียบ
    // กับจำนวนบล็อกที่ต้องเช็คอยู่แล้ว (สูงสุด (2*8+1)^3 ~ 4,913 บล็อก)
    const blockToCategory = new Map();
    for (const cat of ORE_SCANNER_CONFIG.ORE_CATEGORIES) {
      if (!selectedIds.has(cat.id)) continue;
      for (const blockId of cat.blocks) blockToCategory.set(blockId, cat);
    }

    const dimension = player.dimension;
    const originX = Math.floor(player.location.x);
    const originY = Math.floor(player.location.y);
    const originZ = Math.floor(player.location.z);

    const counts = new Map(); // categoryId -> จำนวนที่เจอ
    let nearest = null;       // { cat, dist, x, y, z } (x/y/z = พิกัดโลกจริงของบล็อกที่เจอ)

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          let block;
          try {
            block = dimension.getBlock({ x: originX + dx, y: originY + dy, z: originZ + dz });
          } catch {
            continue; // นอกโลก/ชังค์ยังไม่โหลด
          }
          if (!block) continue;

          const cat = blockToCategory.get(block.typeId);
          if (!cat) continue;

          counts.set(cat.id, (counts.get(cat.id) ?? 0) + 1);

          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (!nearest || dist < nearest.dist) {
            nearest = { cat, dist, x: originX + dx, y: originY + dy, z: originZ + dz };
          }
        }
      }
    }

    if (!nearest) {
      showActionBar(player, t("oreScanner.noneFound", { radius }), "oreScanner");
      return;
    }

    const summary = [...counts.entries()]
      .map(([catId, count]) => {
        const cat = ORE_SCANNER_CONFIG.ORE_CATEGORIES.find((c) => c.id === catId);
        return t("oreScanner.summaryItem", { name: t(cat.nameKey), count });
      })
      .join(t("oreScanner.summarySeparator"));

    showActionBar(player, t("oreScanner.actionBar", {
      radius,
      summary,
      nearestName: t(nearest.cat.nameKey),
      distance: Math.round(nearest.dist * 10) / 10,
      x: nearest.x,
      y: nearest.y,
      z: nearest.z
    }), "oreScanner");
  }
}

// -------------------------
// หมายเหตุ: ไม่สร้าง/initialize instance ที่นี่ — mainUi.js เป็นคนสร้าง
// instance เดียว (this.oreScanner) และเรียก initialize() ให้อยู่แล้ว
// เหมือนแพทเทิร์นของ AutoCollector (สร้างซ้ำที่นี่จะทำให้
// system.runInterval() ทำงานซ้ำสองชุด)
// -------------------------
