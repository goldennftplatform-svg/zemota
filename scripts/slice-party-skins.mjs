/**
 * Slice 72 party portraits into individual trimmed PNGs.
 * Run: node scripts/slice-party-skins.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("public/art/sprites/party-skins");
const OUT = path.join(ROOT, "portraits");

/** Measured column/row bounds per sheet (title band excluded). */
const SHEET_CONFIG = [
  {
    file: "set-1.png",
    cols: 8,
    colBounds: [
      [0, 175],
      [175, 296],
      [296, 415],
      [415, 537],
      [537, 660],
      [660, 781],
      [781, 900],
      [900, 1024],
    ],
    rowBounds: [
      [233, 398],
      [398, 563],
      [563, 728],
    ],
  },
  {
    file: "set-2.png",
    cols: 7,
    colBounds: [
      [0, 186],
      [186, 332],
      [332, 475],
      [475, 618],
      [618, 759],
      [759, 902],
      [902, 1024],
    ],
    rowBounds: [
      [241, 373],
      [373, 505],
      [505, 637],
      [637, 768],
    ],
  },
  {
    file: "set-3.png",
    cols: 8,
    colBounds: [
      [0, 176],
      [176, 295],
      [295, 420],
      [420, 545],
      [545, 664],
      [664, 791],
      [791, 912],
      [912, 1024],
    ],
    rowBounds: [
      [252, 384],
      [384, 516],
      [516, 648],
      [648, 768],
    ],
  },
];

fs.mkdirSync(OUT, { recursive: true });

const manifest = [];
let skinId = 0;

for (const sheet of SHEET_CONFIG) {
  const src = path.join(ROOT, sheet.file);
  let count = 0;
  for (let r = 0; r < sheet.rowBounds.length && count < 24; r++) {
    const [top, bottom] = sheet.rowBounds[r];
    for (let c = 0; c < sheet.cols && count < 24; c++) {
      const [left, right] = sheet.colBounds[c];
      const outFile = `skin-${String(skinId).padStart(3, "0")}.png`;
      const outPath = path.join(OUT, outFile);
      const piece = await sharp(src)
        .extract({ left, top, width: right - left, height: bottom - top })
        .png()
        .toBuffer();
      await sharp(piece).trim({ threshold: 12 }).png().toFile(outPath);
      const meta = await sharp(outPath).metadata();
      manifest.push({
        id: skinId,
        file: `/art/sprites/party-skins/portraits/${outFile}`,
        sheet: sheet.file,
        col: c,
        row: r,
        w: meta.width,
        h: meta.height,
      });
      skinId++;
      count++;
    }
  }
  console.log(sheet.file, "->", count, "portraits");
}

fs.writeFileSync(path.join(ROOT, "portraits-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Wrote ${skinId} portraits`);
