import type { Landmark } from "./types";
import { MANSION_LANDMARK_ADDENDUM } from "../data/mansionHistory";

function blurb(name: string, base: string): string {
  const add = MANSION_LANDMARK_ADDENDUM[name];
  return add ? `${base} ${add}` : base;
}

/** ~2,000 mi narrative; game compresses into TARGET_TRAVEL_DAYS steps in config. */
export const LANDMARKS: Landmark[] = [
  {
    name: "Independence, Missouri",
    milesFromStart: 0,
    blurb: "Jumping-off place for Oregon and California caravans.",
  },
  {
    name: "Kansas River crossing",
    milesFromStart: 102,
    river: true,
    blurb: "First serious water. Ferries, fords, and frayed nerves.",
  },
  {
    name: "Big Blue River",
    milesFromStart: 185,
    river: true,
    blurb: "Spring floods could swallow wagons whole.",
  },
  {
    name: "Fort Kearney",
    milesFromStart: 304,
    blurb: "Military post on the Great Platte River Road.",
  },
  {
    name: "Chimney Rock",
    milesFromStart: 554,
    blurb: blurb("Chimney Rock", "A spire in the sky — emigrants carved names and dates."),
  },
  {
    name: "Fort Laramie",
    milesFromStart: 640,
    blurb: "Repairs, mail, gossip, and a taste of law.",
  },
  {
    name: "Independence Rock",
    milesFromStart: 830,
    blurb: blurb("Independence Rock", "Reach it by July 4th or feel the season slipping."),
  },
  {
    name: "South Pass",
    milesFromStart: 932,
    blurb: "The gentle gap through the Rockies — still not gentle enough.",
  },
  {
    name: "Fort Bridger",
    milesFromStart: 989,
    blurb: "Green River country; supplies before the desert grind.",
  },
  {
    name: "Snake River",
    milesFromStart: 1375,
    river: true,
    blurb: blurb("Snake River", "Rafts, ropes, and shouting — a famous choke point."),
  },
  {
    name: "Fort Boise",
    milesFromStart: 1548,
    blurb: blurb("Fort Boise", "Hudson’s Bay trade post feel; the endgame of the Snake."),
  },
  {
    name: "The Dalles",
    milesFromStart: 1632,
    river: true,
    blurb: blurb("The Dalles", "Columbia River gorge — rapids, roads, or tolls."),
  },
  {
    name: "Oregon City",
    milesFromStart: 1990,
    blurb: blurb("Oregon City", "End of the measured trail — land claim and new politics begin."),
  },
];

export function landmarkAtMiles(miles: number): Landmark | undefined {
  let best: Landmark | undefined;
  for (const L of LANDMARKS) {
    if (L.milesFromStart <= miles + 2) best = L;
  }
  return best;
}

export function nextRiverAhead(miles: number): Landmark | undefined {
  return LANDMARKS.find((L) => L.river && L.milesFromStart > miles);
}
