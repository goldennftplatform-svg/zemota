/** Six old-west style chance games (pick 1–6). Outcomes come from interactive simulation payloads. */

export const CHANCE_GAMES = [
  {
    id: "shell",
    name: "Shell & pea (guess the shell)",
    blurb: "Three cups, one pea — oldest game on any river landing.",
  },
  {
    id: "coin",
    name: "Double-or-nothing coin flip",
    blurb: "Call it in the air. The trail teaches that coins are cruel teachers.",
  },
  {
    id: "dice",
    name: "Bone dice vs the house",
    blurb: "Roll two bone dice; beat a 7 to win a small purse.",
  },
  {
    id: "high_low",
    name: "High-low card",
    blurb: "One card face up — wager whether the next is higher or lower.",
  },
  {
    id: "lottery",
    name: "Lottery draw (pick 1–6)",
    blurb: "Six slips in a hat. Match the caller’s number for a prize.",
  },
  {
    id: "knife",
    name: "Knife toss at the mark",
    blurb: "Throw at a chalk circle — skill, luck, and spectators’ opinions.",
  },
] as const;

export type ChanceGameId = (typeof CHANCE_GAMES)[number]["id"];

export interface ChanceResult {
  title: string;
  detail: string;
  moneyDeltaCents: number;
  foodDeltaLbs: number;
  reputation: string;
}

/** Deterministic outcome from the mini-game simulation (no second RNG in the engine). */
export type ChanceSimPayload =
  | { game: "shell"; cupChoice: 0 | 1 | 2; peaPosition: 0 | 1 | 2 }
  | { game: "coin"; call: "heads" | "tails"; outcome: "heads" | "tails" }
  | { game: "dice"; a: number; b: number; houseThreshold: number }
  | { game: "high_low"; guess: "high" | "low"; first: number; second: number }
  | { game: "lottery"; pick: number; draw: number }
  | { game: "knife"; power: number; hit: boolean };

function clampStake(stakeCents: number): number {
  return Math.max(50, Math.min(stakeCents, 500_00));
}

export function resolveChanceFromSimulation(
  stakeCents: number,
  p: ChanceSimPayload,
): ChanceResult {
  const stake = clampStake(stakeCents);
  switch (p.game) {
    case "shell": {
      const win = p.cupChoice === p.peaPosition;
      return {
        title: "Shell game",
        detail: win
          ? "You pick the right cup — the operator scowls and pays."
          : "Wrong cup. The pea was under another shell the whole time.",
        moneyDeltaCents: win ? Math.round(stake * 2) : -stake,
        foodDeltaLbs: 0,
        reputation: win ? "Campfire story material." : "Lesson: don’t trust river rats.",
      };
    }
    case "coin": {
      const win = p.call === p.outcome;
      return {
        title: "Coin flip",
        detail: win
          ? `${p.outcome === "heads" ? "Heads" : "Tails"} — you called it. The crowd groans.`
          : `${p.outcome === "heads" ? "Heads" : "Tails"}. Your stake walks away.`,
        moneyDeltaCents: win ? stake : -stake,
        foodDeltaLbs: 0,
        reputation: "Even odds still feel personal on the trail.",
      };
    }
    case "dice": {
      const sum = p.a + p.b;
      const house = p.houseThreshold;
      const win = sum > house;
      return {
        title: "Bone dice",
        detail: `You rolled ${sum}. The house needs more than ${house} to sweat — ${win ? "you win" : "house takes it"}.`,
        moneyDeltaCents: win ? Math.round(stake * 1.4) : -Math.round(stake * 0.8),
        foodDeltaLbs: 0,
        reputation: "Dice click like wagon spokes in the dark.",
      };
    }
    case "high_low": {
      const { first, second, guess } = p;
      const rank = (n: number) => (n === 1 ? "A" : n >= 11 ? (n === 11 ? "J" : n === 12 ? "Q" : "K") : String(n));
      let win = false;
      if (second > first) win = guess === "high";
      else if (second < first) win = guess === "low";
      return {
        title: "High-low",
        detail:
          second === first
            ? `Push — ${rank(first)} then ${rank(second)}. House takes ties.`
            : win
              ? `You called ${guess} — ${rank(first)} then ${rank(second)}. The next card breaks your way.`
              : `The deck humiliates your guess (${rank(first)} → ${rank(second)}).`,
        moneyDeltaCents: win ? Math.round(stake * 0.9) : second === first ? 0 : -stake,
        foodDeltaLbs: 0,
        reputation: "Card lore travels faster than mail.",
      };
    }
    case "lottery": {
      const win = p.pick === p.draw;
      return {
        title: "Lottery draw",
        detail: `You chose ${p.pick}. The hat reveals ${p.draw}.`,
        moneyDeltaCents: win ? stake * 5 : -Math.round(stake * 0.2),
        foodDeltaLbs: win ? 15 : 0,
        reputation: "Six numbers and a dream — same as today’s games, worse paper.",
      };
    }
    case "knife": {
      const win = p.hit;
      return {
        title: "Knife toss",
        detail: win
          ? "Blade kisses the chalk — the crowd buys the next round (in beans)."
          : "Wide right. You owe the house a story and a nickel.",
        moneyDeltaCents: win ? Math.round(stake * 1.2) : -Math.round(stake * 0.5),
        foodDeltaLbs: win ? 8 : 0,
        reputation: "Every fort has someone who “never misses.”",
      };
    }
  }
}

/** Legacy instant-RNG path (tests / tooling only). */
export function playChanceGame(id: ChanceGameId, stakeCents: number): ChanceResult {
  const stake = clampStake(stakeCents);
  switch (id) {
    case "shell":
      return resolveChanceFromSimulation(stakeCents, {
        game: "shell",
        cupChoice: (Math.floor(Math.random() * 3) as 0 | 1 | 2),
        peaPosition: (Math.floor(Math.random() * 3) as 0 | 1 | 2),
      });
    case "coin": {
      const outcome = Math.random() < 0.5 ? "heads" : "tails";
      const call = Math.random() < 0.5 ? "heads" : "tails";
      return resolveChanceFromSimulation(stakeCents, { game: "coin", call, outcome });
    }
    case "dice": {
      const a = Math.floor(Math.random() * 6) + 1;
      const b = Math.floor(Math.random() * 6) + 1;
      return resolveChanceFromSimulation(stakeCents, { game: "dice", a, b, houseThreshold: 7 });
    }
    case "high_low": {
      let first = Math.floor(Math.random() * 13) + 1;
      let second = Math.floor(Math.random() * 13) + 1;
      if (second === first) second = (second % 13) + 1;
      const guess = Math.random() < 0.5 ? "high" : "low";
      return resolveChanceFromSimulation(stakeCents, { game: "high_low", guess, first, second });
    }
    case "lottery":
      return resolveChanceFromSimulation(stakeCents, {
        game: "lottery",
        pick: Math.floor(Math.random() * 6) + 1,
        draw: Math.floor(Math.random() * 6) + 1,
      });
    case "knife":
      return resolveChanceFromSimulation(stakeCents, {
        game: "knife",
        power: Math.random() * 100,
        hit: Math.random() < 0.4,
      });
  }
}
