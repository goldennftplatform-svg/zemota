import {
  CHANCE_GAMES,
  resolveChanceFromSimulation,
  type ChanceGameId,
  type ChanceSimPayload,
} from "./chance";
import { ART } from "./asciiArt";
import {
  HUNT_MAX_MEAT_LB,
  HUNT_MAX_SHOTS_PER_SESSION,
  HUNT_MIN_AMMO_TO_HUNT,
  MAX_PARTY,
  PACE_REFERENCE_DAYS,
  TARGET_TRAVEL_DAYS,
  TOTAL_TRAIL_MILES,
} from "./config";
import { huntRegionIndexFromMiles, huntZoneFromMiles, type HuntSessionOptions } from "./huntZones";
import { pickEncounter, TRAIL_ENCOUNTERS, type EncounterMeta } from "./encounters";
import { applyDeaths, rollDailyDeaths } from "./deaths";
import { resolveLandChoice, type LandChoice, type LandOutcome } from "./landClaim";
import { landmarkAtMiles, nextRiverAhead, LANDMARKS } from "./map";
import { PROFILES, PROFILE_ORDER } from "./profiles";
import { idealOutfitCostCents, priceAmmo, priceClothes, priceFood, priceOxen, priceParts } from "./store";
import { pickTriviaForDay, TRIVIA_BANK, type TriviaItem } from "./trivia";
import type {
  DashboardSnapshot,
  DeathCause,
  EmotaPopup,
  GameInventory,
  Pace,
  PartyMember,
  ProfileId,
  Rations,
} from "./types";

export type EnginePhase =
  | "title"
  | "training_text"
  | "training_quiz"
  | "party_names"
  | "profile"
  | "store"
  | "travel_menu"
  | "river"
  | "travel_log"
  | "trail_event"
  | "overhead_hunt"
  | "chance_pick"
  | "chance_play"
  | "chance_result"
  | "trivia"
  | "land_pick"
  | "land_build"
  | "land_result"
  | "game_over"
  | "victory";

export interface ScreenDescriptor {
  lines: string[];
  choices?: { n: number; text: string }[];
  inputLine?: { placeholder: string; hint: string };
  overhead?: "hunt" | "build" | "chance";
  phase: EnginePhase;
  /** Soft onboarding line for the main panel (rendered under story text). */
  coach?: string;
}

function defaultParty(names: string[]): PartyMember[] {
  const out: PartyMember[] = [];
  for (let i = 0; i < MAX_PARTY; i++) {
    const name = names[i]?.trim() || `Traveler ${i + 1}`;
    out.push({ name, health: 100, alive: true });
  }
  return out;
}

function formatMoney(cents: number): string {
  const neg = cents < 0;
  const c = Math.abs(cents);
  const d = Math.floor(c / 100);
  const cc = c % 100;
  return `${neg ? "-" : ""}$${d}.${cc.toString().padStart(2, "0")}`;
}

/** Training slideshow before the warm-up quiz — length drives Next / quiz transition. */
const TRAINING_INTRO_PAGES: string[][] = [
  [
    "Ezra Meeker",
    "• 5′1″ · Oregon Trail 1850s · hops & roads · retraced the trail into the 1920s",
    "• Daily quizzes draw from a large trail / Meeker / hops bank (your first-draft set, tuned here).",
  ],
  [
    "How it plays",
    "• Each travel day → one quiz; late game leans toward land-claim & Puyallup threads.",
    "• Cash won’t buy everything — hunt, games, and luck fill the gap.",
  ],
  [
    "Keys & taps",
    "• Numbers 1–9 match the menu — or click / tap any line you like.",
    "• Story pop-ups: Space or OK. Hunt: aim, then shoot. Sidebar = party & supplies.",
  ],
];

const TRAINING_COACH: string[] = [
  "No rush — read in your own time. Next (or press 1) moves on when you’re ready.",
  "You’ll see this same flow on the trail: a bit of text, then a short list to pick from.",
  "After this page: a tiny warm-up quiz, then you’ll name your wagon party.",
];

const RUN_SAVE_VERSION = 1;

const VALID_RUN_PHASE = new Set<EnginePhase>([
  "training_text",
  "training_quiz",
  "party_names",
  "profile",
  "store",
  "travel_menu",
  "river",
  "travel_log",
  "trail_event",
  "overhead_hunt",
  "chance_pick",
  "chance_play",
  "chance_result",
  "trivia",
  "land_pick",
  "land_build",
  "land_result",
  "game_over",
  "victory",
]);

function isRunPhase(s: string): s is EnginePhase {
  return VALID_RUN_PHASE.has(s as EnginePhase);
}

const DEATH_CAUSES: readonly DeathCause[] = [
  "dysentery",
  "snake_bite",
  "cholera",
  "drowning",
  "exhaustion",
  "wagon_accident",
  "mountain_fever",
];

const LAND_CHOICES: readonly LandChoice[] = [
  "oregon_donation",
  "homestead_style",
  "washington_fee",
  "puyallup_hops",
];

export class GameEngine {
  phase: EnginePhase = "title";
  trainingPage = 0;
  trainingQuizIndex = 0;
  trainingCorrect = 0;

  party: PartyMember[] = [];
  profile: ProfileId = "farmer";
  inv: GameInventory = {
    oxen: 0,
    foodLbs: 0,
    moneyCents: 0,
    ammo: 0,
    clothes: 0,
    spareWheels: 0,
    spareAxles: 0,
  };
  pace: Pace = "steady";
  rations: Rations = "filling";

  day = 1;
  miles = 0;
  triviaCorrect = 0;
  lastChanceDay = -999;
  pendingRiver: (typeof LANDMARKS)[number] | null = null;
  pendingLog: string[] = [];
  pendingHazardMult = 1;
  /** Controls the travel_log continue button: trivia vs post-answer teaching. */
  travelLogPhase: "prompt_trivia" | "show_teach" = "prompt_trivia";

  currentTrivia: TriviaItem | null = null;
  landPicked: LandChoice | null = null;
  lastLandResult: ReturnType<typeof resolveLandChoice> | null = null;

  chanceStakeCents = 2_00;
  lastChanceSummary = "";
  /** Set when entering chance_play until resolved or cancelled. */
  pendingChanceId: ChanceGameId | null = null;

  /** ASCII pop-up queue (dismiss in order in UI). */
  popupQueue: EmotaPopup[] = [];
  activeEncounter: EncounterMeta | null = null;
  pendingTravelBuffer: string[] = [];
  private lastMilestoneAnnounced = 0;

  /** After trivia, did we already advance river gate? */
  private riverHandledForMiles = -1;

  /** Hunts completed per trail region (4 bands) — overhunting reduces spawns. */
  huntSessionsByRegion: number[] = [0, 0, 0, 0];

  resetFromTitle(): void {
    Object.assign(this, new GameEngine());
  }

  startNew(): void {
    this.phase = "training_text";
    this.trainingPage = 0;
    this.party = [];
    this.inv = { oxen: 0, foodLbs: 0, moneyCents: 0, ammo: 0, clothes: 0, spareWheels: 0, spareAxles: 0 };
    this.day = 1;
    this.miles = 0;
    this.triviaCorrect = 0;
    this.lastChanceDay = -999;
    this.pendingRiver = null;
    this.riverHandledForMiles = -1;
    this.travelLogPhase = "prompt_trivia";
    this.afterRestSkipTrivia = false;
    this.popupQueue = [];
    this.activeEncounter = null;
    this.pendingTravelBuffer = [];
    this.lastMilestoneAnnounced = 0;
  }

  peekPopup(): EmotaPopup | undefined {
    return this.popupQueue[0];
  }

  dismissPopup(): void {
    this.popupQueue.shift();
  }

  pushPopup(p: EmotaPopup): void {
    this.popupQueue.push(p);
  }

  private milesPerDay(): number {
    const ox = Math.max(1, this.inv.oxen);
    const base = this.pace === "steady" ? 42 : this.pace === "strenuous" ? 52 : 60;
    const paceScale = PACE_REFERENCE_DAYS / TARGET_TRAVEL_DAYS;
    return Math.round(base * (0.75 + Math.min(6, ox) * 0.05) * paceScale);
  }

  private foodPerDay(): number {
    const living = this.party.filter((p) => p.alive).length;
    const per =
      this.rations === "filling" ? 15 : this.rations === "meager" ? 10 : 7;
    let lbs = living * per;
    if (this.profile === "farmer") lbs = Math.max(0, Math.round(lbs * 0.95));
    return lbs;
  }

  livingCount(): number {
    return this.party.filter((p) => p.alive).length;
  }

  getDashboardSnapshot(): DashboardSnapshot {
    const lm = landmarkAtMiles(this.miles);
    const partyRows =
      this.party.length > 0
        ? this.party.map((p) => ({
            name: p.name,
            health: p.health,
            alive: p.alive,
          }))
        : Array.from({ length: MAX_PARTY }, () => ({
            name: "—",
            health: 0,
            alive: false,
          }));
    return {
      day: this.day,
      maxDays: TARGET_TRAVEL_DAYS,
      miles: this.miles,
      totalMiles: TOTAL_TRAIL_MILES,
      landmark: lm?.name ?? "Independence, Missouri",
      money: formatMoney(this.inv.moneyCents),
      food: this.inv.foodLbs,
      ammo: this.inv.ammo,
      oxen: this.inv.oxen,
      clothes: this.inv.clothes,
      spareParts: `${this.inv.spareWheels} wheel · ${this.inv.spareAxles} axle`,
      pace: this.pace,
      rations: this.rations.replace("_", " "),
      alive: this.livingCount(),
      partyCap: MAX_PARTY,
      profileTitle: PROFILES[this.profile].title,
      triviaStreak: this.triviaCorrect,
      party: partyRows,
    };
  }

  getScreen(): ScreenDescriptor {
    switch (this.phase) {
      case "title":
        return {
          phase: "title",
          lines: [
            "Ezra Meeker’s Oregon Trail Adventure (EMOTA)",
            "Welcome, pioneer — about twenty easy minutes at your pace.",
            "Optional LAN trail strip: run `npm run server` on your machine.",
          ],
          coach:
            "Choose 1 for a gentle intro, or 2 to jump straight to naming your party. You can always use the mouse / touch too.",
          choices: [
            { n: 1, text: "New game · with training" },
            { n: 2, text: "New game · skip training" },
          ],
        };

      case "training_text": {
        const lines = TRAINING_INTRO_PAGES[this.trainingPage] ?? TRAINING_INTRO_PAGES[0]!;
        const coach = TRAINING_COACH[this.trainingPage] ?? TRAINING_COACH[0]!;
        return {
          phase: "training_text",
          lines,
          coach,
          choices: [
            {
              n: 1,
              text:
                this.trainingPage < TRAINING_INTRO_PAGES.length - 1 ? "Next" : "Start 3-question quiz",
            },
          ],
        };
      }

      case "training_quiz": {
        const qs = TRIVIA_BANK.slice(0, 3);
        const q = qs[this.trainingQuizIndex]!;
        return {
          phase: "training_quiz",
          coach: "Warm-up only — pick the answer that feels right. Same keys (1–9) you’ll use on the whole trail.",
          lines: [`Warm-up ${this.trainingQuizIndex + 1}/3`, "", q.q, "", ...q.choices.map((c, i) => `${i + 1}. ${c}`)],
          choices: q.choices.map((_, i) => ({ n: i + 1, text: `Answer ${i + 1}` })),
        };
      }

      case "party_names":
        return {
          phase: "party_names",
          lines: [
            "Party of 5 — comma-separated first names.",
            "A period suggestion is filled in; edit or replace, then press Enter.",
            "After Enter: you’ll choose a leader’s job, then the general store, then the open trail.",
          ],
          coach: "Click the box (or Tab to it), type names separated by commas, then Enter. Five travelers will fill in automatically.",
          inputLine: {
            placeholder: "Names…",
            hint: "Party names",
          },
        };

      case "profile": {
        const roster = this.party.map((p) => p.name).join(" · ");
        return {
          phase: "profile",
          lines: [
            "Names locked in — here’s your company:",
            roster,
            "",
            "What to do next (keys 1–9 or tap a line):",
            "• Now: choose a leader’s job from the list below (starting cash & store prices).",
            "• Next screen: general store — buy gear, then 7 Leave.",
            "• Then: trail camp — Travel spends a day; Rest recovers; Hunt / games optional.",
            "",
            "Lead profession (affects prices, risk, foraging).",
            ...PROFILE_ORDER.map(
              (id, i) => `${i + 1}. ${PROFILES[id].title} · ${formatMoney(PROFILES[id].startCashCents)}`,
            ),
          ],
          coach:
            "Press the number for one job (or tap that line). Next screen is the store — stock up, then 7 Leave to reach the trail.",
          choices: PROFILE_ORDER.map((id, i) => ({
            n: i + 1,
            text: `${PROFILES[id].title} · ${formatMoney(PROFILES[id].startCashCents)}`,
          })),
        };
      }

      case "store": {
        const ideal = idealOutfitCostCents(this.profile);
        return {
          phase: "store",
          coach:
            "Stock up with 1–6; 7 Leave when you’re happy. Cash and inventory stay visible in the brown-trim sidebar →",
          lines: [
            "General store",
            `Full kit ≈ ${formatMoney(ideal)} · You have ${formatMoney(this.inv.moneyCents)}`,
            "",
            `1 · Ox +1 — ${formatMoney(priceOxen(this.profile, 1))}`,
            `2 · Food +100 lb — ${formatMoney(priceFood(this.profile, 100))}`,
            `3 · Ammo box — ${formatMoney(priceAmmo(this.profile, 1))}`,
            `4 · Clothes — ${formatMoney(priceClothes(this.profile, 1))}`,
            `5 · Spare wheel — ${formatMoney(priceParts(this.profile, 1, 0))}`,
            `6 · Spare axle — ${formatMoney(priceParts(this.profile, 0, 1))}`,
            "7 · Leave",
          ],
          choices: [
            { n: 1, text: `Ox +1 · ${formatMoney(priceOxen(this.profile, 1))}` },
            { n: 2, text: `Food +100 · ${formatMoney(priceFood(this.profile, 100))}` },
            { n: 3, text: `Ammo · ${formatMoney(priceAmmo(this.profile, 1))}` },
            { n: 4, text: `Clothes · ${formatMoney(priceClothes(this.profile, 1))}` },
            { n: 5, text: `Wheel · ${formatMoney(priceParts(this.profile, 1, 0))}` },
            { n: 6, text: `Axle · ${formatMoney(priceParts(this.profile, 0, 1))}` },
            { n: 7, text: "Leave" },
          ],
        };
      }

      case "travel_menu":
        return {
          phase: "travel_menu",
          coach:
            "Camp menu: Travel spends a day on the trail; Rest helps recovery. Glance at the sidebar for food, ammo, and miles — it’s your wagon sheet.",
          lines: ["What next?"],
          choices: [
            { n: 1, text: "Travel (uses 1 day)" },
            { n: 2, text: "Rest" },
            {
              n: 3,
              text:
                this.inv.ammo < HUNT_MIN_AMMO_TO_HUNT
                  ? `Hunt (need ${HUNT_MIN_AMMO_TO_HUNT}+ ammo)`
                  : "Hunt (aim · shoot · meat cap)",
            },
            { n: 4, text: "Chance games" },
            { n: 5, text: "Change pace" },
            { n: 6, text: "Change rations" },
            { n: 7, text: "Ezra timeline note" },
          ],
        };

      case "river": {
        const r = this.pendingRiver!;
        return {
          phase: "river",
          coach: "Read the river note, then pick how to cross. Ferry costs cash; waiting burns a day but can be safer.",
          lines: [r.name, r.blurb, "", "Crossing:"],
          choices: [
            { n: 1, text: "Ford (risky)" },
            { n: 2, text: "Caulk wagon" },
            { n: 3, text: "Ferry ($)" },
            { n: 4, text: "Wait 1 day" },
          ],
        };
      }

      case "travel_log":
        return {
          phase: "travel_log",
          coach:
            this.travelLogPhase === "show_teach"
              ? "When the story feels clear, Continue (or 1) wraps the day."
              : "Journal first — then you’ll get the daily quiz. Same idea: read, then tap Next.",
          lines: [...this.pendingLog],
          choices: [
            {
              n: 1,
              text: this.travelLogPhase === "show_teach" ? "Continue" : "Next · quiz",
            },
          ],
        };

      case "trail_event": {
        const e = this.activeEncounter!;
        return {
          phase: "trail_event",
          coach: "Trail encounter — pick what your party does. The story will show how it went; there’s no hidden timer.",
          lines: [
            e.title,
            "",
            ...e.intro,
            "",
            ...e.choices.map((c, i) => `${i + 1}. ${c}`),
          ],
          choices: e.choices.map((c, i) => ({ n: i + 1, text: c })),
        };
      }

      case "overhead_hunt": {
        const z = huntZoneFromMiles(this.miles);
        const ri = huntRegionIndexFromMiles(this.miles);
        const huntsHere = this.huntSessionsByRegion[ri] ?? 0;
        const scarce = huntsHere >= 3 ? " Game is getting scarce here — hunt smarter, not harder." : "";
        return {
          phase: "overhead_hunt",
          coach: "Play on the green field below — aim, then shoot. Cancel hunt brings you back to camp, no pressure.",
          lines: [
            "Hunting (top-down range) — aim with drag/tap or arrows; SPACE or FIRE to shoot. Touch: pad + FIRE.",
            `${z.label}. Wagon limit ${HUNT_MAX_MEAT_LB} lb per trip. Shots use your ammo.${scarce}`,
          ],
          overhead: "hunt",
          choices: [{ n: 1, text: "Cancel hunt" }],
        };
      }

      case "chance_pick":
        return {
          phase: "chance_pick",
          coach: "Small-stake games for extra coin — Back returns to camp whenever you like.",
          lines: ["Pick a game · ~$2 stake", "", ...CHANCE_GAMES.map((g, i) => `${i + 1}. ${g.name}`)],
          choices: [
            ...CHANCE_GAMES.map((g, i) => ({ n: i + 1, text: g.name })),
            { n: CHANCE_GAMES.length + 1, text: "Back" },
          ],
        };

      case "chance_play": {
        const gid = this.pendingChanceId;
        const g = gid ? CHANCE_GAMES.find((x) => x.id === gid) : null;
        return {
          phase: "chance_play",
          coach: "Use the controls on the canvas; Leave table (or 1) is always there if you change your mind.",
          lines: [
            g ? g.name : "Chance game",
            `Stake ${formatMoney(this.chanceStakeCents)} · play on the CRT field below.`,
            "Mini keys on the canvas · Escape or Q = leave table (or click Leave).",
          ],
          overhead: "chance",
          choices: [{ n: 1, text: "Leave table" }],
        };
      }

      case "chance_result":
        return {
          phase: "chance_result",
          coach: "Back takes you to the game list — or all the way to camp from there.",
          lines: this.lastChanceSummary.split("\n"),
          choices: [{ n: 1, text: "Back" }],
        };

      case "trivia": {
        const t = this.currentTrivia!;
        return {
          phase: "trivia",
          coach: "Daily quiz — tap an answer or press its number. Correct answers nudge your score at the end.",
          lines: [`Day ${this.day} · quiz`, "", t.q, "", ...t.choices.map((c, i) => `${i + 1}. ${c}`)],
          choices: t.choices.map((_, i) => ({ n: i + 1, text: `Answer ${i + 1}` })),
        };
      }

      case "land_pick":
        return {
          phase: "land_pick",
          coach: "Near the journey’s end — each path changes the epilogue. Read, then choose what fits your run.",
          lines: ["Land claim", "Pick a path:"],
          choices: [
            { n: 1, text: "Oregon donation claim" },
            { n: 2, text: "Slow prove-up" },
            { n: 3, text: "Puget Sound / WA fees" },
            { n: 4, text: "Puyallup hops (Hop King)" },
          ],
        };

      case "land_build":
        return {
          phase: "land_build",
          coach: "Optional fence mini-game for a small bonus — Skip build is totally fine if you’d rather see the ending.",
          lines: [
            "Playground build · fence posts as blocks · arrows, space at each post (×3) with hammer.",
          ],
          overhead: "build",
          choices: [{ n: 1, text: "Skip build" }],
        };

      case "land_result":
        return {
          phase: "land_result",
          coach: "When you’re ready, Score shows how the trail added up — saved quietly on this device (and LAN if you use it).",
          lines: [
            this.lastLandResult?.title ?? "Land",
            "",
            this.lastLandResult?.body ?? "",
            "",
            this.lastLandResult?.hopKing ? "Hop King ending · Ezra’s Puyallup thread" : "",
          ].filter(Boolean),
          choices: [{ n: 1, text: "Score" }],
        };

      case "game_over":
        return {
          phase: "game_over",
          coach: "Hard run — the trail does that sometimes. Title returns home; your next party might fare better.",
          lines: [
            "The trail wins.",
            `Day ${this.day} · ${Math.round(this.miles)} mi · party lost`,
          ],
          choices: [{ n: 1, text: "Title" }],
        };

      case "victory": {
        const score = this.computeScore();
        return {
          phase: "victory",
          coach: "Nice run — Title starts fresh. Today’s best (if any) sits up in the header for a quiet brag.",
          lines: [
            `Score ${score}`,
            `Alive ${this.livingCount()}/${MAX_PARTY} · Quiz ✓ ${this.triviaCorrect} · ${formatMoney(this.inv.moneyCents)}`,
            this.lastLandResult?.hopKing ? "Hop King bonus" : "",
            "",
            "Scores: device + LAN server if running.",
          ].filter(Boolean),
          choices: [{ n: 1, text: "Title" }],
        };
      }

      default:
        return { phase: this.phase, lines: ["Unknown phase"] };
    }
  }

  computeScore(): number {
    let s =
      Math.round(this.miles) +
      this.livingCount() * 120 +
      Math.floor(this.inv.moneyCents / 20) +
      this.triviaCorrect * 55 -
      this.day * 2;
    s += this.lastLandResult?.scoreBonus ?? 0;
    if (this.lastLandResult?.hopKing) s += 800;
    return Math.max(0, s);
  }

  choose(n: number): void {
    switch (this.phase) {
      case "title":
        if (n === 1) this.startNew();
        else if (n === 2) {
          this.phase = "party_names";
          this.party = [];
        }
        break;

      case "training_text":
        if (n === 1) {
          if (this.trainingPage < TRAINING_INTRO_PAGES.length - 1) this.trainingPage++;
          else {
            this.trainingQuizIndex = 0;
            this.trainingCorrect = 0;
            this.phase = "training_quiz";
          }
        }
        break;

      case "training_quiz": {
        const qs = TRIVIA_BANK.slice(0, 3);
        const q = qs[this.trainingQuizIndex]!;
        if (n - 1 === q.answer) this.trainingCorrect++;
        if (this.trainingQuizIndex < qs.length - 1) {
          this.trainingQuizIndex++;
        } else {
          this.phase = "party_names";
        }
        break;
      }

      case "profile":
        if (n >= 1 && n <= PROFILE_ORDER.length) {
          this.profile = PROFILE_ORDER[n - 1]!;
          this.inv.moneyCents = PROFILES[this.profile].startCashCents;
          this.phase = "store";
        }
        break;

      case "store":
        this.handleStore(n);
        break;

      case "travel_menu":
        this.handleTravelMenu(n);
        break;

      case "river":
        this.handleRiver(n);
        break;

      case "travel_log":
        if (n === 1) {
          if (this.travelLogPhase === "show_teach") {
            this.travelLogPhase = "prompt_trivia";
            this.phase = "travel_menu";
            if (this.miles >= TOTAL_TRAIL_MILES) this.phase = "land_pick";
          } else {
            this.startTrivia();
          }
        }
        break;

      case "trail_event":
        if (n >= 1 && n <= 3 && this.activeEncounter) {
          this.resolveTrailEvent(n);
        }
        break;

      case "overhead_hunt":
        if (n === 1) this.phase = "travel_menu";
        break;

      case "chance_pick":
        this.handleChancePick(n);
        break;

      case "chance_play":
        if (n === 1) this.cancelChancePlay();
        break;

      case "chance_result":
        if (n === 1) this.phase = "travel_menu";
        break;

      case "trivia":
        this.handleTrivia(n);
        break;

      case "land_pick":
        if (n >= 1 && n <= 4) {
          const map: LandChoice[] = [
            "oregon_donation",
            "homestead_style",
            "washington_fee",
            "puyallup_hops",
          ];
          this.landPicked = map[n - 1]!;
          this.phase = "land_build";
        }
        break;

      case "land_build":
        if (n === 1) {
          this._buildQuality = 0.35;
          this.finishLand();
        }
        break;

      case "land_result":
        if (n === 1) this.phase = "victory";
        break;

      case "game_over":
        if (n === 1) this.resetFromTitle();
        break;

      case "victory":
        if (n === 1) this.resetFromTitle();
        break;

      default:
        break;
    }
  }

  submitPartyNames(line: string): void {
    const parts = line.split(",").map((s) => s.trim()).filter(Boolean);
    const names: string[] = [];
    for (let i = 0; i < MAX_PARTY; i++) names.push(parts[i] ?? `Traveler ${i + 1}`);
    this.party = defaultParty(names);
    this.phase = "profile";
  }

  /** Inputs for the overhead hunt canvas; safe to call when phase is overhead_hunt. */
  getHuntSessionOptions(): HuntSessionOptions {
    const ri = huntRegionIndexFromMiles(this.miles);
    const sessions = this.huntSessionsByRegion[ri] ?? 0;
    const depletion = Math.min(1, sessions * 0.26);
    const z = huntZoneFromMiles(this.miles);
    const maxShots = Math.min(this.inv.ammo, HUNT_MAX_SHOTS_PER_SESSION);
    return {
      maxShots: Math.max(0, maxShots),
      maxCarryLb: HUNT_MAX_MEAT_LB,
      zoneId: z.id,
      zoneLabel: z.label,
      depletion,
    };
  }

  completeOverheadHunt(foodGained: number, ammoSpent: number): void {
    if (this.phase !== "overhead_hunt") return;
    const ri = huntRegionIndexFromMiles(this.miles);
    this.huntSessionsByRegion[ri] = (this.huntSessionsByRegion[ri] ?? 0) + 1;
    const gained = Math.min(Math.max(0, foodGained), HUNT_MAX_MEAT_LB);
    const bonus =
      gained > 0 ? Math.round(PROFILES[this.profile].forageBonus * 0.35) : 0;
    this.inv.foodLbs += gained + bonus;
    this.inv.ammo = Math.max(0, this.inv.ammo - ammoSpent);
    this.phase = "travel_menu";
  }

  completeOverheadBuild(quality: number): void {
    if (this.phase !== "land_build") return;
    this._buildQuality = quality;
    this.finishLand();
  }

  private _buildQuality = 0.5;

  private handleStore(n: number): void {
    if (n === 7) {
      if (this.inv.oxen < 1) {
        this.inv.oxen = 2;
        this.inv.foodLbs += 120;
      }
      this.phase = "travel_menu";
      return;
    }
    const p = this.profile;
    if (n === 1) this.buyIfCan(priceOxen(p, 1), () => this.inv.oxen++);
    if (n === 2) this.buyIfCan(priceFood(p, 100), () => (this.inv.foodLbs += 100));
    if (n === 3) this.buyIfCan(priceAmmo(p, 1), () => (this.inv.ammo += 20));
    if (n === 4) this.buyIfCan(priceClothes(p, 1), () => this.inv.clothes++);
    if (n === 5) this.buyIfCan(priceParts(p, 1, 0), () => this.inv.spareWheels++);
    if (n === 6) this.buyIfCan(priceParts(p, 0, 1), () => this.inv.spareAxles++);
  }

  private buyIfCan(cost: number, fn: () => void): void {
    if (this.inv.moneyCents >= cost) {
      this.inv.moneyCents -= cost;
      fn();
    }
  }

  private handleTravelMenu(n: number): void {
    if (this.miles >= TOTAL_TRAIL_MILES) {
      this.phase = "land_pick";
      return;
    }
    if (n === 1) {
      this.advanceTrailDay();
      return;
    }
    if (n === 2) {
      this.restDay();
      return;
    }
    if (n === 3) {
      if (this.inv.ammo < HUNT_MIN_AMMO_TO_HUNT) return;
      this.phase = "overhead_hunt";
      return;
    }
    if (n === 4) {
      if (this.day - this.lastChanceDay < 4) return;
      this.phase = "chance_pick";
      return;
    }
    if (n === 5) {
      this.pace = this.pace === "steady" ? "strenuous" : this.pace === "strenuous" ? "grueling" : "steady";
      return;
    }
    if (n === 6) {
      this.rations =
        this.rations === "filling" ? "meager" : this.rations === "meager" ? "bare_bones" : "filling";
      return;
    }
    if (n === 7) {
      this.pendingLog = [
        "Ezra note",
        "5′1″ · trail · hops · retraced the road into the 1920s — swap in your citations.",
      ];
      this.travelLogPhase = "prompt_trivia";
      this.phase = "travel_log";
    }
  }

  private restDay(): void {
    for (const p of this.party) {
      if (p.alive) p.health = Math.min(100, p.health + 6);
    }
    this.day++;
    this.pendingLog = ["You rest a day. Spirits lift slightly.", "", ...this.randomFluff()];
    this.travelLogPhase = "prompt_trivia";
    this.phase = "travel_log";
    this.pendingHazardMult = 0.85;
    this.afterRestSkipTrivia = true;
  }

  private afterRestSkipTrivia = false;

  private advanceTrailDay(): void {
    const river = nextRiverAhead(this.miles);
    if (
      river &&
      this.miles < river.milesFromStart &&
      this.miles + this.milesPerDay() >= river.milesFromStart &&
      this.riverHandledForMiles < river.milesFromStart
    ) {
      this.pendingRiver = river;
      this.pushPopup({
        title: "RIVER RUN",
        art: ART.river,
        body: [river.name, "", river.blurb],
        vibe: "river",
      });
      this.phase = "river";
      return;
    }

    const hazard = this.pendingHazardMult;
    this.pendingHazardMult = 1;

    const dist = this.milesPerDay();
    this.miles = Math.min(TOTAL_TRAIL_MILES, this.miles + dist);
    this.day++;

    const foodNeed = this.foodPerDay();
    if (this.inv.foodLbs < foodNeed) {
      for (const p of this.party) {
        if (p.alive) p.health = Math.max(0, p.health - 14);
      }
      this.inv.foodLbs = 0;
    } else {
      this.inv.foodLbs -= foodNeed;
    }

    if (Math.random() < 0.12 && (this.inv.spareWheels > 0 || this.inv.spareAxles > 0)) {
      if (Math.random() < 0.5 && this.inv.spareWheels > 0) this.inv.spareWheels--;
      else if (this.inv.spareAxles > 0) this.inv.spareAxles--;
      else this.inv.spareWheels--;
    }

    if (Math.random() < 0.11) {
      const living = this.party.filter((p) => p.alive);
      if (living.length) {
        const v = living[Math.floor(Math.random() * living.length)]!;
        v.health = Math.max(5, v.health - (4 + Math.floor(Math.random() * 14)));
      }
    }

    const logs: string[] = [
      `You travel ~${dist} miles.`,
      this.randomEventLine(),
    ];

    const deaths = rollDailyDeaths(this.party, {
      profile: this.profile,
      hazardMult: hazard * (this.pendingRiver ? 1.2 : 1),
      rationsHarsh: this.rations === "bare_bones",
    });
    const deathLines = applyDeaths(this.party, deaths);
    logs.push(...deathLines);

    if (this.livingCount() === 0) {
      this.phase = "game_over";
      return;
    }

    if (deathLines.length > 0) {
      this.pushPopup({
        title: "THE TRAIL TAKES",
        art: ART.skull,
        body: deathLines,
        vibe: "doom",
      });
    }

    this.pendingTravelBuffer = [...logs];
    if (Math.random() < 0.3) {
      this.activeEncounter = pickEncounter();
      this.phase = "trail_event";
    } else {
      this.goToTravelLog(logs);
    }
  }

  private goToTravelLog(logs: string[]): void {
    this.pendingLog = logs;
    this.maybePushMilestone();
    this.maybePushAmbient();
    this.travelLogPhase = "prompt_trivia";
    this.phase = "travel_log";
  }

  private maybePushMilestone(): void {
    const marks = [500, 1000, 1500];
    for (const m of marks) {
      if (this.miles >= m && this.lastMilestoneAnnounced < m) {
        this.lastMilestoneAnnounced = m;
        this.pushPopup({
          title: `WAYPOINT · ${m} MI`,
          art: ART.milestone.replace("@@@", String(m)),
          body: [`Rough tally: ~${m} miles from the jump-off.`],
          vibe: "mile",
        });
      }
    }
  }

  private maybePushAmbient(): void {
    if (Math.random() < 0.2) {
      this.pushPopup({
        title: "SKY TALK",
        art: ART.storm,
        body: [
          "Heat shimmer, dust devils, or bruised clouds — the plain keeps changing its mind.",
        ],
        vibe: "storm",
      });
    } else if (Math.random() < 0.14) {
      this.pushPopup({
        title: "SMALL MERCY",
        art: ART.luck,
        body: ["Someone finds a patch of berries. Bellies argue less tonight."],
        vibe: "luck",
      });
    }
  }

  private resolveTrailEvent(choice: number): void {
    const e = this.activeEncounter;
    if (!e) return;
    const out: string[] = [];
    const pick = () => {
      const living = this.party.filter((p) => p.alive);
      return living.length ? living[Math.floor(Math.random() * living.length)]! : null;
    };

    switch (e.id) {
      case "trader":
        if (choice === 1) {
          if (this.inv.moneyCents >= 3_00) {
            this.inv.moneyCents -= 3_00;
            this.inv.foodLbs += 50;
            out.push("Flour bought — sacks thump like dull drums in the wagon.");
            this.pushPopup({
              title: "TRADE OK",
              art: ART.trader,
              body: ["−$3.00 · +50 lb food"],
              vibe: "gold",
            });
          } else out.push("You count coin twice — not enough. The trader spits politely.");
        } else if (choice === 2) {
          const p = pick();
          if (p) {
            p.health = Math.min(100, p.health + 10);
            out.push(`${p.name} swaps lies for laughter — the camp feels lighter.`);
          }
        } else out.push("You roll past. His prices die in the dust.");
        break;
      case "herd":
        if (choice === 1) {
          this.inv.foodLbs = Math.max(0, this.inv.foodLbs - 22);
          out.push("The herd owns noon. You snack the clock away.");
        } else if (choice === 2) {
          if (Math.random() < 0.22) {
            const p = pick();
            if (p) p.health = Math.max(5, p.health - 18);
            out.push("A horn clips chaos — someone comes out bruised.");
          } else out.push("You slip the gap like a lie through teeth. Clean.");
        } else {
          this.inv.ammo = Math.max(0, this.inv.ammo - 10);
          this.inv.foodLbs += 28;
          out.push("A wide arc costs powder but fills the pot.");
        }
        break;
      case "night":
        if (choice === 1) {
          for (const p of this.party) {
            if (p.alive) p.health = Math.min(100, p.health + 4);
          }
          out.push("Wagons square; fear sleeps in the middle.");
        } else if (choice === 2) {
          this.inv.foodLbs = Math.max(0, this.inv.foodLbs - 18);
          out.push("You give the dark a wide berth — bellies pay in miles of worry.");
        } else {
          if (Math.random() < 0.18) {
            const p = pick();
            if (p) p.health = Math.max(5, p.health - 12);
            out.push("Hello echoes wrong. You back away before it answers.");
          } else {
            this.inv.moneyCents += 1_25;
            out.push("A shared fire, a shared rumor — someone slips you silver for the story.");
          }
        }
        break;
      case "wheel":
        if (choice === 1) {
          if (this.inv.spareWheels > 0) {
            this.inv.spareWheels--;
            out.push("Spare wheel on — shame retires for now.");
          } else out.push("No spare in the pile. You curse inventory like scripture.");
        } else if (choice === 2) {
          const p = pick();
          if (p) p.health = Math.max(5, p.health - 8);
          out.push("Splinters and rope — it holds, mostly.");
        } else out.push("You baby the pace. Dust wins, but the axle lives.");
        break;
      case "storm":
        if (choice === 1) {
          this.inv.foodLbs = Math.max(0, this.inv.foodLbs - 24);
          out.push("Canvas drums; you feed the storm in beans and patience.");
        } else if (choice === 2) {
          this.inv.foodLbs = Math.max(0, this.inv.foodLbs - 14);
          for (const p of this.party) {
            if (p.alive) p.health = Math.max(5, p.health - 5);
          }
          out.push("Oxen run hot; people rattle in their skins.");
        } else {
          this.inv.foodLbs = Math.max(0, this.inv.foodLbs - 16);
          for (const p of this.party) {
            if (p.alive) p.health = Math.min(100, p.health + 3);
          }
          out.push("Extra canvas, extra fire — you buy warmth with rations.");
        }
        break;
      case "gold":
        if (choice === 1) {
          if (Math.random() < 0.42) {
            const gain = 2_00 + Math.floor(Math.random() * 4) * 25;
            this.inv.moneyCents += gain;
            out.push(`Color in the pan — ${formatMoney(gain)} of maybe-real luck.`);
            this.pushPopup({
              title: "PAN PAYOFF",
              art: ART.luck,
              body: [`Found ~${formatMoney(gain)}`],
              vibe: "gold",
            });
          } else out.push("Fool’s gold laughs yellow and mean.");
        } else if (choice === 2) {
          out.push("You keep rolling — rivers and rumors can wait.");
        } else {
          if (this.inv.moneyCents >= 5_00) {
            this.inv.moneyCents -= 5_00;
            out.push("A map of dreams — paper worth more as fire starter.");
          } else out.push("He wanted five dollars. You wanted sense. Both kept their goods.");
        }
        break;
      default:
        out.push("The trail moves on.");
    }

    this.activeEncounter = null;
    const merged = [...this.pendingTravelBuffer, "", "── Event ──", ...out];
    this.pendingTravelBuffer = [];
    this.goToTravelLog(merged);
  }

  private randomFluff(): string[] {
    const o = [
      "Crickets and coyotes trade complaints at dusk.",
      "Someone tells a story about a ferryman who never blinks.",
      "A child counts oxen hooves until they fall asleep.",
    ];
    return [o[Math.floor(Math.random() * o.length)]!];
  }

  private randomEventLine(): string {
    const e = [
      "A trader offers beans at insulting prices — you refuse with style.",
      "Antelope watch you pass like judges.",
      "Mud pulls at the wheels; the oxen lean in.",
      "A letter you cannot read blows across sagebrush.",
      "Thunderhead builds over the rim — no rain yet, only pressure.",
      "Kids argue whether a cloud looks like a bison or a debt.",
      "Someone hums a hymn off-key; the oxen approve anyway.",
      "Prairie dogs stand sentinel — little generals in dirt forts.",
      "Grease smoke tastes like the only law for miles.",
      "A wheel squeaks in Morse code only the dog understands.",
      "Noon stretches long as leather.",
      "You cross an old campfire ring — ghosts of coffee still argue.",
      "Rattlesnake buzz becomes a sermon on keeping distance.",
      "The trail ahead looks drawn by a tired hand.",
      "Wind flips a hat; someone chases dignity through sage.",
      "Moonrise turns dust into silver lint.",
      "A broken doll lies in the rut — nobody claims it.",
      "Wolves discuss you from a ridge like polite creditors.",
      "Iron rim strikes rock — sparks pretend to be stars.",
    ];
    return e[Math.floor(Math.random() * e.length)]!;
  }

  private handleRiver(n: number): void {
    const r = this.pendingRiver!;
    let hazard = 1.4;
    let cost = 0;
    if (n === 1) {
      hazard = 1.9;
      cost = 0;
    } else if (n === 2) {
      hazard = 1.35;
      cost = 18_00;
    } else if (n === 3) {
      hazard = 0.85;
      cost = 35_00;
    } else {
      this.day++;
      this.pendingRiver = null;
      this.pendingHazardMult = 0.92;
      this.pendingLog = [
        `You wait at ${r.name}. The water argues with itself; you argue with your purse.`,
      ];
      this.travelLogPhase = "prompt_trivia";
      this.phase = "travel_log";
      return;
    }
    if (cost > this.inv.moneyCents) {
      hazard += 0.25;
    } else {
      this.inv.moneyCents -= cost;
    }
    this.day++;
    const foodNeed = this.foodPerDay();
    if (this.inv.foodLbs < foodNeed) {
      for (const p of this.party) {
        if (p.alive) p.health = Math.max(0, p.health - 10);
      }
      this.inv.foodLbs = 0;
    } else {
      this.inv.foodLbs -= foodNeed;
    }
    this.miles = r.milesFromStart;
    this.riverHandledForMiles = r.milesFromStart;
    this.pendingRiver = null;
    this.pendingHazardMult = hazard;
    const logs = [
      `You cross ${r.name}.`,
      cost ? `Paid about ${formatMoney(cost)} (or risk rose if you were short).` : "",
    ].filter(Boolean);
    const deaths = rollDailyDeaths(this.party, {
      profile: this.profile,
      hazardMult: hazard,
      rationsHarsh: this.rations === "bare_bones",
    });
    logs.push(...applyDeaths(this.party, deaths));
    if (this.livingCount() === 0) {
      this.phase = "game_over";
      return;
    }
    this.pendingLog = logs;
    this.travelLogPhase = "prompt_trivia";
    this.phase = "travel_log";
  }

  private startTrivia(): void {
    if (this.afterRestSkipTrivia) {
      this.afterRestSkipTrivia = false;
      this.phase = "travel_menu";
      if (this.miles >= TOTAL_TRAIL_MILES) this.phase = "land_pick";
      return;
    }
    if (this.miles >= TOTAL_TRAIL_MILES) {
      this.phase = "land_pick";
      return;
    }
    this.currentTrivia = pickTriviaForDay(this.day, TARGET_TRAVEL_DAYS);
    this.phase = "trivia";
  }

  private handleTrivia(n: number): void {
    const t = this.currentTrivia!;
    if (n - 1 === t.answer) this.triviaCorrect++;
    this.pendingLog = [
      n - 1 === t.answer ? "Correct." : "Incorrect — teaching note:",
      "",
      t.teach,
    ];
    this.travelLogPhase = "show_teach";
    this.phase = "travel_log";
  }

  private handleChancePick(n: number): void {
    if (n === CHANCE_GAMES.length + 1) {
      this.phase = "travel_menu";
      return;
    }
    if (n < 1 || n > CHANCE_GAMES.length) return;
    this.pendingChanceId = CHANCE_GAMES[n - 1]!.id as ChanceGameId;
    this.phase = "chance_play";
  }

  /** Apply outcome from the chance canvas (single source of truth — no extra RNG). */
  completeChancePlay(payload: ChanceSimPayload): void {
    if (this.phase !== "chance_play") return;
    const res = resolveChanceFromSimulation(this.chanceStakeCents, payload);
    this.inv.moneyCents += res.moneyDeltaCents;
    this.inv.foodLbs += res.foodDeltaLbs;
    this.lastChanceSummary = `${res.title}\n${res.detail}\n${res.reputation}\nMoney delta: ${formatMoney(res.moneyDeltaCents)} | Food: +${res.foodDeltaLbs} lb`;
    this.lastChanceDay = this.day;
    this.pendingChanceId = null;
    this.phase = "chance_result";
  }

  cancelChancePlay(): void {
    if (this.phase !== "chance_play") return;
    this.pendingChanceId = null;
    this.phase = "travel_menu";
  }

  private finishLand(): void {
    const choice = this.landPicked ?? "oregon_donation";
    const res = resolveLandChoice(choice, this.triviaCorrect, this.inv.moneyCents);
    const fee = Math.min(this.inv.moneyCents, res.feeCents);
    this.inv.moneyCents -= fee;
    if (this._buildQuality < 0.4) {
      res.scoreBonus = Math.floor(res.scoreBonus * 0.85);
    }
    this.lastLandResult = res;
    this.phase = "land_result";
  }

  /** Serialize non–title run for localStorage resume (one slot per browser / device). */
  toRunSaveJSON(): string | null {
    if (this.phase === "title") return null;
    let pendingRiverIdx: number | null = null;
    const pr = this.pendingRiver;
    if (pr !== null) {
      const i = LANDMARKS.findIndex((L) => L.name === pr.name);
      pendingRiverIdx = i >= 0 ? i : null;
    }
    return JSON.stringify({
      v: RUN_SAVE_VERSION,
      savedAt: new Date().toISOString(),
      phase: this.phase,
      trainingPage: this.trainingPage,
      trainingQuizIndex: this.trainingQuizIndex,
      trainingCorrect: this.trainingCorrect,
      party: this.party,
      profile: this.profile,
      inv: this.inv,
      pace: this.pace,
      rations: this.rations,
      day: this.day,
      miles: this.miles,
      triviaCorrect: this.triviaCorrect,
      lastChanceDay: this.lastChanceDay,
      pendingRiverIdx,
      pendingLog: this.pendingLog,
      pendingHazardMult: this.pendingHazardMult,
      travelLogPhase: this.travelLogPhase,
      currentTriviaId: this.currentTrivia?.id ?? null,
      landPicked: this.landPicked,
      lastLandResult: this.lastLandResult,
      chanceStakeCents: this.chanceStakeCents,
      lastChanceSummary: this.lastChanceSummary,
      pendingChanceId: this.pendingChanceId,
      popupQueue: this.popupQueue,
      activeEncounterId: this.activeEncounter?.id ?? null,
      pendingTravelBuffer: this.pendingTravelBuffer,
      lastMilestoneAnnounced: this.lastMilestoneAnnounced,
      riverHandledForMiles: this.riverHandledForMiles,
      huntSessionsByRegion: [...this.huntSessionsByRegion],
      afterRestSkipTrivia: this.afterRestSkipTrivia,
      buildQuality: this._buildQuality,
    });
  }

  /** Restore run from `toRunSaveJSON` output; returns false if invalid. */
  applyRunSaveJSON(raw: string): boolean {
    let p: unknown;
    try {
      p = JSON.parse(raw);
    } catch {
      return false;
    }
    if (!p || typeof p !== "object") return false;
    const o = p as Record<string, unknown>;
    if (o.v !== RUN_SAVE_VERSION) return false;
    if (typeof o.phase !== "string" || !isRunPhase(o.phase)) return false;

    const num = (x: unknown, d: number): number =>
      typeof x === "number" && Number.isFinite(x) ? x : d;
    const int = (x: unknown, d: number): number => Math.floor(num(x, d));
    const str = (x: unknown, d: string): string => (typeof x === "string" ? x : d);
    const bool = (x: unknown, d: boolean): boolean => (typeof x === "boolean" ? x : d);

    this.phase = o.phase;
    this.trainingPage = Math.max(0, int(o.trainingPage, 0));
    this.trainingQuizIndex = Math.max(0, int(o.trainingQuizIndex, 0));
    this.trainingCorrect = Math.max(0, int(o.trainingCorrect, 0));

    const rawParty = o.party;
    if (Array.isArray(rawParty)) {
      this.party = rawParty.slice(0, MAX_PARTY).map((row): PartyMember => {
        if (!row || typeof row !== "object") {
          return { name: "Traveler", health: 100, alive: true };
        }
        const r = row as Record<string, unknown>;
        const causeRaw = r.cause;
        const cause =
          typeof causeRaw === "string" && (DEATH_CAUSES as readonly string[]).includes(causeRaw)
            ? (causeRaw as DeathCause)
            : undefined;
        return {
          name: str(r.name, "Traveler").slice(0, 48),
          health: Math.max(0, Math.min(100, int(r.health, 100))),
          alive: bool(r.alive, true),
          ...(cause ? { cause } : {}),
        };
      });
      while (this.party.length < MAX_PARTY) {
        this.party.push({ name: `Traveler ${this.party.length + 1}`, health: 100, alive: true });
      }
    }

    const prof = str(o.profile, "farmer");
    this.profile = prof in PROFILES ? (prof as ProfileId) : "farmer";

    const inv = o.inv;
    if (inv && typeof inv === "object") {
      const iv = inv as Record<string, unknown>;
      this.inv = {
        oxen: Math.max(0, int(iv.oxen, 0)),
        foodLbs: Math.max(0, int(iv.foodLbs, 0)),
        moneyCents: int(iv.moneyCents, 0),
        ammo: Math.max(0, int(iv.ammo, 0)),
        clothes: Math.max(0, int(iv.clothes, 0)),
        spareWheels: Math.max(0, int(iv.spareWheels, 0)),
        spareAxles: Math.max(0, int(iv.spareAxles, 0)),
      };
    }

    const paceRaw = str(o.pace, "steady");
    this.pace = paceRaw === "strenuous" || paceRaw === "grueling" || paceRaw === "steady" ? paceRaw : "steady";
    const ratRaw = str(o.rations, "filling");
    this.rations =
      ratRaw === "meager" || ratRaw === "bare_bones" || ratRaw === "filling" ? ratRaw : "filling";

    this.day = Math.max(1, int(o.day, 1));
    this.miles = Math.max(0, num(o.miles, 0));
    this.triviaCorrect = Math.max(0, int(o.triviaCorrect, 0));
    this.lastChanceDay = int(o.lastChanceDay, -999);

    const pri = o.pendingRiverIdx;
    if (pri === null) this.pendingRiver = null;
    else {
      const ix = int(pri, -1);
      this.pendingRiver = ix >= 0 && ix < LANDMARKS.length ? LANDMARKS[ix]! : null;
    }

    this.pendingLog = Array.isArray(o.pendingLog) ? o.pendingLog.map((x) => str(x, "")) : [];
    this.pendingHazardMult = Math.max(0.25, Math.min(4, num(o.pendingHazardMult, 1)));

    const tlp = o.travelLogPhase;
    this.travelLogPhase = tlp === "show_teach" ? "show_teach" : "prompt_trivia";

    const tid = o.currentTriviaId;
    if (tid === null || tid === undefined) this.currentTrivia = null;
    else {
      const id = str(tid, "");
      this.currentTrivia = TRIVIA_BANK.find((t) => t.id === id) ?? null;
    }

    const lp = o.landPicked;
    if (lp === null || lp === undefined) this.landPicked = null;
    else {
      const ls = str(lp, "");
      this.landPicked = (LAND_CHOICES as readonly string[]).includes(ls) ? (ls as LandChoice) : null;
    }

    const lr = o.lastLandResult;
    if (lr && typeof lr === "object") {
      const lrO = lr as Record<string, unknown>;
      this.lastLandResult = {
        title: str(lrO.title, ""),
        body: str(lrO.body, ""),
        feeCents: int(lrO.feeCents, 0),
        hopKing: bool(lrO.hopKing, false),
        scoreBonus: int(lrO.scoreBonus, 0),
      } satisfies LandOutcome;
    } else this.lastLandResult = null;

    this.chanceStakeCents = Math.max(0, int(o.chanceStakeCents, 2_00));
    this.lastChanceSummary = str(o.lastChanceSummary, "");
    const pcid = o.pendingChanceId;
    if (pcid === null || pcid === undefined) this.pendingChanceId = null;
    else {
      const cid = str(pcid, "");
      this.pendingChanceId = CHANCE_GAMES.some((g) => g.id === cid) ? (cid as ChanceGameId) : null;
    }

    const pq = o.popupQueue;
    if (Array.isArray(pq)) {
      this.popupQueue = pq
        .filter((x) => x && typeof x === "object")
        .map((x) => {
          const q = x as Record<string, unknown>;
          const vibe = str(q.vibe, "trail");
          const okVibe =
            vibe === "storm" ||
            vibe === "gold" ||
            vibe === "doom" ||
            vibe === "river" ||
            vibe === "trail" ||
            vibe === "luck" ||
            vibe === "mile";
          return {
            title: str(q.title, ""),
            art: str(q.art, ""),
            body: Array.isArray(q.body) ? q.body.map((l) => str(l, "")) : [],
            vibe: okVibe ? (vibe as EmotaPopup["vibe"]) : "trail",
          } satisfies EmotaPopup;
        });
    } else this.popupQueue = [];

    const encId = o.activeEncounterId;
    if (encId === null || encId === undefined) this.activeEncounter = null;
    else {
      const eid = str(encId, "");
      this.activeEncounter = TRAIL_ENCOUNTERS.find((e) => e.id === eid) ?? null;
    }

    const ptb = o.pendingTravelBuffer;
    this.pendingTravelBuffer = Array.isArray(ptb) ? ptb.map((x) => str(x, "")) : [];

    this.lastMilestoneAnnounced = Math.max(0, int(o.lastMilestoneAnnounced, 0));
    this.riverHandledForMiles = int(o.riverHandledForMiles, -1);

    const hsr = o.huntSessionsByRegion;
    if (Array.isArray(hsr)) {
      this.huntSessionsByRegion = [0, 1, 2, 3].map((i) => Math.max(0, int(hsr[i], 0)));
    }

    this.afterRestSkipTrivia = bool(o.afterRestSkipTrivia, false);
    this._buildQuality = Math.max(0, Math.min(1, num(o.buildQuality, 0.5)));

    this.repairLoadedRunState();
    return true;
  }

  /** Fix impossible combinations after a version skew or hand-edited save. */
  private repairLoadedRunState(): void {
    if (this.phase === "trivia" && !this.currentTrivia) this.phase = "travel_menu";
    if (this.phase === "trail_event" && !this.activeEncounter) this.phase = "travel_menu";
    if (this.phase === "chance_play") {
      const ok = this.pendingChanceId && CHANCE_GAMES.some((g) => g.id === this.pendingChanceId);
      if (!ok) {
        this.pendingChanceId = null;
        this.phase = "travel_menu";
      }
    }
    if (this.phase === "river" && !this.pendingRiver) this.phase = "travel_menu";

    const preParty: EnginePhase[] = ["training_text", "training_quiz", "party_names"];
    if (!preParty.includes(this.phase) && this.party.length === 0) this.phase = "party_names";
  }
}
