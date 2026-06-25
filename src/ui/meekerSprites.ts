import {
  MEEKER_IDLE_WEST_FRAME,
  MEEKER_SPRITE_SHEETS,
  MEEKER_WALK_WEST_FRAMES,
  meekerSpriteForTrailPct,
  type MeekerSpriteAnim,
  type MeekerSpriteId,
  type MeekerSpriteSheet,
} from "../game/meekerSpriteSheets";
import "../css/meeker-sprites.css";

interface KeyedSheet {
  canvas: HTMLCanvasElement;
  cols: number;
  rows: number;
  frameW: number;
  frameH: number;
}

const timers = new WeakMap<HTMLElement, ReturnType<typeof setInterval>>();
const keyedCache = new Map<MeekerSpriteId, KeyedSheet>();
const keyedLoads = new Map<MeekerSpriteId, Promise<KeyedSheet | null>>();

function keyWhiteSheet(img: HTMLImageElement, sheet: MeekerSpriteSheet): KeyedSheet {
  const frameW = Math.floor(img.naturalWidth / sheet.cols);
  const frameH = Math.floor(img.naturalHeight / sheet.rows);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { canvas, cols: sheet.cols, rows: sheet.rows, frameW, frameH };
  }
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]!;
    const g = px[i + 1]!;
    const b = px[i + 2]!;
    if (r > 238 && g > 238 && b > 238) {
      px[i + 3] = 0;
    } else if (r > 215 && g > 215 && b > 215) {
      px[i + 3] = Math.round(px[i + 3]! * 0.25);
    }
  }
  ctx.putImageData(data, 0, 0);
  return { canvas, cols: sheet.cols, rows: sheet.rows, frameW, frameH };
}

function loadKeyedSheet(id: MeekerSpriteId): Promise<KeyedSheet | null> {
  const cached = keyedCache.get(id);
  if (cached) return Promise.resolve(cached);

  const pending = keyedLoads.get(id);
  if (pending) return pending;

  const promise = new Promise<KeyedSheet | null>((resolve) => {
    const def = MEEKER_SPRITE_SHEETS[id];
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const keyed = keyWhiteSheet(img, def);
      keyedCache.set(id, keyed);
      resolve(keyed);
    };
    img.onerror = () => resolve(null);
    img.src = def.src;
  });
  keyedLoads.set(id, promise);
  return promise;
}

function framesForAnim(anim: MeekerSpriteAnim): readonly number[] {
  return anim === "walk-west" ? MEEKER_WALK_WEST_FRAMES : [MEEKER_IDLE_WEST_FRAME];
}

function ensureCanvas(el: HTMLElement): HTMLCanvasElement {
  let canvas = el.querySelector<HTMLCanvasElement>("canvas.meeker-sprite__canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "meeker-sprite__canvas";
    el.appendChild(canvas);
  }
  return canvas;
}

function drawSpriteFrame(
  target: HTMLCanvasElement,
  keyed: KeyedSheet,
  frameIndex: number,
): void {
  const col = frameIndex % keyed.cols;
  const row = Math.floor(frameIndex / keyed.cols);
  if (target.width !== keyed.frameW || target.height !== keyed.frameH) {
    target.width = keyed.frameW;
    target.height = keyed.frameH;
  }
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(
    keyed.canvas,
    col * keyed.frameW,
    row * keyed.frameH,
    keyed.frameW,
    keyed.frameH,
    0,
    0,
    keyed.frameW,
    keyed.frameH,
  );
}

export function renderMeekerSpriteHtml(
  id: MeekerSpriteId,
  opts?: {
    anim?: MeekerSpriteAnim;
    size?: "hero" | "brand" | "wagon" | "popup" | "recap" | "share";
    className?: string;
    label?: string;
    juice?: boolean;
    stage?: boolean;
  },
): string {
  const anim = opts?.anim ?? "idle-west";
  const size = opts?.size ?? "hero";
  const juice = opts?.juice !== false && (size === "hero" || size === "recap" || size === "brand");
  const extra = `${opts?.className ? ` ${opts.className}` : ""}${juice ? " meeker-sprite--juice" : ""}`;
  const label = opts?.label ?? "";
  const aria = label ? ` aria-label="${label.replace(/"/g, "&quot;")}"` : ` aria-hidden="true"`;
  const inner = `<span class="meeker-sprite meeker-sprite--${size}${extra}" data-meeker-sprite="${id}" data-meeker-anim="${anim}"${aria}></span>`;
  if (opts?.stage) {
    return `<span class="meeker-stage">${inner}</span>`;
  }
  return inner;
}

export function mountMeekerSprite(el: HTMLElement): void {
  const prev = timers.get(el);
  if (prev) clearInterval(prev);
  timers.delete(el);

  const id = el.dataset.meekerSprite as MeekerSpriteId | undefined;
  if (!id || !MEEKER_SPRITE_SHEETS[id]) return;

  const anim = (el.dataset.meekerAnim as MeekerSpriteAnim | undefined) ?? "idle-west";
  const frames = framesForAnim(anim);
  let fi = 0;

  void loadKeyedSheet(id).then((keyed) => {
    if (!keyed || !el.isConnected) return;
    const canvas = ensureCanvas(el);

    const tick = (): void => {
      drawSpriteFrame(canvas, keyed, frames[fi]!);
      fi = (fi + 1) % frames.length;
    };

    tick();
    if (anim === "walk-west" && frames.length > 1) {
      timers.set(el, setInterval(tick, 220));
    }
  });
}

export function startMeekerSpriteAnimations(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-meeker-sprite]")) {
    mountMeekerSprite(el);
  }
}

export function preloadMeekerSprites(): Promise<void> {
  return Promise.all(
    (Object.keys(MEEKER_SPRITE_SHEETS) as MeekerSpriteId[]).map((id) =>
      loadKeyedSheet(id).then(() => undefined),
    ),
  ).then(() => undefined);
}

const HOP_KING_SHARE_TEXT =
  "I'm riding the Old Oregon Trail with young Ezra Meeker — Hop King edition. Name your wagon and survive to hop country!";

export async function shareHopKingStart(): Promise<string> {
  const url = `${window.location.origin}${window.location.pathname}`;
  const payload = `${HOP_KING_SHARE_TEXT}\n${url}`;
  try {
    if (navigator.share) {
      await navigator.share({
        title: "EMOTA · Hop King start",
        text: HOP_KING_SHARE_TEXT,
        url,
      });
      return "Shared!";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "";
  }
  try {
    await navigator.clipboard.writeText(payload);
    return "Link copied — share the Hop King start!";
  } catch {
    return payload;
  }
}

export function hydrateBrandSeal(root: ParentNode = document): void {
  const el = root.querySelector<HTMLElement>(".app-brand__seal [data-meeker-sprite]");
  if (el) mountMeekerSprite(el);
}

/** Header Ezra ages as the wagon moves west. */
export function syncBrandSealToTrail(trailPct: number, phase: string): void {
  const el = document.querySelector<HTMLElement>(".app-brand__seal [data-meeker-sprite]");
  if (!el) return;

  const onboard =
    phase === "title" ||
    phase === "training_text" ||
    phase === "training_quiz" ||
    phase === "party_names" ||
    phase === "profile" ||
    phase === "store";

  const { id, anim } = onboard
    ? { id: "hopKingYoung" as const, anim: "walk-west" as const }
    : meekerSpriteForTrailPct(trailPct);

  if (el.dataset.meekerSprite === id && el.dataset.meekerAnim === anim) return;
  el.dataset.meekerSprite = id;
  el.dataset.meekerAnim = anim;
  mountMeekerSprite(el);
}
