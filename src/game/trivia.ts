/**
 * Daily quiz bank: the master EMOTA trivia list (`triviaAdditional.json`).
 * Choices are deterministically shuffled per id so the correct slot isn’t
 * always A; True/False pairs stay in canonical order.
 */

import { shuffleTriviaChoices } from "./triviaShuffle";
import additional from "../data/triviaAdditional.json" with { type: "json" };
import { validateTriviaBank } from "./triviaValidation";

export interface TriviaItem {
  id: string;
  q: string;
  choices: string[];
  answer: number;
  teach: string;
  /** Bigger numbers surface more often in the last 20% of travel days. */
  endgameWeight: number;
}

function finalizeCore(raw: TriviaItem): TriviaItem {
  const { choices, answer } = shuffleTriviaChoices(raw.choices, raw.answer, raw.id);
  return { ...raw, choices, answer };
}

export function buildTriviaBank(): TriviaItem[] {
  return validateTriviaBank(additional).map(finalizeCore);
}

export const TRIVIA_BANK: TriviaItem[] = buildTriviaBank();

export function pickTriviaForDay(
  day: number,
  totalDays: number,
  exclude?: ReadonlySet<string>,
): TriviaItem {
  const progress = totalDays > 0 ? day / totalDays : 0;
  const endBias = progress > 0.8 ? 3 : 1;
  let best: TriviaItem | null = null;
  let bestScore = -1;
  for (const t of TRIVIA_BANK) {
    if (exclude?.has(t.id)) continue;
    const w = 1 + t.endgameWeight * endBias;
    const s = Math.random() * w;
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return best ?? pickTriviaForDay(day, totalDays);
}

/** Random distinct warm-up questions per run — not hardlocked to the first bank entries. */
export function pickWarmupTrivia(count = 3): TriviaItem[] {
  const pool = [...TRIVIA_BANK];
  const out: TriviaItem[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return out;
}
