/**
 * Slice 72 party portraits — trim + largest-blob crop so each cell is one person.
 * Run: node scripts/slice-party-skins.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("public/art/sprites/party-skins");
const OUT = path.join(ROOT, "portraits");

/** First 3 character rows × cols per sheet (24 skins each). Bounds from scripts/scan-rows.mjs + scan-cols.mjs. */
const SHEET_CONFIG = [
  {
    file: "set-1.png",
    cols: 8,
    colBounds: [
      [0, 175], [175, 296], [296, 415], [415, 537], [537, 660], [660, 781], [781, 900], [900, 1024],
    ],
    rowBounds: [
      [256, 385],
      [410, 544],
      [574, 728],
    ],
  },
  {
    file: "set-2.png",
    cols: 7,
    colBounds: [
      [0, 186], [186, 332], [332, 475], [475, 618], [618, 759], [759, 902], [902, 1024],
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
      [0, 176], [176, 295], [295, 420], [420, 545], [545, 664], [664, 791], [791, 912], [912, 1024],
    ],
    rowBounds: [
      [252, 391],
      [421, 561],
      [592, 768],
    ],
  },
];

/** Re-source specific skins when grid hash lands on a bad cell (crop bleed or wrong silhouette). */
const PORTRAIT_OVERRIDES = {
  /** Jedediah @ slot 1 — row bleed picked a pioneer woman; force the boy in col 5 row 2. */
  13: { file: "set-1.png", left: 537, top: 410, right: 660, bottom: 544, headBias: 0.44 },
  /** Horace @ slot 0 — col bleed left a dress hem; use cowboy row from set-3. */
  65: { file: "set-3.png", left: 0, top: 592, right: 176, bottom: 768, headBias: 0.44 },
};

function keyTransparent(buf) {
  const out = Buffer.from(buf);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i] < 28 && out[i + 1] < 28 && out[i + 2] < 28) out[i + 3] = 0;
  }
  return out;
}

function alphaAt(data, w, x, y) {
  return data[(y * w + x) * 4 + 3] > 20;
}

/** When row bleed leaves two figures in one trim, keep the largest connected sprite. */
function largestBlobBounds(data, w, h) {
  const visited = new Uint8Array(w * h);
  let best = null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (visited[start] || !alphaAt(data, w, x, y)) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      const stack = [[x, y]];
      visited[start] = 1;

      while (stack.length) {
        const [cx, cy] = stack.pop();
        area++;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (visited[ni] || !alphaAt(data, w, nx, ny)) continue;
          visited[ni] = 1;
          stack.push([nx, ny]);
        }
      }

      if (!best || area > best.area) {
        best = { area, minX, minY, maxX, maxY };
      }
    }
  }

  if (!best || best.area < 80) return null;
  return best;
}

function cropRaw(data, w, h, box) {
  const outW = box.maxX - box.minX + 1;
  const outH = box.maxY - box.minY + 1;
  const out = Buffer.alloc(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const si = ((box.minY + y) * w + (box.minX + x)) * 4;
      const di = (y * outW + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { out, outW, outH };
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

async function portraitFromCell(src, left, top, right, bottom, headBias = 0.52) {
  const cellW = right - left;
  const cellH = bottom - top;
  const padX = Math.round(cellW * 0.04);
  const padY = Math.round(cellH * 0.04);

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
  let { data, info } = await sharp(trimmedBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let w = info.width;
  let h = info.height;
  if (w < 4 || h < 4) return null;

  const blob = largestBlobBounds(data, w, h);
  if (blob) {
    const cropped = cropRaw(data, w, h, blob);
    data = cropped.out;
    w = cropped.outW;
    h = cropped.outH;
  }

  const { cx, cy, n } = centroidOfAlpha(data, w, h);
  if (n < 100) return null;

  const targetW = Math.min(w, Math.round(cellW * 0.82));
  const targetH = Math.min(h, Math.round(cellH * 0.94));
  let sx = Math.round(cx - targetW / 2);
  let sy = Math.round(cy - targetH * headBias);
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
      const override = PORTRAIT_OVERRIDES[skinId];
      const cellSrc = override ? path.join(ROOT, override.file) : src;
      const cellLeft = override?.left ?? left;
      const cellTop = override?.top ?? top;
      const cellRight = override?.right ?? right;
      const cellBottom = override?.bottom ?? bottom;
      const png = await portraitFromCell(
        cellSrc,
        cellLeft,
        cellTop,
        cellRight,
        cellBottom,
        override?.headBias,
      );
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
