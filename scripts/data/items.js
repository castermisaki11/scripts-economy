// =========================
// data/items.js
// ฐานข้อมูลไอเทมกลาง (Single Source of Truth) — แทนที่ core/ItemDatabase.js เดิม
//
// นี่คือที่เดียวที่เก็บข้อมูลไอเทมทั้งหมดในแอดออน (ราคา, ไอคอน, หมวดหมู่,
// เปิด/ปิดการใช้งาน) ห้ามสร้างตารางไอเทมซ้ำในไฟล์อื่นเด็ดขาด — ทุกระบบ
// (Shop, Sell, Search, Player Market, Effect Shop, Rewards ฯลฯ) ต้องดึง
// ข้อมูลผ่านฟังก์ชันในไฟล์นี้เท่านั้น
//
// เพิ่มไอเทมใหม่ = เพิ่ม 1 รายการใน RAW_ITEMS ด้านล่างเท่านั้น ไม่ต้องแก้
// systems/shopSystem.js, ui/framework/SearchService.js หรือไฟล์อื่นใด —
// ไอเทมใหม่จะปรากฏใน Shop/Sell/Search อัตโนมัติทันทีที่ enabled: true
//
// กติกาเรื่องราคา:
//   - กำหนดแค่ "sellPrice" ก็พอ — "buyPrice" คำนวณอัตโนมัติจาก
//     ECONOMY_CONFIG.BUY_PRICE_MULTIPLIER (ดู config/economyConfig.js)
//   - ถ้าไอเทมไหนต้องการราคาซื้อที่ไม่ตรงสูตร ให้กำหนด buyPrice เองในไอเทม
//     นั้นได้ตรง ๆ (จะไม่ถูกคำนวณทับ)
//
// กติกาเรื่องชื่อแสดงผล:
//   - ถ้ากำหนด nameKey และมี locale key นั้นจริง -> ใช้ชื่อที่แปลแล้ว
//   - ถ้าไม่กำหนด หรือ locale key ยังไม่มี -> ใช้ชื่ออัตโนมัติจาก itemId
//     (เช่น "minecraft:iron_ingot" -> "Iron Ingot") เหมือนพฤติกรรมเดิมทุก
//     ประการ — ทำให้เพิ่มไอเทมใหม่ได้ทันทีโดยไม่ต้องรอเพิ่ม locale ก่อน
//
// enabled: false = ไอเทมจะถูกซ่อนจาก Shop / Sell / Search / ระบบอื่นที่
// เกี่ยวข้องทั้งหมดโดยอัตโนมัติ (ดู getItemsByCategory) โดยไม่ต้องลบข้อมูล
// ไอเทมทิ้ง (ยังคง getItemData()/getSellPrice() ได้ตามปกติถ้าจำเป็น)
// =========================

import { t } from "../ui/locale/index";
import { ECONOMY_CONFIG } from "../config/economyConfig";

/**
 * ข้อมูลดิบของไอเทมแต่ละชิ้น — คีย์คือ typeId ของ Minecraft
 * ฟิลด์:
 *   nameKey?:   string  locale key ของชื่อ (ไม่บังคับ)
 *   icon:       string  พาธไอคอนที่ใช้แสดงในเมนู (บังคับ)
 *   sellPrice:  number  ราคาขาย ต่อชิ้น (บังคับ)
 *   buyPrice?:  number  ราคาซื้อ ต่อชิ้น (ไม่บังคับ — ไม่กำหนด = คำนวณอัตโนมัติ)
 *   category:   string  หมวดหมู่ — ต้องตรงกับ id ใน data/shops.js (บังคับ)
 *   enabled?:   boolean เปิด/ปิดการขาย/ซื้อไอเทมนี้ (ไม่กำหนด = true)
 */
const RAW_ITEMS = {
  // ---- แร่ธาตุ / โลหะ (ore) ----
  "minecraft:coal": { sellPrice: 50, category: "ore", icon: "textures/items/coal" },
  "minecraft:lapis_lazuli": { sellPrice: 50, category: "ore", icon: "textures/items/dye_powder_blue" },
  "minecraft:redstone": { sellPrice: 50, category: "ore", icon: "textures/items/redstone_dust" },
  "minecraft:copper_ingot": { sellPrice: 120, category: "ore", icon: "textures/items/copper_ingot" },
  "minecraft:quartz": { sellPrice: 30, category: "ore", icon: "textures/items/quartz" },
  "minecraft:iron_ingot": { sellPrice: 300, category: "ore", icon: "textures/items/iron_ingot" },
  "minecraft:gold_ingot": { sellPrice: 1000, category: "ore", icon: "textures/items/gold_ingot" },
  "minecraft:emerald": { sellPrice: 200, category: "ore", icon: "textures/items/emerald" },
  "minecraft:diamond": { sellPrice: 2500, category: "ore", icon: "textures/items/diamond" },
  "minecraft:netherite_ingot": { sellPrice: 14000, category: "ore", icon: "textures/items/netherite_ingot" },

  // ---- แร่ดิบ/เศษ (ore) ----
  "minecraft:raw_iron": { sellPrice: 200, category: "ore", icon: "textures/items/iron_raw" },
  "minecraft:raw_gold": { sellPrice: 700, category: "ore", icon: "textures/items/gold_raw" },
  "minecraft:raw_copper": { sellPrice: 80, category: "ore", icon: "textures/items/copper_raw" },
  "minecraft:netherite_scrap": { sellPrice: 4500, category: "ore", icon: "textures/items/netherite_scrap" },
  "minecraft:iron_nugget": { sellPrice: 33, category: "ore", icon: "textures/items/iron_nugget" },
  "minecraft:gold_nugget": { sellPrice: 111, category: "ore", icon: "textures/items/gold_nugget" },
  "minecraft:amethyst_cluster": { sellPrice: 50, category: "ore", icon: "textures/blocks/amethyst_cluster" },

  // ---- อาหาร (food) ----
  "minecraft:apple": { sellPrice: 10, category: "food", icon: "textures/items/apple" },
  "minecraft:baked_potato": { sellPrice: 20, category: "food", icon: "textures/items/potato_baked" },
  "minecraft:cooked_cod": { sellPrice: 30, category: "food", icon: "textures/items/fish_cooked" },
  "minecraft:bread": { sellPrice: 40, category: "food", icon: "textures/items/bread" },
  "minecraft:cooked_chicken": { sellPrice: 40, category: "food", icon: "textures/items/chicken_cooked" },
  "minecraft:cooked_beef": { sellPrice: 50, category: "food", icon: "textures/items/beef_cooked" },
  "minecraft:cooked_porkchop": { sellPrice: 45, category: "food", icon: "textures/items/porkchop_cooked" },
  "minecraft:cooked_mutton": { sellPrice: 70, category: "food", icon: "textures/items/mutton_cooked" },
  "minecraft:cooked_salmon": { sellPrice: 70, category: "food", icon: "textures/items/fish_salmon_cooked" },
  "minecraft:beetroot_soup": { sellPrice: 100, category: "food", icon: "textures/items/beetroot_soup" },
  "minecraft:golden_carrot": { sellPrice: 120, category: "food", icon: "textures/items/carrot_golden" },
  "minecraft:golden_apple": { sellPrice: 2000, category: "food", icon: "textures/items/apple_golden" },

  // ---- อาหารเพิ่มเติม (food) ----
  "minecraft:mushroom_stew": { sellPrice: 30, category: "food", icon: "textures/items/mushroom_stew" },
  "minecraft:rabbit_stew": { sellPrice: 60, category: "food", icon: "textures/items/rabbit_stew" },
  "minecraft:suspicious_stew": { sellPrice: 80, category: "food", icon: "textures/items/suspicious_stew" },
  "minecraft:cookie": { sellPrice: 15, category: "food", icon: "textures/items/cookie" },
  "minecraft:pumpkin_pie": { sellPrice: 25, category: "food", icon: "textures/items/pumpkin_pie" },
  "minecraft:cake": { sellPrice: 60, category: "food", icon: "textures/items/cake" },
  "minecraft:glow_berries": { sellPrice: 8, category: "food", icon: "textures/items/glow_berries" },
  "minecraft:cooked_rabbit": { sellPrice: 35, category: "food", icon: "textures/items/rabbit_cooked" },

  // ---- พืชผัก (crop) ----
  "minecraft:wheat": { sellPrice: 5, category: "crop", icon: "textures/items/wheat" },
  "minecraft:carrot": { sellPrice: 7, category: "crop", icon: "textures/items/carrot" },
  "minecraft:potato": { sellPrice: 5, category: "crop", icon: "textures/items/potato" },
  "minecraft:beetroot": { sellPrice: 4, category: "crop", icon: "textures/items/beetroot" },
  "minecraft:melon_slice": { sellPrice: 4, category: "crop", icon: "textures/items/melon_slice" },
  "minecraft:pumpkin": { sellPrice: 30, category: "crop", icon: "textures/blocks/pumpkin_side" },
  "minecraft:sugar_cane": { sellPrice: 50, category: "crop", icon: "textures/items/reeds" },
  "minecraft:cocoa_beans": { sellPrice: 4, category: "crop", icon: "textures/items/dye_powder_brown" },
  "minecraft:nether_wart": { sellPrice: 40, category: "crop", icon: "textures/items/nether_wart" },
  "minecraft:sweet_berries": { sellPrice: 2, category: "crop", icon: "textures/items/sweet_berries" },

  // ---- พืชผักเพิ่มเติม (crop) ----
  "minecraft:bamboo": { sellPrice: 2, category: "crop", icon: "textures/items/bamboo" },
  "minecraft:cactus": { sellPrice: 3, category: "crop", icon: "textures/blocks/cactus" },
  "minecraft:vine": { sellPrice: 2, category: "crop", icon: "textures/blocks/vine" },
  "minecraft:lily_pad": { sellPrice: 3, category: "crop", icon: "textures/items/reeds" },
  "minecraft:sea_pickle": { sellPrice: 5, category: "crop", icon: "textures/blocks/sea_pickle" },
  "minecraft:chorus_flower": { sellPrice: 30, category: "crop", icon: "textures/blocks/chorus_flower" },
  "minecraft:chorus_fruit": { sellPrice: 40, category: "crop", icon: "textures/items/chorus_fruit" },
  "minecraft:popped_chorus_fruit": { sellPrice: 50, category: "crop", icon: "textures/items/chorus_fruit_popped" },

  // ---- บล็อกก่อสร้าง (block) ----
  "minecraft:stone": { sellPrice: 1, category: "block", icon: "textures/blocks/stone" },
  "minecraft:cobblestone": { sellPrice: 1, category: "block", icon: "textures/blocks/cobblestone" },
  "minecraft:dirt": { sellPrice: 1, category: "block", icon: "textures/blocks/dirt" },
  "minecraft:sand": { sellPrice: 1, category: "block", icon: "textures/blocks/sand" },
  "minecraft:gravel": { sellPrice: 1, category: "block", icon: "textures/blocks/gravel" },
  "minecraft:clay_ball": { sellPrice: 1, category: "block", icon: "textures/items/clay_ball" },
  "minecraft:glass": { sellPrice: 10, category: "block", icon: "textures/blocks/glass" },
  "minecraft:sandstone": { sellPrice: 2, category: "block", icon: "textures/blocks/sandstone_normal" },
  "minecraft:brick_block": { sellPrice: 8, category: "block", icon: "textures/blocks/brick" },
  "minecraft:quartz_block": { sellPrice: 100, category: "block", icon: "textures/blocks/quartz_block_side" },
  "minecraft:hardened_clay": { sellPrice: 10, category: "block", icon: "textures/blocks/hardened_clay" },
  "minecraft:netherrack": { sellPrice: 1, category: "block", icon: "textures/blocks/netherrack" },
  "minecraft:end_stone": { sellPrice: 1, category: "block", icon: "textures/blocks/end_stone" },
  "minecraft:obsidian": { sellPrice: 120, category: "block", icon: "textures/blocks/obsidian" },
  "minecraft:glowstone": { sellPrice: 25, category: "block", icon: "textures/blocks/glowstone" },

  // ---- บล็อกเนเธอร์เพิ่มเติม (block) ----
  "minecraft:soul_sand": { sellPrice: 2, category: "block", icon: "textures/blocks/soul_sand" },
  "minecraft:soul_soil": { sellPrice: 2, category: "block", icon: "textures/blocks/soul_soil" },
  "minecraft:magma_block": { sellPrice: 5, category: "block", icon: "textures/blocks/magma" },
  "minecraft:shroomlight": { sellPrice: 30, category: "block", icon: "textures/blocks/shroomlight" },
  "minecraft:warped_stem": { sellPrice: 3, category: "block", icon: "textures/blocks/warped_stem" },
  "minecraft:crimson_stem": { sellPrice: 3, category: "block", icon: "textures/blocks/crimson_stem" },
  "minecraft:warped_wart_block": { sellPrice: 8, category: "block", icon: "textures/blocks/warped_wart_block" },
  "minecraft:nether_sprouts": { sellPrice: 2, category: "block", icon: "textures/blocks/nether_sprouts" },
  "minecraft:twisting_vines": { sellPrice: 2, category: "block", icon: "textures/blocks/twisting_vines" },
  "minecraft:weeping_vines": { sellPrice: 2, category: "block", icon: "textures/blocks/weeping_vines" },

  // ---- บล็อก End (block) ----
  "minecraft:purpur_block": { sellPrice: 20, category: "block", icon: "textures/blocks/purpur_block" },
  "minecraft:purpur_pillar": { sellPrice: 20, category: "block", icon: "textures/blocks/purpur_pillar" },

  // ---- น้ำแข็ง/กระจก (block) ----
  "minecraft:packed_ice": { sellPrice: 20, category: "block", icon: "textures/blocks/ice_packed" },
  "minecraft:blue_ice": { sellPrice: 60, category: "block", icon: "textures/blocks/ice_blue" },
  "minecraft:tinted_glass": { sellPrice: 20, category: "block", icon: "textures/blocks/tinted_glass" },
  "minecraft:glass_pane": { sellPrice: 8, category: "block", icon: "textures/blocks/glass_pane_top" },

  // ---- Prismarine (block) ----
  "minecraft:prismarine": { sellPrice: 15, category: "block", icon: "textures/blocks/prismarine_rough" },
  "minecraft:prismarine_bricks": { sellPrice: 20, category: "block", icon: "textures/blocks/prismarine_brick" },
  "minecraft:dark_prismarine": { sellPrice: 25, category: "block", icon: "textures/blocks/prismarine_dark" },

  // ---- บล็อกตระกูลหิน เพิ่มเติม (block) — ขายได้เพิ่มจากเดิมที่มีแค่
  // stone/cobblestone สองอย่าง ----
  "minecraft:granite": { sellPrice: 3, category: "stone", icon: "textures/blocks/stone_granite" },
  "minecraft:polished_granite": { sellPrice: 4, category: "stone", icon: "textures/blocks/stone_granite_smooth" },
  "minecraft:diorite": { sellPrice: 3, category: "stone", icon: "textures/blocks/stone_diorite" },
  "minecraft:polished_diorite": { sellPrice: 4, category: "stone", icon: "textures/blocks/stone_diorite_smooth" },
  "minecraft:andesite": { sellPrice: 3, category: "stone", icon: "textures/blocks/stone_andesite" },
  "minecraft:polished_andesite": { sellPrice: 4, category: "stone", icon: "textures/blocks/stone_andesite_smooth" },
  "minecraft:smooth_stone": { sellPrice: 3, category: "stone", icon: "textures/blocks/smooth_stone" },
  "minecraft:deepslate": { sellPrice: 1, category: "stone", icon: "textures/blocks/deepslate" },
  "minecraft:cobbled_deepslate": { sellPrice: 1, category: "stone", icon: "textures/blocks/cobbled_deepslate" },
  "minecraft:polished_deepslate": { sellPrice: 4, category: "stone", icon: "textures/blocks/polished_deepslate" },
  "minecraft:tuff": { sellPrice: 3, category: "stone", icon: "textures/blocks/tuff" },
  "minecraft:calcite": { sellPrice: 3, category: "stone", icon: "textures/blocks/calcite" },
  "minecraft:basalt": { sellPrice: 3, category: "stone", icon: "textures/blocks/basalt_side" },
  "minecraft:polished_basalt": { sellPrice: 4, category: "stone", icon: "textures/blocks/polished_basalt_side" },
  "minecraft:blackstone": { sellPrice: 4, category: "stone", icon: "textures/blocks/blackstone" },
  "minecraft:polished_blackstone": { sellPrice: 5, category: "stone", icon: "textures/blocks/polished_blackstone" },

  // ---- คอนกรีต หลากสี (block) ----
  "minecraft:white_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_white" },
  "minecraft:orange_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_orange" },
  "minecraft:magenta_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_magenta" },
  "minecraft:light_blue_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_light_blue" },
  "minecraft:yellow_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_yellow" },
  "minecraft:lime_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_lime" },
  "minecraft:pink_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_pink" },
  "minecraft:gray_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_gray" },
  "minecraft:light_gray_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_silver" },
  "minecraft:cyan_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_cyan" },
  "minecraft:purple_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_purple" },
  "minecraft:blue_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_blue" },
  "minecraft:brown_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_brown" },
  "minecraft:green_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_green" },
  "minecraft:red_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_red" },
  "minecraft:black_concrete": { sellPrice: 6, category: "concrete", icon: "textures/blocks/concrete_black" },

  // ---- ดินเผาย้อมสี หลากสี (block) — คู่กับ minecraft:hardened_clay (สีขาว
  // ธรรมชาติ) ที่มีอยู่แล้วด้านบน ----
  "minecraft:white_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_white" },
  "minecraft:orange_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_orange" },
  "minecraft:magenta_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_magenta" },
  "minecraft:light_blue_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_light_blue" },
  "minecraft:yellow_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_yellow" },
  "minecraft:lime_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_lime" },
  "minecraft:pink_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_pink" },
  "minecraft:gray_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_gray" },
  "minecraft:light_gray_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_silver" },
  "minecraft:cyan_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_cyan" },
  "minecraft:purple_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_purple" },
  "minecraft:blue_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_blue" },
  "minecraft:brown_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_brown" },
  "minecraft:green_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_green" },
  "minecraft:red_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_red" },
  "minecraft:black_terracotta": { sellPrice: 10, category: "terracotta", icon: "textures/blocks/hardened_clay_stained_black" },

  // ---- ไม้ (wood) — ท่อนไม้ + แผ่นไม้ ทุกสายพันธุ์ (เดิมไม่มีไม้ขายได้
  // เลยสักชิ้น) ราคาตั้งให้ท่อนไม้ 1 ท่อน = แผ่นไม้ 4 แผ่นพอดี (คราฟต์แล้ว
  // ขายไม่ได้กำไร/ขาดทุนเพิ่มจากเดิม) ----
  "minecraft:oak_log": { sellPrice: 4, category: "wood", icon: "textures/blocks/log_oak" },
  "minecraft:oak_planks": { sellPrice: 1, category: "wood", icon: "textures/blocks/planks_oak" },
  "minecraft:spruce_log": { sellPrice: 4, category: "wood", icon: "textures/blocks/log_spruce" },
  "minecraft:spruce_planks": { sellPrice: 1, category: "wood", icon: "textures/blocks/planks_spruce" },
  "minecraft:birch_log": { sellPrice: 4, category: "wood", icon: "textures/blocks/log_birch" },
  "minecraft:birch_planks": { sellPrice: 1, category: "wood", icon: "textures/blocks/planks_birch" },
  "minecraft:jungle_log": { sellPrice: 4, category: "wood", icon: "textures/blocks/log_jungle" },
  "minecraft:jungle_planks": { sellPrice: 1, category: "wood", icon: "textures/blocks/planks_jungle" },
  "minecraft:acacia_log": { sellPrice: 4, category: "wood", icon: "textures/blocks/log_acacia" },
  "minecraft:acacia_planks": { sellPrice: 1, category: "wood", icon: "textures/blocks/planks_acacia" },
  "minecraft:dark_oak_log": { sellPrice: 4, category: "wood", icon: "textures/blocks/log_big_oak" },
  "minecraft:dark_oak_planks": { sellPrice: 1, category: "wood", icon: "textures/blocks/planks_big_oak" },
  "minecraft:mangrove_log": { sellPrice: 4, category: "wood", icon: "textures/blocks/mangrove_log" },
  "minecraft:mangrove_planks": { sellPrice: 1, category: "wood", icon: "textures/blocks/mangrove_planks" },
  "minecraft:cherry_log": { sellPrice: 4, category: "wood", icon: "textures/blocks/cherry_log" },
  "minecraft:cherry_planks": { sellPrice: 1, category: "wood", icon: "textures/blocks/cherry_planks" },

  // ---- ขนแกะ (wool) — ทุกสี ราคาเท่ากันหมด ----
  "minecraft:white_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_white" },
  "minecraft:orange_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_orange" },
  "minecraft:magenta_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_magenta" },
  "minecraft:light_blue_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_light_blue" },
  "minecraft:yellow_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_yellow" },
  "minecraft:lime_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_lime" },
  "minecraft:pink_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_pink" },
  "minecraft:gray_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_gray" },
  "minecraft:light_gray_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_silver" },
  "minecraft:cyan_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_cyan" },
  "minecraft:purple_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_purple" },
  "minecraft:blue_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_blue" },
  "minecraft:brown_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_brown" },
  "minecraft:green_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_green" },
  "minecraft:red_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_red" },
  "minecraft:black_wool": { sellPrice: 4, category: "wool", icon: "textures/blocks/wool_colored_black" },

  // ---- ของจากทะเล (aquatic) — ปลาดิบ/kelp/ของจากมอนสเตอร์ในน้ำ (เดิมมีแต่
  // ปลาปรุงสุกอยู่ในหมวด food เท่านั้น) ----
  "minecraft:cod": { sellPrice: 15, category: "aquatic", icon: "textures/items/fish_raw" },
  "minecraft:salmon": { sellPrice: 35, category: "aquatic", icon: "textures/items/fish_salmon_raw" },
  "minecraft:pufferfish": { sellPrice: 20, category: "aquatic", icon: "textures/items/fish_pufferfish_raw" },
  "minecraft:tropical_fish": { sellPrice: 25, category: "aquatic", icon: "textures/items/fish_clownfish_raw" },
  "minecraft:kelp": { sellPrice: 2, category: "aquatic", icon: "textures/items/kelp" },
  "minecraft:dried_kelp": { sellPrice: 5, category: "aquatic", icon: "textures/items/dried_kelp" },
  "minecraft:ink_sac": { sellPrice: 10, category: "aquatic", icon: "textures/items/dye_powder_black" },
  "minecraft:glow_ink_sac": { sellPrice: 20, category: "aquatic", icon: "textures/items/dye_powder_glow" },
  "minecraft:turtle_scute": { sellPrice: 40, category: "aquatic", icon: "textures/items/turtle_shell_piece" },
  "minecraft:sponge": { sellPrice: 50, category: "aquatic", icon: "textures/blocks/sponge" },

  // ---- ของจากมอนสเตอร์ / วัสดุเบ็ดเตล็ด (misc) ----
  "minecraft:string": { sellPrice: 8, category: "misc", icon: "textures/items/string" },
  "minecraft:feather": { sellPrice: 10, category: "misc", icon: "textures/items/feather" },
  "minecraft:bone": { sellPrice: 8, category: "misc", icon: "textures/items/bone" },
  "minecraft:gunpowder": { sellPrice: 15, category: "misc", icon: "textures/items/gunpowder" },
  "minecraft:leather": { sellPrice: 20, category: "misc", icon: "textures/items/leather" },
  "minecraft:rabbit_hide": { sellPrice: 10, category: "misc", icon: "textures/items/rabbit_hide" },
  "minecraft:spider_eye": { sellPrice: 12, category: "misc", icon: "textures/items/spider_eye" },
  "minecraft:rotten_flesh": { sellPrice: 3, category: "misc", icon: "textures/items/rotten_flesh" },
  "minecraft:slime_ball": { sellPrice: 20, category: "misc", icon: "textures/items/slimeball" },
  "minecraft:magma_cream": { sellPrice: 25, category: "misc", icon: "textures/items/magma_cream" },
  "minecraft:honeycomb": { sellPrice: 15, category: "misc", icon: "textures/items/honeycomb" },
  "minecraft:glowstone_dust": { sellPrice: 15, category: "misc", icon: "textures/items/glowstone_dust" },
  "minecraft:amethyst_shard": { sellPrice: 30, category: "misc", icon: "textures/items/amethyst_shard" },
  "minecraft:prismarine_shard": { sellPrice: 15, category: "misc", icon: "textures/items/prismarine_shard" },
  "minecraft:prismarine_crystals": { sellPrice: 25, category: "misc", icon: "textures/items/prismarine_crystals" },
  "minecraft:phantom_membrane": { sellPrice: 40, category: "misc", icon: "textures/items/phantom_membrane" },
  "minecraft:nautilus_shell": { sellPrice: 80, category: "misc", icon: "textures/items/nautilus" },
  "minecraft:ender_pearl": { sellPrice: 100, category: "misc", icon: "textures/items/ender_pearl" },
  "minecraft:blaze_rod": { sellPrice: 150, category: "misc", icon: "textures/items/blaze_rod" },
  "minecraft:ghast_tear": { sellPrice: 200, category: "misc", icon: "textures/items/ghast_tear" },

  // ---- ของเบ็ดเตล็ดเพิ่มเติม (misc) ----
  "minecraft:blaze_powder": { sellPrice: 80, category: "misc", icon: "textures/items/blaze_powder" },
  "minecraft:flint": { sellPrice: 5, category: "misc", icon: "textures/items/flint" },
  "minecraft:ender_eye": { sellPrice: 250, category: "misc", icon: "textures/items/ender_eye" },
  "minecraft:rabbit_foot": { sellPrice: 30, category: "misc", icon: "textures/items/rabbit_foot" },
  "minecraft:dragon_breath": { sellPrice: 500, category: "misc", icon: "textures/items/dragons_breath" },
  "minecraft:experience_bottle": { sellPrice: 100, category: "misc", icon: "textures/items/experience_bottle" },
  "minecraft:glistering_melon_slice": { sellPrice: 60, category: "misc", icon: "textures/items/melon_speckled" },
  "minecraft:fermented_spider_eye": { sellPrice: 15, category: "misc", icon: "textures/items/spider_eye_fermented" },
  "minecraft:bone_meal": { sellPrice: 2, category: "misc", icon: "textures/items/dye_powder_white" },
  "minecraft:heart_of_the_sea": { sellPrice: 2000, category: "misc", icon: "textures/items/heartofthesea_closed" },
  "minecraft:totem_of_undying": { sellPrice: 12500, category: "misc", icon: "textures/items/totem" },
  "minecraft:elytra": { sellPrice: 5000, category: "misc", icon: "textures/items/elytra", enabled: false },
  "minecraft:bookshelf": { sellPrice: 30, category: "misc", icon: "textures/blocks/bookshelf" },
  "minecraft:name_tag": { sellPrice: 100, category: "misc", icon: "textures/items/name_tag" },
  "minecraft:saddle": { sellPrice: 200, category: "misc", icon: "textures/items/saddle" },
  "minecraft:lead": { sellPrice: 15, category: "misc", icon: "textures/items/lead" },
  "minecraft:wet_sponge": { sellPrice: 30, category: "misc", icon: "textures/blocks/sponge_wet" }
};

// สร้างฐานข้อมูลจริงจาก RAW_ITEMS — เติม id/buyPrice/enabled ให้ครบทุกรายการ
// ครั้งเดียวตอนโหลดโมดูล (ไม่คำนวณซ้ำทุกครั้งที่เรียกฟังก์ชัน)
function buildItems(rawItems) {
  const out = {};
  for (const [id, def] of Object.entries(rawItems)) {
    const sellPrice = def.sellPrice;
    const buyPrice = typeof def.buyPrice === "number"
      ? def.buyPrice
      : Math.ceil(sellPrice * ECONOMY_CONFIG.BUY_PRICE_MULTIPLIER);

    out[id] = {
      id,
      nameKey: def.nameKey ?? null,
      icon: def.icon,
      sellPrice,
      buyPrice,
      category: def.category,
      enabled: def.enabled !== false
    };
  }
  return out;
}

/** ฐานข้อมูลไอเทมที่พร้อมใช้งานจริง (คีย์ = typeId) */
export const ITEMS = buildItems(RAW_ITEMS);

// Pre-compute ที่ module load — ข้อมูลไม่เปลี่ยน runtime
const ITEMS_BY_CATEGORY = {};
const ALL_ENABLED = [];
for (const [id, item] of Object.entries(ITEMS)) {
  if (!item.enabled) continue;
  ALL_ENABLED.push(id);
  (ITEMS_BY_CATEGORY[item.category] ??= []).push(id);
}

/** true ถ้าไอเทมนี้ถูกลงทะเบียนอยู่ในฐานข้อมูล (ไม่สนใจ enabled) */
export function hasItem(itemId) {
  return Object.prototype.hasOwnProperty.call(ITEMS, itemId);
}

/** true ถ้าไอเทมนี้ลงทะเบียนไว้ "และ" เปิดใช้งานอยู่ (enabled !== false) */
export function isItemEnabled(itemId) {
  return ITEMS[itemId]?.enabled === true;
}

/** คืนข้อมูลดิบของไอเทม (หรือ null ถ้าไม่มีในฐานข้อมูล) */
export function getItemData(itemId) {
  return ITEMS[itemId] ?? null;
}

/** ราคาขาย (ต่อชิ้น) — 0 ถ้าไม่มีในฐานข้อมูล */
export function getSellPrice(itemId) {
  return ITEMS[itemId]?.sellPrice ?? 0;
}

/** ราคาซื้อ (ต่อชิ้น) — 0 ถ้าไม่มีในฐานข้อมูล */
export function getBuyPrice(itemId) {
  return ITEMS[itemId]?.buyPrice ?? 0;
}

/** ไอคอนของไอเทม สำหรับใช้แสดงในเมนู */
export function getItemIcon(itemId) {
  return ITEMS[itemId]?.icon ?? "";
}

/**
 * รายชื่อไอเทม (itemId) ในหมวดหมู่ที่กำหนด ที่ "เปิดใช้งานอยู่" เท่านั้น
 * (enabled: false จะไม่ถูกคืนค่าจากฟังก์ชันนี้ — ทำให้ Shop/Sell/Search ที่
 * เรียกฟังก์ชันนี้ซ่อนไอเทมที่ปิดใช้งานให้อัตโนมัติโดยไม่ต้องกรองเอง)
 * ไม่ใส่ category = ทุกหมวดหมู่ — ใช้ pre-computed data แทน Object.keys().filter()
 */
export function getItemsByCategory(category) {
  return category ? (ITEMS_BY_CATEGORY[category] ?? []) : ALL_ENABLED;
}

/**
 * ชื่อไอเทมสำหรับแสดงผล — ใช้ nameKey ที่แปลแล้วถ้ามีและพบใน locale จริง
 * ไม่งั้น fallback เป็นชื่ออัตโนมัติจาก typeId เช่น
 * "minecraft:iron_ingot" -> "Iron Ingot" (พฤติกรรมเดิมของทุกไอเทมที่ยังไม่
 * มี nameKey กำหนดไว้)
 */
export function getItemDisplayName(itemId) {
  // กันชั้นที่สองสำหรับ targetId = null ("เป้าหมายใดก็ได้" — ดู
  // questTargetName() ใน systems/quests/display.js) — null.split throw ทันที
  if (!itemId) return "?";
  const nameKey = ITEMS[itemId]?.nameKey;
  if (nameKey) {
    const translated = t(nameKey);
    if (translated !== nameKey) return translated;
  }
  const raw = itemId.split(":")[1] ?? itemId;
  return raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * ตรวจสอบความถูกต้องของฐานข้อมูลไอเทม — คืน array ของข้อความปัญหาที่พบ
 * (ว่าง = ไม่มีปัญหา) เรียกจาก data/index.js ตอนโหลดโมดูล แล้ว log
 * console.error ให้เห็นชัดเจนแทนการปล่อยผ่านเงียบ ๆ
 * @param {(category: string) => boolean} isValidCategory ฟังก์ชันเช็ค
 *   category จาก data/shops.js (ส่งเข้ามาเป็นพารามิเตอร์เพื่อไม่ให้
 *   items.js ต้อง import shops.js ตรง ๆ — กัน circular import)
 */
export function validateItems(isValidCategory) {
  const issues = [];

  for (const [id, def] of Object.entries(RAW_ITEMS)) {
    if (!id || typeof id !== "string" || !id.includes(":")) {
      issues.push(`item "${id}": item id ไม่ถูกต้อง (ต้องอยู่ในรูปแบบ "namespace:name")`);
    }

    if (typeof def.sellPrice !== "number" || !Number.isFinite(def.sellPrice) || def.sellPrice < 0) {
      issues.push(`item "${id}": sellPrice ต้องเป็นตัวเลข >= 0 (ได้ ${JSON.stringify(def.sellPrice)})`);
    }

    if (def.buyPrice !== undefined &&
      (typeof def.buyPrice !== "number" || !Number.isFinite(def.buyPrice) || def.buyPrice < 0)) {
      issues.push(`item "${id}": buyPrice ต้องเป็นตัวเลข >= 0 ถ้ากำหนดเอง (ได้ ${JSON.stringify(def.buyPrice)})`);
    }

    if (typeof def.icon !== "string" || def.icon.trim() === "") {
      issues.push(`item "${id}": ต้องกำหนด icon`);
    }

    if (typeof def.category !== "string" || def.category.trim() === "") {
      issues.push(`item "${id}": ต้องกำหนด category`);
    } else if (typeof isValidCategory === "function" && !isValidCategory(def.category)) {
      issues.push(`item "${id}": category "${def.category}" ไม่ได้ลงทะเบียนไว้ใน data/shops.js`);
    }

    if (def.enabled !== undefined && typeof def.enabled !== "boolean") {
      issues.push(`item "${id}": enabled ต้องเป็น true/false (ได้ ${JSON.stringify(def.enabled)})`);
    }

    if (def.nameKey !== undefined && def.nameKey !== null) {
      if (typeof def.nameKey !== "string" || def.nameKey.trim() === "") {
        issues.push(`item "${id}": nameKey ต้องเป็น string ที่ไม่ว่าง`);
      } else if (t(def.nameKey) === def.nameKey) {
        // ไม่ใช่ error ร้ายแรง — แค่ยังไม่มีคำแปล จะ fallback เป็นชื่อ
        // อัตโนมัติจาก itemId แทน (ดู getItemDisplayName)
        issues.push(`item "${id}": nameKey "${def.nameKey}" ยังไม่มีใน locale (จะใช้ชื่ออัตโนมัติแทนชั่วคราว)`);
      }
    }
  }

  return issues;
}

/* =========================
   Item ID ↔ Index Mapping (สำหรับ backup compression)
   เรียง item IDs แบบ alphabetical เพื่อให้ mapping เสถียร
   ไม่ว่า RAW_ITEMS จะถูกแก้ไขยังไง (เพิ่มท้าย = index ของเก่าไม่เปลี่ยน)
========================= */

/** sorted list ของ item IDs — สร้างครั้งเดียวตอนโหลดโมดูล */
const SORTED_ITEM_IDS = Object.keys(RAW_ITEMS).sort();

// Map สำหรับ lookup O(1) แทน indexOf() O(n)
const ITEM_ID_TO_INDEX = new Map(SORTED_ITEM_IDS.map((id, i) => [id, i]));

/**
 * แปลง item ID เป็น index (number) สำหรับเก็บแบบ compressed
 * @param {string} itemId
 * @returns {number} index (0-based) หรือ -1 ถ้าไม่เจอ
 */
export function itemIdToIndex(itemId) {
  const idx = ITEM_ID_TO_INDEX.get(itemId);
  return idx !== undefined ? idx : -1;
}

/**
 * แปลง index กลับเป็น item ID
 * @param {number} index
 * @returns {string|undefined} item ID หรือ undefined ถ้า index นอก range
 */
export function indexToItemId(index) {
  return SORTED_ITEM_IDS[index];
}

/**
 * คืนจำนวน item ทั้งหมดที่มีในระบบ
 * @returns {number}
 */
export function getItemCount() {
  return SORTED_ITEM_IDS.length;
}
