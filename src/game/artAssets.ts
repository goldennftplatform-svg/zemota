/** Raster art served from `/public/art` (drunkcowboy game-over + pioneer, terraink-style US map). */
export const GAME_ART = {
  drunkcowboyPioneer: "/art/drunkcowboy-pioneer.png",
  drunkcowboyGameOver: "/art/drunkcowboy-game-over.png",
  usaMap: "/art/usa-map.png",
} as const;

/** Top-down hunt targets — retro SVG sprites. */
export const HUNT_ART: Record<"bison" | "bear" | "deer" | "rabbit", string> = {
  bison: "/art/hunt/bison.svg",
  bear: "/art/hunt/bear.svg",
  deer: "/art/hunt/deer.svg",
  rabbit: "/art/hunt/rabbit.svg",
};

export type GameArtKey = keyof typeof GAME_ART;
