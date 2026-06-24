import { TOTAL_TRAIL_MILES } from "./config";

/** Pixel size of `public/art/oregon-trail-map.png` (Ezra Meeker vertical chart). */
export const OREGON_TRAIL_CHART = { width: 409, height: 1024 } as const;

/**
 * Trail knots on the portrait chart (0–1 on image pixels).
 * Mile 0 = Independence, Missouri (bottom-right) · finish = Oregon (top-left).
 * x increases right; y increases down.
 */
const PORTRAIT_TRAIL: { miles: number; x: number; y: number }[] = [
  { miles: 0, x: 0.78, y: 0.93 },
  { miles: 102, x: 0.74, y: 0.89 },
  { miles: 185, x: 0.71, y: 0.86 },
  { miles: 304, x: 0.66, y: 0.81 },
  { miles: 450, x: 0.62, y: 0.76 },
  { miles: 554, x: 0.58, y: 0.71 },
  { miles: 640, x: 0.55, y: 0.63 },
  { miles: 750, x: 0.52, y: 0.59 },
  { miles: 830, x: 0.48, y: 0.55 },
  { miles: 932, x: 0.42, y: 0.51 },
  { miles: 989, x: 0.38, y: 0.47 },
  { miles: 1100, x: 0.36, y: 0.43 },
  { miles: 1250, x: 0.33, y: 0.39 },
  { miles: 1375, x: 0.30, y: 0.35 },
  { miles: 1548, x: 0.28, y: 0.31 },
  { miles: 1632, x: 0.22, y: 0.22 },
  { miles: 1800, x: 0.18, y: 0.14 },
  { miles: 1990, x: 0.15, y: 0.08 },
];

/** Raw 0–1 position on the portrait chart image (before landscape display mapping). */
export function trailPortraitNormAt(miles: number): { x: number; y: number } {
  return interpolatePortrait(miles);
}

function interpolatePortrait(miles: number): { x: number; y: number } {
  const m = Math.max(0, Math.min(TOTAL_TRAIL_MILES, miles));
  for (let i = 0; i < PORTRAIT_TRAIL.length - 1; i++) {
    const a = PORTRAIT_TRAIL[i]!;
    const b = PORTRAIT_TRAIL[i + 1]!;
    if (m <= b.miles) {
      const t = (m - a.miles) / Math.max(1, b.miles - a.miles);
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
    }
  }
  const last = PORTRAIT_TRAIL[PORTRAIT_TRAIL.length - 1]!;
  return { x: last.x, y: last.y };
}

/**
 * Display coords on the bigboard (portrait chart shown landscape):
 * east / start → right, west / Oregon → left; trail curve follows the ink line.
 */
export function trailChartNormAt(miles: number): { x: number; y: number } {
  const { x, y } = interpolatePortrait(miles);
  const bob = Math.sin(miles * 0.02) * 0.004;
  const yp = y + bob;
  return { x: yp, y: x };
}

/** @deprecated Portrait → display mapping for minimap SVG. */
export const TRAIL_CHART_NORM = PORTRAIT_TRAIL;

/** Landscape display aspect (portrait chart rotated 90° CCW for east→right, west→left). */
export const OREGON_TRAIL_LANDSCAPE_ASPECT =
  OREGON_TRAIL_CHART.height / OREGON_TRAIL_CHART.width;

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
