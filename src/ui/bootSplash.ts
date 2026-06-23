import { BOOT_LANDING_INTRO_MS } from "../game/config";
import "./bootSplash.css";

function bootIntroMs(): number {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 240;
  } catch {
    /* ignore */
  }
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

  if (shouldSkipBootSplash()) {
    el.remove();
    return;
  }

  if (document.documentElement.classList.contains("emota-mobile")) {
    const statusEl = el.querySelector<HTMLElement>(".emota-boot__status");
    const hintWait = el.querySelector<HTMLElement>(".emota-boot__hint--wait");
    const bar = el.querySelector<HTMLElement>(".emota-boot__bar");
    if (hintWait) hintWait.hidden = true;
    if (bar) bar.style.width = "100%";
    if (statusEl) {
      statusEl.textContent = "Real history · Oregon Trail";
      statusEl.style.animation = "none";
    }
    el.classList.remove("emota-boot--intro");
    el.setAttribute("aria-busy", "false");
    await wait(900);
    el.classList.add("emota-boot--exit");
    await wait(340);
    el.remove();
    return;
  }

  const statusEl = el.querySelector<HTMLElement>(".emota-boot__status");
  const bar = el.querySelector<HTMLElement>(".emota-boot__bar");
  const cta = el.querySelector<HTMLButtonElement>("#emota-boot-cta");
  const hintWait = el.querySelector<HTMLElement>(".emota-boot__hint--wait");
  const hintCta = el.querySelector<HTMLElement>(".emota-boot__hint--cta");

  if (!cta) {
    el.remove();
    return;
  }

  let i = 0;
  const tick = window.setInterval(() => {
    if (statusEl) statusEl.textContent = STATUS_LINES[i % STATUS_LINES.length] ?? "";
    i++;
  }, 440);

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
    statusEl.textContent = "Jump-off ready.";
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
  cta.focus({ preventScroll: true });

  const continueAc = new AbortController();
  await waitForLandingContinue(cta, continueAc.signal);
  continueAc.abort();

  el.classList.add("emota-boot--finishing");
  await wait(200);
  el.classList.add("emota-boot--exit");

  await Promise.race([
    wait(720),
    new Promise<void>((resolve) => {
      el.addEventListener("transitionend", () => resolve(), { once: true });
    }),
  ]);

  el.remove();
}
