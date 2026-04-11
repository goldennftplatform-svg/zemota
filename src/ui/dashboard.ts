import type { DashboardSnapshot } from "../game/types";
import { renderTrailMinimap } from "./trailMinimap";

const PHASE_LABEL: Record<string, string> = {
  training_text: "Training",
  training_quiz: "Quiz",
  party_names: "Party",
  profile: "Profession",
  store: "Supplies",
  gift_shop_prompt: "Gift shop",
  travel_menu: "Camp",
  river: "River",
  travel_log: "Journal",
  trail_event: "Trail event",
  overhead_hunt: "Hunt",
  chance_pick: "Games",
  chance_play: "Games",
  chance_result: "Games",
  trivia: "Daily quiz",
  land_pick: "Land claim",
  land_build: "Build",
  land_result: "Claim",
  bonus_pick: "Stage 2",
  bonus_result: "Life after Oregon",
  game_over: "The end",
  victory: "Score",
};

/** Readable phase for trail room / multiplayer UI. */
export function trailPhaseLabel(phase: string): string {
  return PHASE_LABEL[phase] ?? phase.replace(/_/g, " ");
}

/** Compact crew + pace/rations readout for mobile camp menu (above “What next?”). */
export function buildTravelMenuMobileHud(s: DashboardSnapshot): string {
  const crew = s.party
    .map((p) => {
      const pct = p.alive ? Math.max(4, p.health) : 0;
      const st = p.alive ? "alive" : "gone";
      const rawShort = p.name.length > 10 ? `${p.name.slice(0, 9)}…` : p.name;
      return `<div class="tmh-member tmh-member--${st}" title="${escapeAttr(p.name)}">
        <span class="tmh-member__name">${escapeHtml(rawShort)}</span>
        <span class="tmh-member__bar" role="presentation"><i style="width:${pct}%"></i></span>
      </div>`;
    })
    .join("");

  return `
    <div class="tmh-inner" role="region" aria-label="Camp status">
      <p class="tmh-title">Wagon status</p>
      <div class="tmh-grid">
        <div class="tmh-stat"><span class="tmh-k">Pace</span><span class="tmh-v">${escapeHtml(s.pace)}</span></div>
        <div class="tmh-stat"><span class="tmh-k">Rations</span><span class="tmh-v">${escapeHtml(s.rations)}</span></div>
        <div class="tmh-stat"><span class="tmh-k">Food</span><span class="tmh-v">${s.food} lb</span></div>
        <div class="tmh-stat"><span class="tmh-k">Ammo</span><span class="tmh-v">${escapeHtml(String(s.ammo))}</span></div>
        <div class="tmh-stat"><span class="tmh-k">Day</span><span class="tmh-v">${s.day}/${s.maxDays}</span></div>
        <div class="tmh-stat"><span class="tmh-k">Party</span><span class="tmh-v">${s.alive}/${s.partyCap}</span></div>
      </div>
      <p class="tmh-crew-label">Crew</p>
      <div class="tmh-crew">${crew}</div>
    </div>
  `.trim();
}

/** Inline SVG icons (24×24 viewBox). */
const ico = {
  day: `<svg class="dash-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm11 8H6v10h12V10z"/></svg>`,
  miles: `<svg class="dash-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 15l6-6 4 4 6-7v14H4V15zm0 2h16v2H4v-2z"/></svg>`,
  food: `<svg class="dash-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C8 6 6 10 6 14c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-2-8-6-12zm0 16c-1.7 0-3-1.3-3-3 0-2 1-4 3-6 2 2 3 4 3 6 0 1.7-1.3 3-3 3z"/></svg>`,
  money: `<svg class="dash-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 17.9v-2.1c3-.3 5-1.5 5-2.8 0-1-2-2-5-2s-5 1-5 2c0 .4.5.8 1.2 1.2l-1.5 1.7C4.8 18.8 4 17.5 4 16c0-2.2 3.6-4 8-4s8 1.8 8 4c0 1.8-2.5 3.3-6 3.8z"/></svg>`,
  ammo: `<svg class="dash-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 3h8v2H8V3zm0 4h8l2 14H6L8 7zm4 2v10h2V9h-2z"/></svg>`,
  oxen: `<svg class="dash-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 16c0-2 2-4 4-4h8c2 0 4 2 4 4v2H4v-2zm4-6V8h8v2l2 2H6l2 2zm2-6h4v2h-4V4z"/></svg>`,
  pace: `<svg class="dash-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>`,
  people: `<svg class="dash-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm-8 0c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.7 0-1 .1 1.9.8 3 2 3 3.4V19h5v-2.5c0-2.3-4.7-3.5-7-3.5z"/></svg>`,
  quiz: `<svg class="dash-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 17h-2v-2h2v2zm2.7-7.3l-.9.9c-.5.5-.7 1.1-.7 1.7h-2c0-1.1.4-2.1 1.2-2.9l1.2-1.2c.4-.4.6-.9.6-1.4 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.2 1.8-4 4-4s4 1.8 4 4c0 .9-.4 1.7-1.3 2.6z"/></svg>`,
};

function tile(label: string, value: string, icon: string, prime = false): string {
  const mod = prime ? " dash-tile--prime" : "";
  return `<div class="dash-tile${mod}"><span class="dash-tile__ico">${icon}</span><div class="dash-tile__meta"><span class="dash-tile__lab">${label}</span><span class="dash-tile__val">${value}</span></div></div>`;
}

export function buildDashboardSidebar(s: DashboardSnapshot, phase: string): string {
  const chip = PHASE_LABEL[phase] ?? "Trail";
  const minimap = renderTrailMinimap(s.miles, s.landmark);

  const partyHtml = s.party
    .map((p) => {
      const w = p.alive ? Math.max(4, p.health) : 0;
      const st = p.alive ? "alive" : "gone";
      return `<div class="party-row party-row--${st}">
        <span class="party-row__name">${escapeAttr(p.name)}</span>
        <span class="party-row__bar" role="presentation"><i style="width:${w}%"></i></span>
      </div>`;
    })
    .join("");

  return `
    <div class="dash-wrap">
      <header class="dash-head">
        <div class="dash-head__top">
          <span class="dash-chip">${escapeHtml(chip)}</span>
          <p class="dash-loc">${escapeHtml(s.landmark)}</p>
        </div>
        <div class="dash-minimap-host" aria-hidden="true">${minimap}</div>
      </header>

      <section class="dash-section" aria-label="Trail snapshot">
        <h2 class="dash-section__title">Trail snapshot</h2>
        <div class="dash-primary">
          ${tile("Day", `${s.day} / ${s.maxDays}`, ico.day, true)}
          ${tile("Miles", `${Math.round(s.miles)} / ${s.totalMiles}`, ico.miles, true)}
          ${tile("Party", `${s.alive}/${s.partyCap}`, ico.people, true)}
        </div>
      </section>

      <section class="dash-section" aria-label="Supplies and pace">
        <h2 class="dash-section__title">Supplies &amp; pace</h2>
        <div class="dash-grid">
          ${tile("Cash", s.money, ico.money)}
          ${tile("Food", `${s.food} lb`, ico.food)}
          ${tile("Ammo", String(s.ammo), ico.ammo)}
          ${tile("Oxen", String(s.oxen), ico.oxen)}
          ${tile("Pace", s.pace, ico.pace)}
          ${tile("Rations", s.rations, ico.food)}
          ${tile("Quiz ✓", String(s.triviaStreak), ico.quiz)}
        </div>
      </section>

      <p class="dash-profile">${escapeHtml(s.profileTitle)} · ${escapeHtml(s.spareParts)}</p>
      <section class="dash-section dash-section--party" aria-label="Party health">
        <h2 class="dash-section__title">Party</h2>
        <div class="dash-party">${partyHtml}</div>
      </section>
    </div>
  `.trim();
}

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

const chIco = (d: string) =>
  `<svg class="choice-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;

/** Compact SVG leading mark per menu slot (1-based). */
export function choiceLeadingIcon(phase: string, n: number): string {
  if (phase === "travel_menu") {
    const paths = [
      "",
      "M8 5v14l11-7-11-7z",
      "M12 3c-4 4-6 8-6 12h12c0-4-2-8-6-12z",
      "M12 2C8 6 6 10 6 14h12c0-4-2-8-6-12zm0 20a4 4 0 004-4H8a4 4 0 004 4z",
      "M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z",
      "M13 2L3 14h7l-1 8 10-12h-7l1-8z",
      "M4 10h16v4H4v-4zm0-4h10v4H4V6z",
      "M6 2h8v2H6V2zm0 4h12v14H6V6zm2 2v10h8V8H8z",
      "M4 8h4v10H4V8zm6-2h8l4 3v11H10V6zm4 0V4h6v6h-2V8h-4z",
    ];
    return paths[n] ? chIco(paths[n]!) : `<span class="choice-num">${n}</span>`;
  }
  if (phase === "river") {
    const paths = ["", "M2 12h20M6 8l4 4-4 4", "M4 4h16v16H4V4m4 4h8v8H8V8", "M4 8h16v10H4V8m4 4h8", "M12 6v12M8 10h8"];
    return paths[n] ? chIco(paths[n]!) : `<span class="choice-num">${n}</span>`;
  }
  if (phase === "store") {
    const paths = [
      "",
      "M8 4h8v4H8V4zm-2 8h12v10H6V12z",
      "M4 6h16v12H4V6zm4 4h8v6H8v-6z",
      "M8 8h8v10H8V8zm2-4h4v4h-4V4z",
      "M6 6h12v12H6V6z",
      "M8 8h8v8H8V8z",
      "M4 18h16v2H4v-2z",
      "M4 6h16l-2 12H6L4 6z",
      "M4 8h4v10H4V8zm6-2h8l4 3v11H10V6zm4 0V4h6v6h-2V8h-4z",
    ];
    return paths[n] ? chIco(paths[n]!) : `<span class="choice-num">${n}</span>`;
  }
  if (phase === "gift_shop_prompt") {
    const paths = [
      "",
      "M5 5h6v2H7v8h8v-4h2v6H5V5zm8-2h6v6h-2V7l-6 6-2-2 6-6h-4V3z",
      "M9 11h6v2H9v-2zm0-4h6v2H9V7zm-2 8h10v2H7v-2z",
      "M15 19l-8-8 8-8 1.4 1.4L9.8 11l6.6 6.6L15 19z",
    ];
    return paths[n] ? chIco(paths[n]!) : `<span class="choice-num">${n}</span>`;
  }
  if (phase === "land_pick") {
    const paths = ["", "M6 4h12v16H6V4zm2 2v12h8V6H8z", "M12 2v20M8 8h8M8 12h8", "M4 8l8-4 8 4v8l-8 4-8-4V8z", "M4 14c4-6 8-6 12 0v6H4v-6z"];
    return paths[n] ? chIco(paths[n]!) : `<span class="choice-num">${n}</span>`;
  }
  return `<span class="choice-num">${n}</span>`;
}
