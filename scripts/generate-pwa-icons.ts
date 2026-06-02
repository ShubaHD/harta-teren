/**
 * Generează iconuri PWA 192x192 și 512x512 din icon.svg
 * Rulează: npx tsx scripts/generate-pwa-icons.ts
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

const publicDir = join(process.cwd(), "public");
const svgPath = join(publicDir, "icon.svg");
const sizes = [180, 192, 512] as const;

async function main() {
  const svg = readFileSync(svgPath);
  for (const size of sizes) {
    const outPath = join(publicDir, `icon-${size}.png`);
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Created ${outPath}`);
  }
  console.log("Done. Iconuri PWA generate.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
