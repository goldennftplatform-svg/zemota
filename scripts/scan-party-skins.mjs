import sharp from "sharp";

async function scan(file) {
  const { data, info } = await sharp(`public/art/sprites/party-skins/${file}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const rowScore = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 20 && !(r < 28 && g < 28 && b < 28)) rowScore[y]++;
    }
  }
  console.log("\n" + file);
  let gapStart = -1;
  for (let y = 150; y < h - 100; y++) {
    let low = true;
    for (let k = 0; k < 12; k++) if (rowScore[y + k] > 30) low = false;
    if (low) {
      gapStart = y;
      break;
    }
  }
  let gapEnd = gapStart;
  for (let y = gapStart + 1; y < h; y++) {
    if (rowScore[y] > w * 0.12) {
      gapEnd = y;
      break;
    }
  }
  console.log("gap", gapStart, "chars start", gapEnd);
  const peaks = [];
  for (let y = gapEnd; y < h - 20; y++) {
    if (rowScore[y] > w * 0.15 && rowScore[y] >= rowScore[y - 1] && rowScore[y] >= rowScore[y + 1]) {
      if (!peaks.length || y - peaks[peaks.length - 1] > 50) peaks.push(y);
      else peaks[peaks.length - 1] = Math.round((peaks[peaks.length - 1] + y) / 2);
    }
  }
  console.log("row peaks", peaks);
  return { gapEnd, peaks, w, h };
}

for (const f of ["set-1.png", "set-2.png", "set-3.png"]) await scan(f);
