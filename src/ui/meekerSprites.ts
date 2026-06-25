import {
  MEEKER_IDLE_WEST_FRAME,
  MEEKER_SPRITE_SHEETS,
  MEEKER_WALK_WEST_FRAMES,
  type MeekerSpriteAnim,
  type MeekerSpriteId,
  type MeekerSpriteSheet,
} from "../game/meekerSpriteSheets";
import "../css/meeker-sprites.css";

const timers = new WeakMap<HTMLElement, ReturnType<typeof setInterval>>();

function frameBgPosition(frameIndex: number, sheet: MeekerSpriteSheet): string {
  const col = frameIndex % sheet.cols;
  const row = Math.floor(frameIndex / sheet.cols);
  const x = sheet.cols <= 1 ? 0 : (col / (sheet.cols - 1)) * 100;
  const y = sheet.rows <= 1 ? 0 : (row / (sheet.rows - 1)) * 100;
  return `${x}% ${y}%`;
}

export function applyMeekerSpriteFrame(
  el: HTMLElement,
  sheet: MeekerSpriteSheet,
  frameIndex: number,
): void {
  el.style.backgroundImage = `url(${sheet.src})`;
  el.style.backgroundSize = `${sheet.cols * 100}% ${sheet.rows * 100}%`;
  el.style.backgroundPosition = frameBgPosition(frameIndex, sheet);
  el.style.backgroundRepeat = "no-repeat";
}

function framesForAnim(anim: MeekerSpriteAnim): readonly number[] {
  return anim === "walk-west" ? MEEKER_WALK_WEST_FRAMES : [MEEKER_IDLE_WEST_FRAME];
}

export function renderMeekerSpriteHtml(
  id: MeekerSpriteId,
  opts?: {
    anim?: MeekerSpriteAnim;
    size?: "hero" | "brand" | "wagon" | "popup" | "recap";
    className?: string;
    label?: string;
  },
): string {
  const anim = opts?.anim ?? "idle-west";
  const size = opts?.size ?? "hero";
  const extra = opts?.className ? ` ${opts.className}` : "";
  const label = opts?.label ?? "";
  const aria = label ? ` aria-label="${label.replace(/"/g, "&quot;")}"` : ` aria-hidden="true"`;
  return `<span class="meeker-sprite meeker-sprite--${size}${extra}" data-meeker-sprite="${id}" data-meeker-anim="${anim}"${aria}></span>`;
}

export function mountMeekerSprite(el: HTMLElement): void {
  const prev = timers.get(el);
  if (prev) clearInterval(prev);
  timers.delete(el);

  const id = el.dataset.meekerSprite as MeekerSpriteId | undefined;
  if (!id || !MEEKER_SPRITE_SHEETS[id]) return;

  const sheet = MEEKER_SPRITE_SHEETS[id];
  const anim = (el.dataset.meekerAnim as MeekerSpriteAnim | undefined) ?? "idle-west";
  const frames = framesForAnim(anim);
  let fi = 0;

  const tick = (): void => {
    applyMeekerSpriteFrame(el, sheet, frames[fi]!);
    fi = (fi + 1) % frames.length;
  };

  tick();
  if (anim === "walk-west" && frames.length > 1) {
    timers.set(el, setInterval(tick, 240));
  }
}

export function startMeekerSpriteAnimations(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-meeker-sprite]")) {
    mountMeekerSprite(el);
  }
}

export function preloadMeekerSprites(): Promise<void> {
  return Promise.all(
    Object.values(MEEKER_SPRITE_SHEETS).map(
      (sheet) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = sheet.src;
        }),
    ),
  ).then(() => undefined);
}

const HOP_KING_SHARE_TEXT =
  "I'm riding the Old Oregon Trail with young Ezra Meeker — Hop King edition. Name your wagon and survive to hop country!";

/** Share link + Hop King hook (Web Share API or clipboard). */
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
