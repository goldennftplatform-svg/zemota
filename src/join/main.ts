/**
 * Printable event sign — big QR codes for phones + projector setup.
 * `/join` · `/event` (aliases) · local: `npm run server` → /join
 */

import QRCode from "qrcode";
import "./join.css";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayUrl(url: string): string {
  const u = new URL(url);
  const path = u.pathname === "/" ? "" : u.pathname;
  return `${u.host}${path}${u.search}`;
}

async function paintQr(canvas: HTMLCanvasElement, url: string, size: number): Promise<void> {
  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin: 2,
    color: { dark: "#001408", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}

function copyText(text: string, btn: HTMLButtonElement): void {
  void navigator.clipboard?.writeText(text).then(
    () => {
      const prev = btn.textContent;
      btn.textContent = "Copied!";
      window.setTimeout(() => {
        btn.textContent = prev;
      }, 1600);
    },
    () => {
      window.prompt("Copy this link:", text);
    },
  );
}

async function boot(): Promise<void> {
  const root = document.getElementById("join-app")!;
  const origin = window.location.origin;
  const playUrl = `${origin}/play`;
  const boardUrl = `${origin}/bigboard?wall=1`;
  const signUrl = `${origin}/join`;

  root.innerHTML = `
    <header class="join-header">
      <p class="join-kicker">Ezra Meeker · Oregon Trail</p>
      <h1 class="join-title">Scan to play</h1>
      <p class="join-lead">No app to install. Same link works at the event and at home later.</p>
    </header>

    <section class="join-card join-card--play" aria-labelledby="join-play-heading">
      <h2 id="join-play-heading" class="join-card__heading">On your phone</h2>
      <div class="join-qr-wrap">
        <canvas id="join-play-qr" class="join-qr" width="280" height="280" role="img" aria-label="QR code to open the game"></canvas>
      </div>
      <p class="join-url" id="join-play-url">${escapeHtml(displayUrl(playUrl))}</p>
      <ol class="join-steps">
        <li>Scan the code <strong>or</strong> type the address above</li>
        <li>Tap <strong>Play now</strong></li>
        <li>Name your wagon and hit the trail</li>
      </ol>
      <div class="join-actions">
        <button type="button" class="join-btn" id="join-copy-play">Copy play link</button>
        <a class="join-btn join-btn--ghost" href="/play">Open game</a>
      </div>
    </section>

    <section class="join-card join-card--board" aria-labelledby="join-board-heading">
      <h2 id="join-board-heading" class="join-card__heading">For the TV / projector</h2>
      <div class="join-qr-wrap join-qr-wrap--small">
        <canvas id="join-board-qr" class="join-qr join-qr--small" width="200" height="200" role="img" aria-label="QR code for the live bigboard"></canvas>
      </div>
      <p class="join-url join-url--dim" id="join-board-url">${escapeHtml(displayUrl(boardUrl))}</p>
      <p class="join-note">Open this on the big screen so everyone sees wagons move on the map.</p>
      <div class="join-actions">
        <button type="button" class="join-btn join-btn--ghost" id="join-copy-board">Copy board link</button>
        <a class="join-btn join-btn--ghost" href="/bigboard?wall=1" target="_blank" rel="noopener">Open bigboard</a>
      </div>
    </section>

    <section class="join-card join-card--after" aria-labelledby="join-after-heading">
      <h2 id="join-after-heading" class="join-card__heading">After the event</h2>
      <p class="join-note join-note--hi">Players keep the same link. Their wagon saves on their phone — they can finish the trail at home.</p>
    </section>

    <footer class="join-footer">
      <button type="button" class="join-btn join-btn--print" id="join-print">Print this sign</button>
      <p class="join-footer__meta">Event sign · <span>${escapeHtml(displayUrl(signUrl))}</span></p>
    </footer>
  `;

  const playCanvas = document.getElementById("join-play-qr") as HTMLCanvasElement;
  const boardCanvas = document.getElementById("join-board-qr") as HTMLCanvasElement;

  await Promise.all([
    paintQr(playCanvas, playUrl, 280),
    paintQr(boardCanvas, boardUrl, 200),
  ]);

  document.getElementById("join-copy-play")!.addEventListener("click", (e) => {
    copyText(playUrl, e.currentTarget as HTMLButtonElement);
  });
  document.getElementById("join-copy-board")!.addEventListener("click", (e) => {
    copyText(boardUrl, e.currentTarget as HTMLButtonElement);
  });
  document.getElementById("join-print")!.addEventListener("click", () => window.print());
}

void boot();
