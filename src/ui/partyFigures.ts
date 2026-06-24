/** Stick-figure party roster — shared by play sidebar and bigboard dock. */

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

function partyStickSvg(alive: boolean): string {
  const stroke = alive ? "currentColor" : "#6a6a6a";
  return `<svg class="party-stick" viewBox="0 0 24 40" aria-hidden="true" focusable="false">
    <circle cx="12" cy="6" r="4" fill="none" stroke="${stroke}" stroke-width="2"/>
    <line x1="12" y1="10" x2="12" y2="24" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="14" x2="5" y2="20" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="14" x2="19" y2="20" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="24" x2="6" y2="36" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="24" x2="18" y2="36" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

/** Up to five stick figures — greyed when a party member has died. */
export function renderPartyRoster(
  party: PartyFigureRow[],
  opts?: { compact?: boolean; showNames?: boolean },
): string {
  const compact = opts?.compact ?? false;
  const showNames = opts?.showNames ?? true;
  const mod = compact ? " party-roster--compact" : "";
  const figs = party
    .slice(0, 5)
    .map((p) => {
      const st = p.alive ? "alive" : "gone";
      const rawShort = p.name.length > 9 ? `${p.name.slice(0, 8)}…` : p.name;
      const nameHtml = showNames
        ? `<span class="party-roster__name">${escapeHtml(rawShort)}</span>`
        : "";
      return `<div class="party-roster__fig party-roster__fig--${st}" title="${escapeAttr(p.name)}">
        ${partyStickSvg(p.alive)}
        ${nameHtml}
      </div>`;
    })
    .join("");
  return `<div class="party-roster${mod}">${figs}</div>`;
}
