/**
 * Hunt minigame animal sprites — chunky retro SVGs from `/public/art/hunt`.
 */

import type { AnimalKind } from "../game/huntZones";
import { HUNT_ART } from "../game/artAssets";
import { drawTopDownBlockAnimal } from "./huntAnimalBlocks";

const KINDS: AnimalKind[] = ["bison", "bear", "deer", "rabbit"];

const sprites: Partial<Record<AnimalKind, HTMLImageElement>> = {};
let loadPromise: Promise<void> | null = null;

export function preloadHuntSprites(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all(
    KINDS.map(
      (kind) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            sprites[kind] = img;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = HUNT_ART[kind];
        }),
    ),
  ).then(() => undefined);
  return loadPromise;
}

export function huntSpritesReady(): boolean {
  return KINDS.every((k) => sprites[k]?.complete);
}

export function drawHuntAnimalSprite(
  ctx: CanvasRenderingContext2D,
  kind: AnimalKind,
  alive: boolean,
  x: number,
  y: number,
  w: number,
  h: number,
  facing: 1 | -1,
  bodyTint: string,
): void {
  const img = sprites[kind];
  if (!img?.complete || !img.naturalWidth) {
    drawTopDownBlockAnimal(ctx, kind, alive, x, y, w, h, facing, bodyTint);
    return;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (!alive) {
    ctx.globalAlpha = 0.55;
  }

  if (facing < 0) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }

  if (!alive) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(80,20,20,0.45)";
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    const s = Math.min(w, h) * 0.22;
    ctx.fillRect(cx - s, cy - 2, s * 2, 4);
    ctx.fillRect(cx - 2, cy - s, 4, s * 2);
  }

  ctx.restore();
}
