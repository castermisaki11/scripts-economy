// =========================
// shopEffect.js
// ร้านค้าเอฟเฟกต์ (potion effect) ซื้อระยะเวลา/ระดับตามราคาที่คำนวณ
// จากราคาฐานของแต่ละเอฟเฟกต์ x สัดส่วนเวลา/ระดับ
//
// === MIGRATED to scripts/ui/ framework ===
// ไฟล์นี้ไม่สร้าง ActionFormData ตรง ๆ อีกต่อไป ทุกหน้าจอผ่าน
// UIFramework.js, การนำทางผ่าน NavigationManager.js, ทุกสตริงผ่าน t()
// ตรรกะการคำนวณราคา/การซื้อ/การให้เอฟเฟกต์ไม่ถูกแก้ไขจากเดิม
//
// หมายเหตุ (ช่วงเปลี่ยนผ่าน): mainUi.js ต้อง NavigationManager.push(...)
// ก่อนเรียก openShopMenu() เสมอแล้ว ไม่งั้นปุ่ม "กลับ"/X จะ close ทั้งหมด
// แทนที่จะกลับไปเมนูร้านค้า
// =========================

import { getMoney, removeMoney, depositToBank } from "../core/economyUtils";
import { createListMenu } from "../ui/framework/UIFramework";
import { showIconConfirm } from "../core/confirmDialog";
import { NavigationManager } from "../ui/framework/NavigationManager";
import { t } from "../ui/locale/index";
import { playBuySuccess, playError, playCancel } from "../core/soundUtils";
import { showSuccess, showError, showActionBar } from "../core/messageUtils";
import { EFFECTS } from "../data/effects";
import { SHOP_CONFIG } from "../config/shopConfig";
import { grantBuff } from "../core/buffManager";
import { TICKS_PER_SECOND } from "../core/constants";

// รายชื่อเอฟเฟกต์ + ราคาฐาน ย้ายไปอยู่ data/effects.js แล้ว (แต่ละเอฟเฟกต์มี
// ฟิลด์ singleLevel บอกในตัวเองว่ามีแค่ตัวเลือกระยะเวลา หรือมีทั้งระดับ+
// ระยะเวลา — แทนที่ SINGLE_LEVEL_EFFECTS ที่เคยเป็น array แยกไว้ต่างหาก)
// เพิ่มเอฟเฟกต์ใหม่แก้ที่ data/effects.js จุดเดียว ไม่ต้องแก้ไฟล์นี้

// ระบบเงิน ย้ายไปรวมไว้ที่ ./economyUtils แล้ว (import ด้านบน) — ใช้
// removeMoney() ที่ clamp ไม่ให้ติดลบให้แล้ว (เดิมไฟล์นี้หักเงินตรงด้วย
// changeMoney() ที่ไม่ clamp)
//
// หมายเหตุ: เดิมไฟล์นี้มีฟังก์ชัน isAdmin(player) ของตัวเอง (เช็คแท็ก
// "admin"/"Admin") แต่ไม่มีจุดไหนในไฟล์เรียกใช้เลย — เป็นโค้ดตาย ลบออกไป
// พร้อมการรวม isAdmin ไว้ที่ playerUtils.js (ดู mainUi.js / playerMarket.js /
// economy.js ที่เช็ค admin จริง ๆ)

function purchaseEffect(player, { id, label, cost, duration, amp }) {
    const bal = getMoney(player);

    if (bal < cost) {
        playError(player);
        showError(player, t("effect.insufficientFunds", { cost, balance: bal }));
        return false;
    }

    removeMoney(player, cost);
    // เงินที่เสียไปตอนซื้อเอฟเฟกต์ เข้าธนาคารกลางแค่ "ส่วนภาษี" เท่านั้น
    // (แก้บั๊กเดียวกับ shopSystem.js — เดิมเข้าธนาคารกลางเต็ม 100% ของราคา)
    depositToBank(Math.floor(cost * SHOP_CONFIG.NPC_SHOP.TAX_RATE));

    // ให้เอฟเฟกต์ผ่านระบบกลาง (core/buffManager.js) แทนการยิง runCommand
    // ตรง ๆ — จะได้ซ้อนกับเอฟเฟกต์จากแหล่งอื่น (เช่น เพิร์คอาชีพ, addon อื่น)
    // แทนที่จะทับ ค่า amp ในไฟล์นี้เป็น "level" (เริ่มที่ 1) อยู่แล้ว ตรงกับ
    // หน่วยที่ grantBuff ใช้พอดี ไม่ต้อง -1 เอง (buffManager แปลงเป็น
    // amplifier 0-based ให้เองตอนเรียก player.addEffect ภายใน) ส่วน duration
    // ของไฟล์นี้เป็นวินาที (หน่วยเดิมของ /effect) ต้องคูณ TICKS_PER_SECOND
    // ก่อนส่งเข้า grantBuff ซึ่งรับ durationTicks
    grantBuff(player, id, amp, duration * TICKS_PER_SECOND, "shopEffect");

    playBuySuccess(player);
    showSuccess(player, t("effect.purchaseSuccess", { name: label, balance: getMoney(player) }));
    showActionBar(player, t("effect.purchaseActionBar", { name: label, cost }), "effectShop");
    return true;
}

export const openShopMenu = safeAsync(async (player) => {
    if (!player?.isValid) return;

    const items = EFFECTS.map(e => ({
        id: e.id,
        labelKey: "effect.buttonLabel",
        labelVars: { name: t(e.labelKey), cost: e.cost },
        icon: `textures/ui/${e.id}_effect.png`
    }));

    return createListMenu(player, {
        titleKey: "effect.shopTitle",
        bodyKey: "effect.shopBody",
        bodyVars: { balance: getMoney(player) },
        menuGroup: "effectMenu",
        items,
        onSelect: (item) => {
            const cfg = EFFECTS.find(e => e.id === item.id);
            NavigationManager.push(player, () => openShopMenu(player));
            return openPresetMenu(player, cfg);
        }
    });
});

export const openPresetMenu = safeAsync(async (player, cfg) => {
    if (!player?.isValid) return;

    const { BASE_UNIT_SECONDS, SINGLE_LEVEL_DURATIONS, LEVELED_AMPS, LEVELED_DURATIONS } = SHOP_CONFIG.EFFECT_SHOP;
    const combos = [];
    const effectName = t(cfg.labelKey);

    if (cfg.singleLevel) {

        SINGLE_LEVEL_DURATIONS.forEach(dur => {
            const cost = Math.floor(cfg.cost * (dur / BASE_UNIT_SECONDS));
            combos.push({
                amp: 1,
                duration: dur,
                cost,
                labelKey: "effect.presetSingleLabel",
                labelVars: { name: effectName, duration: dur, cost }
            });
        });

    } else {

        LEVELED_AMPS.forEach(a => {
            LEVELED_DURATIONS.forEach(dur => {
                const cost = Math.floor(cfg.cost * a * (dur / BASE_UNIT_SECONDS));
                combos.push({
                    amp: a,
                    duration: dur,
                    cost,
                    labelKey: "effect.presetLeveledLabel",
                    labelVars: { name: effectName, level: roman(a), duration: dur, cost }
                });
            });
        });
    }

    const items = combos.map((c, idx) => ({
        id: idx,
        labelKey: c.labelKey,
        labelVars: c.labelVars,
        // ใช้ไอคอนของเอฟเฟกต์นั้นเอง (ตัวเดียวกับที่โชว์ในหน้ารายการเอฟเฟกต์)
        // กำกับทุก preset ระยะเวลา/ระดับของเอฟเฟกต์นี้
        icon: `textures/ui/${cfg.id}_effect.png`
    }));

    return createListMenu(player, {
        titleKey: "effect.presetTitle",
        titleVars: { name: effectName },
        bodyKey: "ui.balanceLabel",
        bodyVars: { balance: getMoney(player) },
        items,
        // ไม่ระบุ onCancel — ปุ่ม "กลับ"/X ใช้ NavigationManager.back(player)
        // ค่าเริ่มต้นของ createListMenu ซึ่งจะไปเรียก openShopMenu ที่ถูก
        // push ไว้ก่อนเข้าหน้านี้ (เหมือนพฤติกรรมเดิมที่ปุ่ม "ย้อนกลับ"
        // เรียก openShopMenu(player) ตรง ๆ)
        onSelect: (item) => {
            const pick = combos[item.id];

            // เข้าหน้ายืนยัน (อีกหนึ่ง "หน้าจอ") — push หน้าเลือกรูปแบบไว้ก่อนเสมอ
            // เหมือนรูปแบบเดียวกับ shopSystem.js
            NavigationManager.push(player, () => openPresetMenu(player, cfg));
            return openEffectConfirm(player, cfg, pick);
        }
    });
});

// =========================
// ยืนยันการซื้อเอฟเฟกต์
// =========================
export const openEffectConfirm = safeAsync(async (player, cfg, pick) => {
    const effectName = t(cfg.labelKey);
    const fullLabel = t(pick.labelKey, pick.labelVars);

    return showIconConfirm({
        player,
        titleKey: "effect.confirmTitle",
        bodyKey: "effect.confirmBody",
        bodyVars: { name: effectName, duration: pick.duration, cost: pick.cost },
        confirmIcon: `textures/ui/${cfg.id}_effect.png`,
        onCancel: () => {
            playCancel(player);
            return NavigationManager.back(player);
        },
        onConfirm: () => {
            const success = purchaseEffect(player, {
                id: cfg.id,
                label: fullLabel,
                amp: pick.amp,
                duration: pick.duration,
                cost: pick.cost
            });

            if (success) {
                // ทำรายการเสร็จสมบูรณ์ — เคลียร์สแตกที่ push ไว้ (openShopMenu + openPresetMenu)
                // กันไม่ให้หลงเหลือข้ามไปปนกับเมนูอื่นในเซสชันถัดไปของผู้เล่นคนนี้
                return NavigationManager.close(player);
            }

            // เงินไม่พอ — กลับไปหน้าเลือกรูปแบบเดิมให้ลองใหม่/เลือกอื่นได้ทันที
            // (purchaseEffect เล่นเสียง failure และแจ้งข้อความไปแล้ว)
            return NavigationManager.back(player);
        }
    });
});

function roman(n) {
    const map = {
        M: 1000, CM: 900,
        D: 500, CD: 400,
        C: 100, XC: 90,
        L: 50, XL: 40,
        X: 10, IX: 9,
        V: 5, IV: 4,
        I: 1
    };

    let s = "";

    for (const k in map) {
        while (n >= map[k]) {
            s += k;
            n -= map[k];
        }
    }

    return s;
}
