import {
  MEEKER_IDLE_WEST_FRAME,
  MEEKER_SPRITE_SHEETS,
  MEEKER_ICON_FRONT_FRAME,
  MEEKER_WALK_FRAME_MS,
  MEEKER_WALK_FRAME_MS_PLAY,
  MEEKER_WALK_FRONT_FRAMES,
  MEEKER_WALK_WEST_FRAMES,
  playerBoxMeekerSprite,
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
const mountGen = new WeakMap<HTMLElement, number>();
const runningKey = new WeakMap<HTMLElement, string>();
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
  switch (anim) {
    case "walk-west":
      return MEEKER_WALK_WEST_FRAMES;
    case "walk-front":
      return MEEKER_WALK_FRONT_FRAMES;
    case "icon-front":
      return [MEEKER_ICON_FRONT_FRAME];
    case "idle-west":
    default:
      return [MEEKER_IDLE_WEST_FRAME];
  }
}

function isEzraCharacter(id: MeekerSpriteId | undefined): boolean {
  return id === "hopKingYoung" || id === "ezraElder";
}

/** Ezra characters stay static during play; walk only on title / boot / recap. */
function effectiveAnim(el: HTMLElement, anim: MeekerSpriteAnim): MeekerSpriteAnim {
  if (!isEzraCharacter(el.dataset.meekerSprite as MeekerSpriteId | undefined)) {
    return anim;
  }
  if (el.closest(".journey-recap, .emota-boot, .app-layout.is-title")) return anim;
  if (el.closest(".app-layout.is-playing")) {
    if (anim === "walk-west" || anim === "walk-front") return "icon-front";
    return anim;
  }
  return anim;
}

function walkFrameMs(el: HTMLElement): number {
  if (el.closest(".app-layout.is-playing")) return MEEKER_WALK_FRAME_MS_PLAY;
  return MEEKER_WALK_FRAME_MS;
}

interface FrameTrim {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const trimCache = new Map<string, FrameTrim>();

function shouldTrimSprite(el: HTMLElement): boolean {
  return (
    el.classList.contains("meeker-sprite--brand") ||
    el.classList.contains("meeker-sprite--ribbon") ||
    el.classList.contains("meeker-sprite--share") ||
    el.closest(".app-brand__seal") !== null
  );
}

function getFrameTrim(keyed: KeyedSheet, frameIndex: number): FrameTrim {
  const cacheKey = `${keyed.frameW}x${keyed.frameH}:${frameIndex}`;
  const cached = trimCache.get(cacheKey);
  if (cached) return cached;

  const col = frameIndex % keyed.cols;
  const row = Math.floor(frameIndex / keyed.cols);
  const x0 = col * keyed.frameW;
  const y0 = row * keyed.frameH;
  const full: FrameTrim = { sx: x0, sy: y0, sw: keyed.frameW, sh: keyed.frameH };

  const ctx = keyed.canvas.getContext("2d");
  if (!ctx) {
    trimCache.set(cacheKey, full);
    return full;
  }

  const data = ctx.getImageData(x0, y0, keyed.frameW, keyed.frameH).data;
  let minX = keyed.frameW;
  let minY = keyed.frameH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < keyed.frameH; y++) {
    for (let x = 0; x < keyed.frameW; x++) {
      const a = data[(y * keyed.frameW + x) * 4 + 3]!;
      if (a > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    trimCache.set(cacheKey, full);
    return full;
  }

  const pad = 1;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(keyed.frameW - 1, maxX + pad);
  maxY = Math.min(keyed.frameH - 1, maxY + pad);
  const trim: FrameTrim = {
    sx: x0 + minX,
    sy: y0 + minY,
    sw: maxX - minX + 1,
    sh: maxY - minY + 1,
  };
  trimCache.set(cacheKey, trim);
  return trim;
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
  opts?: { trim?: boolean },
): void {
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  if (opts?.trim) {
    const t = getFrameTrim(keyed, frameIndex);
    if (target.width !== t.sw || target.height !== t.sh) {
      target.width = t.sw;
      target.height = t.sh;
    }
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(keyed.canvas, t.sx, t.sy, t.sw, t.sh, 0, 0, t.sw, t.sh);
    return;
  }

  const col = frameIndex % keyed.cols;
  const row = Math.floor(frameIndex / keyed.cols);
  if (target.width !== keyed.frameW || target.height !== keyed.frameH) {
    target.width = keyed.frameW;
    target.height = keyed.frameH;
  }
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
    size?: "hero" | "brand" | "wagon" | "popup" | "recap" | "share" | "ribbon";
    className?: string;
    label?: string;
    juice?: boolean;
    stage?: boolean;
  },
): string {
  const anim = opts?.anim ?? "idle-west";
  const size = opts?.size ?? "hero";
  const juice = opts?.juice !== false && (size === "hero" || size === "recap");
  const extra = `${opts?.className ? ` ${opts.className}` : ""}${juice ? " meeker-sprite--juice" : ""}`;
  const label = opts?.label ?? "";
  const aria = label ? ` aria-label="${label.replace(/"/g, "&quot;")}"` : ` aria-hidden="true"`;
  const inner = `<span class="meeker-sprite meeker-sprite--${size}${extra}" data-meeker-sprite="${id}" data-meeker-anim="${anim}"${aria}></span>`;
  if (opts?.stage) {
    return `<span class="meeker-stage">${inner}</span>`;
  }
  return inner;
}

export function mountMeekerSprite(el: HTMLElement, opts?: { force?: boolean }): void {
  const id = el.dataset.meekerSprite as MeekerSpriteId | undefined;
  if (!id || !MEEKER_SPRITE_SHEETS[id]) return;

  const requested = (el.dataset.meekerAnim as MeekerSpriteAnim | undefined) ?? "idle-west";
  const anim = effectiveAnim(el, requested);
  const key = `${id}:${anim}`;
  if (!opts?.force && runningKey.get(el) === key && (anim === "idle-west" || anim === "icon-front" || timers.has(el))) return;

  const prev = timers.get(el);
  if (prev) clearInterval(prev);
  timers.delete(el);

  const gen = (mountGen.get(el) ?? 0) + 1;
  mountGen.set(el, gen);

  const frames = framesForAnim(anim);
  let fi = 0;

  void loadKeyedSheet(id).then((keyed) => {
    if (!keyed || !el.isConnected || mountGen.get(el) !== gen) return;
    const canvas = ensureCanvas(el);

    const trim = shouldTrimSprite(el);

    const tick = (): void => {
      drawSpriteFrame(canvas, keyed, frames[fi]!, { trim });
      fi = (fi + 1) % frames.length;
    };

    tick();
    if (frames.length > 1) {
      timers.set(el, setInterval(tick, walkFrameMs(el)));
      runningKey.set(el, key);
    } else {
      runningKey.set(el, key);
    }
  });
}

export function startMeekerSpriteAnimations(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-meeker-sprite]")) {
    if (el.closest(".app-brand__seal")) continue;
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

/** Young Hop King in the header — walks on title only; static idle during play. */
export function syncBrandSealToTrail(_trailPct: number, phase: string): void {
  const el = document.querySelector<HTMLElement>(".app-brand__seal [data-meeker-sprite]");
  if (!el) return;

  const { id, anim } = playerBoxMeekerSprite(phase);
  const prevAnim = el.dataset.meekerAnim;
  const prevId = el.dataset.meekerSprite;

  el.dataset.meekerSprite = id;
  el.dataset.meekerAnim = anim;

  const walkTimerWhileStatic =
    (anim === "icon-front" || anim === "idle-west") && timers.has(el);
  const needsWalkRestart =
    (anim === "walk-west" || anim === "walk-front") && !timers.has(el);
  if (prevAnim !== anim || prevId !== id || walkTimerWhileStatic || needsWalkRestart) {
    mountMeekerSprite(el, { force: true });
  }
}

let brandWatchStarted = false;

/** Keep header Ezra drawn; never restart walk loop during play. */
export function startBrandSealWatch(): void {
  if (brandWatchStarted) return;
  brandWatchStarted = true;
  window.setInterval(() => {
    const el = document.querySelector<HTMLElement>(".app-brand__seal [data-meeker-sprite]");
    if (!el) return;
    const playing = !!document.querySelector(".app-layout.is-playing");
    if (playing && (el.dataset.meekerAnim === "walk-west" || el.dataset.meekerAnim === "walk-front")) {
      el.dataset.meekerAnim = "icon-front";
      mountMeekerSprite(el, { force: true });
      return;
    }
    if (!el.querySelector("canvas.meeker-sprite__canvas")) {
      mountMeekerSprite(el, { force: true });
      return;
    }
    if (!playing && (el.dataset.meekerAnim === "walk-west" || el.dataset.meekerAnim === "walk-front") && !timers.has(el)) {
      mountMeekerSprite(el, { force: true });
    }
  }, 2000);
}
