/** Raster art served from `/public/art`. */
/** Bump when replacing spotlight rasters so clients skip stale CDN/browser caches. */
export const ART_REV = "spotlight1";

const v = (path: string) => `${path}?v=${ART_REV}`;

export const GAME_ART = {
  /** Legacy pixel map — kept for reference; game UI uses oregonTrailMap. */
  usaMap: v("/art/usa-map.png"),
  /** Vintage “Old Oregon Trail” chart — bigboard + minimap. */
  /** Ezra Meeker horizontal Oregon Trail postcard (bigboard + minimap + game BG). */
  oregonTrailMap: v("/art/oregon-trail-map.png"),
  hopKingYoungSheet: v("/art/sprites/hop-king-young.png"),
  ezraElderSheet: v("/art/sprites/ezra-elder.png"),
  ezraWagonSheet: v("/art/sprites/ezra-wagon.png"),
  /** Desktop boot title card (replaces ASCII # logo). */
  emotaWordmark: v("/art/emota-wordmark.png"),
} as const;

/** Top-down / side hunt targets — chunky PNGs for phone readability. */
export const HUNT_ART: Record<"bison" | "bear" | "deer" | "rabbit", string> = {
  bison: v("/art/hunt/bison.png"),
  bear: v("/art/hunt/bear.png"),
  deer: v("/art/hunt/deer.png"),
  rabbit: v("/art/hunt/rabbit.png"),
};

/** Overhead hunt hunter sprite. */
export const HUNT_HUNTER_ART = v("/art/hunt/hunter.png");

/** Land-vista top-down covered wagon. */
export const VISTA_WAGON_ART = v("/art/sprites/vista/wagon-top.png");

export type GameArtKey = keyof typeof GAME_ART;
