import type { TriviaItem } from "./trivia";

/** Fail authoring/build checks before invalid content reaches a quiz. */
export function validateTriviaBank(raw: unknown): TriviaItem[] {
  if (!Array.isArray(raw)) throw new Error("Trivia bank must be an array");
  const ids = new Set<string>();
  for (const [i, row] of raw.entries()) {
    const fail = (why: string): never => { throw new Error(`Trivia row ${i} (${row?.id ?? "no id"}): ${why}`); };
    if (!row || typeof row !== "object") fail("expected object");
    if (typeof row.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(row.id)) fail("invalid stable id");
    if (ids.has(row.id)) fail("duplicate id");
    ids.add(row.id);
    if (typeof row.q !== "string" || !row.q.trim()) fail("question required");
    if (!Array.isArray(row.choices) || row.choices.length < 2 || row.choices.length > 4 ||
      row.choices.some((s: unknown) => typeof s !== "string" || !s.trim())) fail("2 to 4 nonempty answers required");
    if (new Set(row.choices.map((s: string) => s.trim().toLowerCase())).size !== row.choices.length) fail("duplicate answers");
    if (!Number.isInteger(row.answer) || row.answer < 0 || row.answer >= row.choices.length) fail("answer index out of range");
    if (typeof row.teach !== "string" || !row.teach.trim()) fail("teaching text required");
    if (!Number.isInteger(row.endgameWeight) || row.endgameWeight < 0 || row.endgameWeight > 5) fail("weight must be 0-5");
  }
  return raw as TriviaItem[];
}

/** Bound by actual content, not a fixed cap. Retired/invalid IDs do not consume space. */
export function restoreSeenTrivia(raw: unknown, bank: readonly TriviaItem[]): Set<string> {
  const known = new Set(bank.map((t) => t.id));
  return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && known.has(id)) : []);
}
