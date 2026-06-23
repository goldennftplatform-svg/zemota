import { ART } from "./asciiArt";
import { MANSION_ENCOUNTER_SPECS } from "../data/mansionHistory";

export interface EncounterMeta {
  id: string;
  title: string;
  art: string;
  intro: string[];
  /** Button labels (1-based index in UI) */
  choices: string[];
}

export const TRAIL_ENCOUNTERS: EncounterMeta[] = [
  {
    id: "trader",
    title: "SHY TRADER",
    art: ART.trader,
    intro: [
      "A dust-caked trader flags you down beside a dead campfire.",
      "“Flour, nails, gossip — pick your poison.”",
    ],
    choices: ["Buy 50 lb flour ($3)", "Swap gossip only (free)", "Wave him off"],
  },
  {
    id: "herd",
    title: "BUFFALO STRING",
    art: ART.herd,
    intro: [
      "The plain fills with brown backs — a herd crosses your line of march.",
      "You can wait, stampede through a gap, or send someone to scout.",
    ],
    choices: ["Wait it out (lose a half-day feel)", "Push a tight gap (risky)", "Scout wide (uses ammo)"],
  },
  {
    id: "night",
    title: "STRANGE FIRES",
    art: ART.night,
    intro: [
      "Distant fires blink like wrong stars. Voices carry — not English.",
      "Camp circles tight or ride wide?",
    ],
    choices: ["Circle wagons · tight camp", "Give the fires a wide berth (extra miles feel)", "Send a cautious hello (risk)"],
  },
  {
    id: "wheel",
    title: "SPARE OR SPLINT?",
    art: ART.wheel,
    intro: [
      "A wheel complains — spokes sing the song of split wood.",
      "You can burn a spare, rig a splint, or baby the pace.",
    ],
    choices: ["Use spare part if you have one", "Splint & pray (no part)", "Crawl slow (no spare used)"],
  },
  {
    id: "storm",
    title: "SKIN OF THE SKY",
    art: ART.storm,
    intro: [
      "The horizon goes iron. Hail ticks on the canvas like teeth.",
      "Dig in, run for a cutbank, or double-team the oxen?",
    ],
    choices: ["Batten down — ride it out", "Sprint for shelter (hard on oxen)", "Double-lash cover (food for warmth)"],
  },
  {
    id: "gold",
    title: "PANNING RUMOR",
    art: ART.luck,
    intro: [
      "Someone shows you color in a creek pan — maybe fool’s gold, maybe not.",
      "Waste an afternoon, buy the “claim,” or keep rolling?",
    ],
    choices: ["Pan half a day (might find coin)", "Laugh and roll on", "Buy a worthless map ($5)"],
  },
  ...MANSION_ENCOUNTER_SPECS.map((spec) => ({
    ...spec,
    art:
      spec.id === "mansion_ferry"
        ? ART.river
        : spec.id === "mansion_hop_rumor"
          ? ART.luck
          : spec.id === "mansion_monument"
            ? ART.milestone.replace("@@@", "TRAIL")
            : ART.trader,
  })),
];

export function pickEncounter(): EncounterMeta {
  return TRAIL_ENCOUNTERS[Math.floor(Math.random() * TRAIL_ENCOUNTERS.length)]!;
}
