import { GAME_ART } from "../game/artAssets";
import { TOTAL_TRAIL_MILES } from "../game/config";

/** Minimap SVG viewport. */
const VB = { x: -52, y: -42, w: 404, h: 256 };

/**
 * Wagon positions on the vintage Oregon Trail map (% of image, object-fit contain).
 * Mile 0 = St. Joseph (where the trail line begins on the chart).
 */
const BIGBOARD_TRAIL_PCT: { miles: number; left: number; top: number }[] = [
  { miles: 0, left: 85.2, top: 61.8 },
  { miles: 320, left: 74.5, top: 58.2 },
  { miles: 640, left: 67.8, top: 56.4 },
  { miles: 980, left: 60.2, top: 54.6 },
  { miles: 1400, left: 41.5, top: 51.8 },
  { miles: 1700, left: 27.2, top: 49.6 },
  { miles: TOTAL_TRAIL_MILES, left: 18.8, top: 52.4 },
];

function interpolateBigboardPct(miles: number): { left: number; top: number } {
  const m = Math.max(0, Math.min(TOTAL_TRAIL_MILES, miles));
  for (let i = 0; i < BIGBOARD_TRAIL_PCT.length - 1; i++) {
    const a = BIGBOARD_TRAIL_PCT[i]!;
    const b = BIGBOARD_TRAIL_PCT[i + 1]!;
    if (m <= b.miles) {
      const t = (m - a.miles) / Math.max(1, b.miles - a.miles);
      return {
        left: a.left + (b.left - a.left) * t,
        top: a.top + (b.top - a.top) * t,
      };
    }
  }
  const last = BIGBOARD_TRAIL_PCT[BIGBOARD_TRAIL_PCT.length - 1]!;
  return { left: last.left, top: last.top };
}

/** Trail miles → % on the Oregon Trail chart (St. Joseph → Oregon City). */
export function trailBigboardOverlayPercent(miles: number): { left: number; top: number } {
  const { left, top } = interpolateBigboardPct(miles);
  const bob = Math.sin(miles * 0.02) * 0.28;
  return { left, top: top + bob };
}

function pctToSvg(left: number, top: number): { x: number; y: number } {
  return {
    x: VB.x + (left / 100) * VB.w,
    y: VB.y + (top / 100) * VB.h,
  };
}

function trailChartPolyline(): string {
  return BIGBOARD_TRAIL_PCT.map((p) => {
    const s = pctToSvg(p.left, p.top);
    return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
  }).join(" ");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/\u003c/g, "&lt;")
    .replace(/\u003e/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTrailMinimap(
  miles: number,
  landmarkName: string,
  variant: "full" | "ribbon" = "full",
): string {
  const overlay = trailBigboardOverlayPercent(miles);
  const { x, y } = pctToSvg(overlay.left, overlay.top);
  const pct = Math.round((miles / TOTAL_TRAIL_MILES) * 100);
  const poly = trailChartPolyline();
  const title = escapeXml(`Trail about ${pct}% complete, near ${landmarkName}`);

  const midX = VB.x + VB.w / 2;
  const start = pctToSvg(BIGBOARD_TRAIL_PCT[0]!.left, BIGBOARD_TRAIL_PCT[0]!.top);
  const end = pctToSvg(
    BIGBOARD_TRAIL_PCT[BIGBOARD_TRAIL_PCT.length - 1]!.left,
    BIGBOARD_TRAIL_PCT[BIGBOARD_TRAIL_PCT.length - 1]!.top,
  );

  return `
<svg class="minimap-svg${variant === "ribbon" ? " minimap-svg--ribbon" : ""}" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="Trail progress on the Old Oregon Trail map">
  <title>${title}</title>
  <rect class="minimap-frame" x="${VB.x + 0.5}" y="${VB.y + 0.5}" width="${VB.w - 1}" height="${VB.h - 1}" rx="10" ry="10" />
  <image class="minimap-map-raster minimap-map-raster--chart" href="${GAME_ART.oregonTrailMap}" x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" preserveAspectRatio="xMidYMid meet" />
  <polyline class="minimap-route minimap-route--chart" points="${poly}" fill="none" />
  <circle class="minimap-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" />
  <text class="minimap-tag minimap-tag--e" x="${start.x.toFixed(1)}" y="${(start.y + 14).toFixed(1)}">St. Joseph</text>
  <text class="minimap-tag minimap-tag--w" x="${(end.x - 4).toFixed(1)}" y="${(end.y + 12).toFixed(1)}">OR</text>
  <text class="minimap-pct" x="${midX.toFixed(1)}" y="${VB.y + 220}" text-anchor="middle">${pct}% trail</text>
</svg>
`.trim();
}
