/**
 * Top-down “block art” sprites for the hunt minigame — chunky cells with outlines,
 * on-brand with the cabin build studs (no external image assets).
 */

import type { AnimalKind } from "../game/huntZones";

const OUTLINE = "rgba(12,10,8,0.92)";

/** Bird’s-eye silhouettes; wider axis = head / bulk toward +X (mirrored when facing < 0). */
const PATTERNS: Record<AnimalKind, string[]> = {
  bison: [
    "      DDD      ",
    "     BBBBB     ",
    "    BBBBBBB    ",
    "   BBBBBBBBB   ",
    "   BBBBBBBBB   ",
    "    BBBBBBB    ",
    "     BBBBB     ",
    "      BBB      ",
  ],
  bear: [
    "      BBB      ",
    "    BBBBBBB    ",
    "   BBBBBBBBB   ",
    "  BBBBBBBSSS   ",
    "   BBBBBBBBB   ",
    "    BBBBBBB    ",
    "      BBB      ",
  ],
  deer: [
    "      A A      ",
    "     AAAAA     ",
    "      DDD      ",
    "     DDDDD     ",
    "    DDDDDDD    ",
    "    DDDDDDD    ",
    "     DDDDD     ",
    "      DDD      ",
  ],
  rabbit: [
    "      E E      ",
    "     E   E     ",
    "    RRRRRRR    ",
    "   RRRRRRRRR   ",
    "    RRRRRRR    ",
    "     RRRRR     ",
  ],
};

const DEAD_BLOT = [
  "    ggg    ",
  "   ggggg   ",
  "  ggggggg  ",
  " ggggggggg ",
  "  ggggggg  ",
  "   ggggg   ",
  "    ggg    ",
];

const PALETTES: Record<AnimalKind, Record<string, string>> = {
  bison: {
    B: "#5c4030",
    D: "#3d2a1a",
  },
  bear: {
    B: "#2a1e18",
    S: "#3d3228",
  },
  deer: {
    D: "#6e5428",
    A: "#c8b898",
  },
  rabbit: {
    R: "#5a5854",
    E: "#6e6c66",
  },
};

/** Keep each stud readable on a 320×240 hunt canvas (sub-pixel cells disappear). */
const MIN_BLOCK_PX = 2.35;

function patternSolid(pattern: string[], rows: number, cols: number, r: number, c: number): boolean {
  if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
  const code = pattern[r]![c]!;
  return code !== " " && code !== ".";
}

/** Pixel-art style: filled studs + one clean outer silhouette (no per-tile box noise). */
function drawPattern(
  ctx: CanvasRenderingContext2D,
  pattern: string[],
  palette: Record<string, string>,
  x: number,
  y: number,
  bw: number,
  bh: number,
  facing: 1 | -1,
): void {
  const rows = pattern.length;
  const cols = pattern[0]?.length ?? 0;
  if (!cols || !rows) return;
  let cw = bw / cols;
  let ch = bh / rows;
  const scale = Math.max(1, MIN_BLOCK_PX / Math.min(cw, ch));
  cw *= scale;
  ch *= scale;
  const drawW = cw * cols;
  const drawH = ch * rows;
  const ox = x + (bw - drawW) * 0.5;
  const oy = y + (bh - drawH) * 0.5;
  const inset = 0.5;

  for (let r = 0; r < rows; r++) {
    const line = pattern[r]!;
    for (let c = 0; c < cols; c++) {
      const chCode = line[c]!;
      if (chCode === " " || chCode === ".") continue;
      const fill = palette[chCode];
      if (!fill) continue;
      const mc = facing >= 0 ? c : cols - 1 - c;
      const px = ox + mc * cw;
      const py = oy + r * ch;
      ctx.fillStyle = fill;
      ctx.fillRect(px + inset, py + inset, cw - inset * 2, ch - inset * 2);
    }
  }

  ctx.beginPath();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!patternSolid(pattern, rows, cols, r, c)) continue;
      const mc = facing >= 0 ? c : cols - 1 - c;
      const x0 = ox + mc * cw + inset;
      const y0 = oy + r * ch + inset;
      const w0 = cw - inset * 2;
      const h0 = ch - inset * 2;
      const t = y0 + 0.5;
      const b = y0 + h0 - 0.5;
      const l = x0 + 0.5;
      const rr = x0 + w0 - 0.5;
      if (!patternSolid(pattern, rows, cols, r - 1, c)) {
        ctx.moveTo(l, t);
        ctx.lineTo(rr, t);
      }
      if (!patternSolid(pattern, rows, cols, r + 1, c)) {
        ctx.moveTo(l, b);
        ctx.lineTo(rr, b);
      }
      if (!patternSolid(pattern, rows, cols, r, c - 1)) {
        ctx.moveTo(l, t);
        ctx.lineTo(l, b);
      }
      if (!patternSolid(pattern, rows, cols, r, c + 1)) {
        ctx.moveTo(rr, t);
        ctx.lineTo(rr, b);
      }
    }
  }
  ctx.stroke();
}

/** Darken a #rrggbb color for fallen game. */
function fallenTint(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#3a3634";
  const n = parseInt(m[1]!, 16);
  const r = Math.floor(((n >> 16) & 0xff) * 0.45);
  const g = Math.floor(((n >> 8) & 0xff) * 0.42);
  const b = Math.floor((n & 0xff) * 0.4);
  return `rgb(${r},${g},${b})`;
}

export function drawTopDownBlockAnimal(
  ctx: CanvasRenderingContext2D,
  kind: AnimalKind,
  alive: boolean,
  x: number,
  y: number,
  w: number,
  h: number,
  facing: 1 | -1,
  bodyTint: string,
): void {
  if (!alive) {
    drawPattern(ctx, DEAD_BLOT, { g: fallenTint(bodyTint) }, x, y, w, h, facing);
    return;
  }
  const pattern = PATTERNS[kind];
  const base = PALETTES[kind];
  const palette =
    kind === "bison"
      ? { ...base, B: blendToward(base.B!, bodyTint, 0.22), D: blendToward(base.D!, bodyTint, 0.18) }
      : kind === "bear"
        ? { ...base, B: blendToward(base.B!, bodyTint, 0.2), S: blendToward(base.S!, bodyTint, 0.15) }
        : kind === "deer"
          ? { ...base, D: blendToward(base.D!, bodyTint, 0.25), A: base.A! }
          : { ...base, R: blendToward(base.R!, bodyTint, 0.2), E: blendToward(base.E!, bodyTint, 0.15) };

  drawPattern(ctx, pattern, palette, x, y, w, h, facing);
}

function blendToward(hex: string, targetHex: string, t: number): string {
  const a = parseHex(hex);
  const b = parseHex(targetHex);
  if (!a || !b) return hex;
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
