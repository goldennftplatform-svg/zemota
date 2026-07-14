/** 3×4 pixel sprite sheets — young Hop King, elder Ezra, elder + wagon. */

import { GAME_ART } from "./artAssets";

export type MeekerSpriteId = "hopKingYoung" | "ezraElder" | "ezraWagon";

export type MeekerSpriteAnim = "walk-west" | "walk-front" | "idle-west" | "icon-front";

export interface MeekerSpriteSheet {
  src: string;
  cols: number;
  rows: number;
}

export const MEEKER_SPRITE_SHEETS: Record<MeekerSpriteId, MeekerSpriteSheet> = {
  hopKingYoung: { src: GAME_ART.hopKingYoungSheet, cols: 4, rows: 3 },
  ezraElder: { src: GAME_ART.ezraElderSheet, cols: 4, rows: 3 },
  ezraWagon: { src: GAME_ART.ezraWagonSheet, cols: 4, rows: 3 },
};

/** Westbound trail (map runs east → west): back-left, left, front-left walk cycle. */
export const MEEKER_WALK_WEST_FRAMES = [6, 7, 8, 9] as const;

/** Title / header attract — front-facing shuffle from uploaded sheet (row 1). */
export const MEEKER_WALK_FRONT_FRAMES = [1, 2, 3] as const;

/** Standing profile facing west (sidebar / legacy). */
export const MEEKER_IDLE_WEST_FRAME = 7;

/** Straight-on front pose — best read at phone header size (row 3, col 4). */
export const MEEKER_ICON_FRONT_FRAME = 11;

/** Walk cycle frame interval on title / attract screens (ms). */
export const MEEKER_WALK_FRAME_MS = 220;

/** Fallback if walk ever runs during play chrome — 80% slower than attract (5× interval). */
export const MEEKER_WALK_FRAME_MS_PLAY = MEEKER_WALK_FRAME_MS * 5;

/**
 * Player-facing Ezra — young Hop King at jump-off (the “gotcha”: trail is only half the story).
 * Stays in the header / player chrome for the whole run.
 */
export const PLAYER_BOX_MEEKER: MeekerSpriteId = "hopKingYoung";

/** Monument-era Ezra — death screens, loss slash, dysentery popups. */
export const SLASH_MEEKER: MeekerSpriteId = "ezraElder";

/** Title/attract: front walk. Gameplay HUD: static front icon (no side-profile loop). */
export function playerBoxMeekerSprite(phase?: string): { id: MeekerSpriteId; anim: MeekerSpriteAnim } {
  const anim = phase === "title" ? "walk-front" : "icon-front";
  return { id: PLAYER_BOX_MEEKER, anim };
}

export function slashMeekerSprite(): { id: MeekerSpriteId; anim: MeekerSpriteAnim } {
  return { id: SLASH_MEEKER, anim: "idle-west" };
}
