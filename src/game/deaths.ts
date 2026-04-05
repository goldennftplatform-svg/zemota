import type { DeathCause, PartyMember, ProfileId } from "./types";
import { PROFILES } from "./profiles";

export const DEATH_CAUSES: {
  id: DeathCause;
  label: string;
  flavor: string;
}[] = [
  { id: "dysentery", label: "dysentery", flavor: "has died of dysentery." },
  { id: "snake_bite", label: "snake bite", flavor: "was bitten by a rattlesnake." },
  { id: "cholera", label: "cholera", flavor: "succumbed to cholera along the Platte." },
  { id: "drowning", label: "drowning", flavor: "was lost crossing rough water." },
  { id: "exhaustion", label: "exhaustion", flavor: "collapsed from exhaustion and cold." },
  {
    id: "wagon_accident",
    label: "wagon accident",
    flavor: "was crushed in a wagon accident.",
  },
  { id: "mountain_fever", label: "mountain fever", flavor: "burned with mountain fever." },
];

const BASE_LETHALITY = 0.03;

export interface DeathRollContext {
  profile: ProfileId;
  /** River crossing, storm, outbreak, etc. */
  hazardMult: number;
  rationsHarsh: boolean;
}

function pickCause(): DeathCause {
  return DEATH_CAUSES[Math.floor(Math.random() * DEATH_CAUSES.length)]!.id;
}

/** Per living party member, one independent roll (~3% baseline × modifiers). */
export function rollDailyDeaths(
  party: PartyMember[],
  ctx: DeathRollContext,
): { name: string; cause: DeathCause }[] {
  const prof = PROFILES[ctx.profile];
  let p =
    BASE_LETHALITY * prof.dangerMult * ctx.hazardMult * (ctx.rationsHarsh ? 1.15 : 1);
  p = Math.min(0.12, Math.max(0.005, p));
  const dead: { name: string; cause: DeathCause }[] = [];
  for (const m of party) {
    if (!m.alive) continue;
    if (Math.random() < p) {
      dead.push({ name: m.name, cause: pickCause() });
    }
  }
  return dead;
}

export function applyDeaths(
  party: PartyMember[],
  deaths: { name: string; cause: DeathCause }[],
): string[] {
  const lines: string[] = [];
  for (const d of deaths) {
    const m = party.find((x) => x.name === d.name && x.alive);
    if (!m) continue;
    m.alive = false;
    m.health = 0;
    m.cause = d.cause;
    const flavor = DEATH_CAUSES.find((c) => c.id === d.cause)?.flavor ?? "has died.";
    lines.push(`${m.name} ${flavor}`);
  }
  return lines;
}
