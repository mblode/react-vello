"use strict";
const fs = require("node:fs");
const path = require("node:path");

const pkgRoot = path.resolve(__dirname, "..");
const srcDir = path.join(pkgRoot, "src", "wasm");
const distDir = path.join(pkgRoot, "dist", "wasm");
const files = [
  "rvello.js",
  "rvello_bg.wasm",
  "rvello.d.ts",
  "rvello_bg.wasm.d.ts",
];

if (!fs.existsSync(srcDir)) {
  console.error(
    '[react-vello] Missing src/wasm assets. Run "pnpm -w wasm:build" and re-sync.'
  );
  process.exit(1);
}

const missing = files.filter((file) => !fs.existsSync(path.join(srcDir, file)));
if (missing.length > 0) {
  console.error(
    `[react-vello] Missing wasm assets in src/wasm:\n${missing.map((file) => `- ${file}`).join("\n")}`
  );
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
}
