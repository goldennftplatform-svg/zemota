import "./style.css";
import { initMobileShellClass } from "./mobile-detect";
import { GameEngine, type EnginePhase } from "./game/engine";
import { MULTIPLAYER_CAP } from "./game/config";
import { OverheadMini } from "./ui/overhead";
import { ChanceMini } from "./ui/chanceGames";
import { TrailMultiplayer, getDisplayName } from "./net/multiplayer";
import type { TrailPeer, TrailPeerPartyRow } from "./net/trailProtocol";
import { randomHistoricPartyLine } from "./data/historicNames";
import {
  buildDashboardSidebar,
  buildTravelMenuMobileHud,
  choiceLeadingIcon,
  trailPhaseLabel,
} from "./ui/dashboard";
import { landViewCaption, paintLandView, type LandViewState } from "./ui/landView";
import {
  clearRunSave,
  peekRunSaveMeta,
  tryPersistRun,
  tryResumeRun,
} from "./game/runSave";

initMobileShellClass();

declare global {
  interface Window {
    /** Playwright / load tests — push fake miles + scores onto the trail socket. */
    __emotaTrailStress?: {
      applySimulationStep: (o: {
        miles: number;
        day: number;
        phase?: string;
        landmark?: string;
        alive?: number;
        partyCap?: number;
        profileTitle?: string;
        party?: TrailPeerPartyRow[];
      }) => void;
      submitScore: (name: string, score: number) => void;
      emitTrailFeed: (kind: string, text: string, miles?: number, day?: number) => void;
    };
  }
}

const HS_KEY = "emota_high_scores";

const HINT_PLAY =
  "1–9 or click · Pop-ups: Space/OK · Hunt: drag/tap aim, pad + FIRE (touch) or keys";
const HINT_TITLE = "1–9 · start a run · optional `npm run server` for LAN trail strip";

/** Short footer nudges for early trail beats (full controls stay in HINT_PLAY). */
const PHASE_SOFT_FOOTER: Partial<Record<EnginePhase, string>> = {
  training_text: "No timer — Next or 1 when you’re ready.",
  training_quiz: "Warm-up quiz; any pick advances.",
  party_names: "Names + Enter, or tap the field first.",
  profile: "One number picks your job.",
  store: "Buy with 1–6, then 7 Leave — watch the sidebar.",
  travel_menu: "Camp hub: Travel, Rest, Hunt, Games…",
};

function loadLocalScores(): { name: string; score: number; at: string }[] {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as { name: string; score: number; at: string }[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function saveLocalScore(row: { name: string; score: number; at: string }): void {
  const arr = [...loadLocalScores(), row].sort((a, b) => b.score - a.score);
  localStorage.setItem(HS_KEY, JSON.stringify(arr.slice(0, 50)));
}

function localCalendarDayKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function footerHint(phase: EnginePhase, isTitle: boolean, netStatus: string): string {
  if (isTitle) return netStatus ? `${HINT_TITLE} · ${netStatus}` : HINT_TITLE;
  const soft = PHASE_SOFT_FOOTER[phase];
  return soft ? `${soft} · ${HINT_PLAY}` : HINT_PLAY;
}

function getTodaysBestLocalScore(): { name: string; score: number } | null {
  const todayKey = localCalendarDayKey(new Date());
  let best: { name: string; score: number } | null = null;
  for (const row of loadLocalScores()) {
    if (localCalendarDayKey(row.at) !== todayKey) continue;
    if (!best || row.score > best.score) best = { name: row.name, score: row.score };
  }
  return best;
}

const appLayout = document.getElementById("app-layout")!;
const screenEl = document.getElementById("screen")!;
const hintEl = document.getElementById("hint-text")!;
const stripEl = document.getElementById("multiplayer-strip")!;
const peerSheetEl = document.getElementById("mp-peer-sheet")!;
const sidebarEl = document.getElementById("sidebar")!;
const travelMenuHudEl = document.getElementById("travel-menu-mobile-hud")!;
const canvas = document.getElementById("overhead") as HTMLCanvasElement;
const popupRoot = document.getElementById("emota-popups")!;
const landSlot = document.getElementById("land-view-slot")!;
const landCanvas = document.getElementById("land-view-canvas") as HTMLCanvasElement;
const landCaptionEl = document.getElementById("land-view-caption")!;
const todayHighEl = document.getElementById("today-high-score")!;

const engine = new GameEngine();
const overhead = new OverheadMini(canvas);
const chanceMini = new ChanceMini(canvas);

let prevPhase = "";
let scoreCommitted = false;
let overheadActive = false;
let chanceActive = false;
let netStatus = "";

type TrailBc = {
  alive: number;
  landmark: string;
  phase: string;
  miles: number;
  partyCap: number;
};

let trailBc: TrailBc = {
  alive: -1,
  landmark: "",
  phase: "title",
  miles: -1,
  partyCap: 5,
};

function pushNetworkProgress(): void {
  if (engine.phase === "title") {
    mp.updateProgress(0, 1, {
      phase: "title",
      party: [],
      partyCap: 5,
      profileTitle: "",
    });
    return;
  }
  const snap = engine.getDashboardSnapshot();
  mp.updateProgress(engine.miles, engine.day, {
    alive: snap.alive,
    landmark: snap.landmark,
    phase: engine.phase,
    partyCap: snap.partyCap,
    profileTitle: snap.profileTitle,
    party: snap.party.map((row) => ({
      name: row.name,
      health: row.health,
      alive: row.alive,
    })),
  });
}

function syncTrailBroadcast(): void {
  const phase = engine.phase;
  if (phase === "title") {
    trailBc = {
      alive: -1,
      landmark: "",
      phase: "title",
      miles: -1,
      partyCap: 5,
    };
    return;
  }
  const s = engine.getDashboardSnapshot();
  const name = getDisplayName();
  const m = Math.floor(engine.miles);

  if (trailBc.phase === "title") {
    trailBc = {
      alive: s.alive,
      landmark: s.landmark,
      phase,
      miles: m,
      partyCap: s.partyCap,
    };
    return;
  }

  if (trailBc.alive >= 0 && s.alive < trailBc.alive) {
    const lost = trailBc.alive - s.alive;
    mp.emitTrailEvent({
      kind: "death",
      text:
        lost > 1
          ? `${name}: ${lost} lost on the trail. ${s.alive}/${s.partyCap} left near ${s.landmark}.`
          : `${name}: a party member is lost. ${s.alive}/${s.partyCap} remain.`,
      miles: engine.miles,
      day: engine.day,
    });
  }

  if (trailBc.landmark && trailBc.landmark !== s.landmark && m > trailBc.miles) {
    mp.emitTrailEvent({
      kind: "milestone",
      text: `${name} reached ${s.landmark}`,
      miles: engine.miles,
      day: engine.day,
    });
  }

  for (const mark of [500, 1000, 1500, 1990]) {
    if (trailBc.miles >= 0 && trailBc.miles < mark && m >= mark) {
      mp.emitTrailEvent({
        kind: "milestone",
        text: `${name} crossed ${mark} trail miles`,
        miles: m,
        day: engine.day,
      });
    }
  }

  if (trailBc.phase !== "victory" && phase === "victory") {
    mp.emitTrailEvent({
      kind: "victory",
      text: `${name} finished the run! Score ${engine.computeScore()}`,
      miles: engine.miles,
      day: engine.day,
    });
  }
  if (trailBc.phase !== "game_over" && phase === "game_over") {
    mp.emitTrailEvent({
      kind: "wipeout",
      text: `${name}'s wagon company is lost to the trail.`,
      miles: engine.miles,
      day: engine.day,
    });
  }
  if (trailBc.phase !== "river" && phase === "river") {
    mp.emitTrailEvent({
      kind: "river",
      text: `${name} faces a river crossing.`,
      miles: engine.miles,
      day: engine.day,
    });
  }

  trailBc = {
    alive: s.alive,
    landmark: s.landmark,
    phase,
    miles: m,
    partyCap: s.partyCap,
  };
}

let lastTrailPeers: TrailPeer[] = [];

function closePeerSheet(): void {
  peerSheetEl.hidden = true;
  peerSheetEl.setAttribute("aria-hidden", "true");
  peerSheetEl.innerHTML = "";
}

function openPeerSheet(peer: TrailPeer): void {
  const cap = peer.partyCap ?? 5;
  const aliveN = peer.alive != null ? peer.alive : "—";
  const phaseLab = peer.phase ? trailPhaseLabel(peer.phase) : "—";
  const party = peer.party;
  const partyBlock =
    party && party.length > 0
      ? `<div class="mp-peer-sheet__party" aria-label="Party roster">
          ${party
            .map((m) => {
              const st = m.alive ? "alive" : "gone";
              const w = m.alive ? Math.max(4, m.health) : 0;
              return `<div class="party-row party-row--${st}">
                <span class="party-row__name">${escapeHtml(m.name)}</span>
                <span class="party-row__bar" role="presentation"><i style="width:${w}%"></i></span>
              </div>`;
            })
            .join("")}
        </div>`
      : `<p class="mp-peer-sheet__note">No live party roster for this wagon yet (they may be on an older client, or still on the title screen).</p>`;

  peerSheetEl.hidden = false;
  peerSheetEl.removeAttribute("aria-hidden");
  peerSheetEl.innerHTML = `
    <div class="mp-peer-sheet__backdrop" data-close-sheet="1" aria-hidden="true"></div>
    <div class="mp-peer-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="mp-peer-sheet-title">
      <header class="mp-peer-sheet__head">
        <h2 id="mp-peer-sheet-title" class="mp-peer-sheet__title">${escapeHtml(peer.displayName)}</h2>
        <button type="button" class="mp-peer-sheet__close" data-close-sheet="1" aria-label="Close wagon details">×</button>
      </header>
      <p class="mp-peer-sheet__meta">
        Day ${peer.day} · ${Math.round(peer.miles)} mi
        ${peer.landmark ? ` · ${escapeHtml(peer.landmark)}` : ""}
      </p>
      <p class="mp-peer-sheet__meta">Screen: <strong>${escapeHtml(phaseLab)}</strong> · Party alive <strong>${aliveN}</strong> / ${cap}</p>
      ${peer.profileTitle ? `<p class="mp-peer-sheet__meta">Profession: ${escapeHtml(peer.profileTitle)}</p>` : ""}
      <h3 class="mp-peer-sheet__sub">Party</h3>
      ${partyBlock}
    </div>
  `;
  peerSheetEl.querySelector<HTMLButtonElement>(".mp-peer-sheet__close")?.focus();
}

function renderTrailStrip(peers: TrailPeer[]): void {
  lastTrailPeers = peers;
  if (!peers.length) {
    stripEl.hidden = true;
    return;
  }
  stripEl.hidden = false;
  const selfName = getDisplayName();
  const chips = peers
    .slice(0, MULTIPLAYER_CAP)
    .map((p) => {
      const aliveBit =
        p.alive != null && p.partyCap != null ? ` · ${p.alive}/${p.partyCap}` : "";
      const selfClass = p.displayName === selfName ? " mp-chip--self" : "";
      return `<button type="button" class="mp-chip${selfClass}" data-peer-id="${escapeAttr(p.id)}" aria-label="Wagon ${escapeAttr(p.displayName)}: ${Math.round(p.miles)} miles, day ${p.day}. Open party details.">
        <span class="mp-chip__name">${escapeHtml(p.displayName)}</span>
        <span class="mp-chip__meta">${Math.round(p.miles)} mi · d${p.day}${aliveBit}</span>
      </button>`;
    })
    .join("");
  stripEl.innerHTML = `<span class="mp-strip__chev" aria-hidden="true">&gt;</span><div class="mp-strip__chips">${chips}</div>`;
}

const mp = new TrailMultiplayer(
  (peers) => {
    renderTrailStrip(peers ?? []);
  },
  (rows) => {
    if (rows.length && engine.phase === "title") {
      netStatus = `Server top: ${rows[0]!.name} ${rows[0]!.score}`;
      hintEl.textContent = `${HINT_TITLE} · ${netStatus}`;
    }
  },
  (msg) => {
    netStatus = msg;
    if (engine.phase === "title") {
      hintEl.textContent = `${HINT_TITLE} · ${msg}`;
    }
  },
);

void mp.connect();

window.__emotaTrailStress = {
  applySimulationStep: (o) => {
    mp.updateProgress(o.miles, o.day, {
      phase: o.phase ?? "travel_menu",
      landmark: o.landmark ?? "",
      alive: o.alive,
      partyCap: o.partyCap,
      profileTitle: o.profileTitle ?? "",
      party: o.party,
    });
  },
  submitScore: (name, score) => {
    mp.submitScore(name, score, { stress: true });
  },
  emitTrailFeed: (kind, text, miles, day) => {
    mp.emitTrailEvent({ kind, text, miles, day });
  },
};

stripEl.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest(".mp-chip");
  if (!btn) return;
  const id = btn.getAttribute("data-peer-id");
  if (!id) return;
  const peer = lastTrailPeers.find((p) => p.id === id);
  if (peer) openPeerSheet(peer);
});

peerSheetEl.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("[data-close-sheet]")) closePeerSheet();
});

function renderChoiceLead(phase: string, n: number): string {
  if (["travel_menu", "river", "store", "land_pick"].includes(phase)) {
    return choiceLeadingIcon(phase, n);
  }
  return `<span class="choice-num">${n}</span>`;
}

function refreshPopupOverlay(): void {
  const pop = engine.peekPopup();
  if (!pop) {
    popupRoot.innerHTML = "";
    popupRoot.hidden = true;
    return;
  }
  popupRoot.hidden = false;
  const v = escapeHtml(pop.vibe);
  popupRoot.innerHTML = `
    <div class="emota-popup-backdrop" data-close="1" aria-hidden="true"></div>
    <div class="emota-popup emota-popup--${v}" role="dialog" aria-modal="true" aria-labelledby="emota-popup-title">
      <pre class="emota-popup__art">${escapeHtml(pop.art)}</pre>
      <p class="emota-popup__kicker">// EMOTA SIGNAL</p>
      <h2 id="emota-popup-title" class="emota-popup__title">${escapeHtml(pop.title)}</h2>
      <div class="emota-popup__body">${pop.body.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div>
      <button type="button" class="emota-popup__ok">OK · SPACE</button>
    </div>
  `;
  const close = (): void => {
    engine.dismissPopup();
    refreshPopupOverlay();
    render();
  };
  popupRoot.querySelector(".emota-popup__ok")?.addEventListener("click", close);
  popupRoot.querySelector("[data-close]")?.addEventListener("click", close);
  (popupRoot.querySelector(".emota-popup__ok") as HTMLButtonElement | null)?.focus();
}

function render(): void {
  let sc = engine.getScreen();
  const resumeMeta = sc.phase === "title" ? peekRunSaveMeta() : null;
  if (resumeMeta && sc.choices?.length) {
    sc = {
      ...sc,
      lines: [
        ...sc.lines,
        "",
        `Saved wagon on this device — ${resumeMeta.phaseLabel} · day ${resumeMeta.day} · ~${resumeMeta.miles} mi`,
      ],
      coach: sc.coach
        ? `${sc.coach} Tap Resume (or press 3) to continue.`
        : "Your trail is saved in this browser. Tap Resume below (or press 3) to pick up where you left off.",
      choices: [...sc.choices, { n: 3, text: `Resume · day ${resumeMeta.day} · ~${resumeMeta.miles} mi` }],
    };
  }
  const phaseBefore = prevPhase;
  const enteringPartyNames = sc.phase === "party_names" && phaseBefore !== "party_names";

  const isTitle = sc.phase === "title";
  appLayout.classList.toggle("is-title", isTitle);
  if (isTitle) {
    sidebarEl.hidden = true;
    landSlot.hidden = true;
    travelMenuHudEl.hidden = true;
    travelMenuHudEl.innerHTML = "";
  } else {
    sidebarEl.hidden = false;
    sidebarEl.innerHTML = buildDashboardSidebar(engine.getDashboardSnapshot(), sc.phase);
    landSlot.hidden = false;
    const showTravelHud =
      sc.phase === "travel_menu" &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 799px)").matches;
    if (showTravelHud) {
      travelMenuHudEl.hidden = false;
      travelMenuHudEl.innerHTML = buildTravelMenuMobileHud(engine.getDashboardSnapshot());
    } else {
      travelMenuHudEl.hidden = true;
      travelMenuHudEl.innerHTML = "";
    }
    const landState: LandViewState = {
      miles: engine.miles,
      day: engine.day,
      phase: sc.phase,
      activeRiverName:
        sc.phase === "river" && engine.pendingRiver ? engine.pendingRiver.name : null,
    };
    paintLandView(landCanvas, landState);
    landCaptionEl.textContent = landViewCaption(landState);
  }

  if (sc.phase === "overhead_hunt" && prevPhase !== "overhead_hunt" && !overheadActive) {
    overheadActive = true;
    canvas.hidden = false;
    canvas.classList.remove("overhead-canvas--chance");
    canvas.classList.add("overhead-canvas--hunt");
    overhead.startHunt(engine.getHuntSessionOptions(), (food, ammo) => {
      overheadActive = false;
      engine.completeOverheadHunt(food, ammo);
      render();
    });
  } else if (sc.phase === "land_build" && prevPhase !== "land_build" && !overheadActive) {
    overheadActive = true;
    canvas.hidden = false;
    canvas.classList.remove("overhead-canvas--chance");
    overhead.startBuild((quality) => {
      overheadActive = false;
      engine.completeOverheadBuild(quality);
      render();
    });
  } else if (
    sc.phase === "chance_play" &&
    prevPhase !== "chance_play" &&
    engine.pendingChanceId &&
    !chanceActive
  ) {
    chanceActive = true;
    overhead.stop();
    overheadActive = false;
    canvas.hidden = false;
    canvas.classList.remove("overhead-canvas--hunt");
    canvas.classList.add("overhead-canvas--chance");
    chanceMini.start(engine.pendingChanceId, engine.chanceStakeCents, (payload) => {
      chanceActive = false;
      engine.completeChancePlay(payload);
      render();
    });
  } else if (
    sc.phase !== "overhead_hunt" &&
    sc.phase !== "land_build" &&
    sc.phase !== "chance_play" &&
    overheadActive === false &&
    chanceActive === false
  ) {
    overhead.stop();
    chanceMini.stop();
    canvas.classList.remove("overhead-canvas--hunt", "overhead-canvas--chance");
    canvas.hidden = true;
  }

  if (sc.phase === "victory" && !scoreCommitted) {
    scoreCommitted = true;
    const score = engine.computeScore();
    const hop = engine.lastLandResult?.hopKing ?? false;
    const name = getDisplayName();
    const row = { name, score, at: new Date().toISOString() };
    saveLocalScore(row);
    mp.submitScore(name, score, { hopKing: hop, profile: engine.profile });
  }

  if (sc.phase === "title") {
    scoreCommitted = false;
  }

  const topLocal = loadLocalScores()[0];
  const linesBase = sc.lines.join("\n");
  const lines =
    sc.phase === "title" && topLocal
      ? `${linesBase}\n\nBest here: ${topLocal.name} · ${topLocal.score}`
      : linesBase;
  const linesHtml = lines.split("\n").map((l) => escapeHtml(l)).join("<br/>");

  let choicesHtml = "";
  if (sc.choices?.length) {
    choicesHtml =
      '<ul class="choices">' +
      sc.choices
        .map(
          (c) =>
            `<li tabindex="0" data-n="${c.n}" role="button"><span class="choice-lead">${renderChoiceLead(sc.phase, c.n)}</span><span class="choice-label">${escapeHtml(c.text)}</span></li>`,
        )
        .join("") +
      "</ul>";
  }
  let inputHtml = "";
  if (sc.inputLine) {
    inputHtml = `<input class="line-input" type="text" placeholder="${escapeHtml(sc.inputLine.placeholder)}" aria-label="${escapeHtml(sc.inputLine.hint)}" />`;
  }

  const coachHtml = sc.coach
    ? `<p class="screen-coach" role="note"><span class="screen-coach__lead">Trail tip</span><span class="screen-coach__text">${escapeHtml(sc.coach)}</span></p>`
    : "";

  screenEl.innerHTML = `<div class="block">${linesHtml}</div>${coachHtml}${choicesHtml}${inputHtml}`;

  hintEl.textContent = footerHint(sc.phase, isTitle, netStatus);

  const todayBest = getTodaysBestLocalScore();
  if (todayBest) {
    todayHighEl.hidden = false;
    todayHighEl.innerHTML = `<span class="today-high-score__label">Today's high</span><span class="today-high-score__value">${todayBest.score}</span><span class="today-high-score__who">${escapeHtml(todayBest.name)}</span>`;
  } else {
    todayHighEl.hidden = true;
    todayHighEl.textContent = "";
  }

  const input = screenEl.querySelector<HTMLInputElement>(".line-input");
  if (input) {
    if (enteringPartyNames) {
      input.value = randomHistoricPartyLine();
    }
    input.focus();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const v = input.value.trim();
        if (engine.phase === "party_names" && v) {
          engine.submitPartyNames(v);
          render();
        }
      }
    });
  }

  screenEl.querySelectorAll<HTMLLIElement>(".choices li").forEach((li) => {
    const n = Number(li.dataset.n);
    const go = () => choice(n);
    li.addEventListener("click", go);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    });
  });

  refreshPopupOverlay();

  pushNetworkProgress();
  syncTrailBroadcast();

  tryPersistRun(engine);

  prevPhase = sc.phase;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function choice(n: number): void {
  const was = engine.phase;
  if (was === "title" && (n === 1 || n === 2)) clearRunSave();
  if (was === "title" && n === 3) {
    if (tryResumeRun(engine)) {
      if (engine.phase === "victory") scoreCommitted = true;
      render();
      return;
    }
    return;
  }

  if (engine.phase === "overhead_hunt" && n === 1) {
    overhead.stop();
    overheadActive = false;
    engine.choose(1);
    canvas.hidden = true;
    canvas.classList.remove("overhead-canvas--hunt");
    render();
    return;
  }
  if (engine.phase === "land_build" && n === 1) {
    overhead.stop();
    overheadActive = false;
    engine.choose(1);
    canvas.hidden = true;
    render();
    return;
  }
  if (engine.phase === "chance_play" && n === 1) {
    chanceMini.stop();
    chanceActive = false;
    engine.choose(1);
    canvas.hidden = true;
    canvas.classList.remove("overhead-canvas--chance");
    render();
    return;
  }
  engine.choose(n);
  if (engine.phase === "title" && (was === "victory" || was === "game_over")) clearRunSave();
  render();
}

document.addEventListener("keydown", (e) => {
  if (!peerSheetEl.hidden && e.key === "Escape") {
    e.preventDefault();
    closePeerSheet();
    return;
  }
  if (e.target instanceof HTMLInputElement) return;
  if (engine.peekPopup()) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      engine.dismissPopup();
      refreshPopupOverlay();
      render();
    }
    return;
  }
  if (engine.phase === "chance_play") {
    if (e.key === "Escape" || e.key.toLowerCase() === "q") {
      e.preventDefault();
      choice(1);
    }
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= 9) choice(n);
});

render();

