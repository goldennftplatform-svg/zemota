/**
 * Spotlight art pack — rasterize crisp SVG/pixel sprites for hunt, vista, boot,
 * and punch up the existing ezra-wagon sheet (Blender MCP hand-off substitute).
 *
 * Run: node scripts/spotlight-art.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const art = path.join(root, "public", "art");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function svgToPng(svg, outPath, width) {
  const buf = Buffer.from(svg);
  await sharp(buf, { density: 144 })
    .resize(width, null, { kernel: sharp.kernel.nearest, fit: "inside" })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log("wrote", path.relative(root, outPath));
}

const bison = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 56" shape-rendering="crispEdges">
  <ellipse cx="48" cy="50" rx="34" ry="5" fill="#0a0804" opacity="0.4"/>
  <rect x="20" y="38" width="8" height="12" fill="#2a1a0c"/><rect x="34" y="38" width="8" height="12" fill="#2a1a0c"/>
  <rect x="52" y="38" width="8" height="12" fill="#2a1a0c"/><rect x="66" y="38" width="8" height="12" fill="#2a1a0c"/>
  <rect x="12" y="20" width="68" height="22" fill="#6b4423"/><rect x="16" y="14" width="56" height="10" fill="#8a5a34"/>
  <rect x="24" y="6" width="28" height="12" fill="#5c3820"/><rect x="28" y="2" width="18" height="8" fill="#7a5030"/>
  <rect x="70" y="18" width="18" height="16" fill="#5c3820"/><rect x="84" y="22" width="8" height="8" fill="#3d2818"/>
  <rect x="74" y="10" width="5" height="10" fill="#d4c090"/><rect x="82" y="12" width="5" height="8" fill="#d4c090"/>
  <rect x="76" y="22" width="4" height="4" fill="#1a1008"/><rect x="6" y="24" width="8" height="5" fill="#4a3018"/>
</svg>`;

const bear = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 56" shape-rendering="crispEdges">
  <ellipse cx="40" cy="50" rx="28" ry="5" fill="#0a0804" opacity="0.4"/>
  <rect x="18" y="36" width="9" height="14" fill="#2a1c10"/><rect x="36" y="36" width="9" height="14" fill="#2a1c10"/>
  <rect x="50" y="36" width="9" height="14" fill="#2a1c10"/><rect x="12" y="18" width="52" height="24" fill="#5a3c22"/>
  <rect x="16" y="12" width="40" height="10" fill="#6b4a2c"/><rect x="56" y="16" width="18" height="16" fill="#4a3018"/>
  <rect x="68" y="22" width="8" height="6" fill="#3a2410"/><rect x="22" y="8" width="8" height="8" fill="#4a3018"/>
  <rect x="42" y="8" width="8" height="8" fill="#4a3018"/><rect x="62" y="20" width="4" height="4" fill="#1a1008"/>
  <rect x="4" y="26" width="10" height="6" fill="#3a2410"/>
</svg>`;

const deer = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 56" shape-rendering="crispEdges">
  <ellipse cx="36" cy="50" rx="24" ry="4" fill="#0a0804" opacity="0.35"/>
  <rect x="16" y="36" width="6" height="14" fill="#3a2818"/><rect x="28" y="36" width="6" height="14" fill="#3a2818"/>
  <rect x="40" y="36" width="6" height="14" fill="#3a2818"/><rect x="50" y="36" width="6" height="14" fill="#3a2818"/>
  <rect x="14" y="22" width="40" height="16" fill="#a87840"/><rect x="18" y="16" width="30" height="10" fill="#b88850"/>
  <rect x="48" y="14" width="14" height="14" fill="#986830"/><rect x="58" y="18" width="8" height="6" fill="#7a5028"/>
  <rect x="52" y="4" width="3" height="12" fill="#d4c090"/><rect x="58" y="2" width="3" height="14" fill="#d4c090"/>
  <rect x="52" y="18" width="3" height="3" fill="#1a1008"/><rect x="8" y="24" width="8" height="4" fill="#8a6030"/>
</svg>`;

const rabbit = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 40" shape-rendering="crispEdges">
  <ellipse cx="24" cy="36" rx="14" ry="3" fill="#0a0804" opacity="0.35"/>
  <rect x="12" y="28" width="5" height="8" fill="#6a5848"/><rect x="26" y="28" width="5" height="8" fill="#6a5848"/>
  <rect x="10" y="16" width="26" height="16" fill="#c8b090"/><rect x="14" y="10" width="18" height="10" fill="#d4c0a0"/>
  <rect x="30" y="12" width="12" height="10" fill="#b8a080"/><rect x="18" y="2" width="5" height="12" fill="#c8b090"/>
  <rect x="26" y="0" width="5" height="14" fill="#c8b090"/><rect x="34" y="14" width="3" height="3" fill="#1a1008"/>
  <rect x="4" y="20" width="8" height="4" fill="#a89070"/>
</svg>`;

const hunter = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" shape-rendering="crispEdges">
  <ellipse cx="24" cy="52" rx="14" ry="4" fill="#0a0804" opacity="0.4"/>
  <rect x="14" y="26" width="20" height="22" fill="#2a5a38"/>
  <rect x="16" y="28" width="16" height="4" fill="#1fb855"/>
  <rect x="12" y="14" width="24" height="14" fill="#3d2818"/>
  <rect x="16" y="8" width="16" height="10" fill="#5a3c22"/>
  <rect x="18" y="4" width="12" height="6" fill="#3d2818"/>
  <rect x="20" y="16" width="8" height="8" fill="#e8c8a0"/>
  <rect x="34" y="22" width="12" height="4" fill="#8a7a60"/>
  <rect x="42" y="20" width="4" height="8" fill="#5a5040"/>
  <rect x="16" y="46" width="6" height="6" fill="#2a1c10"/>
  <rect x="26" y="46" width="6" height="6" fill="#2a1c10"/>
</svg>`;

const vistaWagon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 64" shape-rendering="crispEdges">
  <ellipse cx="48" cy="56" rx="38" ry="6" fill="#0a0804" opacity="0.4"/>
  <rect x="18" y="28" width="60" height="22" fill="#6b4423"/>
  <rect x="20" y="30" width="56" height="4" fill="#8a5a34"/>
  <rect x="28" y="12" width="40" height="20" fill="#e8dcc4"/>
  <rect x="30" y="14" width="36" height="16" fill="#f0e6d0"/>
  <rect x="32" y="16" width="8" height="12" fill="#d4c8b0"/>
  <rect x="44" y="16" width="8" height="12" fill="#d4c8b0"/>
  <rect x="56" y="16" width="8" height="12" fill="#d4c8b0"/>
  <rect x="14" y="34" width="8" height="8" fill="#3d2818"/>
  <rect x="74" y="34" width="8" height="8" fill="#3d2818"/>
  <rect x="16" y="48" width="12" height="10" fill="#2a1c10" rx="0"/>
  <rect x="68" y="48" width="12" height="10" fill="#2a1c10"/>
  <rect x="18" y="50" width="8" height="6" fill="#4a3820"/>
  <rect x="70" y="50" width="8" height="6" fill="#4a3820"/>
  <rect x="42" y="8" width="12" height="6" fill="#5c3820"/>
</svg>`;

/** Phosphor EMOTA wordmark — CRT title card, not Inter/system. */
const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8fffaa"/>
      <stop offset="55%" stop-color="#39ff7a"/>
      <stop offset="100%" stop-color="#1fb855"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="16" y="16" width="608" height="128" rx="8" fill="#0a2418" stroke="#1fb855" stroke-width="3" opacity="0.92"/>
  <text x="320" y="102" text-anchor="middle" font-family="Courier New, Consolas, monospace" font-size="78" font-weight="700" letter-spacing="10" fill="url(#g)" filter="url(#glow)">EMOTA</text>
  <text x="320" y="128" text-anchor="middle" font-family="Courier New, Consolas, monospace" font-size="14" letter-spacing="4" fill="#8fffaa" opacity="0.85">EZRA MEEKER · OREGON TRAIL</text>
</svg>`;

async function enhanceWagonSheet() {
  const src = path.join(art, "sprites", "ezra-wagon.png");
  const bak = path.join(art, "sprites", "ezra-wagon.pre-spotlight.png");
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(src, bak);
    console.log("backup", path.relative(root, bak));
  }
  const meta = await sharp(src).metadata();
  await sharp(src)
    .modulate({ saturation: 1.25, brightness: 1.06 })
    .linear(1.12, -8)
    .sharpen({ sigma: 0.8 })
    .png()
    .toFile(src + ".tmp");
  fs.renameSync(src + ".tmp", src);
  console.log("enhanced wagon sheet", meta.width, "x", meta.height);
}

async function main() {
  const huntDir = path.join(art, "hunt");
  const vistaDir = path.join(art, "sprites", "vista");
  ensureDir(huntDir);
  ensureDir(vistaDir);

  await enhanceWagonSheet();

  await svgToPng(bison, path.join(huntDir, "bison.png"), 192);
  await svgToPng(bear, path.join(huntDir, "bear.png"), 160);
  await svgToPng(deer, path.join(huntDir, "deer.png"), 144);
  await svgToPng(rabbit, path.join(huntDir, "rabbit.png"), 96);
  await svgToPng(hunter, path.join(huntDir, "hunter.png"), 96);
  await svgToPng(vistaWagon, path.join(vistaDir, "wagon-top.png"), 192);
  await svgToPng(wordmark, path.join(art, "emota-wordmark.png"), 640);

  // Keep SVG sources as crisp fallbacks too (overwrite with richer versions)
  fs.writeFileSync(path.join(huntDir, "bison.svg"), bison);
  fs.writeFileSync(path.join(huntDir, "bear.svg"), bear);
  fs.writeFileSync(path.join(huntDir, "deer.svg"), deer);
  fs.writeFileSync(path.join(huntDir, "rabbit.svg"), rabbit);
  console.log("updated hunt SVG sources");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
