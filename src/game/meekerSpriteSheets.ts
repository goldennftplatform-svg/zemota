/** 3×4 pixel sprite sheets — young Hop King, elder Ezra, elder + wagon. */

export type MeekerSpriteId = "hopKingYoung" | "ezraElder" | "ezraWagon";

export type MeekerSpriteAnim = "walk-west" | "idle-west";

export interface MeekerSpriteSheet {
  src: string;
  cols: number;
  rows: number;
}

export const MEEKER_SPRITE_SHEETS: Record<MeekerSpriteId, MeekerSpriteSheet> = {
  hopKingYoung: { src: "/art/sprites/hop-king-young.png", cols: 4, rows: 3 },
  ezraElder: { src: "/art/sprites/ezra-elder.png", cols: 4, rows: 3 },
  ezraWagon: { src: "/art/sprites/ezra-wagon.png", cols: 4, rows: 3 },
};

/** Westbound trail (map runs east → west): back-left, left, front-left walk cycle. */
export const MEEKER_WALK_WEST_FRAMES = [6, 7, 8, 9] as const;

/** Standing profile facing west. */
export const MEEKER_IDLE_WEST_FRAME = 7;

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

/** Title/attract: walk. Gameplay HUD: static idle (no looping walk). */
export function playerBoxMeekerSprite(phase?: string): { id: MeekerSpriteId; anim: MeekerSpriteAnim } {
  const anim = phase === "title" ? "walk-west" : "idle-west";
  return { id: PLAYER_BOX_MEEKER, anim };
}

export function slashMeekerSprite(): { id: MeekerSpriteId; anim: MeekerSpriteAnim } {
  return { id: SLASH_MEEKER, anim: "idle-west" };
}
