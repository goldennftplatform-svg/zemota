import { sanitizeWagonIdentity, WAGON_COLORS, WAGON_EMBLEMS, type WagonIdentity } from "../game/wagonIdentity";

export function wagonBadge(raw: unknown): string {
  const w = sanitizeWagonIdentity(raw);
  const marks = {
    star: '<path d="m48 12 2 6h7l-5 4 2 6-6-4-6 4 2-6-5-4h7z"/>',
    pine: '<path d="m48 12-8 11h5v5h6v-5h5z"/>',
    sun: '<circle cx="48" cy="20" r="6"/><path d="M48 10v3m0 14v3M38 20h3m14 0h3" fill="none" stroke="currentColor"/>',
    river: '<path d="M39 15q5-4 9 0t9 0v4q-5 4-9 0t-9 0zm0 9q5-4 9 0t9 0v4q-5 4-9 0t-9 0z"/>',
  };
  return `<svg class="wagon-badge" viewBox="0 0 80 56" role="img" aria-label="${w.color} canvas, ${WAGON_EMBLEMS[w.emblem]} pennant" style="--wagon-color:${WAGON_COLORS[w.color]}"><path d="M10 36V23a22 18 0 0 1 44 0v13z" fill="var(--wagon-color)" stroke="#38291b" stroke-width="3"/><path d="M8 36h50v7H8z" fill="#a8762e"/><g fill="#24190f" stroke="#e8d2a0" stroke-width="2"><circle cx="18" cy="46" r="7"/><circle cx="48" cy="46" r="7"/></g><path d="M62 37V5" stroke="#e8d2a0" stroke-width="2"/><path d="M62 5H34v27h28l-7-13z" fill="var(--wagon-color)"/><g fill="currentColor" color="#38291b">${marks[w.emblem]}</g></svg>`;
}

export function identityFields(w: WagonIdentity, escape: (s: string) => string): string {
  return `<fieldset class="wagon-identity"><legend>Your wagon colors</legend><div class="wagon-identity__preview">${wagonBadge(w)}<span>Canvas &amp; pennant<br/>Seen on the live trail wall</span></div>
    <label>Canvas <select name="wagon-color">${Object.keys(WAGON_COLORS).map((c) => `<option ${c === w.color ? "selected" : ""} value="${c}">${c}</option>`).join("")}</select></label>
    <label>Pennant <select name="wagon-emblem">${Object.entries(WAGON_EMBLEMS).map(([e, label]) => `<option ${e === w.emblem ? "selected" : ""} value="${e}">${label}</option>`).join("")}</select></label>
    ${w.oxNames.map((n, i) => `<label>Ox ${i + 1} <input name="ox-${i}" maxlength="20" value="${escape(n)}" /></label>`).join("")}</fieldset>`;
}

export function readIdentityFields(host: HTMLElement): WagonIdentity {
  const value = (name: string) => host.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value;
  return sanitizeWagonIdentity({ color: value("wagon-color"), emblem: value("wagon-emblem"), oxNames: [value("ox-0"), value("ox-1")] });
}
