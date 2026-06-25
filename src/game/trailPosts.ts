import { TOTAL_TRAIL_MILES, TRAIL_POST_STOP_FRACTION } from "./config";
import { LANDMARKS } from "./map";
import type { ProfileId } from "./types";
import { PROFILES } from "./profiles";

/** Landmarks that can host a trading post this run (not rivers, not jump-off / Oregon City). */
export function postEligibleLandmarkIndices(): number[] {
  return LANDMARKS.map((_, i) => i).filter((i) => {
    const L = LANDMARKS[i]!;
    return (
      L.milesFromStart > 0 &&
      L.milesFromStart < TOTAL_TRAIL_MILES &&
      !L.river
    );
  });
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rng = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** ~half of eligible posts per run — different every play. */
export function rollTrailPostStops(seed: number): number[] {
  const eligible = postEligibleLandmarkIndices();
  const count = Math.max(1, Math.round(eligible.length * TRAIL_POST_STOP_FRACTION));
  return shuffleSeeded(eligible, seed ^ 0x504f5354).slice(0, count);
}

/** Landmark indices newly crossed on this travel leg. */
export function landmarksCrossed(fromMiles: number, toMiles: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < LANDMARKS.length; i++) {
    const m = LANDMARKS[i]!.milesFromStart;
    if (m > fromMiles + 2 && m <= toMiles + 2) out.push(i);
  }
  return out;
}

export type TrailPostOfferKind =
  | "buy_food"
  | "buy_ammo"
  | "barter_ammo_food"
  | "repair"
  | "today_special"
  | "pass";

export interface TrailPostOffer {
  n: number;
  kind: TrailPostOfferKind;
  label: string;
  todayOnly?: boolean;
}

interface TodaySpecial {
  label: string;
  costCents: number;
  foodLbs: number;
  ammo: number;
}

const TODAY_SPECIALS: TodaySpecial[] = [
  { label: "120 lb flour sack", costCents: 2_80, foodLbs: 120, ammo: 0 },
  { label: "Powder & lead (40 rounds)", costCents: 3_20, foodLbs: 0, ammo: 40 },
  { label: "Bacon & beans crate", costCents: 2_40, foodLbs: 80, ammo: 0 },
  { label: "Trader’s stew + 20 lb salt pork", costCents: 3_60, foodLbs: 100, ammo: 0 },
];

function todaySpecial(landmarkIdx: number, day: number, seed: number): TodaySpecial {
  const mix = (landmarkIdx * 1_049 + day * 97 + seed) >>> 0;
  return TODAY_SPECIALS[mix % TODAY_SPECIALS.length]!;
}

function priceCents(base: number, profile: ProfileId, todayOnly: boolean): number {
  const mult = PROFILES[profile].buyPriceMult;
  const trade = PROFILES[profile].tradeMult;
  const raw = base * mult;
  return Math.max(50, Math.round(todayOnly ? raw / trade : raw));
}

/** Three quick offers + pass — one is always “today only” at this post. */
export function buildTrailPostOffers(
  landmarkIdx: number,
  day: number,
  seed: number,
  profile: ProfileId,
): TrailPostOffer[] {
  const special = todaySpecial(landmarkIdx, day, seed);
  const foodCost = priceCents(3_00, profile, false);
  const ammoCost = priceCents(2_50, profile, false);
  const specialCost = priceCents(special.costCents, profile, true);

  return [
    {
      n: 1,
      kind: "buy_food",
      label: `Buy 100 lb food · ${fmt$(foodCost)}`,
    },
    {
      n: 2,
      kind: "buy_ammo",
      label: `Buy 25 rounds · ${fmt$(ammoCost)}`,
    },
    {
      n: 3,
      kind: "today_special",
      label: `Today only · ${special.label} · ${fmt$(specialCost)}`,
      todayOnly: true,
    },
    {
      n: 4,
      kind: "barter_ammo_food",
      label: "Barter 15 ammo → 60 lb food (no cash)",
    },
    {
      n: 5,
      kind: "repair",
      label: "Wagon tune-up · spare wheel if you have one, else $4",
    },
    { n: 6, kind: "pass", label: "Roll on — no time to trade" },
  ];
}

function fmt$(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export interface TrailPostResolveInput {
  kind: TrailPostOfferKind;
  landmarkIdx: number;
  day: number;
  seed: number;
  profile: ProfileId;
  moneyCents: number;
  foodLbs: number;
  ammo: number;
  spareWheels: number;
}

export interface TrailPostResolveResult {
  lines: string[];
  moneyCents: number;
  foodLbs: number;
  ammo: number;
  spareWheels: number;
  partyHealthBump: number;
}

export function resolveTrailPostChoice(input: TrailPostResolveInput): TrailPostResolveResult {
  const base = {
    moneyCents: input.moneyCents,
    foodLbs: input.foodLbs,
    ammo: input.ammo,
    spareWheels: input.spareWheels,
    partyHealthBump: 0,
    lines: [] as string[],
  };
  const { profile } = input;
  const L = LANDMARKS[input.landmarkIdx]!;

  if (input.kind === "pass") {
    return {
      ...base,
      lines: [`You push past ${L.name} without stopping.`],
    };
  }

  if (input.kind === "buy_food") {
    const cost = priceCents(3_00, profile, false);
    if (input.moneyCents < cost) {
      return { ...base, lines: ["Not enough cash for the food lot."] };
    }
    return {
      ...base,
      moneyCents: input.moneyCents - cost,
      foodLbs: input.foodLbs + 100,
      lines: [`+100 lb food · −${fmt$(cost)}`],
    };
  }

  if (input.kind === "buy_ammo") {
    const cost = priceCents(2_50, profile, false);
    if (input.moneyCents < cost) {
      return { ...base, lines: ["Not enough cash for powder and lead."] };
    }
    return {
      ...base,
      moneyCents: input.moneyCents - cost,
      ammo: input.ammo + 25,
      lines: [`+25 ammo · −${fmt$(cost)}`],
    };
  }

  if (input.kind === "barter_ammo_food") {
    if (input.ammo < 15) {
      return { ...base, lines: ["You need at least 15 rounds to barter."] };
    }
    return {
      ...base,
      ammo: input.ammo - 15,
      foodLbs: input.foodLbs + 60,
      lines: ["Traded 15 ammo for 60 lb food — fair enough for today."],
    };
  }

  if (input.kind === "repair") {
    if (input.spareWheels > 0) {
      return {
        ...base,
        spareWheels: input.spareWheels - 1,
        partyHealthBump: 6,
        lines: ["You lash a spare wheel and tighten the running gear. The wagon rides easier."],
      };
    }
    const cost = priceCents(4_00, profile, false);
    if (input.moneyCents < cost) {
      return { ...base, lines: ["No spare wheel and not enough cash for the smith’s quick fix."] };
    }
    return {
      ...base,
      moneyCents: input.moneyCents - cost,
      partyHealthBump: 4,
      lines: [`Paid ${fmt$(cost)} for axle grease and a hurried wheel check.`],
    };
  }

  if (input.kind === "today_special") {
    const sp = todaySpecial(input.landmarkIdx, input.day, input.seed);
    const cost = priceCents(sp.costCents, profile, true);
    if (input.moneyCents < cost) {
      return { ...base, lines: [`Today’s lot (${sp.label}) — you’re short ${fmt$(cost - input.moneyCents)}.`] };
    }
    const bits: string[] = [`Today only at ${L.name}: ${sp.label}.`];
    if (sp.foodLbs) bits.push(`+${sp.foodLbs} lb food`);
    if (sp.ammo) bits.push(`+${sp.ammo} ammo`);
    bits.push(`−${fmt$(cost)}`);
    return {
      ...base,
      moneyCents: input.moneyCents - cost,
      foodLbs: input.foodLbs + sp.foodLbs,
      ammo: input.ammo + sp.ammo,
      lines: [bits.join(" · ")],
    };
  }

  return { ...base, lines: ["You move on."] };
}
