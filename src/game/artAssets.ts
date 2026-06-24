/** Raster art served from `/public/art`. */
export const GAME_ART = {
  drunkcowboyPioneer: "/art/drunkcowboy-pioneer.png",
  drunkcowboyGameOver: "/art/drunkcowboy-game-over.png",
  /** Legacy pixel map — kept for reference; game UI uses oregonTrailMap. */
  usaMap: "/art/usa-map.png",
  /** Vintage “Old Oregon Trail” chart — bigboard + minimap. */
  oregonTrailMap: "/art/oregon-trail-map.png",
} as const;

/** Top-down hunt targets — retro SVG sprites. */
export const HUNT_ART: Record<"bison" | "bear" | "deer" | "rabbit", string> = {
  bison: "/art/hunt/bison.svg",
  bear: "/art/hunt/bear.svg",
  deer: "/art/hunt/deer.svg",
  rabbit: "/art/hunt/rabbit.svg",
};

export type GameArtKey = keyof typeof GAME_ART;
