#!/usr/bin/env node
// tools/build-mcpack.mjs
// สร้าง .mcpack 2 ตัว: เต็ม + no-admin
// รัน bump-version ก่อนอัตโนมัติ

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, createWriteStream } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { ZipArchive } from "archiver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

// ── helpers ──────────────────────────────────────────

function getVersion() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
  return pkg.version;
}

function addFilesToZip(zip, dir, basePath) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(basePath, full);
    if (statSync(full).isDirectory()) {
      addFilesToZip(zip, full, basePath);
    } else {
      zip.file(rel, readFileSync(full));
    }
  }
}

function createMcpack(name, variantLabel, modifyBuildConfig) {
  return new Promise((resolve_, reject) => {
    const outputPath = join(DIST, name);
    const output = writeFileSync(outputPath, ""); // touch
    const archive = new ZipArchive();

    const stream = createWriteStream(outputPath);
    archive.pipe(stream);

    // ถ้าต้องการแก้ buildConfig (no-admin)
    let buildConfigOrig = null;
    if (modifyBuildConfig) {
      const bcPath = resolve(ROOT, "scripts/config/buildConfig.js");
      buildConfigOrig = readFileSync(bcPath, "utf-8");
      writeFileSync(bcPath, buildConfigOrig.replace(
        /ADMIN_FEATURES_ENABLED\s*=\s*true/,
        "ADMIN_FEATURES_ENABLED = false"
      ));
    }

    try {
      // manifest.json
      archive.file(join(ROOT, "manifest.json"), { name: "manifest.json" });

      // scripts/ (ทั้งโฟลเดอร์)
      addFilesToZip(archive, resolve(ROOT, "scripts"), ROOT);

      archive.finalize();

      stream.on("close", () => {
        // คืนค่า buildConfig เดิม
        if (buildConfigOrig !== null) {
          writeFileSync(resolve(ROOT, "scripts/config/buildConfig.js"), buildConfigOrig);
        }
        console.log(`  ✓ ${variantLabel} → ${name} (${archive.pointer()} bytes)`);
        resolve_();
      });

      stream.on("error", (err) => {
        if (buildConfigOrig !== null) {
          writeFileSync(resolve(ROOT, "scripts/config/buildConfig.js"), buildConfigOrig);
        }
        reject(err);
      });
    } catch (err) {
      if (buildConfigOrig !== null) {
        writeFileSync(resolve(ROOT, "scripts/config/buildConfig.js"), buildConfigOrig);
      }
      reject(err);
    }
  });
}

// ── main ─────────────────────────────────────────────

async function main() {
  const version = getVersion();
  console.log(`build — v${version}`);

  // 1. sync version ก่อน
  console.log("\n[1/3] Syncing version...");
  execSync("node tools/bump-version.mjs", { cwd: ROOT, stdio: "inherit" });

  // 2. สร้าง dist/
  console.log("\n[2/3] Building .mcpack files...");
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  // 3. สร้างทั้ง 2 ตัว
  console.log("\n[3/3] Packaging...");
  await createMcpack(
    `scripts-economy-v${version}.mcpack`,
    "Full (admin)",
    false
  );
  await createMcpack(
    `scripts-economy-v${version}-no-admin.mcpack`,
    "No-admin",
    true
  );

  console.log(`\nDone — ${DIST}/`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
