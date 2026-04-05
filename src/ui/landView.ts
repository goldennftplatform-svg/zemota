import { landmarkAtMiles, nextRiverAhead } from "../game/map";

const W = 640;
const H = 180;

export interface LandViewState {
  miles: number;
  day: number;
  phase: string;
  /** Set when `phase === "river"` and a crossing is active */
  activeRiverName: string | null;
}

function biomeAt(miles: number): string {
  if (miles < 220) return "east";
  if (miles < 520) return "prairie";
  if (miles < 720) return "bluffs";
  if (miles < 950) return "rockies";
  if (miles < 1360) return "desert";
  if (miles < 1540) return "snake";
  if (miles < 1620) return "pine";
  if (miles < 1920) return "columbia";
  return "willamette";
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function groundColor(biome: string): string {
  switch (biome) {
    case "east":
      return "#0a3220";
    case "prairie":
      return "#0d3a24";
    case "bluffs":
      return "#0f3a22";
    case "rockies":
      return "#082818";
    case "desert":
      return "#143018";
    case "snake":
      return "#062818";
    case "pine":
      return "#062a16";
    case "columbia":
      return "#082a1c";
    case "willamette":
      return "#083822";
    default:
      return "#0a3220";
  }
}

function riverMode(s: LandViewState): "none" | "approach" | "crossing" {
  if (s.phase === "river" && s.activeRiverName) return "crossing";
  const next = nextRiverAhead(s.miles);
  if (next && next.milesFromStart - s.miles > 0 && next.milesFromStart - s.miles < 58) {
    return "approach";
  }
  return "none";
}

export function landViewCaption(s: LandViewState): string {
  if (s.phase === "river" && s.activeRiverName) {
    return `Crossing · ${s.activeRiverName}`;
  }
  const next = nextRiverAhead(s.miles);
  if (next && next.milesFromStart - s.miles > 0 && next.milesFromStart - s.miles < 58) {
    const d = Math.max(1, Math.ceil(next.milesFromStart - s.miles));
    return `Water ahead (~${d} mi) · ${next.name}`;
  }
  const lm = landmarkAtMiles(s.miles);
  if (lm) return `Trail vista · ${lm.name}`;
  return "Trail vista";
}

/** Top-down trail vista — road, wagon from above, biome ground (early-GTA-style read). */
export function paintLandView(canvas: HTMLCanvasElement, s: LandViewState): void {
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const biome = biomeAt(s.miles);
  const rMode = riverMode(s);
  const scroll = Math.floor(s.miles * 2.4 + s.day * 0.8) % 200;
  const tick = s.day + s.miles * 0.05;
  const seed = Math.floor(s.miles / 18) * 10007 + s.day * 13;
  const rand = mulberry32(seed);

  const gnd = groundColor(biome);
  ctx.fillStyle = gnd;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(0,80,50,0.2)";
  for (let gx = 0; gx < W; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  for (let gy = 0; gy < H; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }

  const roadY = H * 0.42;
  const roadH = 44;
  ctx.fillStyle = "#2a2418";
  ctx.fillRect(0, roadY, W, roadH);
  ctx.fillStyle = "#3a3220";
  ctx.fillRect(0, roadY + 4, W, roadH - 8);
  ctx.strokeStyle = "rgba(255,220,80,0.35)";
  ctx.setLineDash([10, 14]);
  ctx.beginPath();
  ctx.moveTo(0, roadY + roadH / 2);
  ctx.lineTo(W, roadY + roadH / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 22; i++) {
    const tx = (i * 31 + scroll) % (W + 40) - 20;
    const ty = roadY - 8 - rand() * 18;
    ctx.fillStyle = biome === "desert" ? "#1a3010" : "#062818";
    ctx.beginPath();
    ctx.arc(tx, ty, 5 + rand() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 22; i++) {
    const tx = (i * 29 + scroll * 0.9) % (W + 40) - 20;
    const ty = roadY + roadH + 8 + rand() * 20;
    ctx.fillStyle = biome === "desert" ? "#1a3010" : "#062818";
    ctx.beginPath();
    ctx.arc(tx, ty, 5 + rand() * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (rMode === "approach") {
    ctx.fillStyle = "rgba(15, 92, 68, 0.5)";
    ctx.fillRect(0, roadY - 6, W, 6);
    ctx.strokeStyle = "#2a8f5a";
    ctx.beginPath();
    ctx.moveTo(0, roadY);
    ctx.lineTo(W, roadY);
    ctx.stroke();
  }

  if (rMode === "crossing") {
    ctx.fillStyle = "#042818";
    ctx.fillRect(0, roadY - 4, W, roadH + 8);
    for (let row = 0; row < 5; row++) {
      ctx.fillStyle = row % 2 === 0 ? "#063d2c" : "#052a20";
      const yy = roadY + row * 10 + Math.sin((tick + row) * 0.15) * 2;
      ctx.fillRect(0, yy, W, 9);
    }
    ctx.strokeStyle = "#1fb855";
    ctx.globalAlpha = 0.25;
    for (let x = -40; x < W + 40; x += 20) {
      const ox = x + (tick * 2) % 20;
      ctx.beginPath();
      ctx.moveTo(ox, roadY + 6);
      ctx.quadraticCurveTo(ox + 8, roadY + 22, ox, roadY + 36);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const prog = (scroll % 160) / 160;
  const wx = 48 + prog * (W - 120);
  drawWagonTopDown(ctx, wx, roadY + roadH / 2);

  ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
  ctx.fillRect(0, 0, W, H);
}

function drawWagonTopDown(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 34, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a2418";
  ctx.strokeStyle = "#1fb855";
  ctx.lineWidth = 2;
  ctx.fillRect(-26, -14, 52, 28);
  ctx.strokeRect(-26, -14, 52, 28);
  ctx.beginPath();
  ctx.arc(-16, 16, 8, 0, Math.PI * 2);
  ctx.arc(16, 16, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#063018";
  ctx.fillRect(-10, -22, 20, 10);
  ctx.restore();
}
