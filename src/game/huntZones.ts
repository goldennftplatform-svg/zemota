/** Trail regions for hunting: different mixes of game and cover (OG-style). */

export type HuntZoneId = "plains" | "forest" | "mountains" | "oregon";

export type AnimalKind = "bison" | "bear" | "deer" | "rabbit";

export interface HuntZoneInfo {
  id: HuntZoneId;
  label: string;
  /** Relative obstacle density 0–1 (trees / rocks). */
  cover: number;
}

const ZONES: HuntZoneInfo[] = [
  { id: "plains", label: "Great Plains — open grass, herds", cover: 0.12 },
  { id: "forest", label: "Woods & river breaks — timber, cover", cover: 0.35 },
  { id: "mountains", label: "High country — rocks, thickets", cover: 0.42 },
  { id: "oregon", label: "Willamette edge — valley game", cover: 0.28 },
];

/** Cumulative miles thresholds — 4 bands along ~2k mi trail. */
const MILE_CUTS = [0, 520, 1080, 1620];

export function huntRegionIndexFromMiles(miles: number): number {
  let idx = 0;
  for (let i = MILE_CUTS.length - 1; i >= 0; i--) {
    if (miles >= MILE_CUTS[i]!) idx = i;
  }
  return Math.min(idx, ZONES.length - 1);
}

export function huntZoneFromMiles(miles: number): HuntZoneInfo {
  return ZONES[huntRegionIndexFromMiles(miles)] ?? ZONES[0]!;
}

/** Options passed from GameEngine into the hunt minigame. */
export interface HuntSessionOptions {
  maxShots: number;
  maxCarryLb: number;
  zoneId: HuntZoneId;
  zoneLabel: string;
  /** 0 = pristine, 1 = heavily hunted in this region. */
  depletion: number;
}

/** Weight tables by zone — buffalo/bear pay best (player lore). */
const WEIGHTS: Record<HuntZoneId, Record<AnimalKind, number>> = {
  plains: { bison: 38, deer: 32, bear: 6, rabbit: 24 },
  forest: { bison: 14, deer: 34, bear: 22, rabbit: 30 },
  mountains: { bison: 18, deer: 28, bear: 34, rabbit: 20 },
  oregon: { bison: 12, deer: 36, bear: 14, rabbit: 38 },
};

export function pickAnimalKind(zoneId: HuntZoneId, rnd: () => number): AnimalKind {
  const w = WEIGHTS[zoneId];
  const total = w.bison + w.bear + w.deer + w.rabbit;
  let r = rnd() * total;
  for (const k of ["bison", "bear", "deer", "rabbit"] as const) {
    r -= w[k];
    if (r <= 0) return k;
  }
  return "deer";
}

/** Meat returned to the wagon per animal (lbs). */
export function meatLbForKind(kind: AnimalKind): number {
  switch (kind) {
    case "bison":
      return 78 + Math.floor(Math.random() * 22);
    case "bear":
      return 88 + Math.floor(Math.random() * 28);
    case "deer":
      return 38 + Math.floor(Math.random() * 18);
    default:
      return 8 + Math.floor(Math.random() * 10);
  }
}

export function animalShort(kind: AnimalKind): string {
  switch (kind) {
    case "bison":
      return "B";
    case "bear":
      return "Br";
    case "deer":
      return "D";
    default:
      return "r";
  }
}
