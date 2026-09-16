#!/usr/bin/env node
// tools/bump-version.mjs
// อ่าน version จาก package.json → sync ไป manifest.json + constants.js

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function parseVersion(v) {
  const parts = v.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version: "${v}" — ต้องเป็น format x.y.z`);
  }
  return parts;
}

// 1. อ่าน version จาก package.json
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
const version = pkg.version;
const versionArray = parseVersion(version);

console.log(`version:sync — syncing v${version} [${versionArray}]`);

// 2. อัปเดต manifest.json (header.version เท่านั้น — module versions แยก)
const manifestPath = resolve(ROOT, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

manifest.header.version = versionArray;

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`  ✓ manifest.json → header.version = [${versionArray}]`);

// 3. อัปเดต scripts/core/constants.js (ADDON_VERSION)
const constantsPath = resolve(ROOT, "scripts/core/constants.js");
let constants = readFileSync(constantsPath, "utf-8");

constants = constants.replace(
  /export const ADDON_VERSION = "[^"]*";/,
  `export const ADDON_VERSION = "${version}";`
);

writeFileSync(constantsPath, constants);
console.log(`  ✓ constants.js  → ADDON_VERSION = "${version}"`);

console.log("\nDone — ทั้ง 3 ไฟล์ตรงกันแล้ว");
