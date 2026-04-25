#!/usr/bin/env node
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const SRC = resolve("public/icons/icon.svg");
const OUT_DIR = resolve("public/icons");

const TARGETS = [
  { size: 192, name: "icon-192.png", maskable: false },
  { size: 512, name: "icon-512.png", maskable: false },
  { size: 512, name: "maskable-512.png", maskable: true },
  { size: 180, name: "apple-touch-icon-180.png", maskable: false },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { size, name, maskable } of TARGETS) {
  const innerSize = maskable ? Math.round(size * 0.8) : size;
  const pad = Math.round((size - innerSize) / 2);
  await sharp(SRC, { density: 600 })
    .resize(innerSize, innerSize, { fit: "contain", background: "#f2f1ed" })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#f2f1ed" })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT_DIR, name));
  console.log(`✓ ${name} (${size}×${size})`);
}
