/**
 * Projector / “TV wall” — spectator Socket.IO client (no trail:hello).
 * Run from built app: `npm run server` → http://host:3333/bigboard
 */

import { io, type Socket } from "socket.io-client";
import { initMobileShellClass } from "../mobile-detect";
import { GAME_ART } from "../game/artAssets";
import { TOTAL_TRAIL_MILES } from "../game/config";
import { trailPortraitNormAt } from "../game/trailChartCoords";
import type { TrailFeedEvent, TrailPeer } from "../net/trailProtocol";
import { EMOTA_SOCKET_BASE } from "../net/socketClientOpts";
import { clearStoredTrailOrigin, persistTrailOriginFromQuery, resolveTrailOrigin } from "../net/socketUrl";
import {
  BIGBOARD_MUSEUM_STATS,
  MEEKER_MANSION_HISTORY_URL,
  pickBigboardRotatingFact,
} from "../data/mansionHistory";
import {
  preloadMeekerSprites,
  renderMeekerSpriteHtml,
  startMeekerSpriteAnimations,
} from "../ui/meekerSprites";
import { renderPartyRoster, hydratePartySkins } from "../ui/partyFigures";
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

/** Meeker history / trail facts on the wall dock — new pick every 40s. */
export const BIGBOARD_FACT_ROTATE_MS = 40_000;

let rotatingFact: { title: string; body: string } = {
  title: "Meeker Mansion · history",
  body: "Facts from Ezra Meeker, the Oregon Trail, and the Hop King museum roll here while wagons travel.",
};
let lastFactKey = "";
let factRotateTick = 0;

function refreshRotatingFact(): void {
  const sorted = [...peers].sort((a, b) => b.miles - a.miles);
  const leader = sorted[0];
  const leadMiles = leader?.miles ?? 0;
  const next = pickBigboardRotatingFact(leadMiles, leader?.landmark, lastFactKey || undefined);
  const key = `${next.title}\0${next.body}`;
  if (key === lastFactKey && lastFactKey) return;
  lastFactKey = key;
  rotatingFact = next;
  factRotateTick += 1;
}

applyWallClass();
window.addEventListener("resize", applyWallClass);
window.addEventListener("resize", () => render());

setInterval(() => {
  if (!isWallMode()) return;
  refreshRotatingFact();
  render();
}, BIGBOARD_FACT_ROTATE_MS);

const FEED_MAX_DOM = 48;
const FEED_MAX_WALL = 8;
const POPUP_MS_WALL = 4200;
const POPUP_MS_DEFAULT = 5500;
const WAGON_LOSS_FLASH_MS = 2800;
const LOSS_CALLOUT_MS = 5200;
const LB_WALL = 6;
const LB_DEFAULT = 12;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
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

/** Place wagons on the horizontal Ezra Meeker chart (east right → west left). */
function layoutWagonsOnChart(): void {
  const inner = document.getElementById("bb-map-inner");
  if (!inner) return;

  for (const el of inner.querySelectorAll<HTMLElement>(".bb-wagon")) {
    const miles = Number(el.dataset.miles ?? 0);
    const { x, y } = trailPortraitNormAt(miles);
    const bob = Math.sin(miles * 0.02) * 0.004;
    el.style.left = `${x * 100}%`;
    el.style.top = `${(y + bob) * 100}%`;
  }
}

function scheduleWagonLayout(): void {
  requestAnimationFrame(() => {
    layoutWagonsOnChart();
    requestAnimationFrame(layoutWagonsOnChart);
  });
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
let serverReportedPeers = -1;
let bbSocket: Socket | null = null;
let deathCallout: string | null = null;
let deathCalloutTimer: ReturnType<typeof setTimeout> | null = null;
/** displayName → flash end timestamp (ms) */
const wagonLossFlashUntil = new Map<string, number>();
const wagonLossFlashTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isWagonLossFlashing(displayName: string): boolean {
  const until = wagonLossFlashUntil.get(displayName);
  return until != null && until > Date.now();
}

function startWagonLossFlash(displayName: string): void {
  const name = displayName.trim();
  if (!name) return;
  wagonLossFlashUntil.set(name, Date.now() + WAGON_LOSS_FLASH_MS);
  const prev = wagonLossFlashTimers.get(name);
  if (prev) clearTimeout(prev);
  wagonLossFlashTimers.set(
    name,
    setTimeout(() => {
      wagonLossFlashUntil.delete(name);
      wagonLossFlashTimers.delete(name);
      render();
    }, WAGON_LOSS_FLASH_MS),
  );
}

function showLossCallout(ev: TrailFeedEvent): void {
  deathCallout = `${ev.displayName} — ${ev.text}`;
  if (deathCalloutTimer) clearTimeout(deathCalloutTimer);
  deathCalloutTimer = setTimeout(() => {
    deathCallout = null;
    render();
  }, LOSS_CALLOUT_MS);
  startWagonLossFlash(ev.displayName);
}

/** Ezra + wagon pixel sprite (westbound on the chart). */
function wagonSpriteHtml(): string {
  return renderMeekerSpriteHtml("ezraWagon", { anim: "walk-west", size: "wagon" });
}

function trailHostLabel(): string {
  if (!lastResolvedOrigin) return "trail server";
  try {
    return new URL(lastResolvedOrigin).host;
  } catch {
    return lastResolvedOrigin;
  }
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

function renderDock(wall: boolean): string {
  if (!wall) return "";

  const sorted = [...peers].sort((a, b) => b.miles - a.miles);
  const avgMiles =
    peers.length > 0
      ? Math.round(peers.reduce((sum, p) => sum + p.miles, 0) / peers.length)
      : 0;
  const leader = sorted[0];

  const wagonList =
    sorted.length > 0
      ? sorted
          .slice(0, 6)
          .map(
            (p) => `<li class="bb-dock__row">
          <span class="bb-dock__name">${escapeHtml(p.displayName)}</span>
          <span class="bb-dock__val">${Math.round(p.miles)} mi</span>
        </li>`,
          )
          .join("")
      : `<li class="bb-dock__empty">Scan QR at /join to play</li>`;

  const newsList =
    feed.length > 0
      ? feed
          .slice(0, 4)
          .map(
            (ev) =>
              `<li class="bb-dock__news${ev.kind === "death" || ev.kind === "wipeout" ? " bb-dock__news--loss" : ""}"><strong>${escapeHtml(ev.displayName)}</strong> · ${escapeHtml(ev.text)}</li>`,
          )
          .join("")
      : `<li class="bb-dock__empty">Trail news will appear here</li>`;

  const lbList =
    scoreRows.length > 0
      ? scoreRows
          .slice(0, 4)
          .map(
            (r, i) => `<li class="bb-dock__row">
          <span class="bb-dock__name">${i + 1}. ${escapeHtml(r.name)}</span>
          <span class="bb-dock__val">${escapeHtml(String(r.score))}</span>
        </li>`,
          )
          .join("")
      : `<li class="bb-dock__empty">No scores yet</li>`;

  const leadLine = leader
    ? `${escapeHtml(leader.displayName)} · ${Math.round(leader.miles)} mi`
    : "—";

  const museumStats = BIGBOARD_MUSEUM_STATS.map(
    (s) => `<span class="bb-dock__chip"><span class="bb-dock__chip-k">${escapeHtml(s.k)}</span> ${escapeHtml(s.v)}</span>`,
  ).join("");

  const historyRollClass = factRotateTick > 0 ? " bb-dock__history--roll" : "";

  const leaderAlive = leader?.alive ?? leader?.party?.filter((m) => m.alive).length;
  const leaderCap = leader?.partyCap ?? 5;
  const leaderPartyRows =
    leader?.party && leader.party.length > 0
      ? leader.party.map((m) => ({ name: m.name, alive: m.alive }))
      : Array.from({ length: leaderCap }, (_, i) => ({
          name: `Traveler ${i + 1}`,
          alive: leaderAlive != null ? i < leaderAlive : true,
        }));
  const leaderPartyBlock =
    leader && leaderPartyRows.length > 0
      ? `<div class="bb-dock__party">
          <span class="bb-dock__party-chip">Party · ${leaderAlive ?? "?"}/${leaderCap}</span>
          ${renderPartyRoster(leaderPartyRows, { compact: true, showNames: false })}
          <p class="bb-dock__sub bb-dock__sub--lead">${leadLine}</p>
        </div>`
      : `<p class="bb-dock__empty">Party roster when wagons join</p>`;

  return `<section class="bb-dock" aria-label="Trail dashboard">
    <div class="bb-dock__panel">
      <h3 class="bb-dock__head">Wagons on trail</h3>
      <ol class="bb-dock__list">${wagonList}</ol>
    </div>
    <div class="bb-dock__panel bb-dock__panel--party">
      <h3 class="bb-dock__head">Lead wagon party</h3>
      ${leaderPartyBlock}
      <div class="bb-dock__sub">${peers.length} active · avg ${avgMiles} mi</div>
    </div>
    <div class="bb-dock__panel">
      <h3 class="bb-dock__head">Latest news</h3>
      <ul class="bb-dock__list">${newsList}</ul>
    </div>
    <div class="bb-dock__panel">
      <h3 class="bb-dock__head">Top scores</h3>
      <ol class="bb-dock__list">${lbList}</ol>
    </div>
    <div class="bb-dock__panel bb-dock__panel--history">
      <h3 class="bb-dock__head">Meeker Mansion · history</h3>
      <div class="bb-dock__history-slot" aria-live="polite" aria-atomic="true">
        <p class="bb-dock__history-title${historyRollClass}">${escapeHtml(rotatingFact.title)}</p>
        <p class="bb-dock__history-body${historyRollClass}">${escapeHtml(rotatingFact.body)}</p>
      </div>
      <div class="bb-dock__chips">${museumStats}</div>
      <a class="bb-dock__link" href="${MEEKER_MANSION_HISTORY_URL}" target="_blank" rel="noopener noreferrer">Full museum story →</a>
    </div>
  </section>`;
}

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
      const h = hueFor(p.displayName);
      const flashing = isWagonLossFlashing(p.displayName);
      const meta = wall
        ? `${Math.round(p.miles)} mi`
        : `${Math.round(p.miles)} mi · day ${p.day}${p.alive != null ? ` · ${p.alive} alive` : ""}`;
      return `<div class="bb-wagon${flashing ? " bb-wagon--loss-flash" : ""}" data-miles="${p.miles}" data-display-name="${escapeAttr(p.displayName)}" style="--h:${h}">
        <div class="bb-wagon__icon" style="filter:hue-rotate(${h % 80}deg)">${wagonSpriteHtml()}</div>
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
          <p class="bb-lobby__server">Trail room: <strong>${escapeHtml(trailHostLabel())}</strong>${
            serverReportedPeers > 0
              ? ` · server sees <strong>${serverReportedPeers}</strong> wagon${serverReportedPeers === 1 ? "" : "s"} — syncing…`
              : ""
          }</p>
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

  const lossCalloutHtml = deathCallout
    ? `<div class="bb-loss-callout" role="alert">
        <span class="bb-loss-callout__ico">${bbFeedIcon("death")}</span>
        <span class="bb-loss-callout__text">${escapeHtml(deathCallout)}</span>
      </div>`
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
      : !wall
        ? `<span class="bb-stat bb-stat--muted">Updates as people play</span>`
        : "";

  const liveChip = `<span class="bb-live-chip ${connClass}" role="status" aria-label="${escapeHtml(connLabel)} · ${wagonCount} wagons on trail">
    <span class="bb-live__dot" aria-hidden="true"></span>
    <span class="bb-live-chip__n">${wagonCount}</span>
  </span>`;

  const headerHtml = wall
    ? ""
    : `<header class="bb-header bb-header--slim">
        <div class="bb-brand bb-brand--slim">
          <span class="bb-brand__mark">${renderMeekerSpriteHtml("hopKingYoung", { anim: "walk-west", size: "brand" })}</span>
          <span class="bb-brand__title">EMOTA</span>
        </div>
        <div class="bb-header__end">
          ${liveChip}
          ${topScoreHtml}
          ${connHint}
        </div>
      </header>`;

  const lbSection = wall
    ? ""
    : `<section class="bb-lb" aria-labelledby="bb-lb-title">
        <h2 id="bb-lb-title" class="bb-lb__title">Leaderboard</h2>
        <div class="bb-lb__body">${leaderboardBody}</div>
      </section>`;

  app.innerHTML = `
    <div class="bb-root">
      <div class="bb-vignette" aria-hidden="true"></div>
      ${headerHtml}
      ${joinBanner}
      ${lbSection}
      <div class="bb-main">
        <div class="bb-map-wrap">
          ${wall ? liveChip : ""}
          ${conn !== "ok" && wall ? `<div class="bb-conn-warn" role="alert">${escapeHtml(socketTargetDisplay())}</div>` : ""}
          <div class="bb-map-stage" id="bb-map-stage">
            ${lobbyHint}
            ${lossCalloutHtml}
            <div class="bb-map-inner" id="bb-map-inner">
              <img class="bb-map__raster" id="bb-map-img" src="${GAME_ART.oregonTrailMap}" alt="" aria-hidden="true" decoding="async" />
              <div class="bb-markers" id="markers">${markersHtml}</div>
              <div class="bb-map-labels">
                <span class="bb-map-label bb-map-label--w">Oregon City</span>
                <span class="bb-map-label bb-map-label--title">The Old Oregon Trail</span>
                <span class="bb-map-label bb-map-label--e">Independence</span>
              </div>
            </div>
          </div>
          ${renderDock(wall)}
        </div>
        <aside class="bb-feed" aria-label="Trail news">
          <div class="bb-feed__head">Trail news</div>
          <div class="bb-feed__list" id="feed-list">${feedHtml || `<div class="bb-feed__item bb-feed__item--idle">Waiting for trail news…</div>`}</div>
        </aside>
      </div>
    </div>
  `;

  const mapImg = document.getElementById("bb-map-img") as HTMLImageElement | null;
  if (mapImg) {
    if (mapImg.complete) scheduleWagonLayout();
    else mapImg.addEventListener("load", scheduleWagonLayout, { once: true });
  }
  scheduleWagonLayout();
  startMeekerSpriteAnimations(app);
  hydratePartySkins(app);
}

function showBigPopup(ev: TrailFeedEvent): void {
  if (!["death", "victory", "wipeout"].includes(ev.kind)) return;
  const el = popupHost;
  if (!el) return;
  const wall = isWallMode();
  el.classList.toggle("bb-popup-host--toast", wall);
  el.hidden = false;
  const art = ev.kind === "death" ? "" : ev.kind === "victory" ? "★" : "✖";
  const artHtml =
    ev.kind === "death" && !wall
      ? `<div class="bb-popup__sprite">${renderMeekerSpriteHtml("ezraElder", { anim: "idle-west", size: "hero", stage: true })}</div>`
      : ev.kind === "victory" && !wall
        ? `<div class="bb-popup__sprite">${renderMeekerSpriteHtml("hopKingYoung", { anim: "walk-west", size: "hero", stage: true })}</div>`
        : ev.kind === "death"
          ? ""
          : `<div class="bb-popup__art" aria-hidden="true">${art}</div>`;
  const cardMod =
    ev.kind === "death"
      ? `bb-popup__card--death${wall ? " bb-popup__card--toast" : ""}`
      : ev.kind === "victory"
        ? `bb-popup__card--victory${wall ? " bb-popup__card--toast" : ""}`
        : `bb-popup__card--wipeout${wall ? " bb-popup__card--toast" : ""}`;
  const title =
    ev.kind === "death" ? "LOSS ON THE TRAIL" : ev.kind === "victory" ? "OREGON REACHED" : "WAGON LOST";
  el.innerHTML = `<div class="bb-popup${wall ? " bb-popup--toast" : ""}">
    <div class="bb-popup__card ${cardMod}">
      <span class="bb-popup__ico">${bbFeedIcon(ev.kind)}</span>
      ${artHtml}
      <h2 class="bb-popup__title">${escapeHtml(title)}</h2>
      <p class="bb-popup__body"><strong>${escapeHtml(ev.displayName)}</strong> — ${escapeHtml(ev.text)}</p>
    </div>
  </div>`;
  startMeekerSpriteAnimations(el);
  if (popupTimer) clearTimeout(popupTimer);
  popupTimer = setTimeout(() => {
    el.hidden = true;
    el.innerHTML = "";
  }, wall ? POPUP_MS_WALL : POPUP_MS_DEFAULT);
}

function prependFeed(ev: TrailFeedEvent): void {
  feed = [ev, ...feed].slice(0, 200);
  if (ev.kind === "death" || ev.kind === "wipeout") {
    showLossCallout(ev);
  }
  render();
  showBigPopup(ev);
}

function setConn(s: "ok" | "warn" | "bad"): void {
  connState = s;
  render();
}

refreshRotatingFact();
void preloadMeekerSprites();
render();

const socketOpts = {
  ...EMOTA_SOCKET_BASE,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  autoConnect: false as const,
};

function wireBigboardSocket(socket: Socket): void {
  bbSocket = socket;

  socket.on("connect", () => {
    setConn("ok");
    socket.emit("trail:room:request");
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
}

async function openBigboardSocket(retriedAfterClear: boolean): Promise<void> {
  if (bbSocket) {
    bbSocket.removeAllListeners();
    bbSocket.disconnect();
    bbSocket = null;
  }

  const bbOrigin = await resolveTrailOrigin();
  lastResolvedOrigin = bbOrigin;
  render();

  const socket = bbOrigin ? io(bbOrigin, socketOpts) : io(socketOpts);
  wireBigboardSocket(socket);

  socket.on("connect_error", () => {
    if (!retriedAfterClear) {
      clearStoredTrailOrigin();
      void openBigboardSocket(true);
    }
  });

  socket.connect();
}

void openBigboardSocket(false);

/** If connected room is empty but /health reports peers, reconnect to canonical trail server. */
setInterval(() => {
  if (connState !== "ok" || !lastResolvedOrigin) return;
  void fetch(`${lastResolvedOrigin}/health`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { peers?: number } | null) => {
      if (!j || typeof j.peers !== "number") return;
      serverReportedPeers = j.peers;
      if (j.peers > 0 && peers.length === 0) {
        clearStoredTrailOrigin();
        void openBigboardSocket(true);
        return;
      }
      if (j.peers > peers.length) {
        bbSocket?.emit("trail:room:request");
      }
      render();
    })
    .catch(() => {
      /* ignore */
    });
}, 15_000);
