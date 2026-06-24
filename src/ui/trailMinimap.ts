import { GAME_ART } from "../game/artAssets";
import { TOTAL_TRAIL_MILES } from "../game/config";
import { TRAIL_CHART_NORM, trailChartStagePercent } from "../game/trailChartCoords";

/** Minimap SVG viewport. */
const VB = { x: -52, y: -42, w: 404, h: 256 };
const MINIMAP_ASPECT = VB.w / VB.h;

function pctToSvg(left: number, top: number): { x: number; y: number } {
  return {
    x: VB.x + (left / 100) * VB.w,
    y: VB.y + (top / 100) * VB.h,
  };
}

function trailChartPolyline(): string {
  return TRAIL_CHART_NORM.map((p) => {
    const stage = trailChartStagePercent(p.miles, MINIMAP_ASPECT);
    const s = pctToSvg(stage.left, stage.top);
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

export { trailChartStagePercent as trailBigboardOverlayPercent };

export function renderTrailMinimap(
  miles: number,
  landmarkName: string,
  variant: "full" | "ribbon" = "full",
): string {
  const overlay = trailChartStagePercent(miles, MINIMAP_ASPECT);
  const { x, y } = pctToSvg(overlay.left, overlay.top);
  const pct = Math.round((miles / TOTAL_TRAIL_MILES) * 100);
  const poly = trailChartPolyline();
  const title = escapeXml(`Trail about ${pct}% complete, near ${landmarkName}`);

  const midX = VB.x + VB.w / 2;
  const start = pctToSvg(
    trailChartStagePercent(0, MINIMAP_ASPECT).left,
    trailChartStagePercent(0, MINIMAP_ASPECT).top,
  );
  const end = pctToSvg(
    trailChartStagePercent(TOTAL_TRAIL_MILES, MINIMAP_ASPECT).left,
    trailChartStagePercent(TOTAL_TRAIL_MILES, MINIMAP_ASPECT).top,
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
