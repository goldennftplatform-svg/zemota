import { BOOT_SPLASH_MIN_MS } from "../game/config";
import "./bootSplash.css";

function bootMinMs(): number {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 280;
  } catch {
    /* ignore */
  }
  return BOOT_SPLASH_MIN_MS;
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
  "Optional LAN trail socket…",
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

function waitForSkip(el: HTMLElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    const onKeyCap = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        done();
      }
    };
    el.addEventListener("click", done, { once: true, signal });
    document.addEventListener("keydown", onKeyCap, { capture: true, signal });
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

/**
 * Blocks until fonts + minimum dwell, then animates the boot layer away.
 * Title `render()` should run after this resolves.
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

  const statusEl = el.querySelector<HTMLElement>(".emota-boot__status");
  const bar = el.querySelector<HTMLElement>(".emota-boot__bar");

  let i = 0;
  const tick = window.setInterval(() => {
    if (statusEl) statusEl.textContent = STATUS_LINES[i % STATUS_LINES.length] ?? "";
    i++;
  }, 440);

  const skipAc = new AbortController();
  const t0 = performance.now();
  const fonts = document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve();
  const minWait = (async () => {
    await fonts;
    const minMs = bootMinMs();
    const elapsed = performance.now() - t0;
    const rest = Math.max(0, minMs - elapsed);
    await wait(rest);
  })();
  await Promise.race([minWait, waitForSkip(el, skipAc.signal)]);
  skipAc.abort();

  window.clearInterval(tick);
  el.classList.add("emota-boot--finishing");
  if (bar) bar.style.width = "100%";
  if (statusEl) {
    statusEl.textContent = "Ready — keys 1–9 or click the list to play.";
    statusEl.style.animation = "none";
  }

  await wait(320);
  el.setAttribute("aria-busy", "false");
  el.classList.add("emota-boot--exit");

  await Promise.race([
    wait(720),
    new Promise<void>((resolve) => {
      el.addEventListener("transitionend", () => resolve(), { once: true });
    }),
  ]);

  el.remove();
}
