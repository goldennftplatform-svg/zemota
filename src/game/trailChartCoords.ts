import { TOTAL_TRAIL_MILES } from "./config";

/** Pixel size of `public/art/oregon-trail-map.png` — cropped to framed map art only. */
export const OREGON_TRAIL_CHART = { width: 996, height: 440 } as const;

/** Crop applied to the source Meeker postcard (full bleed → map frame). */
export const OREGON_TRAIL_CHART_CROP = { left: 14, top: 34, width: 996, height: 440 } as const;

/**
 * Trail knots on the chart (0–1 on image pixels).
 * Mile 0 = Independence (east/right) · finish = Oregon City (west/left).
 */
const CHART_TRAIL: { miles: number; x: number; y: number }[] = [
  { miles: 0, x: 0.891, y: 0.548 },
  { miles: 102, x: 0.85, y: 0.524 },
  { miles: 185, x: 0.819, y: 0.5 },
  { miles: 304, x: 0.767, y: 0.488 },
  { miles: 554, x: 0.695, y: 0.452 },
  { miles: 640, x: 0.634, y: 0.428 },
  { miles: 830, x: 0.572, y: 0.404 },
  { miles: 932, x: 0.521, y: 0.392 },
  { miles: 989, x: 0.469, y: 0.416 },
  { miles: 1375, x: 0.377, y: 0.452 },
  { miles: 1548, x: 0.325, y: 0.476 },
  { miles: 1632, x: 0.233, y: 0.38 },
  { miles: 1800, x: 0.15, y: 0.356 },
  { miles: 1990, x: 0.089, y: 0.404 },
];

function interpolateChart(miles: number): { x: number; y: number } {
  const m = Math.max(0, Math.min(TOTAL_TRAIL_MILES, miles));
  for (let i = 0; i < CHART_TRAIL.length - 1; i++) {
    const a = CHART_TRAIL[i]!;
    const b = CHART_TRAIL[i + 1]!;
    if (m <= b.miles) {
      const t = (m - a.miles) / Math.max(1, b.miles - a.miles);
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
    }
  }
  const last = CHART_TRAIL[CHART_TRAIL.length - 1]!;
  return { x: last.x, y: last.y };
}

/** 0–1 position on the chart image (bigboard wagon markers). */
export function trailPortraitNormAt(miles: number): { x: number; y: number } {
  return interpolateChart(miles);
}

/** Same as {@link trailPortraitNormAt} — chart is already landscape east→west. */
export function trailChartNormAt(miles: number): { x: number; y: number } {
  const { x, y } = interpolateChart(miles);
  const bob = Math.sin(miles * 0.02) * 0.004;
  return { x, y: y + bob };
}

export const TRAIL_CHART_NORM = CHART_TRAIL;

export const OREGON_TRAIL_LANDSCAPE_ASPECT =
  OREGON_TRAIL_CHART.width / OREGON_TRAIL_CHART.height;

export function chartNormToContainPercent(
  nx: number,
  ny: number,
  containerAspect: number,
  imgAspect = OREGON_TRAIL_CHART.width / OREGON_TRAIL_CHART.height,
): { left: number; top: number } {
  let left: number;
  let top: number;
  if (imgAspect > containerAspect) {
    const renderHeight = containerAspect / imgAspect;
    const offsetY = (1 - renderHeight) / 2;
    left = nx;
    top = offsetY + ny * renderHeight;
  } else {
    const renderWidth = imgAspect / containerAspect;
    const offsetX = (1 - renderWidth) / 2;
    left = offsetX + nx * renderWidth;
    top = ny;
  }
  return { left: left * 100, top: top * 100 };
}

export function trailChartStagePercent(
  miles: number,
  containerAspect: number,
): { left: number; top: number } {
  const { x, y } = trailChartNormAt(miles);
  return chartNormToContainPercent(x, y, containerAspect, OREGON_TRAIL_LANDSCAPE_ASPECT);
}
