/** Deterministic shuffle so correct answers are not always choice A. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleTriviaChoices(
  choices: readonly string[],
  correctIndex: number,
  seed: string,
): { choices: string[]; answer: number } {
  if (choices.length !== 4) {
    throw new Error("shuffleTriviaChoices: expected exactly 4 choices");
  }
  type E = { text: string; correct: boolean };
  const entry: E[] = choices.map((text, i) => ({ text, correct: i === correctIndex }));
  const rand = mulberry32(hashSeed(seed));
  for (let i = entry.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = entry[i]!;
    entry[i] = entry[j]!;
    entry[j] = tmp;
  }
  return {
    choices: entry.map((e) => e.text),
    answer: entry.findIndex((e) => e.correct),
  };
}
