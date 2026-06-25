/** Party roster portraits — 72 random pioneer skins + names. */

import { partySkinIndex } from "../game/partySkinSheets";
import { renderPartySkinHtml } from "./partySkins";

export type PartyFigureRow = { name: string; alive: boolean };

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

/** Up to five travelers — greyed when a party member has died. */
export function renderPartyRoster(
  party: PartyFigureRow[],
  opts?: { compact?: boolean; showNames?: boolean; bare?: boolean },
): string {
  const compact = opts?.compact ?? false;
  const showNames = opts?.showNames ?? true;
  const bare = opts?.bare ?? false;
  const mod = `${compact ? " party-roster--compact" : ""}${bare ? " party-roster--bare" : ""}`;
  const figs = party
    .slice(0, 5)
    .map((p, slot) => {
      const st = p.alive ? "alive" : "gone";
      const rawShort = p.name.length > 9 ? `${p.name.slice(0, 8)}…` : p.name;
      const nameHtml = showNames
        ? `<span class="party-roster__name">${escapeHtml(rawShort)}</span>`
        : "";
      const skinId = partySkinIndex(p.name, slot);
      return `<div class="party-roster__fig party-roster__fig--${st}" title="${escapeAttr(p.name)}">
        ${renderPartySkinHtml(skinId)}
        ${nameHtml}
      </div>`;
    })
    .join("");
  return `<div class="party-roster${mod}">${figs}</div>`;
}

export { hydratePartySkins, preloadPartySkinSheets } from "./partySkins";
