import { TOTAL_TRAIL_MILES } from "./config";

/** Pixel size of `public/art/oregon-trail-map.png`. */
export const OREGON_TRAIL_CHART = { width: 1024, height: 768 } as const;

/**
 * Trail landmarks as 0–1 coords on the chart image (St. Joseph → Oregon City).
 * Tuned to the thick ink trail on the vintage map.
 */
export const TRAIL_CHART_NORM: { miles: number; x: number; y: number }[] = [
  { miles: 0, x: 0.734, y: 0.518 },
  { miles: 200, x: 0.702, y: 0.508 },
  { miles: 320, x: 0.664, y: 0.498 },
  { miles: 500, x: 0.632, y: 0.49 },
  { miles: 640, x: 0.598, y: 0.484 },
  { miles: 800, x: 0.568, y: 0.478 },
  { miles: 980, x: 0.534, y: 0.472 },
  { miles: 1150, x: 0.482, y: 0.466 },
  { miles: 1400, x: 0.362, y: 0.46 },
  { miles: 1650, x: 0.252, y: 0.456 },
  { miles: 1850, x: 0.188, y: 0.468 },
  { miles: TOTAL_TRAIL_MILES, x: 0.148, y: 0.486 },
];

function interpolateChartNorm(miles: number): { x: number; y: number } {
  const m = Math.max(0, Math.min(TOTAL_TRAIL_MILES, miles));
  for (let i = 0; i < TRAIL_CHART_NORM.length - 1; i++) {
    const a = TRAIL_CHART_NORM[i]!;
    const b = TRAIL_CHART_NORM[i + 1]!;
    if (m <= b.miles) {
      const t = (m - a.miles) / Math.max(1, b.miles - a.miles);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  const last = TRAIL_CHART_NORM[TRAIL_CHART_NORM.length - 1]!;
  return { x: last.x, y: last.y };
}

/** 0–1 position on the chart image for a given mile. */
export function trailChartNormAt(miles: number): { x: number; y: number } {
  const { x, y } = interpolateChartNorm(miles);
  const bob = Math.sin(miles * 0.02) * 0.003;
  return { x, y: y + bob };
}

/** Map image norm coords → % on a box using `object-fit: contain`. */
export function chartNormToContainPercent(
  nx: number,
  ny: number,
  containerAspect: number,
): { left: number; top: number } {
  const imgAspect = OREGON_TRAIL_CHART.width / OREGON_TRAIL_CHART.height;
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

/** Trail miles → overlay % for a contain-sized map stage. */
export function trailChartStagePercent(
  miles: number,
  containerAspect: number,
): { left: number; top: number } {
  const { x, y } = interpolateChartNorm(miles);
  const bob = Math.sin(miles * 0.02) * 0.004;
  const p = chartNormToContainPercent(x, y + bob, containerAspect);
  return p;
}
