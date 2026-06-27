import { TOTAL_TRAIL_MILES } from "./config";

/** Pixel size of `public/art/oregon-trail-map.png` — trimmed to the geography band only. */
export const OREGON_TRAIL_CHART = { width: 976, height: 310 } as const;

/**
 * Trail knots on the chart (0–1 on image pixels).
 * Mile 0 = Independence (east/right) · finish = Oregon City (west/left).
 */
const CHART_TRAIL: { miles: number; x: number; y: number }[] = [
  { miles: 0, x: 0.899, y: 0.565 },
  { miles: 102, x: 0.857, y: 0.531 },
  { miles: 185, x: 0.826, y: 0.497 },
  { miles: 304, x: 0.772, y: 0.48 },
  { miles: 554, x: 0.699, y: 0.429 },
  { miles: 640, x: 0.637, y: 0.395 },
  { miles: 830, x: 0.573, y: 0.361 },
  { miles: 932, x: 0.521, y: 0.343 },
  { miles: 989, x: 0.468, y: 0.378 },
  { miles: 1375, x: 0.374, y: 0.429 },
  { miles: 1548, x: 0.321, y: 0.463 },
  { miles: 1632, x: 0.228, y: 0.326 },
  { miles: 1800, x: 0.143, y: 0.292 },
  { miles: 1990, x: 0.081, y: 0.361 },
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

/** Map image scaled with object-fit: cover — fills TV stage, no top/bottom letterbox. */
export function chartNormToCoverPercent(
  nx: number,
  ny: number,
  containerAspect: number,
  imgAspect = OREGON_TRAIL_LANDSCAPE_ASPECT,
): { left: number; top: number } {
  let left: number;
  let top: number;
  if (imgAspect > containerAspect) {
    const renderWidth = imgAspect / containerAspect;
    const offsetX = (1 - renderWidth) / 2;
    left = offsetX + nx * renderWidth;
    top = ny;
  } else {
    const renderHeight = containerAspect / imgAspect;
    const offsetY = (1 - renderHeight) / 2;
    left = nx;
    top = offsetY + ny * renderHeight;
  }
  return { left: left * 100, top: top * 100 };
}

export function trailChartStageCoverPercent(
  miles: number,
  containerAspect: number,
): { left: number; top: number } {
  const { x, y } = trailChartNormAt(miles);
  return chartNormToCoverPercent(x, y, containerAspect, OREGON_TRAIL_LANDSCAPE_ASPECT);
}
