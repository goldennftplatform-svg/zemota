import { TOTAL_TRAIL_MILES } from "./config";

/** Pixel size of `public/art/oregon-trail-map.png`. */
export const OREGON_TRAIL_CHART = { width: 1024, height: 768 } as const;

/**
 * Trail landmarks as 0–1 coords on the chart image (St. Joseph → Oregon City).
 * Tuned to the thick ink trail on the vintage map.
 */
export const TRAIL_CHART_NORM: { miles: number; x: number; y: number }[] = [
  { miles: 0, x: 0.781, y: 0.534 },
  { miles: 200, x: 0.748, y: 0.524 },
  { miles: 320, x: 0.708, y: 0.514 },
  { miles: 500, x: 0.676, y: 0.506 },
  { miles: 640, x: 0.64, y: 0.5 },
  { miles: 800, x: 0.61, y: 0.494 },
  { miles: 980, x: 0.574, y: 0.488 },
  { miles: 1150, x: 0.52, y: 0.482 },
  { miles: 1400, x: 0.396, y: 0.476 },
  { miles: 1650, x: 0.284, y: 0.472 },
  { miles: 1850, x: 0.214, y: 0.486 },
  { miles: TOTAL_TRAIL_MILES, x: 0.168, y: 0.504 },
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
