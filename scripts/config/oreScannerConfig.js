// =========================
// oreScannerConfig.js
// ค่าตั้งค่าของระบบสแกนแร่ (systems/oreScanner.js) — จุดเดียวที่ควรแก้เพื่อ
// ปรับระยะเริ่มต้น/ขั้นต่ำ-สูงสุด, ความถี่การสแกน, หรือเพิ่ม/ลดหมวดแร่ที่
// สแกนได้ ไม่ต้องแตะ oreScanner.js
//
// ตามสถาปัตยกรรมเดียวกับ config/ ไฟล์อื่น (questConfig.js, jobConfig.js
// ฯลฯ) — แยกค่าตั้งค่าออกจาก logic เสมอ
// =========================

export const ORE_SCANNER_CONFIG = {
  // ปิดไว้เป็นค่าเริ่มต้นเสมอสำหรับผู้เล่นที่ยังไม่เคยตั้งค่า (ต้องเข้าไป
  // เปิดเองในเมนูตั้งค่าครั้งแรก)
  DEFAULT_ENABLED: false,

  // ระยะสแกนเริ่มต้น (บล็อก) — ทรงลูกบาศก์รอบจุดยืนผู้เล่น (radius บล็อก
  // ทุกทิศจากจุดยืน ไม่ใช่รัศมีทรงกลม)
  DEFAULT_RADIUS: 3,
  MIN_RADIUS: 1,
  MAX_RADIUS: 8,

  // ความถี่การสแกน (ticks) — 40 tick = 2 วินาที ทุกครั้งที่ครบจะสแกนพร้อมกัน
  // ทุกผู้เล่นที่เปิดระบบไว้ในลูปเดียว (ดู startScanInterval ใน oreScanner.js)
  SCAN_INTERVAL_TICKS: 40,

  // หมวดแร่ที่เลือกสแกนได้ — เพิ่ม/ลบหมวดแค่แก้ array นี้ ไม่ต้องแก้
  // oreScanner.js (ลำดับที่นี่ = ลำดับ toggle ที่แสดงในฟอร์มตั้งค่าเสมอ)
  ORE_CATEGORIES: [
    {
      id: "coal",
      nameKey: "oreScanner.category.coal",
      blocks: ["minecraft:coal_ore", "minecraft:deepslate_coal_ore"]
    },
    {
      id: "iron",
      nameKey: "oreScanner.category.iron",
      blocks: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"]
    },
    {
      id: "copper",
      nameKey: "oreScanner.category.copper",
      blocks: ["minecraft:copper_ore", "minecraft:deepslate_copper_ore"]
    },
    {
      id: "gold",
      nameKey: "oreScanner.category.gold",
      blocks: [
        "minecraft:gold_ore",
        "minecraft:deepslate_gold_ore",
        "minecraft:nether_gold_ore"
      ]
    },
    {
      id: "redstone",
      nameKey: "oreScanner.category.redstone",
      blocks: [
        "minecraft:redstone_ore",
        "minecraft:deepslate_redstone_ore",
        // บล็อกแร่เรดสโตนที่กำลัง "ติด/เรือง" (โดนกระตุ้น) เป็นคนละ typeId
        // กับแร่ปกติใน Bedrock — รวมไว้ด้วยกันเพื่อไม่ให้สแกนพลาด
        "minecraft:lit_redstone_ore",
        "minecraft:lit_deepslate_redstone_ore"
      ]
    },
    {
      id: "lapis",
      nameKey: "oreScanner.category.lapis",
      blocks: ["minecraft:lapis_ore", "minecraft:deepslate_lapis_ore"]
    },
    {
      id: "diamond",
      nameKey: "oreScanner.category.diamond",
      blocks: ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"]
    },
    {
      id: "emerald",
      nameKey: "oreScanner.category.emerald",
      blocks: ["minecraft:emerald_ore", "minecraft:deepslate_emerald_ore"]
    },
    {
      id: "quartz",
      nameKey: "oreScanner.category.quartz",
      blocks: ["minecraft:nether_quartz_ore"]
    },
    {
      id: "ancientDebris",
      nameKey: "oreScanner.category.ancientDebris",
      blocks: ["minecraft:ancient_debris"]
    }
  ]
};
