/**
 * PWA Icon Generator Script
 * Run: npx tsx scripts/generate-icons.ts
 *
 * Generates 192x192 and 512x512 PNG icons for the PWA manifest
 * using sharp with an SVG source.
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#16a34a"/>
  <text x="256" y="320" font-size="280" font-weight="bold" fill="white"
        text-anchor="middle" font-family="system-ui, sans-serif">底</text>
</svg>`;

const sizes = [192, 512] as const;

async function main() {
  for (const size of sizes) {
    const outPath = path.join(
      __dirname,
      "..",
      "public",
      "icons",
      `icon-${size}.png`,
    );
    await sharp(Buffer.from(SVG))
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Generated ${outPath}`);
  }
}

main().catch(console.error);
