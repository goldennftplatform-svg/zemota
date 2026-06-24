import { TARGET_TRAVEL_DAYS, TOTAL_TRAIL_MILES } from "./config";

/** Wagon / trail display name — skips onboarding grind for end-game QA. */
export const DEBUG_WAGON_NAME = "EzraEzra";

export const DEBUG_PLAYTEST_MILES = Math.round(TOTAL_TRAIL_MILES * 0.95);
export const DEBUG_PLAYTEST_DAY = Math.max(1, Math.round(TARGET_TRAVEL_DAYS * 0.95));

export function isDebugPlaytestWagonName(name: string): boolean {
  return name.trim() === DEBUG_WAGON_NAME;
}

/** 50/50 whether Puyallup hops path qualifies as Hop King (needs triviaCorrect ≥ 5). */
export function rollDebugPlaytestHopKing(): boolean {
  return Math.random() < 0.5;
}
