/** Longer run (~25–30+ min); pace scales so you still reach Oregon in time. */
export const TARGET_TRAVEL_DAYS = 52;
/** Original tuning reference — miles/day multiplied by this / TARGET_TRAVEL_DAYS */
export const PACE_REFERENCE_DAYS = 36;
export const TOTAL_TRAIL_MILES = 1990;
export const MAX_PARTY = 5;
/** Trail room + stress “event” ceiling (server + client strip). */
export const MULTIPLAYER_CAP = 100;

/** Base chance-game cooldown days (soft). */
export const CHANCE_COOLDOWN_DAYS = 4;

/** Max meat (lbs) you can pack from one hunt back to the wagon (OG ~100–200). */
export const HUNT_MAX_MEAT_LB = 200;

/** Max rifle shots per hunt session (each uses 1 ammo from inventory). */
export const HUNT_MAX_SHOTS_PER_SESSION = 22;

/** Minimum ammo to start a hunt (need a usable supply). */
export const HUNT_MIN_AMMO_TO_HUNT = 5;

/**
 * Landing page: CRT “load” phase length before the click-to-enter button appears.
 * Player must still click (or activate the button) to reach the title menu.
 */
export const BOOT_LANDING_INTRO_MS = 1600;
