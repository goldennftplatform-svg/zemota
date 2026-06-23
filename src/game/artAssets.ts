/** Raster art served from `/public/art` (drunkcowboy game-over + pioneer, terraink-style US map). */
export const GAME_ART = {
  drunkcowboyPioneer: "/art/drunkcowboy-pioneer.png",
  drunkcowboyGameOver: "/art/drunkcowboy-game-over.png",
  usaMap: "/art/usa-map.png",
} as const;

export type GameArtKey = keyof typeof GAME_ART;
