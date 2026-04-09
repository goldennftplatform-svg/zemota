/**
 * Projector / “TV wall” — spectator Socket.IO client (no trail:hello).
 * Run from built app: `npm run server` → http://host:3333/bigboard
 */

import { io } from "socket.io-client";
import { initMobileShellClass } from "../mobile-detect";
import { TOTAL_TRAIL_MILES } from "../game/config";
import type { TrailFeedEvent, TrailPeer } from "../net/trailProtocol";
import { EMOTA_SOCKET_BASE } from "../net/socketClientOpts";
import { resolveTrailOrigin, trailServerOrigin } from "../net/socketUrl";
import "./bigboard.css";

initMobileShellClass();

const FEED_MAX_DOM = 48;
const POPUP_MS = 8200;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

/** West (Oregon) left · East (Missouri) right — matches how the trail reads on a wall. */
function wagonPosition(miles: number): { left: string; top: string } {
  const t = Math.max(0, Math.min(1, miles / TOTAL_TRAIL_MILES));
  const left = 6 + (1 - t) * 86;
  const wave = Math.sin(miles * 0.02) * 4;
  const top = 48 + wave + ((1 - t) - 0.5) * 6;
  return { left: `${left}%`, top: `${top}%` };
}

type ScoreRow = { name: string; score: number; at: string };

let peers: TrailPeer[] = [];
let feed: TrailFeedEvent[] = [];
let scoreRows: ScoreRow[] = [];
let popupTimer: ReturnType<typeof setTimeout> | null = null;
let connState: "ok" | "warn" | "bad" = "warn";
let lastSocketError = "";
let lastPeerIds = new Set<string>();
let roomSyncCount = 0;
let joinToast: string | null = null;
let joinToastTimer: ReturnType<typeof setTimeout> | null = null;
/** Set after `resolveTrailOrigin()` so the status line can show tunnel URL from `/trail.json`. */
let lastResolvedOrigin: string | undefined;

/** Simple covered-wagon icon (reads on projector / wall). */
function wagonIconSvg(): string {
  return `<svg class="bb-wagon-svg" viewBox="0 0 56 36" aria-hidden="true" focusable="false">
    <ellipse cx="14" cy="28" rx="10" ry="6" fill="#1a1814" stroke="#39ff7a" stroke-width="1.2"/>
    <ellipse cx="40" cy="28" rx="10" ry="6" fill="#1a1814" stroke="#39ff7a" stroke-width="1.2"/>
    <path fill="#2a2218" stroke="#39ff7a" stroke-width="1.5" d="M8 14 L44 14 L48 22 L6 22 Z"/>
    <path fill="#39ff7a" fill-opacity="0.25" d="M10 14 L32 6 L44 14 Z"/>
    <rect x="22" y="8" width="6" height="6" fill="#39ff7a" fill-opacity="0.5" rx="1"/>
  </svg>`;
}

function socketTargetDisplay(): string {
  const o = lastResolvedOrigin ?? trailServerOrigin();
  if (o) return o;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (/\.vercel\.app$/i.test(host)) {
      return "No trail URL — set Vercel VITE_TRAIL_SERVER_URL, or public/trail.json origin, or ?trail=https://…";
    }
    return `${window.location.origin} — use ?trail=http://127.0.0.1:3333 with npm run server, or npm run dev`;
  }
  return "";
}

const app = document.getElementById("app")!;

const popupHost = document.createElement("div");
popupHost.id = "bb-popup-host";
popupHost.hidden = true;
document.body.appendChild(popupHost);

function render(): void {
  const conn = connState;
  const connClass = conn === "ok" ? "bb-live--ok" : conn === "bad" ? "" : "bb-live--warn";
  const connLabel =
    conn === "ok" ? "LIVE · SOCKET" : conn === "bad" ? "OFFLINE" : "CONNECTING…";
  const trailTarget =
    lastResolvedOrigin ??
    trailServerOrigin() ??
    (conn === "ok" && typeof window !== "undefined" ? window.location.origin : undefined);
  const connDetailOk =
    conn === "ok" && trailTarget
      ? `<div class="bb-live__detail bb-live__detail--muted">${escapeHtml(trailTarget)}</div>`
      : "";
  const connDetail =
    conn !== "ok"
      ? `<div class="bb-live__detail">${escapeHtml(socketTargetDisplay())}${
          lastSocketError ? ` · ${escapeHtml(lastSocketError.slice(0, 140))}` : ""
        }</div>`
      : connDetailOk;

  const feedHtml = feed
    .slice(0, FEED_MAX_DOM)
    .map((ev) => {
      const mod =
        ev.kind === "death"
          ? "bb-feed__item--death"
          : ev.kind === "victory"
            ? "bb-feed__item--victory"
            : ev.kind === "wipeout"
              ? "bb-feed__item--wipeout"
              : ev.kind === "river"
                ? "bb-feed__item--river"
                : ev.kind === "milestone"
                  ? "bb-feed__item--milestone"
                  : "";
      return `<div class="bb-feed__item ${mod}" data-id="${escapeHtml(ev.id)}">
        <div class="bb-feed__meta">${escapeHtml(fmtTime(ev.at))} · ${escapeHtml(ev.kind)} · ${escapeHtml(ev.displayName)}</div>
        <div class="bb-feed__text">${escapeHtml(ev.text)}</div>
      </div>`;
    })
    .join("");

  const markersHtml = peers
    .map((p) => {
      const pos = wagonPosition(p.miles);
      const h = hueFor(p.displayName);
      const alive = p.alive != null ? `${p.alive} alive` : "";
      const lm = p.landmark ? p.landmark.slice(0, 28) : "";
      return `<div class="bb-wagon" style="left:${pos.left};top:${pos.top};--h:${h}">
        <div class="bb-wagon__icon" style="filter:hue-rotate(${h % 80}deg) drop-shadow(0 0 10px rgba(57,255,120,0.55))">${wagonIconSvg()}</div>
        <div class="bb-wagon__name">${escapeHtml(p.displayName)}</div>
        <div class="bb-wagon__meta">${Math.round(p.miles)} mi · d${p.day}${alive ? ` · ${alive}` : ""}</div>
        ${lm ? `<div class="bb-wagon__meta">${escapeHtml(lm)}</div>` : ""}
      </div>`;
    })
    .join("");

  const lobbyHint =
    conn === "ok" && peers.length === 0
      ? `<div class="bb-lobby" role="status">
          <strong>No wagons on the wire yet.</strong> Open the <em>game</em> on this site (same trail server) — each player appears here as a wagon when they start a run.
        </div>`
      : "";

  const joinBanner = joinToast
    ? `<div class="bb-join-banner" role="status">${escapeHtml(joinToast)}</div>`
    : "";

  const top = scoreRows[0];
  const boardHighHtml = top
    ? `<div class="bb-high__num">${escapeHtml(String(top.score))}</div>
       <div class="bb-high__who">${escapeHtml(top.name)}</div>`
    : `<div class="bb-high__empty">—</div>`;
  const boardRunners =
    scoreRows.length > 1
      ? scoreRows
          .slice(1, 6)
          .map(
            (r, i) =>
              `<div class="bb-high__row"><span>${i + 2}.</span><span>${escapeHtml(r.name)}</span><span>${escapeHtml(String(r.score))}</span></div>`,
          )
          .join("")
      : "";

  app.innerHTML = `
    <div class="bb-root">
      <div class="bb-vignette" aria-hidden="true"></div>
      <div class="bb-crt" aria-hidden="true"></div>
      <header class="bb-header">
        <div class="bb-brand">
          <img src="/meeker-mark.svg" width="40" height="52" alt="" />
          <div>
            <div class="bb-brand__title">EMOTA · LIVE TRAIL</div>
            <div class="bb-brand__sub">Oregon Trail · classroom · projector wall</div>
          </div>
        </div>
        <div class="bb-high" aria-label="Server leaderboard high score">
          <div class="bb-high__label">// SERVER HIGH</div>
          ${boardHighHtml}
          ${boardRunners ? `<div class="bb-high__list">${boardRunners}</div>` : ""}
        </div>
        <div class="bb-live ${connClass}">
          <span class="bb-live__dot" aria-hidden="true"></span>
          <div class="bb-live__text">
            <span>${connLabel}</span>
            ${connDetail}
          </div>
        </div>
      </header>
      ${joinBanner}
      <div class="bb-main">
        <aside class="bb-feed">
          <div class="bb-feed__head">// SIGNAL FEED</div>
          <div class="bb-feed__list" id="feed-list">${feedHtml || `<div class="bb-feed__item">Waiting for trail events…</div>`}</div>
        </aside>
        <div class="bb-map-wrap">
          <div class="bb-stars" id="stars" aria-hidden="true"></div>
          <svg class="bb-map__svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" aria-label="Trail map">
            <defs>
              <linearGradient id="bbg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#003020;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#001008;stop-opacity:1" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g transform="translate(1000 0) scale(-1 1)">
              <path
                fill="url(#bbg)"
                stroke="#005533"
                stroke-width="2"
                d="M 120 420 L 140 280 L 200 200 L 320 180 L 480 200 L 620 190 L 760 210 L 860 260 L 880 340 L 820 420 L 680 460 L 480 480 L 300 450 L 160 440 Z"
              />
              <path
                fill="none"
                stroke="#39ff7a"
                stroke-width="3"
                stroke-dasharray="10 6"
                opacity="0.55"
                filter="url(#glow)"
                d="M 200 380 Q 380 300 520 320 Q 680 340 780 300"
              />
            </g>
            <text x="260" y="290" fill="#8fffaa" font-family="monospace" font-size="14" opacity="0.55">Oregon</text>
            <text x="780" y="400" fill="#39ff7a" font-family="monospace" font-size="14" opacity="0.5">Independence</text>
          </svg>
          <div class="bb-markers" id="markers">${lobbyHint}${markersHtml}</div>
          <div class="bb-map-labels">
            <span>Oregon · west</span>
            <span>THE OREGON TRAIL · ${TOTAL_TRAIL_MILES} mi</span>
            <span>MO · east · jump-off</span>
          </div>
        </div>
      </div>
    </div>
  `;

  seedStars();
}

function seedStars(): void {
  const host = document.getElementById("stars");
  if (!host) return;
  host.innerHTML = "";
  for (let i = 0; i < 40; i++) {
    const s = document.createElement("div");
    s.className = "bb-star";
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 4}s`;
    host.appendChild(s);
  }
}

function showBigPopup(ev: TrailFeedEvent): void {
  if (!["death", "victory", "wipeout"].includes(ev.kind)) return;
  const el = popupHost;
  if (!el) return;
  el.hidden = false;
  const art = ev.kind === "death" ? "☠" : ev.kind === "victory" ? "★" : "✖";
  const cardMod =
    ev.kind === "death" ? "bb-popup__card--death" : ev.kind === "victory" ? "bb-popup__card--victory" : "bb-popup__card--wipeout";
  const title =
    ev.kind === "death" ? "LOSS ON THE TRAIL" : ev.kind === "victory" ? "OREGON REACHED" : "WAGON LOST";
  el.innerHTML = `<div class="bb-popup">
    <div class="bb-popup__card ${cardMod}">
      <p class="bb-popup__kicker">// EMOTA · LIVE</p>
      <div class="bb-popup__art" aria-hidden="true">${art}</div>
      <h2 class="bb-popup__title">${escapeHtml(title)}</h2>
      <p class="bb-popup__body">${escapeHtml(ev.displayName)} — ${escapeHtml(ev.text)}</p>
    </div>
  </div>`;
  if (popupTimer) clearTimeout(popupTimer);
  popupTimer = setTimeout(() => {
    el.hidden = true;
    el.innerHTML = "";
  }, POPUP_MS);
}

function prependFeed(ev: TrailFeedEvent): void {
  feed = [ev, ...feed].slice(0, 200);
  render();
  showBigPopup(ev);
}

function setConn(s: "ok" | "warn" | "bad"): void {
  connState = s;
  render();
}

render();

const socketOpts = {
  ...EMOTA_SOCKET_BASE,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
};

void resolveTrailOrigin().then((bbOrigin) => {
  lastResolvedOrigin = bbOrigin;
  render();
  const socket = bbOrigin ? io(bbOrigin, socketOpts) : io(socketOpts);

  socket.on("connect", () => {
    lastSocketError = "";
    setConn("ok");
  });
  socket.on("disconnect", () => setConn("bad"));
  socket.on("connect_error", (err: Error) => {
    lastSocketError = err?.message || String(err);
    setConn("warn");
  });

  socket.on("trail:room", (list: TrailPeer[]) => {
    const next = Array.isArray(list) ? list : [];
    roomSyncCount += 1;
    if (roomSyncCount > 1) {
      const newly = next.filter((p) => !lastPeerIds.has(p.id));
      if (newly.length === 1) {
        joinToast = `Wagon on the wire: ${newly[0].displayName}`;
      } else if (newly.length > 1) {
        joinToast =
          `${newly.length} wagons on the wire: ${newly.map((p) => p.displayName).join(" · ")}`.slice(
            0,
            220,
          );
      }
      if (joinToast) {
        if (joinToastTimer) clearTimeout(joinToastTimer);
        joinToastTimer = setTimeout(() => {
          joinToast = null;
          render();
        }, 5000);
      }
    }
    lastPeerIds = new Set(next.map((p) => p.id));
    peers = next;
    render();
  });

  socket.on("trail:feed:sync", (list: TrailFeedEvent[]) => {
    feed = Array.isArray(list) ? [...list].reverse() : [];
    render();
  });

  socket.on("trail:feed:append", (ev: TrailFeedEvent) => {
    if (!ev?.id) return;
    prependFeed(ev);
  });

  socket.on("scores:list", (list: unknown) => {
    const rows = Array.isArray(list) ? list : [];
    scoreRows = rows
      .map((r) => {
        const o = r as Record<string, unknown>;
        const name = String(o?.name ?? "").slice(0, 40);
        const score = Number(o?.score);
        const at = String(o?.at ?? "");
        if (!name || !Number.isFinite(score)) return null;
        return { name, score, at };
      })
      .filter((x): x is ScoreRow => x != null);
    render();
  });
});
