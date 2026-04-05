import { TOTAL_TRAIL_MILES } from "../game/config";

/** Wider viewBox (same user coords as trail/art) so the map reads zoomed out with margin. */
const VB = { x: -52, y: -42, w: 404, h: 256 };

/** Stylized coords; trail runs east→west across a simplified U.S. silhouette. */
const TRAIL_KNOTS: { miles: number; x: number; y: number }[] = [
  { miles: 0, x: 248, y: 96 },
  { miles: 320, x: 222, y: 88 },
  { miles: 640, x: 196, y: 82 },
  { miles: 980, x: 168, y: 78 },
  { miles: 1400, x: 124, y: 72 },
  { miles: 1700, x: 86, y: 70 },
  { miles: TOTAL_TRAIL_MILES, x: 52, y: 76 },
];

/** Simplified lower-48 outline (decorative). */
const US_SILHOUETTE =
  "M 48 42 L 62 32 L 98 26 L 152 22 L 210 30 L 252 48 L 268 72 L 272 98 L 262 128 " +
  "L 232 148 L 188 156 L 128 152 L 78 138 L 44 108 L 38 72 Z";

/** Flat water shapes (Great Lakes + interior hints) — terraink-style dusty cyan. */
const WATER_PATHS: string[] = [
  "M 200 48 L 226 46 L 232 58 L 220 72 L 202 66 Z",
  "M 214 58 L 234 56 L 238 72 L 224 82 L 208 76 Z",
  "M 188 88 Q 206 84 214 98 L 198 108 L 174 100 Z",
  "M 248 118 L 268 124 L 262 138 L 238 134 Z",
];

/** Pale “park / high country” patches — stronger in the west. */
const PARK_PATHS: string[] = [
  "M 40 44 L 102 40 L 118 72 L 92 98 L 44 88 Z",
  "M 48 56 L 124 50 L 138 86 L 104 108 L 46 96 Z",
  "M 56 68 L 112 64 L 122 94 L 84 112 L 52 102 Z",
  "M 34 72 L 76 66 L 88 96 L 58 118 L 36 104 Z",
];

/** Thin schematic “highway” segments — hubs near jump-off and Oregon. */
const HIGHWAY_POLYLINES: string[] = [
  "236 90 252 96 266 102",
  "236 90 222 82 208 88",
  "236 90 228 104 218 112",
  "248 96 238 108 226 118",
  "196 82 210 76 222 70",
  "196 82 182 88 168 94",
  "168 78 154 82 142 88",
  "124 72 110 76 98 82",
  "86 70 72 74 60 80",
  "52 76 64 68 78 62",
  "52 76 44 86 38 96",
  "52 76 66 84 82 92",
  "248 96 232 88 218 84",
  "210 30 198 38 186 46",
  "152 22 160 34 168 44",
];

function trailPosition(miles: number): { x: number; y: number } {
  const m = Math.max(0, Math.min(TOTAL_TRAIL_MILES, miles));
  for (let i = 0; i < TRAIL_KNOTS.length - 1; i++) {
    const a = TRAIL_KNOTS[i]!;
    const b = TRAIL_KNOTS[i + 1]!;
    if (m <= b.miles) {
      const t = (m - a.miles) / Math.max(1, b.miles - a.miles);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  const last = TRAIL_KNOTS[TRAIL_KNOTS.length - 1]!;
  return { x: last.x, y: last.y };
}

function trailPolylinePoints(): string {
  return TRAIL_KNOTS.map((p) => `${p.x},${p.y}`).join(" ");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/\u003c/g, "&lt;")
    .replace(/\u003e/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTrailMinimap(miles: number, landmarkName: string): string {
  const { x, y } = trailPosition(miles);
  const pct = Math.round((miles / TOTAL_TRAIL_MILES) * 100);
  const poly = trailPolylinePoints();
  const title = escapeXml(`Trail about ${pct}% complete, near ${landmarkName}`);

  const waterLayers = WATER_PATHS.map(
    (d) => `<path class="minimap-water" d="${d}" />`,
  ).join("\n    ");
  const parkLayers = PARK_PATHS.map((d) => `<path class="minimap-park" d="${d}" />`).join("\n    ");
  const highwayLayers = HIGHWAY_POLYLINES.map(
    (pts) => `<polyline class="minimap-highway" points="${pts}" fill="none" />`,
  ).join("\n    ");

  const midX = VB.x + VB.w / 2;
  const rightX = VB.x + VB.w - 10;
  const bottomY = VB.y + VB.h - 8;

  return `
<svg class="minimap-svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="Trail progress across the United States">
  <title>${title}</title>
  <defs>
    <clipPath id="minimap-us-clip">
      <path d="${US_SILHOUETTE}" />
    </clipPath>
  </defs>
  <rect class="minimap-frame" x="${VB.x + 0.5}" y="${VB.y + 0.5}" width="${VB.w - 1}" height="${VB.h - 1}" rx="10" ry="10" />
  <g clip-path="url(#minimap-us-clip)">
    <rect class="minimap-paper" x="${VB.x - 8}" y="${VB.y - 8}" width="${VB.w + 16}" height="${VB.h + 16}" />
    ${waterLayers}
    ${parkLayers}
  </g>
  <g class="minimap-highways" clip-path="url(#minimap-us-clip)">
    ${highwayLayers}
  </g>
  <path class="minimap-coast" fill="none" d="${US_SILHOUETTE}" />
  <polyline class="minimap-route" points="${poly}" fill="none" />
  <circle class="minimap-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" />
  <line class="minimap-rule" x1="${VB.x + 28}" y1="${VB.y + 198}" x2="${VB.x + VB.w - 28}" y2="${VB.y + 198}" />
  <text class="minimap-tag minimap-tag--e" x="258" y="112">MO</text>
  <text class="minimap-tag minimap-tag--w" x="22" y="86">OR</text>
  <text class="minimap-pct" x="${midX.toFixed(1)}" y="${VB.y + 220}" text-anchor="middle">${pct}% trail</text>
  <text class="minimap-credit" x="${rightX.toFixed(1)}" y="${bottomY.toFixed(1)}" text-anchor="end">terraink.app</text>
</svg>
`.trim();
}
