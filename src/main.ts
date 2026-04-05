import "./style.css";
import { GameEngine } from "./game/engine";
import { OverheadMini } from "./ui/overhead";
import { ChanceMini } from "./ui/chanceGames";
import { TrailMultiplayer, getDisplayName } from "./net/multiplayer";
import { randomHistoricPartyLine } from "./data/historicNames";
import { buildDashboardSidebar, choiceLeadingIcon } from "./ui/dashboard";
import { landViewCaption, paintLandView, type LandViewState } from "./ui/landView";

const HS_KEY = "emota_high_scores";

const HINT_PLAY =
  "1–9 or click · Pop-ups: Space/OK · Hunt: drag/tap aim, pad + FIRE (touch) or keys";
const HINT_TITLE = "1–9 · start a run · optional `npm run server` for LAN trail strip";

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

const appLayout = document.getElementById("app-layout")!;
const screenEl = document.getElementById("screen")!;
const hintEl = document.getElementById("hint-text")!;
const stripEl = document.getElementById("multiplayer-strip")!;
const sidebarEl = document.getElementById("sidebar")!;
const canvas = document.getElementById("overhead") as HTMLCanvasElement;
const popupRoot = document.getElementById("emota-popups")!;
const landSlot = document.getElementById("land-view-slot")!;
const landCanvas = document.getElementById("land-view-canvas") as HTMLCanvasElement;
const landCaptionEl = document.getElementById("land-view-caption")!;

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
    mp.updateProgress(0, 1, { phase: "title" });
    return;
  }
  const snap = engine.getDashboardSnapshot();
  mp.updateProgress(engine.miles, engine.day, {
    alive: snap.alive,
    landmark: snap.landmark,
    phase: engine.phase,
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

  if (trailBc.phase === "title" && phase !== "title") {
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

const mp = new TrailMultiplayer(
  (peers) => {
    if (!peers.length) {
      stripEl.hidden = true;
      return;
    }
    stripEl.hidden = false;
    stripEl.textContent = peers
      .slice(0, 25)
      .map((p) => `${p.displayName} · ${Math.round(p.miles)} mi · d${p.day}`)
      .join(" · ");
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

mp.connect();

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
  const sc = engine.getScreen();
  const phaseBefore = prevPhase;
  const enteringPartyNames = sc.phase === "party_names" && phaseBefore !== "party_names";

  const isTitle = sc.phase === "title";
  appLayout.classList.toggle("is-title", isTitle);
  if (isTitle) {
    sidebarEl.hidden = true;
    landSlot.hidden = true;
  } else {
    sidebarEl.hidden = false;
    sidebarEl.innerHTML = buildDashboardSidebar(engine.getDashboardSnapshot(), sc.phase);
    landSlot.hidden = false;
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

  screenEl.innerHTML = `<div class="block">${linesHtml}</div>${choicesHtml}${inputHtml}`;

  if (isTitle) {
    hintEl.textContent = netStatus ? `${HINT_TITLE} · ${netStatus}` : HINT_TITLE;
  } else {
    hintEl.textContent = HINT_PLAY;
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

  prevPhase = sc.phase;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function choice(n: number): void {
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
  render();
}

document.addEventListener("keydown", (e) => {
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
