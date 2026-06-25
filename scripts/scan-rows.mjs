import sharp from "sharp";

function isFg(r, g, b, a) {
  return a > 20 && !(r < 28 && g < 28 && b < 28);
}

async function rowBounds(file, y0, y1, w) {
  const { data, info } = await sharp(`public/art/sprites/party-skins/${file}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rowScore = new Array(info.height).fill(0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (isFg(data[i], data[i + 1], data[i + 2], data[i + 3])) rowScore[y]++;
    }
  }
  const peaks = [];
  for (let y = y0; y < y1; y++) {
    if (rowScore[y] < w * 0.12) continue;
    if (rowScore[y] >= rowScore[y - 1] && rowScore[y] >= rowScore[y + 1]) {
      if (!peaks.length || y - peaks[peaks.length - 1] > 45) peaks.push(y);
      else peaks[peaks.length - 1] = Math.round((peaks[peaks.length - 1] + y) / 2);
    }
  }
  const bounds = [];
  for (let r = 0; r < peaks.length; r++) {
    const top = r === 0 ? y0 : Math.round((peaks[r - 1] + peaks[r]) / 2);
    const bottom = r === peaks.length - 1 ? info.height : Math.round((peaks[r] + peaks[r + 1]) / 2);
    bounds.push([top, bottom]);
  }
  console.log(file, "rows", peaks, bounds);
}

await rowBounds("set-1.png", 230, 750, 1024);
await rowBounds("set-2.png", 230, 750, 1024);
await rowBounds("set-3.png", 250, 750, 1024);
