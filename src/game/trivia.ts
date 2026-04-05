/**
 * Daily quiz bank: core “teaching” cards plus migrated first-draft EMOTA trivia
 * (`triviaDraftRaw.ts`). Choices are deterministically shuffled per id so the
 * correct slot isn’t always A.
 */

import { TRIVIA_DRAFT_RAW } from "./triviaDraftRaw";
import { shuffleTriviaChoices } from "./triviaShuffle";

export interface TriviaItem {
  id: string;
  q: string;
  choices: string[];
  answer: number;
  teach: string;
  /** Bigger numbers surface more often in the last 20% of travel days. */
  endgameWeight: number;
}

function endgameWeightForCategory(cat: string): number {
  const c = cat.toLowerCase();
  let w = 1;
  if (/hop|brew|beer|yakima|puyallup/.test(c)) w += 3;
  if (/meeker|retrace|monument|history/.test(c)) w += 1;
  if (/geography|landmark|trail|nature/.test(c)) w += 1;
  if (/health|survival|supplies|economics|transportation|planning/.test(c)) w += 0;
  return Math.min(5, w);
}

function finalizeCore(raw: TriviaItem): TriviaItem {
  const { choices, answer } = shuffleTriviaChoices(raw.choices, raw.answer, raw.id);
  return { ...raw, choices, answer };
}

function finalizeDraft(r: (typeof TRIVIA_DRAFT_RAW)[number]): TriviaItem {
  const { choices, answer } = shuffleTriviaChoices(r.o, r.a, r.id);
  const correct = choices[answer] ?? "";
  return {
    id: r.id,
    q: r.q,
    choices,
    answer,
    teach: `That matches the trail record here: ${correct}. (${r.cat})`,
    endgameWeight: endgameWeightForCategory(r.cat),
  };
}

const TRIVIA_CORE_RAW: TriviaItem[] = [
  {
    id: "ezra_size",
    q: "Ezra Meeker was known on the trail and in photographs as:",
    choices: [
      "Well over six feet, like a mountain man",
      "About five feet one inch — small in stature, enormous in mileage",
      "Average height for 1850s emigrants",
      "Tall enough to see over oxen without standing on a crate",
    ],
    answer: 1,
    teach:
      "Ezra was notably short — a 5′1″ promoter of memory and roads who still crossed continents by wagon, rail, ship, car, and even early flight to tell the Oregon Trail story.",
    endgameWeight: 0,
  },
  {
    id: "oregon_year",
    q: "The Meeker family’s original overland emigration to Oregon Territory is associated with which era?",
    choices: ["1810s fur trade only", "1852 overland migration", "1898 gold rush only", "1920s auto tourism only"],
    answer: 1,
    teach:
      "The 1852 wagon journey is the core “Oregon Trail” chapter before later business and hop-farming chapters.",
    endgameWeight: 0,
  },
  {
    id: "land_claim",
    q: "At journey’s end, many families faced land policy questions. A common tension was:",
    choices: [
      "Free land with no paperwork anywhere",
      "Donation land claims vs later fees and filings as territories matured",
      "Only British crown grants mattered",
      "Land was assigned by dice at The Dalles",
    ],
    answer: 1,
    teach:
      "Oregon’s donation land era and later Washington filings are both part of how Ezra’s generation actually secured farms.",
    endgameWeight: 2,
  },
  {
    id: "puyallup_hint",
    q: "Puyallup Valley agriculture in the Meeker story is especially tied to:",
    choices: ["Silver mining camps", "Hop fields and marketing hops", "Whale oil rendering", "Cattle drives to Texas"],
    answer: 1,
    teach: "Ezra’s “hop king” chapter belongs to Puyallup — acreage, prices, and boom/bust follow from there.",
    endgameWeight: 4,
  },
  {
    id: "retrace",
    q: "From the 1870s into the 1920s, Ezra Meeker famously:",
    choices: [
      "Never left Oregon again",
      "Retraced and promoted the Oregon Trail memory by wagon and modern transport",
      "Only traveled by steamship to Europe",
      "Opposed all road building",
    ],
    answer: 1,
    teach: "Planes, automobiles, and 1920s advocacy kept the trail in public mind — Meeker’s trademark stubborn energy.",
    endgameWeight: 3,
  },
  {
    id: "river_logic",
    q: "Why did major rivers matter more than “random events” on the real trail?",
    choices: [
      "They were purely decorative in diaries",
      "They forced timing, expense, and risk — ferries, fords, and drownings cluster in accounts",
      "They never flooded in the 1850s",
      "They were only crossed in winter",
    ],
    answer: 1,
    teach: "The game raises death risk at rivers because history does — emigrant diaries cluster drama at water.",
    endgameWeight: 1,
  },
  {
    id: "company_agent",
    q: "A “company agent” on the trail might represent:",
    choices: [
      "Only a child under ten",
      "Fur-trade or supply-house business with samples, credit, and contracts — not a family farm party",
      "A U.S. senator",
      "A professional gambler only",
    ],
    answer: 1,
    teach: "Not every wagon was a homesteader nuclear family — commercial travelers carried different risks and resources.",
    endgameWeight: 0,
  },
  {
    id: "hop_king",
    q: "The game’s secret “Hop King of the World” ending points to:",
    choices: [
      "California gold country only",
      "Puyallup Valley hop industry and Ezra’s promotional personality",
      "The Lewis and Clark-only route",
      "A fictional island",
    ],
    answer: 1,
    teach: "The “secret” is really a geography and economics lesson around Northwest hops and Meeker’s branding.",
    endgameWeight: 5,
  },
];

export const TRIVIA_BANK: TriviaItem[] = [
  ...TRIVIA_CORE_RAW.map(finalizeCore),
  ...TRIVIA_DRAFT_RAW.map(finalizeDraft),
];

export function pickTriviaForDay(day: number, totalDays: number): TriviaItem {
  const progress = totalDays > 0 ? day / totalDays : 0;
  const endBias = progress > 0.8 ? 3 : 1;
  let best: TriviaItem | null = null;
  let bestScore = -1;
  for (const t of TRIVIA_BANK) {
    const w = 1 + t.endgameWeight * endBias;
    const s = Math.random() * w;
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return best ?? TRIVIA_BANK[0]!;
}
