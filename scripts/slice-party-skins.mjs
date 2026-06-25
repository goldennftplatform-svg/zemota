/**
 * Slice 72 party portraits — trim + center-crop so each cell is one person.
 * Run: node scripts/slice-party-skins.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("public/art/sprites/party-skins");
const OUT = path.join(ROOT, "portraits");

const SHEET_CONFIG = [
  {
    file: "set-1.png",
    cols: 8,
    colBounds: [
      [0, 175], [175, 296], [296, 415], [415, 537], [537, 660], [660, 781], [781, 900], [900, 1024],
    ],
    rowBounds: [[233, 398], [398, 563], [563, 728]],
  },
  {
    file: "set-2.png",
    cols: 7,
    colBounds: [
      [0, 186], [186, 332], [332, 475], [475, 618], [618, 759], [759, 902], [902, 1024],
    ],
    rowBounds: [[241, 373], [373, 505], [505, 637], [637, 768]],
  },
  {
    file: "set-3.png",
    cols: 8,
    colBounds: [
      [0, 176], [176, 295], [295, 420], [420, 545], [545, 664], [664, 791], [791, 912], [912, 1024],
    ],
    rowBounds: [[252, 384], [384, 516], [516, 648], [648, 768]],
  },
];

function keyTransparent(buf) {
  const out = Buffer.from(buf);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i] < 28 && out[i + 1] < 28 && out[i + 2] < 28) out[i + 3] = 0;
  }
  return out;
}

function centroidOfAlpha(data, w, h) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 20) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  if (!n) return { cx: w / 2, cy: h / 2, n: 0 };
  return { cx: sx / n, cy: sy / n, n };
}

async function portraitFromCell(src, left, top, right, bottom) {
  const cellW = right - left;
  const cellH = bottom - top;
  const padX = Math.round(cellW * 0.06);
  const padY = Math.round(cellH * 0.05);

  const piece = await sharp(src)
    .extract({
      left: left + padX,
      top: top + padY,
      width: cellW - padX * 2,
      height: cellH - padY * 2,
    })
    .png()
    .toBuffer();

  const trimmedBuf = await sharp(piece).trim({ threshold: 12 }).png().toBuffer();
  const { data, info } = await sharp(trimmedBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  if (w < 4 || h < 4) return null;

  const { cx, cy, n } = centroidOfAlpha(data, w, h);
  if (n < 100) return null;

  const targetW = Math.min(w, Math.round(cellW * 0.78));
  const targetH = Math.min(h, Math.round(cellH * 0.92));
  let sx = Math.round(cx - targetW / 2);
  let sy = Math.round(cy - targetH * 0.55);
  sx = Math.max(0, Math.min(sx, w - targetW));
  sy = Math.max(0, Math.min(sy, h - targetH));

  const crop = Buffer.from(data);
  const outW = targetW;
  const outH = targetH;
  const out = Buffer.alloc(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const si = ((sy + y) * w + (sx + x)) * 4;
      const di = (y * outW + x) * 4;
      out[di] = crop[si];
      out[di + 1] = crop[si + 1];
      out[di + 2] = crop[si + 2];
      out[di + 3] = crop[si + 3];
    }
  }

  const keyed = keyTransparent(out);
  return sharp(keyed, { raw: { width: outW, height: outH, channels: 4 } }).png().toBuffer();
}

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
      const png = await portraitFromCell(src, left, top, right, bottom);
      if (!png) {
        console.warn("skip", sheet.file, r, c);
        continue;
      }
      const outFile = `skin-${String(skinId).padStart(3, "0")}.png`;
      await sharp(png).toFile(path.join(OUT, outFile));
      const meta = await sharp(png).metadata();
      manifest.push({
        id: skinId,
        file: `/art/sprites/party-skins/portraits/${outFile}`,
        w: meta.width,
        h: meta.height,
      });
      skinId++;
      count++;
    }
  }
  console.log(sheet.file, "->", count);
}

fs.writeFileSync(path.join(ROOT, "portraits-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Wrote ${skinId} portraits`);
