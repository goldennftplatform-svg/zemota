/**
 * Trail server origin for Socket.IO (Express + server/index.ts).
 * Priority: `?trail=` → localStorage `emota_trail_server` → `VITE_TRAIL_SERVER_URL`
 *
 * Query/localStorage win so stress tests (`?trail=`), classrooms, and tunnels can override a
 * baked Vercel env without redeploying. Same origin must be used by the game, bigboard, and bots.
 *
 * Async `resolveTrailOrigin()` also reads `/trail.json` when nothing above is set.
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
  const fromBrowser = trailOverrideFromBrowser();
  if (fromBrowser) return fromBrowser;
  const v = import.meta.env.VITE_TRAIL_SERVER_URL;
  if (typeof v === "string" && v.trim()) {
    return normalizeOrigin(v);
  }
  return undefined;
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
