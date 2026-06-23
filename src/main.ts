import "./style.css";
import { runBootSplash } from "./ui/bootSplash";
import { initMobileShellClass } from "./mobile-detect";
import { GameEngine, type EnginePhase } from "./game/engine";
import { MEEKER_GIFT_SHOP_URL } from "./game/config";
import { OverheadMini } from "./ui/overhead";
import { ChanceMini } from "./ui/chanceGames";
import { GAME_ART } from "./game/artAssets";
import { TrailMultiplayer, getDisplayName, setDisplayName } from "./net/multiplayer";
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
  shouldAutoResumeAfterLoad,
  tryPersistRun,
  tryResumeRun,
} from "./game/runSave";
import { calendarDayKeyPST, todayCalendarKeyPST } from "./game/pstDate";
import { getTravelerNumber } from "./game/playerNumber";
import { showTrailInterstitial } from "./ui/trailInterstitial";

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
const HINT_TITLE = "1–9 · start a run";

const HINT_PLAY_EASY = "Tap a choice below · tap OK on pop-ups";
const HINT_TITLE_EASY = "Tap a choice to start";

/** Short footer nudges for early trail beats (full controls stay in HINT_PLAY). */
const PHASE_SOFT_FOOTER: Partial<Record<EnginePhase, string>> = {
  training_text: "No timer — Next or 1 when you’re ready.",
  training_quiz: "Warm-up quiz; any pick advances.",
  party_names: "Wagon name (upper field) · party names (lower) + Enter.",
  profile: "Pick your leader’s job: 1–5 or tap a line → then store → 7 Leave → trail.",
  store: "Buy with 1–6, then 7 Leave — watch the sidebar.",
  travel_menu: "Camp hub: Travel, Rest, Hunt, Games…",
  gift_shop_prompt: "1 opens the museum shop in a new tab; 2 claims after you’ve looked; 3 backs out.",
};

const PHASE_SOFT_FOOTER_EASY: Partial<Record<EnginePhase, string>> = {
  training_text: "No rush — tap Next when ready.",
  training_quiz: "Warm-up only — tap any answer.",
  party_names: "Top: scoreboard name · bottom: five party names.",
  profile: "Tap your leader’s job, then the store, then Leave.",
  store: "Tap items to buy · tap Leave when ready.",
  travel_menu: "Camp menu — tap Travel, Rest, Hunt, or Games.",
  gift_shop_prompt: "Tap 1 for gift shop · 2 when finished · 3 to skip.",
  title: "Tap Play now to start · or Continue if you saved.",
  game_over: "Tap Title to return home.",
  victory: "Tap Title when you’re done.",
  travel_log: "Tap Next to continue your journal.",
  trail_event: "Tap a choice to handle the event.",
  river: "Tap how to cross the river.",
  trivia: "Tap an answer.",
  land_pick: "Tap a homestead choice.",
  land_result: "Tap to continue.",
  bonus_pick: "Tap your Stage 2 path.",
  bonus_result: "Tap for your final score.",
  chance_pick: "Tap a game at the table.",
  chance_result: "Tap to leave the table.",
  overhead_hunt: "Aim and tap FIRE — or tap Back to camp.",
  chance_play: "Play the game, then tap OK.",
  land_build: "Build your claim, then continue.",
};

function isEasyReadUI(): boolean {
  return document.documentElement.classList.contains("emota-easy-read");
}

function isMobileShell(): boolean {
  return document.documentElement.classList.contains("emota-mobile");
}

/** Sidebar is hidden on mobile during setup; shown once the trail opens. */
const MOBILE_SIDEBAR_PHASES = new Set<EnginePhase>([
  "travel_menu",
  "river",
  "trivia",
  "trail_event",
  "travel_log",
  "overhead_hunt",
  "chance_pick",
  "chance_result",
  "chance_play",
  "land_pick",
  "land_build",
  "land_result",
  "bonus_pick",
  "bonus_result",
  "victory",
  "game_over",
]);

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

let netStatus = "";

function footerHint(phase: EnginePhase, isTitle: boolean): string {
  if (isEasyReadUI()) {
    if (isTitle) {
      const bits = [PHASE_SOFT_FOOTER_EASY.title ?? HINT_TITLE_EASY];
      if (netStatus) bits.push(netStatus);
      return bits.join(" · ");
    }
    const soft = PHASE_SOFT_FOOTER_EASY[phase];
    return soft ?? HINT_PLAY_EASY;
  }
  if (isTitle) {
    const bits = [HINT_TITLE];
    if (netStatus) bits.push(netStatus);
    return bits.join(" · ");
  }
  const soft = PHASE_SOFT_FOOTER[phase];
  return soft ? `${soft} · ${HINT_PLAY}` : HINT_PLAY;
}

function getTodaysBestLocalScore(): { name: string; score: number } | null {
  const todayKey = todayCalendarKeyPST();
  let best: { name: string; score: number } | null = null;
  for (const row of loadLocalScores()) {
    if (calendarDayKeyPST(row.at) !== todayKey) continue;
    if (!best || row.score > best.score) best = { name: row.name, score: row.score };
  }
  return best;
}

let lastRenderedPstDay = todayCalendarKeyPST();

const appLayout = document.getElementById("app-layout")!;
const screenEl = document.getElementById("screen")!;
const hintEl = document.getElementById("hint-text")!;
const appFooterEl = document.querySelector(".app-footer");
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
const footerGiftShopEl = document.getElementById("footer-gift-shop") as HTMLAnchorElement | null;
if (footerGiftShopEl) footerGiftShopEl.href = MEEKER_GIFT_SHOP_URL;

const engine = new GameEngine();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persistRunNow();
});

window.addEventListener("pagehide", () => {
  persistRunNow();
});
const overhead = new OverheadMini(canvas);
const chanceMini = new ChanceMini(canvas);

let prevPhase = "";
let scoreCommitted = false;
let overheadActive = false;
let chanceActive = false;
/** One-shot welcome line after auto-resume from localStorage. */
let welcomeBackNote: string | null = null;

function persistRunNow(): void {
  tryPersistRun(engine);
}

function tryAutoResumeFromSave(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      clearRunSave();
      return false;
    }
  } catch {
    /* ignore */
  }
  if (!shouldAutoResumeAfterLoad()) return false;
  const meta = peekRunSaveMeta();
  if (!tryResumeRun(engine)) return false;
  if (engine.phase === "victory") scoreCommitted = true;
  overheadActive = false;
  chanceActive = false;
  prevPhase = "";
  if (meta) {
    welcomeBackNote = `Welcome back — ${meta.phaseLabel} · day ${meta.day} · ~${meta.miles} mi`;
  }
  return true;
}

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

/** Other wagons stay on the bigboard only — main client never shows peer chips. */
function hideTrailStrip(peers: TrailPeer[]): void {
  lastTrailPeers = peers;
  stripEl.hidden = true;
  stripEl.innerHTML = "";
}

const mp = new TrailMultiplayer(
  (peers) => {
    hideTrailStrip(peers ?? []);
  },
  () => {
    render();
  },
  (msg) => {
    netStatus = msg;
    render();
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
    mp.submitScore(name, score, { stress: true, travelerNo: getTravelerNumber() });
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
  if (["travel_menu", "river", "store", "land_pick", "gift_shop_prompt"].includes(phase)) {
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
  const artBlock = pop.imageSrc
    ? `<img class="emota-popup__img emota-popup__img--${escapeHtml(pop.imageVariant ?? "pioneer")}" src="${escapeAttr(pop.imageSrc)}" alt="${escapeAttr(pop.imageAlt ?? "")}" decoding="async" />`
    : `<pre class="emota-popup__art">${escapeHtml(pop.art)}</pre>`;
  popupRoot.innerHTML = `
    <div class="emota-popup-backdrop" data-close="1" aria-hidden="true"></div>
    <div class="emota-popup emota-popup--${v}" role="dialog" aria-modal="true" aria-labelledby="emota-popup-title">
      ${artBlock}
      <p class="emota-popup__kicker">// EMOTA SIGNAL</p>
      <h2 id="emota-popup-title" class="emota-popup__title">${escapeHtml(pop.title)}</h2>
      <div class="emota-popup__body">${pop.body.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div>
      <button type="button" class="emota-popup__ok">${isEasyReadUI() ? "OK · TAP HERE" : "OK · SPACE"}</button>
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
  if (engine.takeTravelInterstitial()) {
    void showTrailInterstitial().then(() => render());
    return;
  }

  let sc = engine.getScreen();
  if (welcomeBackNote) {
    const note = welcomeBackNote;
    welcomeBackNote = null;
    sc = {
      ...sc,
      coach: sc.coach ? `${note} — ${sc.coach}` : note,
    };
  }
  const resumeMeta = sc.phase === "title" ? peekRunSaveMeta() : null;
  if (resumeMeta && sc.choices?.length) {
    const play = sc.choices.find((c) => c.n === 1);
    const learn = sc.choices.find((c) => c.n === 2);
    const resumeChoice = {
      n: 3 as const,
      text: isEasyReadUI()
        ? `Continue · day ${resumeMeta.day}`
        : `Resume saved wagon · day ${resumeMeta.day}`,
    };
    const baseChoices = [play, learn].filter(Boolean) as { n: number; text: string }[];
    sc = {
      ...sc,
      lines: [
        ...sc.lines,
        "",
        `Saved wagon — ${resumeMeta.phaseLabel} · day ${resumeMeta.day} · ~${resumeMeta.miles} mi`,
      ],
      coach: sc.coach
        ? isEasyReadUI()
          ? `${sc.coach} Tap Continue to pick up your wagon.`
          : `${sc.coach} Tap Resume (or press 3) to continue.`
        : isEasyReadUI()
          ? "Tap Continue to pick up your wagon."
          : "Your trail is saved in this browser. Tap Resume below (or press 3) to pick up where you left off.",
      choices: isEasyReadUI()
        ? [resumeChoice, ...baseChoices]
        : [...baseChoices, resumeChoice],
    };
  }
  const phaseBefore = prevPhase;
  const enteringPartyNames = sc.phase === "party_names" && phaseBefore !== "party_names";

  const isTitle = sc.phase === "title";
  const mobile = isMobileShell();
  const showSidebarMobile = !mobile || MOBILE_SIDEBAR_PHASES.has(sc.phase);
  appLayout.classList.toggle("is-title", isTitle);
  if (isTitle || !showSidebarMobile) {
    sidebarEl.hidden = true;
    if (!isTitle) sidebarEl.innerHTML = "";
  } else {
    sidebarEl.hidden = false;
    sidebarEl.innerHTML = buildDashboardSidebar(engine.getDashboardSnapshot(), sc.phase);
  }

  if (isTitle) {
    landSlot.hidden = true;
    travelMenuHudEl.hidden = true;
    travelMenuHudEl.innerHTML = "";
  } else {
    landSlot.hidden = mobile;
    const showTravelHud =
      sc.phase === "travel_menu" &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 899px)").matches;
    if (showTravelHud) {
      travelMenuHudEl.hidden = false;
      travelMenuHudEl.innerHTML = buildTravelMenuMobileHud(engine.getDashboardSnapshot());
    } else {
      travelMenuHudEl.hidden = true;
      travelMenuHudEl.innerHTML = "";
    }
    if (!mobile) {
      const landState: LandViewState = {
        miles: engine.miles,
        day: engine.day,
        phase: sc.phase,
        activeRiverName:
          sc.phase === "river" && engine.pendingRiver ? engine.pendingRiver.name : null,
      };
      paintLandView(landCanvas, landState);
      landCaptionEl.textContent = landViewCaption(landState);
    } else {
      landCaptionEl.textContent = "";
    }
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
    mp.submitScore(name, score, {
      hopKing: hop,
      profile: engine.profile,
      travelerNo: getTravelerNumber(),
    });
  }

  if (sc.phase === "title") {
    scoreCommitted = false;
  }

  const topLocalToday = getTodaysBestLocalScore();
  const linesBase = sc.lines.join("\n");
  const lines =
    sc.phase === "title" && topLocalToday
      ? `${linesBase}\n\nYour best today (this device): ${topLocalToday.score}`
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
  let trailDisplayNameHtml = "";
  if (sc.phase === "party_names" && sc.inputLine) {
    const dn = escapeHtml(getDisplayName());
    trailDisplayNameHtml = `<div class="trail-display-name" role="region" aria-label="Wagon name for leaderboard and trail">
  <p class="trail-display-name__label">Wagon name · scores &amp; live trail</p>
  <input type="text" class="trail-display-name__input" maxlength="24" spellcheck="false" autocomplete="nickname" value="${dn}" aria-label="Wagon name for leaderboard and trail feed" />
  <p class="trail-display-name__hint">Separate from your five travelers in the box below.</p>
</div>`;
  }

  let inputHtml = "";
  if (sc.inputLine) {
    inputHtml = `<input class="line-input" type="text" placeholder="${escapeHtml(sc.inputLine.placeholder)}" aria-label="${escapeHtml(sc.inputLine.hint)}" />`;
    if (sc.phase === "party_names") {
      inputHtml += `<button type="button" class="party-continue-btn">Continue</button>`;
    }
  }

  const coachHtml = sc.coach
    ? `<p class="screen-coach" role="note"><span class="screen-coach__lead">Trail tip</span><span class="screen-coach__text">${escapeHtml(sc.coach)}</span></p>`
    : "";

  const heroHtml = sc.heroImage
    ? `<figure class="screen-hero screen-hero--${escapeHtml(sc.heroImage.variant ?? "default")}"><img class="screen-hero__img" src="${escapeAttr(sc.heroImage.src)}" alt="${escapeAttr(sc.heroImage.alt)}" decoding="async" /></figure>`
    : "";

  screenEl.innerHTML = `${heroHtml}<div class="block">${linesHtml}</div>${coachHtml}${choicesHtml}${trailDisplayNameHtml}${inputHtml}`;

  hintEl.textContent = footerHint(sc.phase, isTitle);
  appFooterEl?.classList.toggle("app-footer--choices-active", isEasyReadUI() && !!sc.choices?.length);

  const bestLocal = getTodaysBestLocalScore();
  if (bestLocal) {
    todayHighEl.hidden = false;
    todayHighEl.title = "Your best score today on this browser (Pacific calendar day). Live trail names stay on the bigboard.";
    todayHighEl.innerHTML = `<span class="today-high-score__label">Your best today</span><span class="today-high-score__value">${bestLocal.score}</span>`;
  } else {
    todayHighEl.hidden = true;
    todayHighEl.removeAttribute("title");
    todayHighEl.textContent = "";
  }

  const trailDisplayInput = screenEl.querySelector<HTMLInputElement>(".trail-display-name__input");
  if (trailDisplayInput) {
    const commitTrailName = (): void => {
      setDisplayName(trailDisplayInput.value.trim());
      pushNetworkProgress();
    };
    trailDisplayInput.addEventListener("blur", commitTrailName);
    trailDisplayInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitTrailName();
        screenEl.querySelector<HTMLInputElement>(".line-input")?.focus();
      }
    });
  }

  const input = screenEl.querySelector<HTMLInputElement>(".line-input");
  const submitPartyFromScreen = (): void => {
    if (!input) return;
    const v = input.value.trim();
    if (engine.phase === "party_names" && v) {
      if (trailDisplayInput) setDisplayName(trailDisplayInput.value.trim());
      engine.submitPartyNames(v);
      render();
    }
  };

  screenEl.querySelector<HTMLButtonElement>(".party-continue-btn")?.addEventListener("click", () => {
    submitPartyFromScreen();
    if (engine.phase === "party_names") input?.focus();
  });

  if (input) {
    if (enteringPartyNames) {
      input.value = randomHistoricPartyLine();
    }
    if (!isEasyReadUI()) input.focus();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitPartyFromScreen();
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

  stripEl.hidden = true;
  if (!peerSheetEl.hidden) closePeerSheet();

  prevPhase = sc.phase;

  if (isEasyReadUI()) {
    requestAnimationFrame(() => {
      const focusEl =
        screenEl.querySelector<HTMLButtonElement>(".party-continue-btn") ??
        screenEl.querySelector<HTMLLIElement>(".choices li") ??
        screenEl.querySelector<HTMLInputElement>(".line-input");
      focusEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  const pstNow = todayCalendarKeyPST();
  if (pstNow !== lastRenderedPstDay) lastRenderedPstDay = pstNow;
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

  if (engine.phase === "gift_shop_prompt" && n === 1) {
    window.open(MEEKER_GIFT_SHOP_URL, "_blank", "noopener,noreferrer");
    render();
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
  const boot = document.getElementById("emota-boot");
  if (boot) {
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      e.preventDefault();
      return;
    }
  }
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

setInterval(() => {
  const d = todayCalendarKeyPST();
  if (d !== lastRenderedPstDay) {
    lastRenderedPstDay = d;
    render();
  }
}, 30_000);

void (async () => {
  await runBootSplash();
  tryAutoResumeFromSave();
  render();
})();

