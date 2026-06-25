import sharp from "sharp";

function isFg(r, g, b, a) {
  return a > 20 && !(r < 28 && g < 28 && b < 28);
}

async function colCenters(file, y0, y1) {
  const { data, info } = await sharp(`public/art/sprites/party-skins/${file}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const colScore = new Array(w).fill(0);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isFg(data[i], data[i + 1], data[i + 2], data[i + 3])) colScore[x]++;
    }
  }
  const peaks = [];
  for (let x = 3; x < w - 3; x++) {
    if (colScore[x] < 8) continue;
    if (colScore[x] >= colScore[x - 1] && colScore[x] >= colScore[x + 1]) {
      if (!peaks.length || x - peaks[peaks.length - 1] > 35) peaks.push(x);
      else peaks[peaks.length - 1] = Math.round((peaks[peaks.length - 1] + x) / 2);
    }
  }
  const bounds = [];
  for (let c = 0; c < peaks.length; c++) {
    const left = c === 0 ? 0 : Math.round((peaks[c - 1] + peaks[c]) / 2);
    const right = c === peaks.length - 1 ? w : Math.round((peaks[c] + peaks[c + 1]) / 2);
    bounds.push([left, right]);
  }
  console.log(file, "cols", peaks.length, peaks, bounds);
}

await colCenters("set-1.png", 250, 400);
await colCenters("set-2.png", 250, 400);
await colCenters("set-3.png", 300, 450);
