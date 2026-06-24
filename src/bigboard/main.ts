/**
 * Projector / “TV wall” — spectator Socket.IO client (no trail:hello).
 * Run from built app: `npm run server` → http://host:3333/bigboard
 */

import { io } from "socket.io-client";
import { initMobileShellClass } from "../mobile-detect";
import { GAME_ART } from "../game/artAssets";
import { TOTAL_TRAIL_MILES } from "../game/config";
import { trailBigboardOverlayPercent } from "../ui/trailMinimap";
import type { TrailFeedEvent, TrailPeer } from "../net/trailProtocol";
import { EMOTA_SOCKET_BASE } from "../net/socketClientOpts";
import { resolveTrailOrigin, persistTrailOriginFromQuery } from "../net/socketUrl";
import { bbFeedIcon, bbTrophyIcon } from "./bbIcons";
import "./bigboard.css";

initMobileShellClass();
persistTrailOriginFromQuery();

/** Projector / TV layout — big map, icon feed, minimal chrome. */
function isWallMode(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("wall") === "1") return true;
    return window.matchMedia("(min-width: 1100px) and (min-height: 600px)").matches;
  } catch {
    return false;
  }
}

function applyWallClass(): void {
  document.documentElement.classList.toggle("bb-wall", isWallMode());
}

applyWallClass();
window.addEventListener("resize", applyWallClass);

const FEED_MAX_DOM = 48;
const FEED_MAX_WALL = 8;
const POPUP_MS = 8200;
const LB_WALL = 6;
const LB_DEFAULT = 12;

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

function feedKindLabel(kind: string): string {
  const m: Record<string, string> = {
    death: "Loss",
    victory: "Victory",
    wipeout: "Wiped out",
    river: "River",
    milestone: "Milestone",
    system: "Trail",
  };
  return m[kind] ?? kind.replace(/_/g, " ");
}

/** Wagon marker on the usa-map raster (same trail knots as the in-game minimap). */
function wagonPosition(miles: number): { left: string; top: string } {
  const { left, top } = trailBigboardOverlayPercent(miles);
  return { left: `${left}%`, top: `${top}%` };
}

type ScoreRow = { name: string; score: number; at: string };

let peers: TrailPeer[] = [];
let feed: TrailFeedEvent[] = [];
let scoreRows: ScoreRow[] = [];
let popupTimer: ReturnType<typeof setTimeout> | null = null;
let connState: "ok" | "warn" | "bad" = "warn";
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
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (/\.vercel\.app$/i.test(host)) {
      return "Live trail not set up yet — host must add the trail server to Vercel.";
    }
  }
  return "Cannot reach the live trail — check the trail server is running.";
}

const app = document.getElementById("app")!;

const popupHost = document.createElement("div");
popupHost.id = "bb-popup-host";
popupHost.hidden = true;
document.body.appendChild(popupHost);

function render(): void {
  const wall = isWallMode();
  const conn = connState;
  const connClass = conn === "ok" ? "bb-live--ok" : conn === "bad" ? "" : "bb-live--warn";
  const connLabel = conn === "ok" ? "Live" : conn === "bad" ? "Offline" : "Connecting";
  const wagonCount = peers.length;

  const feedLimit = wall ? FEED_MAX_WALL : FEED_MAX_DOM;
  const feedHtml = feed
    .slice(0, feedLimit)
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
      const label = feedKindLabel(ev.kind);
      if (wall) {
        return `<div class="bb-feed__item ${mod}" data-id="${escapeHtml(ev.id)}">
        <span class="bb-feed__ico-wrap" title="${escapeHtml(label)}">${bbFeedIcon(ev.kind)}</span>
        <span class="bb-feed__text"><strong>${escapeHtml(ev.displayName)}</strong> · ${escapeHtml(ev.text)}</span>
      </div>`;
      }
      return `<div class="bb-feed__item ${mod}" data-id="${escapeHtml(ev.id)}">
        <span class="bb-feed__ico-wrap">${bbFeedIcon(ev.kind)}</span>
        <div class="bb-feed__copy">
          <div class="bb-feed__meta">${escapeHtml(label)} · ${escapeHtml(ev.displayName)}</div>
          <div class="bb-feed__text">${escapeHtml(ev.text)}</div>
        </div>
      </div>`;
    })
    .join("");

  const markersHtml = peers
    .map((p) => {
      const pos = wagonPosition(p.miles);
      const h = hueFor(p.displayName);
      const meta = wall
        ? `${Math.round(p.miles)} mi`
        : `${Math.round(p.miles)} mi · day ${p.day}${p.alive != null ? ` · ${p.alive} alive` : ""}`;
      return `<div class="bb-wagon" style="left:${pos.left};top:${pos.top};--h:${h}">
        <div class="bb-wagon__icon" style="filter:hue-rotate(${h % 80}deg) drop-shadow(0 0 10px rgba(57,255,120,0.55))">${wagonIconSvg()}</div>
        <div class="bb-wagon__name">${escapeHtml(p.displayName)}</div>
        <div class="bb-wagon__meta">${escapeHtml(meta)}</div>
      </div>`;
    })
    .join("");

  const playLink =
    typeof window !== "undefined" ? `${window.location.host}/play` : "zemota.vercel.app/play";
  const joinLink =
    typeof window !== "undefined" ? `${window.location.host}/join` : "zemota.vercel.app/join";

  const lobbyHint =
    conn === "ok" && peers.length === 0
      ? `<div class="bb-lobby" role="status">
          <strong>Waiting for wagons.</strong>
          <ol class="bb-lobby__steps">
            <li>Scan the QR on the sign — or open <strong>${escapeHtml(playLink)}</strong></li>
            <li>Tap <strong>Play now</strong></li>
            <li>Wagons appear here automatically</li>
          </ol>
          <p class="bb-lobby__host">No sign yet? Host prints one at <strong>${escapeHtml(joinLink)}</strong></p>
        </div>`
      : "";

  const joinBanner = joinToast
    ? `<div class="bb-join-banner" role="status">${escapeHtml(joinToast)}</div>`
    : "";

  const top = scoreRows[0];
  const topScoreHtml = top
    ? `<span class="bb-stat bb-stat--gold"><span class="bb-stat__ico">${bbTrophyIcon()}</span><span class="bb-stat__val">${escapeHtml(String(top.score))}</span><span class="bb-stat__lbl">${escapeHtml(top.name)}</span></span>`
    : `<span class="bb-stat bb-stat--muted">No scores yet</span>`;

  const lbCap = wall ? LB_WALL : LB_DEFAULT;
  const lbRows = scoreRows.slice(0, lbCap);
  const leaderboardBody =
    lbRows.length > 0
      ? `<ol class="bb-lb__list" aria-label="Top scores">
          ${lbRows
            .map(
              (r, i) => `<li class="bb-lb__item">
            <span class="bb-lb__rank" aria-hidden="true">${i + 1}</span>
            <span class="bb-lb__name">${escapeHtml(r.name)}</span>
            <span class="bb-lb__score">${escapeHtml(String(r.score))}</span>
          </li>`,
            )
            .join("")}
        </ol>`
      : `<p class="bb-lb__empty">Scores appear when someone reaches Oregon.</p>`;

  const connHint =
    conn !== "ok"
      ? `<span class="bb-stat bb-stat--warn">${escapeHtml(socketTargetDisplay())}</span>`
      : wall
        ? ""
        : `<span class="bb-stat bb-stat--muted">Updates as people play</span>`;

  app.innerHTML = `
    <div class="bb-root">
      <div class="bb-vignette" aria-hidden="true"></div>
      <header class="bb-header">
        <div class="bb-brand">
          <img class="bb-brand__mark" src="/art/drunkcowboy-pioneer.png" width="48" height="48" alt="" decoding="async" />
          <div>
            <div class="bb-brand__title">EMOTA · Live Trail</div>
            <div class="bb-brand__sub">Oregon · ${TOTAL_TRAIL_MILES} miles west</div>
          </div>
        </div>
        <div class="bb-stats">
          <span class="bb-stat bb-live ${connClass}"><span class="bb-live__dot" aria-hidden="true"></span><span class="bb-stat__lbl">${connLabel}</span></span>
          <span class="bb-stat"><span class="bb-stat__val">${wagonCount}</span><span class="bb-stat__lbl">wagons</span></span>
          ${topScoreHtml}
          ${connHint}
        </div>
      </header>
      ${joinBanner}
      <section class="bb-lb" aria-labelledby="bb-lb-title">
        <h2 id="bb-lb-title" class="bb-lb__title">Leaderboard</h2>
        <div class="bb-lb__body">${leaderboardBody}</div>
      </section>
      <div class="bb-main">
        <div class="bb-map-wrap">
          <img class="bb-map__raster" src="${GAME_ART.usaMap}" alt="" aria-hidden="true" decoding="async" />
          <div class="bb-markers" id="markers">${lobbyHint}${markersHtml}</div>
          <div class="bb-map-labels">
            <span>Oregon</span>
            <span>The Oregon Trail</span>
            <span>Ohio</span>
          </div>
        </div>
        <aside class="bb-feed" aria-label="Trail news">
          <div class="bb-feed__head">Trail news</div>
          <div class="bb-feed__list" id="feed-list">${feedHtml || `<div class="bb-feed__item bb-feed__item--idle">Waiting for trail news…</div>`}</div>
        </aside>
      </div>
    </div>
  `;
}

function showBigPopup(ev: TrailFeedEvent): void {
  if (!["death", "victory", "wipeout"].includes(ev.kind)) return;
  const el = popupHost;
  if (!el) return;
  el.hidden = false;
  const art = ev.kind === "death" ? "" : ev.kind === "victory" ? "★" : "✖";
  const artHtml =
    ev.kind === "death"
      ? `<img class="bb-popup__img" src="${GAME_ART.drunkcowboyGameOver}" alt="" decoding="async" />`
      : `<div class="bb-popup__art" aria-hidden="true">${art}</div>`;
  const cardMod =
    ev.kind === "death" ? "bb-popup__card--death" : ev.kind === "victory" ? "bb-popup__card--victory" : "bb-popup__card--wipeout";
  const title =
    ev.kind === "death" ? "LOSS ON THE TRAIL" : ev.kind === "victory" ? "OREGON REACHED" : "WAGON LOST";
  el.innerHTML = `<div class="bb-popup">
    <div class="bb-popup__card ${cardMod}">
      <span class="bb-popup__ico">${bbFeedIcon(ev.kind)}</span>
      ${artHtml}
      <h2 class="bb-popup__title">${escapeHtml(title)}</h2>
      <p class="bb-popup__body"><strong>${escapeHtml(ev.displayName)}</strong> — ${escapeHtml(ev.text)}</p>
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
    setConn("ok");
  });
  socket.on("disconnect", () => setConn("bad"));
  socket.on("connect_error", () => {
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
