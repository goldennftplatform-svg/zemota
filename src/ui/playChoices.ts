const CARD_PHASES = new Set([
  "training_quiz",
  "trivia",
  "trail_event",
  "profile",
  "river",
  "land_pick",
  "title",
  "travel_menu",
]);

const QUIZ_PHASES = new Set(["training_quiz", "trivia"]);

const PICK_LETTERS = "ABCDEFGHI";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isPickCardPhase(phase: string): boolean {
  return CARD_PHASES.has(phase);
}

export function isQuizPhase(phase: string): boolean {
  return QUIZ_PHASES.has(phase);
}

/** Card-style choice rows — full answer text, letter badge, no wasted "Answer 1" junk. */
export function renderPickChoicesHtml(
  phase: string,
  choices: { n: number; text: string }[],
): string {
  const quiz = isQuizPhase(phase);
  const mod = quiz ? " choices--quiz" : " choices--cards";
  const items = choices
    .map((c, i) => {
      const badge = PICK_LETTERS[i] ?? String(c.n);
      return `<li tabindex="0" data-n="${c.n}" role="button" class="pick-card">
        <span class="pick-card__badge" aria-hidden="true">${badge}</span>
        <span class="pick-card__text">${escapeHtml(c.text)}</span>
      </li>`;
    })
    .join("");
  return `<ul class="choices${mod}">${items}</ul>`;
}

export function renderDefaultChoicesHtml(
  phase: string,
  choices: { n: number; text: string }[],
  renderLead: (phase: string, n: number) => string,
): string {
  const items = choices
    .map(
      (c) =>
        `<li tabindex="0" data-n="${c.n}" role="button"><span class="choice-lead">${renderLead(phase, c.n)}</span><span class="choice-label">${escapeHtml(c.text)}</span></li>`,
    )
    .join("");
  return `<ul class="choices">${items}</ul>`;
}

export function renderChoicesHtml(
  phase: string,
  choices: { n: number; text: string }[],
  renderLead: (phase: string, n: number) => string,
): string {
  if (isPickCardPhase(phase)) return renderPickChoicesHtml(phase, choices);
  return renderDefaultChoicesHtml(phase, choices, renderLead);
}
