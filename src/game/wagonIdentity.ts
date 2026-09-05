export const WAGON_COLORS = { canvas: "#e8d2a0", sage: "#9bbf88", sky: "#89bde0", rose: "#e69b91", gold: "#efc15b" } as const;
export const WAGON_EMBLEMS = { star: "Star", pine: "Pine", sun: "Sun", river: "River" } as const;
export interface WagonIdentity {
  color: keyof typeof WAGON_COLORS;
  emblem: keyof typeof WAGON_EMBLEMS;
  oxNames: [string, string];
}

/** Same allowlist at the save, server, and display boundaries. Never accepts CSS or SVG. */
export function sanitizeWagonIdentity(raw: unknown): WagonIdentity {
  const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const names = Array.isArray(r.oxNames) ? r.oxNames : [];
  const name = (n: unknown, fallback: string) => typeof n === "string"
    ? n.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 20) || fallback : fallback;
  return {
    color: typeof r.color === "string" && Object.hasOwn(WAGON_COLORS, r.color) ? r.color as WagonIdentity["color"] : "canvas",
    emblem: typeof r.emblem === "string" && Object.hasOwn(WAGON_EMBLEMS, r.emblem) ? r.emblem as WagonIdentity["emblem"] : "star",
    oxNames: [name(names[0], "Buck"), name(names[1], "Bright")],
  };
}
