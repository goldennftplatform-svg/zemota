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

/**
 * Player-facing Ezra — young Hop King at jump-off (the “gotcha”: trail is only half the story).
 * Stays in the header / player chrome for the whole run.
 */
export const PLAYER_BOX_MEEKER: MeekerSpriteId = "hopKingYoung";

/** Monument-era Ezra — death screens, loss slash, dysentery popups. */
export const SLASH_MEEKER: MeekerSpriteId = "ezraElder";

export function playerBoxMeekerSprite(): { id: MeekerSpriteId; anim: MeekerSpriteAnim } {
  return { id: PLAYER_BOX_MEEKER, anim: "walk-west" };
}

export function slashMeekerSprite(): { id: MeekerSpriteId; anim: MeekerSpriteAnim } {
  return { id: SLASH_MEEKER, anim: "idle-west" };
}
