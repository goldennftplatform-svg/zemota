/**
 * Trail server origin for Socket.IO (Express + server/index.ts).
 * Priority: VITE_TRAIL_SERVER_URL → ?trail= → localStorage emota_trail_server
 *
 * Async `resolveTrailOrigin()` also reads `/trail.json` { "origin": "https://..." } so you can
 * push a URL change without editing Vercel env (still one deploy per change).
 * For a URL that never changes: use a named Cloudflare Tunnel + your domain, set env once.
 */
function normalizeOrigin(s: string): string {
  return s.trim().replace(/\/$/, "");
}

function trailOverrideFromBrowser(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const q = new URLSearchParams(window.location.search).get("trail");
    if (q?.trim()) return normalizeOrigin(q);
    const ls = localStorage.getItem("emota_trail_server");
    if (ls?.trim()) return normalizeOrigin(ls);
  } catch {
    return undefined;
  }
  return undefined;
}

export function trailServerOrigin(): string | undefined {
  const v = import.meta.env.VITE_TRAIL_SERVER_URL;
  if (typeof v === "string" && v.trim()) {
    return normalizeOrigin(v);
  }
  return trailOverrideFromBrowser();
}

/** Use for Socket.IO connect — includes optional `/trail.json` when env + browser overrides are empty. */
export async function resolveTrailOrigin(): Promise<string | undefined> {
  const sync = trailServerOrigin();
  if (sync) return sync;
  if (typeof window === "undefined") return undefined;
  try {
    const r = await fetch("/trail.json", { cache: "no-store" });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { origin?: string };
    const o = j?.origin?.trim?.();
    if (o) return normalizeOrigin(o);
  } catch {
    return undefined;
  }
  return undefined;
}
