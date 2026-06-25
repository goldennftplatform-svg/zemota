import { GAME_ART } from "../game/artAssets";
import { TOTAL_TRAIL_MILES } from "../game/config";
import {
  OREGON_TRAIL_LANDSCAPE_ASPECT,
  trailChartStagePercent,
} from "../game/trailChartCoords";

/** Inner map draw size — viewBox matches chart aspect so the raster fills with no letterboxing. */
const MAP_W = 400;
const MAP_H = MAP_W / OREGON_TRAIL_LANDSCAPE_ASPECT;
const PAD = 4;
const VB = { x: -PAD, y: -PAD, w: MAP_W + PAD * 2, h: MAP_H + PAD * 2 };
const MINIMAP_ASPECT = VB.w / VB.h;

function pctToSvg(left: number, top: number): { x: number; y: number } {
  return {
    x: (left / 100) * MAP_W,
    y: (top / 100) * MAP_H,
  };
}

function trailChartPolyline(): string {
  const pts: string[] = [];
  for (let m = 0; m <= TOTAL_TRAIL_MILES; m += 80) {
    const stage = trailChartStagePercent(m, MINIMAP_ASPECT);
    const s = pctToSvg(stage.left, stage.top);
    pts.push(`${s.x.toFixed(1)},${s.y.toFixed(1)}`);
  }
  return pts.join(" ");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/\u003c/g, "&lt;")
    .replace(/\u003e/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { trailChartStagePercent as trailBigboardOverlayPercent };

export function renderTrailMinimap(
  miles: number,
  landmarkName: string,
  variant: "full" | "ribbon" | "land" = "full",
): string {
  const overlay = trailChartStagePercent(miles, MINIMAP_ASPECT);
  const { x, y } = pctToSvg(overlay.left, overlay.top);
  const pct = Math.round((miles / TOTAL_TRAIL_MILES) * 100);
  const poly = trailChartPolyline();
  const title = escapeXml(`Trail about ${pct}% complete, near ${landmarkName}`);

  const midX = MAP_W / 2;
  const start = pctToSvg(
    trailChartStagePercent(0, MINIMAP_ASPECT).left,
    trailChartStagePercent(0, MINIMAP_ASPECT).top,
  );
  const end = pctToSvg(
    trailChartStagePercent(TOTAL_TRAIL_MILES, MINIMAP_ASPECT).left,
    trailChartStagePercent(TOTAL_TRAIL_MILES, MINIMAP_ASPECT).top,
  );

  const pctLine =
    variant === "land"
      ? ""
      : `<text class="minimap-pct" x="${midX.toFixed(1)}" y="${(MAP_H - 6).toFixed(1)}" text-anchor="middle">${pct}% trail</text>`;

  return `
<svg class="minimap-svg${variant === "ribbon" ? " minimap-svg--ribbon" : ""}${variant === "land" ? " minimap-svg--land" : ""}" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="Trail progress on the Old Oregon Trail map">
  <title>${title}</title>
  <rect class="minimap-frame minimap-frame--chart" x="0.5" y="0.5" width="${(MAP_W - 1).toFixed(1)}" height="${(MAP_H - 1).toFixed(1)}" rx="4" ry="4" />
  <image class="minimap-map-raster minimap-map-raster--chart" href="${GAME_ART.oregonTrailMap}" x="0" y="0" width="${MAP_W.toFixed(1)}" height="${MAP_H.toFixed(1)}" preserveAspectRatio="xMidYMid meet" />
  <polyline class="minimap-route minimap-route--chart" points="${poly}" fill="none" />
  <circle class="minimap-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" />
  <text class="minimap-tag minimap-tag--e" x="${start.x.toFixed(1)}" y="${(start.y + 12).toFixed(1)}">MO</text>
  <text class="minimap-tag minimap-tag--w" x="${(end.x - 4).toFixed(1)}" y="${(end.y + 10).toFixed(1)}">OR</text>
  ${pctLine}
</svg>
`.trim();
}
