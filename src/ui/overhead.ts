/**
 * EMOTA overhead minis — build mode: toy grid / fence posts.
 * Hunt mode: top-down open range (early-GTA-style field, wagon hunter, roaming game).
 */

import type { AnimalKind, HuntSessionOptions, HuntZoneId } from "../game/huntZones";
import { meatLbForKind, pickAnimalKind } from "../game/huntZones";
import { drawTopDownBlockAnimal } from "./huntAnimalBlocks";

export type OverheadMode = "hunt" | "build" | null;

const TILE = 16;
const COLS = 20;
const ROWS = 15;
const W = COLS * TILE;
const H = ROWS * TILE;
const SKY_ROWS = 2;
const SKY_H = SKY_ROWS * TILE;

/** Top-down hunt: field + bottom hunter strip */
const FIELD_TOP = 50;
const FIELD_BOTTOM = H - 40;
const AIM_X_MIN = 18;
const AIM_X_MAX = W - 18;
const AIM_Y_MIN = FIELD_TOP + 6;
const AIM_Y_MAX = FIELD_BOTTOM - 10;

/** On-canvas touch targets (canvas pixel coords, 320×240). Nudge sits left of field; FIRE bottom-right — no overlap. */
const FIRE_BTN = { x: W - 92, y: H - 40, w: 86, h: 36 };
const NUDGE = { size: 32, cx: 96, cy: H - 82 };

function hitFireBtn(mx: number, my: number): boolean {
  return mx >= FIRE_BTN.x && mx <= FIRE_BTN.x + FIRE_BTN.w && my >= FIRE_BTN.y && my <= FIRE_BTN.y + FIRE_BTN.h;
}

/** Cross layout: up / left · down / right — bottom-left for thumbs. */
function hitNudgePad(mx: number, my: number): "up" | "down" | "left" | "right" | null {
  const s = NUDGE.size;
  const half = s / 2;
  const { cx, cy } = NUDGE;
  if (mx >= cx - half && mx <= cx + half && my >= cy - s - 8 && my <= cy - s - 8 + s) return "up";
  if (mx >= cx - s - 10 && mx <= cx - 10 && my >= cy - half && my <= cy + half) return "left";
  if (mx >= cx + 10 && mx <= cx + s + 10 && my >= cy - half && my <= cy + half) return "right";
  if (mx >= cx - half && mx <= cx + half && my >= cy + 8 && my <= cy + 8 + s) return "down";
  return null;
}

function drawTouchControls(ctx: CanvasRenderingContext2D): void {
  const s = NUDGE.size;
  const half = s / 2;
  const { cx, cy } = NUDGE;
  ctx.save();
  ctx.strokeStyle = "#00aa44";
  ctx.fillStyle = "rgba(0,40,20,0.85)";
  const drawPad = (px: number, py: number, label: string) => {
    roundRect(ctx, px, py, s, s, 4);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#aaffcc";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, px + s / 2, py + s / 2);
  };
  drawPad(cx - half, cy - s - 8, "↑");
  drawPad(cx - s - 10, cy - half, "←");
  drawPad(cx + 10, cy - half, "→");
  drawPad(cx - half, cy + 8, "↓");

  roundRect(ctx, FIRE_BTN.x, FIRE_BTN.y, FIRE_BTN.w, FIRE_BTN.h, 6);
  ctx.fillStyle = "rgba(0,90,40,0.92)";
  ctx.fill();
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#eeffee";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FIRE", FIRE_BTN.x + FIRE_BTN.w / 2, FIRE_BTN.y + FIRE_BTN.h / 2);
  ctx.restore();
}

interface HuntAnimal {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: AnimalKind;
  alive: boolean;
  vx: number;
  vy: number;
  facing: 1 | -1;
  /** Gait bob for drawing */
  walkPhase: number;
  /** Frames since spawn / re-entry — used for fade-in */
  spawnAge: number;
}

interface HuntState {
  aimX: number;
  aimY: number;
  animals: HuntAnimal[];
  /** Sparse sage / brush — circles for hit-test */
  clumps: { x: number; y: number; r: number }[];
  meatLb: number;
  shotsFired: number;
  maxShots: number;
  maxCarryLb: number;
  zoneId: HuntZoneId;
  zoneLabel: string;
  depletion: number;
  done: boolean;
  frame: number;
  hitFlash: number;
}

interface BuildState {
  px: number;
  py: number;
  posts: boolean[];
  swings: number;
  done: boolean;
}

/** Classic “noob” + plastic palette (build mode) */
const RBX = {
  outline: "#1e1e1e",
  skyTop: "#7ec8ff",
  skyBot: "#4aa9e8",
  grassA: "#3bb85c",
  grassB: "#329a4e",
  studHi: "#5fe078",
  studSh: "#2d7a40",
  torso: "#2c6bff",
  head: "#f5cd4c",
  skin: "#ffdd99",
  hammer: "#c9a86c",
  postWood: "#8b5a2b",
  postWoodHi: "#a67c52",
  postDone: "#5c3d1e",
  shadow: "rgba(0,0,0,0.35)",
  ui: "#ffffff",
} as const;

const PRAIRIE = {
  hunterCoat: "#a82a22",
  hunterPants: "#4a3520",
  hunterHat: "#e8e4dc",
  rifle: "#c8c4bc",
  rifleStock: "#3d3028",
  bison: "#4a3220",
  bear: "#1e1410",
  deer: "#7a5c28",
  rabbit: "#5a5854",
} as const;

function prairieGroundColors(zone: HuntZoneId): { near: string; far: string; deep: string } {
  switch (zone) {
    case "plains":
      return { near: "#7a8c52", far: "#5a6c3a", deep: "#3a4a28" };
    case "forest":
      return { near: "#4a5c3a", far: "#3a4a30", deep: "#2a3228" };
    case "mountains":
      return { near: "#5a5c48", far: "#3a3c38", deep: "#2a2c28" };
    default:
      return { near: "#6a7c4a", far: "#4a5c38", deep: "#3a4a2a" };
  }
}

function sizeForKind(k: AnimalKind): { w: number; h: number } {
  switch (k) {
    case "bison":
      return { w: 50, h: 32 };
    case "bear":
      return { w: 44, h: 30 };
    case "deer":
      return { w: 36, h: 24 };
    default:
      /* Wide pattern (15 cols) needs enough pixels per block or art vanishes when scaled. */
      return { w: 36, h: 22 };
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawPart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  radius = 3,
): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = RBX.outline;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  roundRect(ctx, x + 1.5, y + 1.5, w - 3, Math.max(2, h * 0.35), radius * 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawStudCell(ctx: CanvasRenderingContext2D, gx: number, gy: number, alt: boolean): void {
  const x = gx * TILE;
  const y = SKY_H + gy * TILE;
  const base = alt ? RBX.grassA : RBX.grassB;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, TILE, TILE);
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 0.5, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = RBX.studSh;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy - 1.2, 3, 2.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = RBX.studHi;
  ctx.fill();
}

function drawSky(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, SKY_H);
  g.addColorStop(0, RBX.skyTop);
  g.addColorStop(1, RBX.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, SKY_H);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  for (let i = 0; i < 5; i++) {
    const cx = (i * 67 + 20) % (W - 20);
    const cy = 6 + (i % 3) * 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 2 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
}

function gridToPixel(gx: number, gy: number): { x: number; y: number } {
  return { x: gx * TILE, y: SKY_H + gy * TILE };
}

function drawGroundShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rw: number, rh: number): void {
  ctx.save();
  ctx.fillStyle = RBX.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRbxAvatar(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  bob: number,
  holdHammer: boolean,
): void {
  const { x, y } = gridToPixel(gx, gy);
  const ox = x + TILE / 2;
  const oy = y + TILE / 2 + bob;
  drawGroundShadow(ctx, ox, oy + 5, 6, 3);

  const bw = 11;
  const bh = 9;
  const bx = ox - bw / 2;
  const by = oy - 2;
  drawPart(ctx, bx, by, bw, bh, RBX.torso, 2);
  const hw = 9;
  const hh = 8;
  const hx = ox - hw / 2;
  const hy = by - hh + 3;
  drawPart(ctx, hx, hy, hw, hh, RBX.head, 3);
  ctx.fillStyle = RBX.skin;
  ctx.beginPath();
  ctx.arc(ox, hy + 4.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = RBX.outline;
  ctx.stroke();

  if (holdHammer) {
    const hx0 = ox + 4;
    const hy0 = by + 1;
    drawPart(ctx, hx0, hy0, 3, 10, RBX.hammer, 1);
  }
}

function drawFencePost(ctx: CanvasRenderingContext2D, gx: number, gy: number, done: boolean, bob: number): void {
  const { x, y } = gridToPixel(gx, gy);
  const ox = x + TILE / 2;
  const oy = y + TILE / 2 + bob;
  drawGroundShadow(ctx, ox, oy + 6, 4, 2);
  const w = 8;
  const h = 14;
  const px = ox - w / 2;
  const py = oy - h / 2;
  const fill = done ? RBX.postDone : RBX.postWood;
  drawPart(ctx, px, py, w, h, fill, 2);
  ctx.fillStyle = done ? "rgba(0,0,0,0.2)" : RBX.postWoodHi;
  ctx.fillRect(px + 2, py + 2, 3, h - 5);
}

function drawHud(ctx: CanvasRenderingContext2D, lines: string[], topY: number): void {
  ctx.save();
  ctx.font = "bold 11px monospace";
  ctx.textBaseline = "top";
  const pad = 4;
  const filtered = lines.filter(Boolean);
  let maxW = 0;
  for (const ln of filtered) {
    maxW = Math.max(maxW, ctx.measureText(ln).width);
  }
  const boxW = Math.min(W - 8, maxW + pad * 2);
  const boxH = filtered.length * 12 + pad * 2;
  roundRect(ctx, 4, topY, boxW, boxH, 3);
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#00aa44";
  ctx.stroke();
  ctx.fillStyle = RBX.ui;
  let ly = topY + pad;
  for (const ln of filtered) {
    ctx.fillStyle = "#aaffcc";
    ctx.fillText(ln, 4 + pad, ly);
    ly += 12;
  }
  ctx.restore();
}

// —— Top-down hunt (field + sprites from above) ——

/** Deterministic 0..1 — stable stud scatter per clump. */
function huntHash(ix: number, iy: number, salt: number): number {
  let n = ix * 374761393 + iy * 668265263 + salt * 1442695041;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n >>> 0) % 0x1_00_00) / 0x1_00_00;
}

/**
 * Cover reads as a pile of discrete studs / pixel brush — not a solid blob.
 * Hit testing still uses the clump’s circular radius elsewhere.
 */
function drawStudBrushClump(
  ctx: CanvasRenderingContext2D,
  c: { x: number; y: number; r: number },
  clumpIndex: number,
): void {
  const CELL = 3;
  const GAP = 1;
  const brick = CELL - GAP;
  const R = c.r;
  const cx0 = Math.round(c.x);
  const cy0 = Math.round(c.y);
  const salt = clumpIndex * 1103515245 + cx0 * 49297 + cy0 * 9301;
  const span = Math.ceil(R / CELL) + 2;

  for (let iy = -span; iy <= span; iy++) {
    for (let ix = -span; ix <= span; ix++) {
      const fx = ix * CELL;
      const fy = iy * CELL * 0.92;
      if (fx * fx + fy * fy > R * R) continue;
      const h = huntHash(ix, iy, salt);
      if (h < 0.2) continue;
      const px = cx0 + fx - CELL * 0.5;
      const py = cy0 + fy - CELL * 0.5;
      const pxR = Math.round(px);
      const pyR = Math.round(py);
      const top = h < 0.62;
      ctx.fillStyle = top ? "rgba(54,64,44,0.92)" : "rgba(34,42,30,0.94)";
      ctx.fillRect(pxR, pyR, brick, brick);
    }
  }
}

function colorForKind(k: AnimalKind): string {
  switch (k) {
    case "bison":
      return PRAIRIE.bison;
    case "bear":
      return PRAIRIE.bear;
    case "deer":
      return PRAIRIE.deer;
    default:
      return PRAIRIE.rabbit;
  }
}

function drawTopDownField(ctx: CanvasRenderingContext2D, hunt: HuntState, _t: number): void {
  const p = prairieGroundColors(hunt.zoneId);
  const g = ctx.createLinearGradient(0, FIELD_TOP, 0, H);
  g.addColorStop(0, p.near);
  g.addColorStop(0.55, p.far);
  g.addColorStop(1, p.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(0,48,28,0.07)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 28) {
    ctx.beginPath();
    ctx.moveTo(gx, FIELD_TOP);
    ctx.lineTo(gx, FIELD_BOTTOM);
    ctx.stroke();
  }
  for (let gy = FIELD_TOP; gy < FIELD_BOTTOM; gy += 28) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }

  /* Static 2×2 grass studs — no scrolling shimmer */
  ctx.fillStyle = "rgba(22,42,28,0.22)";
  for (let i = 0; i < 52; i++) {
    const x = (i * 97 + 19) % (W - 2);
    const y = FIELD_TOP + ((i * 59 + 7) % (FIELD_BOTTOM - FIELD_TOP - 6));
    ctx.fillRect(x, y, 2, 2);
  }

  hunt.clumps.forEach((c, i) => {
    ctx.save();
    drawStudBrushClump(ctx, c, i);
    ctx.restore();
  });

  ctx.strokeStyle = "#00aa44";
  ctx.lineWidth = 2;
  ctx.strokeRect(3, FIELD_TOP, W - 6, FIELD_BOTTOM - FIELD_TOP);
}

function drawTdHunter(ctx: CanvasRenderingContext2D): void {
  const cx = W / 2;
  const cy = H - 22;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PRAIRIE.hunterCoat;
  ctx.fillRect(cx - 10, cy - 10, 20, 22);
  ctx.fillStyle = PRAIRIE.hunterHat;
  ctx.fillRect(cx - 8, cy - 17, 16, 9);
  ctx.fillStyle = "#e8c8a0";
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1fb855";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 10, cy - 10, 20, 22);
  ctx.fillStyle = PRAIRIE.rifle;
  ctx.fillRect(cx + 8, cy - 2, 18, 4);
  ctx.restore();
}

function drawTdAnimal(ctx: CanvasRenderingContext2D, a: HuntAnimal): void {
  const col = colorForKind(a.kind);
  const { x, y: y0, w, h } = a;
  const bob = a.alive ? Math.sin(a.walkPhase) * 1.2 : 0;
  const y = y0 + bob;
  ctx.save();
  drawTopDownBlockAnimal(ctx, a.kind, a.alive, x, y, w, h, a.facing, col);
  ctx.restore();
}

function drawOgCrosshair(ctx: CanvasRenderingContext2D, ax: number, ay: number, flash: number): void {
  const s = 14;
  ctx.save();
  ctx.strokeStyle = flash > 0 ? "#ff4444" : "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax - s, ay);
  ctx.lineTo(ax - 4, ay);
  ctx.moveTo(ax + 4, ay);
  ctx.lineTo(ax + s, ay);
  ctx.moveTo(ax, ay - s);
  ctx.lineTo(ax, ay - 4);
  ctx.moveTo(ax, ay + 4);
  ctx.lineTo(ax, ay + s);
  ctx.stroke();
  ctx.strokeRect(ax - 3, ay - 3, 6, 6);
  ctx.restore();
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleHitsPoint(cx: number, cy: number, r: number, px: number, py: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function circleOverlapsRect(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

function pickSpawnTopDown(
  w: number,
  h: number,
  animals: HuntAnimal[],
  clumps: { x: number; y: number; r: number }[],
): { x: number; y: number; vx: number; vy: number } | null {
  const tries = 55;
  const minX = 10;
  const maxX = W - w - 10;
  const minY = FIELD_TOP + 4;
  const maxY = FIELD_BOTTOM - h - 6;
  if (maxY <= minY) return null;
  for (let t = 0; t < tries; t++) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    const vx = (Math.random() - 0.5) * 1.5;
    const vy = (Math.random() - 0.5) * 1.1;
    let bad = false;
    for (const o of animals) {
      if (overlaps(x, y, w, h, o.x, o.y, o.w, o.h)) bad = true;
    }
    for (const c of clumps) {
      if (circleOverlapsRect(c.x, c.y, c.r, x, y, w, h)) bad = true;
    }
    if (!bad) return { x, y, vx, vy };
  }
  return null;
}

function buildHuntState(opts: HuntSessionOptions): HuntState {
  const clumps: { x: number; y: number; r: number }[] = [];
  const nClump = 4 + Math.floor(Math.random() * 4) + Math.floor(opts.depletion * 2);
  for (let i = 0; i < nClump; i++) {
    const r = 8 + Math.floor(Math.random() * 11);
    clumps.push({
      x: 40 + Math.random() * (W - 80),
      y: FIELD_TOP + r + 8 + Math.random() * (FIELD_BOTTOM - FIELD_TOP - 2 * r - 24),
      r,
    });
  }

  const animals: HuntAnimal[] = [];
  const baseCount = 6 + Math.floor(Math.random() * 4);
  const count = Math.max(4, Math.min(11, Math.round(baseCount - opts.depletion * 2.5)));
  for (let slot = 0; slot < count; slot++) {
    const kind = pickAnimalKind(opts.zoneId, () => Math.random());
    const { w, h } = sizeForKind(kind);
    const sp0 = pickSpawnTopDown(w, h, animals, clumps);
    const sp = sp0 ?? {
      x: 60 + Math.random() * (W - 80 - w),
      y: FIELD_TOP + 20 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 1.1,
      vy: (Math.random() - 0.5) * 0.9,
    };
    animals.push({
      x: sp.x,
      y: sp.y,
      w,
      h,
      kind,
      alive: true,
      vx: sp.vx,
      vy: sp.vy,
      facing: sp.vx >= 0 ? 1 : -1,
      walkPhase: Math.random() * Math.PI * 2,
      spawnAge: 0,
    });
  }

  return {
    aimX: W / 2,
    aimY: (FIELD_TOP + FIELD_BOTTOM) / 2,
    animals,
    clumps,
    meatLb: 0,
    shotsFired: 0,
    maxShots: Math.max(1, opts.maxShots),
    maxCarryLb: opts.maxCarryLb,
    zoneId: opts.zoneId,
    zoneLabel: opts.zoneLabel,
    depletion: opts.depletion,
    done: false,
    frame: 0,
    hitFlash: 0,
  };
}

function moveAnimalsTopDown(h: HuntState): void {
  const minX = 6;
  const maxX = W - 6;
  const minY = FIELD_TOP + 2;
  const maxY = FIELD_BOTTOM - 4;
  for (const a of h.animals) {
    if (!a.alive) continue;
    a.spawnAge = Math.min(80, a.spawnAge + 1);
    a.x += a.vx;
    a.y += a.vy;
    a.walkPhase += 0.14 + (Math.abs(a.vx) + Math.abs(a.vy)) * 0.06;
    a.facing = a.vx >= 0 ? 1 : -1;
    if (h.frame % 48 === 0 && Math.random() < 0.38) {
      a.vx += (Math.random() - 0.5) * 0.2;
      a.vy += (Math.random() - 0.5) * 0.18;
    }
    a.vx = Math.max(-1.4, Math.min(1.4, a.vx));
    a.vy = Math.max(-1.15, Math.min(1.15, a.vy));
    if (a.x < minX) {
      a.x = minX;
      a.vx *= -1;
    } else if (a.x + a.w > maxX) {
      a.x = maxX - a.w;
      a.vx *= -1;
    }
    if (a.y < minY) {
      a.y = minY;
      a.vy *= -1;
    } else if (a.y + a.h > maxY) {
      a.y = maxY - a.h;
      a.vy *= -1;
    }
  }
}

function drawHuntTopDown(ctx: CanvasRenderingContext2D, hunt: HuntState, t: number): void {
  ctx.imageSmoothingEnabled = false;
  drawTopDownField(ctx, hunt, t);
  const order = [...hunt.animals].sort((a, b) => a.y - b.y);
  for (const a of order) {
    drawTdAnimal(ctx, a);
  }
  drawTdHunter(ctx);
  drawOgCrosshair(ctx, hunt.aimX, hunt.aimY, hunt.hitFlash);
  const scarce = hunt.depletion > 0.55 ? " · scarce" : "";
  drawHud(ctx, [
    `HUNT  ${hunt.zoneLabel}${scarce}  ·  TOP-DOWN`,
    `MEAT ${hunt.meatLb}/${hunt.maxCarryLb} lb   SHOTS ${hunt.shotsFired}/${hunt.maxShots}`,
    `Aim · arrows · drag · pad + FIRE`,
  ], 4);
  drawTouchControls(ctx);
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  mode: "hunt" | "build",
  hunt: HuntState | null,
  build: BuildState | null,
  t: number,
): void {
  const bobPick = Math.sin(t * 5) * 1.2;
  const bobChar = Math.sin(t * 6 + 1) * 0.9;

  if (mode === "hunt" && hunt) {
    drawHuntTopDown(ctx, hunt, t);
    return;
  }

  ctx.clearRect(0, 0, W, H);
  drawSky(ctx);
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      drawStudCell(ctx, gx, gy, (gx + gy) % 2 === 0);
    }
  }

  if (mode === "build" && build) {
    const corners: [number, number][] = [
      [2, 2],
      [COLS - 3, 2],
      [2, ROWS - 3],
    ];
    corners.forEach(([cx, cy], i) => {
      drawFencePost(ctx, cx, cy, build.posts[i]!, bobPick * 0.6);
    });
    drawRbxAvatar(ctx, build.px, build.py, bobChar, true);
    const n = build.posts.filter(Boolean).length;
    drawHud(ctx, [`CABIN POSTS  ${n}/3`, `SPACE at each post  |  ARROWS`], SKY_H + 4);
  }
}

const POINTER_OPTS: AddEventListenerOptions = { passive: false };

export class OverheadMini {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: OverheadMode = null;
  private hunt: HuntState | null = null;
  private build: BuildState | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private pointerDownHandler = (e: PointerEvent) => this.onPointerDown(e);
  private pointerMoveHandler = (e: PointerEvent) => this.onPointerMove(e);
  private pointerUpHandler = (e: PointerEvent) => this.onPointerUp(e);
  /** Touch / pen: which pointer is dragging the crosshair */
  private aimDragPointerId: number | null = null;
  private t0 = 0;
  private raf = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("2d context");
    this.ctx = c;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
  }

  startHunt(opts: HuntSessionOptions, onDone: (food: number, ammoSpent: number) => void): void {
    this.mode = "hunt";
    this.t0 = performance.now();
    this.hunt = buildHuntState(opts);
    this.build = null;
    this.aimDragPointerId = null;
    this._onHuntDone = onDone;
    this.canvas.classList.add("overhead-canvas--hunt");
    window.addEventListener("keydown", this.keyHandler);
    this.canvas.addEventListener("pointerdown", this.pointerDownHandler, POINTER_OPTS);
    this.canvas.addEventListener("pointermove", this.pointerMoveHandler, POINTER_OPTS);
    this.canvas.addEventListener("pointerup", this.pointerUpHandler, POINTER_OPTS);
    this.canvas.addEventListener("pointercancel", this.pointerUpHandler, POINTER_OPTS);
    this.canvas.addEventListener("lostpointercapture", this.pointerUpHandler, POINTER_OPTS);
    this.startLoop();
  }

  startBuild(onDone: (quality: number) => void): void {
    this.mode = "build";
    this.t0 = performance.now();
    this.hunt = null;
    this.build = {
      px: Math.floor(COLS / 2),
      py: Math.floor(ROWS / 2),
      posts: [false, false, false],
      swings: 0,
      done: false,
    };
    this._onBuildDone = onDone;
    window.addEventListener("keydown", this.keyHandler);
    this.startLoop();
  }

  private _onHuntDone: (food: number, ammoSpent: number) => void = () => {};
  private _onBuildDone: (quality: number) => void = () => {};

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener("keydown", this.keyHandler);
    this.canvas.removeEventListener("pointerdown", this.pointerDownHandler, POINTER_OPTS);
    this.canvas.removeEventListener("pointermove", this.pointerMoveHandler, POINTER_OPTS);
    this.canvas.removeEventListener("pointerup", this.pointerUpHandler, POINTER_OPTS);
    this.canvas.removeEventListener("pointercancel", this.pointerUpHandler, POINTER_OPTS);
    this.canvas.removeEventListener("lostpointercapture", this.pointerUpHandler, POINTER_OPTS);
    this.canvas.classList.remove("overhead-canvas--hunt");
    this.aimDragPointerId = null;
    this.mode = null;
    this.hunt = null;
    this.build = null;
  }

  private canvasCoords(e: PointerEvent): { mx: number; my: number } {
    const rect = this.canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    return { mx, my };
  }

  private setAim(mx: number, my: number): void {
    if (!this.hunt || this.hunt.done) return;
    this.hunt.aimX = Math.max(AIM_X_MIN, Math.min(AIM_X_MAX, mx));
    this.hunt.aimY = Math.max(AIM_Y_MIN, Math.min(AIM_Y_MAX, my));
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.mode !== "hunt" || !this.hunt || this.hunt.done) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const { mx, my } = this.canvasCoords(e);

    if (hitFireBtn(mx, my)) {
      e.preventDefault();
      this.fire();
      return;
    }

    const dir = hitNudgePad(mx, my);
    if (dir) {
      e.preventDefault();
      const n = 14;
      if (dir === "up") this.setAim(this.hunt.aimX, this.hunt.aimY - n);
      if (dir === "down") this.setAim(this.hunt.aimX, this.hunt.aimY + n);
      if (dir === "left") this.setAim(this.hunt.aimX - n, this.hunt.aimY);
      if (dir === "right") this.setAim(this.hunt.aimX + n, this.hunt.aimY);
      return;
    }

    e.preventDefault();
    this.aimDragPointerId = e.pointerId;
    this.setAim(mx, my);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.mode !== "hunt" || !this.hunt || this.hunt.done) return;
    const { mx, my } = this.canvasCoords(e);

    if (e.pointerType === "mouse") {
      if (hitFireBtn(mx, my) || hitNudgePad(mx, my)) return;
      this.setAim(mx, my);
      return;
    }

    if (this.aimDragPointerId === e.pointerId) {
      e.preventDefault();
      if (hitFireBtn(mx, my) || hitNudgePad(mx, my)) return;
      this.setAim(mx, my);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.aimDragPointerId === e.pointerId) {
      this.aimDragPointerId = null;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (!this.mode) return;
      const t = (performance.now() - this.t0) / 1000;
      if (this.hunt && !this.hunt.done) {
        this.hunt.frame++;
        if (this.hunt.hitFlash > 0) this.hunt.hitFlash--;
        moveAnimalsTopDown(this.hunt);
      }
      drawWorld(this.ctx, this.mode as "hunt" | "build", this.hunt, this.build, t);
      if (!this.hunt?.done && !this.build?.done) {
        this.raf = requestAnimationFrame(tick);
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private finishHunt(): void {
    if (!this.hunt || this.hunt.done) return;
    const food = this.hunt.meatLb;
    const ammo = this.hunt.shotsFired;
    this.hunt.done = true;
    this.stop();
    this._onHuntDone(food, ammo);
  }

  private pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }

  private fire(): void {
    const h = this.hunt;
    if (!h || h.done) return;
    if (h.shotsFired >= h.maxShots) return;
    h.shotsFired += 1;
    const ax = h.aimX;
    const ay = h.aimY;

    for (const c of h.clumps) {
      if (circleHitsPoint(c.x, c.y, c.r, ax, ay)) {
        h.hitFlash = 10;
        if (h.shotsFired >= h.maxShots) this.finishHunt();
        return;
      }
    }

    let hit = false;
    for (const a of h.animals) {
      if (!a.alive) continue;
      if (this.pointInRect(ax, ay, a.x, a.y, a.w, a.h)) {
        const raw = meatLbForKind(a.kind);
        const room = Math.max(0, h.maxCarryLb - h.meatLb);
        h.meatLb += Math.min(room, raw);
        a.alive = false;
        a.vx = 0;
        a.vy = 0;
        hit = true;
        h.hitFlash = 5;
        break;
      }
    }
    if (!hit) h.hitFlash = 10;

    if (h.shotsFired >= h.maxShots) {
      this.finishHunt();
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (this.mode === "hunt" && this.hunt && !this.hunt.done) {
      const step = 6;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;
      if (dx || dy) {
        e.preventDefault();
        this.hunt.aimX = Math.max(AIM_X_MIN, Math.min(AIM_X_MAX, this.hunt.aimX + dx));
        this.hunt.aimY = Math.max(AIM_Y_MIN, Math.min(AIM_Y_MAX, this.hunt.aimY + dy));
      }
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        this.fire();
      }
    }

    if (this.mode === "build" && this.build && !this.build.done) {
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp") dy = -1;
      if (e.key === "ArrowDown") dy = 1;
      if (e.key === "ArrowLeft") dx = -1;
      if (e.key === "ArrowRight") dx = 1;
      if (dx || dy) {
        this.build.px = Math.max(0, Math.min(COLS - 1, this.build.px + dx));
        this.build.py = Math.max(0, Math.min(ROWS - 1, this.build.py + dy));
      }
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        this.build.swings++;
        const corners = [
          [2, 2],
          [COLS - 3, 2],
          [2, ROWS - 3],
        ];
        corners.forEach(([cx, cy], i) => {
          if (this.build!.px === cx && this.build!.py === cy) {
            this.build!.posts[i] = true;
          }
        });
        if (this.build.posts.every(Boolean) || this.build.swings > 24) {
          const q =
            this.build.posts.filter(Boolean).length / 3 -
            Math.min(0.3, this.build.swings * 0.01);
          const quality = Math.max(0.2, Math.min(1, q + 0.5));
          this.build.done = true;
          this.stop();
          this._onBuildDone(quality);
        }
      }
    }
  }
}
