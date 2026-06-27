import { BOOT_LANDING_INTRO_MS } from "../game/config";
import { renderMeekerSpriteHtml, startMeekerSpriteAnimations } from "./meekerSprites";
import "./bootSplash.css";

function isMobileLanding(): boolean {
  return document.documentElement.classList.contains("emota-mobile");
}

function bootIntroMs(): number {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 240;
  } catch {
    /* ignore */
  }
  if (isMobileLanding()) return Math.max(1200, BOOT_LANDING_INTRO_MS - 200);
  return BOOT_LANDING_INTRO_MS;
}

/** Block-letter EMOTA (UTF-8 box drawing); monospace in CSS */
const ASCII_LOGO = `
      ███████╗███╗   ███╗ ██████╗ ████████╗ █████╗
      ██╔════╝████╗ ████║██╔═══██╗╚══██╔══╝██╔══██╗
      █████╗  ██╔████╔██║██║   ██║   ██║   ███████║
      ██╔══╝  ██║╚██╔╝██║██║   ██║   ██║   ██╔══██║
      ███████╗██║ ╚═╝ ██║╚██████╔╝   ██║   ██║  ██║
      ╚══════╝╚═╝     ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝`.trimStart();

const STATUS_LINES = [
  "Warming CRT phosphor…",
  "Loading wagon roster…",
  "Parsing trail manifest…",
  "Hearing rumors from down the trail…",
];

const MOBILE_STATUS_LINES = [
  "Warming CRT phosphor…",
  "Loading young Hop King…",
  "Real history · Oregon Trail",
  "Jump-off almost ready…",
];

function shouldSkipBootSplash(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("nosplash") === "1") return true;
    if (navigator.webdriver === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function revealAppLayout(): void {
  document.getElementById("app-layout")?.classList.add("app-layout--ready");
}

/** Resolves when the player activates the landing CTA (click or keyboard on button). */
function waitForLandingContinue(cta: HTMLButtonElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    cta.addEventListener("click", finish, { once: true, signal });
    cta.addEventListener(
      "keydown",
      (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          finish();
        }
      },
      { signal },
    );
  });
}

/**
 * Full-screen landing: short CRT intro, then **click required** to reach the title menu.
 */
export async function runBootSplash(): Promise<void> {
  const el = document.getElementById("emota-boot");
  if (!el) return;

  const pre = el.querySelector(".emota-boot__ascii");
  if (pre) pre.textContent = ASCII_LOGO;

  const spriteHost = el.querySelector(".emota-boot__sprite");
  if (spriteHost) {
    spriteHost.innerHTML = renderMeekerSpriteHtml("hopKingYoung", {
      anim: "walk-west",
      size: "hero",
      stage: true,
    });
    startMeekerSpriteAnimations(spriteHost);
  }

  if (shouldSkipBootSplash()) {
    revealAppLayout();
    el.remove();
    return;
  }

  const statusEl = el.querySelector<HTMLElement>(".emota-boot__status");
  const bar = el.querySelector<HTMLElement>(".emota-boot__bar");
  const cta = el.querySelector<HTMLButtonElement>("#emota-boot-cta");
  const hintWait = el.querySelector<HTMLElement>(".emota-boot__hint--wait");
  const hintCta = el.querySelector<HTMLElement>(".emota-boot__hint--cta");

  if (!cta) {
    revealAppLayout();
    el.remove();
    return;
  }

  const mobile = isMobileLanding();
  const statusLines = mobile ? MOBILE_STATUS_LINES : STATUS_LINES;
  let i = 0;
  const tick = window.setInterval(() => {
    if (statusEl) statusEl.textContent = statusLines[i % statusLines.length] ?? "";
    i++;
  }, mobile ? 520 : 440);

  const fonts = document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve();
  await fonts;

  const introMs = bootIntroMs();
  await wait(introMs);

  window.clearInterval(tick);
  el.classList.remove("emota-boot--intro");
  if (bar) {
    bar.style.width = "100%";
  }
  if (statusEl) {
    statusEl.textContent = mobile ? "Tap to open the title menu." : "Jump-off ready.";
    statusEl.style.animation = "none";
  }
  if (hintWait) hintWait.hidden = true;
  cta.hidden = false;
  const hintKeyboard = el.querySelector<HTMLElement>(".emota-boot__hint--keyboard");
  const hintTouch = el.querySelector<HTMLElement>(".emota-boot__hint--touch");
  const easy = document.documentElement.classList.contains("emota-easy-read");
  if (hintKeyboard) hintKeyboard.hidden = easy;
  if (hintTouch) {
    hintTouch.hidden = !easy;
  } else if (hintCta) {
    hintCta.hidden = false;
  }

  el.setAttribute("aria-busy", "false");
  if (!mobile) cta.focus({ preventScroll: true });

  const continueAc = new AbortController();
  await waitForLandingContinue(cta, continueAc.signal);
  continueAc.abort();

  revealAppLayout();
  el.classList.add("emota-boot--finishing");
  await wait(mobile ? 160 : 200);
  el.classList.add("emota-boot--exit");

  await Promise.race([
    wait(mobile ? 680 : 720),
    new Promise<void>((resolve) => {
      el.addEventListener("transitionend", () => resolve(), { once: true });
    }),
  ]);

  el.remove();
}
