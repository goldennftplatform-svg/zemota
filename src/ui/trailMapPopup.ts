import { GAME_ART } from "../game/artAssets";
import { TOTAL_TRAIL_MILES } from "../game/config";
import { trailPortraitNormAt } from "../game/trailChartCoords";
import type { DashboardSnapshot } from "../game/types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wagonIconSvg(): string {
  return `<svg class="trail-map-popup__wagon-svg" viewBox="0 0 56 36" aria-hidden="true" focusable="false">
    <ellipse cx="14" cy="28" rx="10" ry="6" fill="#1a1814" stroke="#39ff7a" stroke-width="1.2"/>
    <ellipse cx="40" cy="28" rx="10" ry="6" fill="#1a1814" stroke="#39ff7a" stroke-width="1.2"/>
    <path fill="#2a2218" stroke="#39ff7a" stroke-width="1.5" d="M8 14 L44 14 L48 22 L6 22 Z"/>
    <path fill="#39ff7a" fill-opacity="0.25" d="M10 14 L32 6 L44 14 Z"/>
    <rect x="22" y="8" width="6" height="6" fill="#39ff7a" fill-opacity="0.5" rx="1"/>
  </svg>`;
}

export function buildTrailMapPopupHtml(s: DashboardSnapshot, wagonName: string): string {
  const { x, y } = trailPortraitNormAt(s.miles);
  const bob = Math.sin(s.miles * 0.02) * 0.004;
  const left = x * 100;
  const top = (y + bob) * 100;
  const pct = Math.round((s.miles / TOTAL_TRAIL_MILES) * 100);
  const miles = Math.round(s.miles);

  return `
    <div class="trail-map-popup__backdrop" data-close-trail-map="1" aria-hidden="true"></div>
    <div class="trail-map-popup__panel" role="dialog" aria-modal="true" aria-labelledby="trail-map-popup-title">
      <header class="trail-map-popup__head">
        <h2 id="trail-map-popup-title" class="trail-map-popup__title">Your wagon on the trail</h2>
        <button type="button" class="trail-map-popup__close" data-close-trail-map="1" aria-label="Close trail map">×</button>
      </header>
      <div class="trail-map-popup__stage">
        <div class="trail-map-popup__inner">
          <img class="trail-map-popup__raster" src="${GAME_ART.oregonTrailMap}" alt="" decoding="async" />
          <div class="trail-map-popup__markers">
            <div class="trail-map-popup__wagon" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%">
              <div class="trail-map-popup__wagon-icon">${wagonIconSvg()}</div>
              <div class="trail-map-popup__wagon-name">${escapeHtml(wagonName)}</div>
              <div class="trail-map-popup__wagon-meta">${miles} mi · day ${s.day}</div>
            </div>
          </div>
          <div class="trail-map-popup__labels" aria-hidden="true">
            <span class="trail-map-popup__label trail-map-popup__label--e">Independence</span>
            <span class="trail-map-popup__label trail-map-popup__label--title">The Old Oregon Trail</span>
            <span class="trail-map-popup__label trail-map-popup__label--w">Oregon City</span>
          </div>
        </div>
      </div>
      <p class="trail-map-popup__foot">
        <strong>${escapeHtml(s.landmark)}</strong> · Day ${s.day} · ${miles} mi (${pct}%)
      </p>
    </div>
  `.trim();
}

let hostEl: HTMLElement | null = null;

function ensureHost(): HTMLElement {
  if (hostEl) return hostEl;
  hostEl = document.getElementById("trail-map-popup");
  if (!hostEl) {
    hostEl = document.createElement("div");
    hostEl.id = "trail-map-popup";
    hostEl.className = "trail-map-popup";
    hostEl.hidden = true;
    document.body.appendChild(hostEl);
  }
  return hostEl;
}

export function isTrailMapPopupOpen(): boolean {
  const el = hostEl ?? document.getElementById("trail-map-popup");
  return !!el && !el.hidden;
}

export function openTrailMapPopup(s: DashboardSnapshot, wagonName: string): void {
  const el = ensureHost();
  el.innerHTML = buildTrailMapPopupHtml(s, wagonName);
  el.hidden = false;
  el.removeAttribute("aria-hidden");
  el.querySelector<HTMLButtonElement>(".trail-map-popup__close")?.focus();
}

export function closeTrailMapPopup(): void {
  const el = hostEl ?? document.getElementById("trail-map-popup");
  if (!el) return;
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = "";
}
