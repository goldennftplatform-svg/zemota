/**
 * Trail server origin for Socket.IO (Express + server/index.ts).
 * Priority (dev): `?trail=` → localStorage → `VITE_TRAIL_SERVER_URL` → `/trail.json`
 * Priority (production e.g. *.vercel.app): `?trail=` → `/trail.json` (live Vercel env via API) — not baked JS
 *
 * Query wins so stress tests (`?trail=`), classrooms, and tunnels can override a
 * baked Vercel env without redeploying. Same origin must be used by the game, bigboard, and bots.
 */
const LS_TRAIL = "emota_trail_server";

function normalizeOrigin(s: string): string {
  return s.trim().replace(/\/$/, "");
}

function isProductionTrailHost(): boolean {
  if (typeof window === "undefined") return false;
  return /\.vercel\.app$/i.test(window.location.hostname);
}

function trailFromQuery(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const q = new URLSearchParams(window.location.search).get("trail");
    if (q?.trim()) return normalizeOrigin(q);
  } catch {
    return undefined;
  }
  return undefined;
}

function originFromBuildEnv(): string | undefined {
  const v = import.meta.env.VITE_TRAIL_SERVER_URL;
  if (typeof v === "string" && v.trim()) return normalizeOrigin(v);
  return undefined;
}

async function originFromTrailJson(): Promise<string | undefined> {
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

async function canonicalDeployOrigin(): Promise<string | undefined> {
  if (isProductionTrailHost()) {
    return originFromTrailJson();
  }
  return originFromBuildEnv() ?? (await originFromTrailJson());
}

/** Save `?trail=https://…` once — phones keep the same room without retyping the link. */
export function persistTrailOriginFromQuery(): void {
  if (typeof window === "undefined") return;
  try {
    const q = trailFromQuery();
    if (q) localStorage.setItem(LS_TRAIL, q);
  } catch {
    /* private mode */
  }
}

export function clearStoredTrailOrigin(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_TRAIL);
  } catch {
    /* private mode */
  }
}

/** Drop a saved tunnel URL that no longer matches the deployed trail server. */
export function clearStoredTrailOriginIfStale(canonical: string): void {
  if (typeof window === "undefined") return;
  try {
    const ls = localStorage.getItem(LS_TRAIL);
    if (ls?.trim() && normalizeOrigin(ls) !== canonical) {
      localStorage.removeItem(LS_TRAIL);
    }
  } catch {
    /* private mode */
  }
}

function trailOverrideFromBrowser(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const ls = localStorage.getItem(LS_TRAIL);
    if (ls?.trim()) return normalizeOrigin(ls);
  } catch {
    return undefined;
  }
  return undefined;
}

export function trailServerOrigin(): string | undefined {
  const fromQuery = trailFromQuery();
  if (fromQuery) return fromQuery;

  const fromBrowser = trailOverrideFromBrowser();
  if (fromBrowser) return fromBrowser;

  return originFromBuildEnv();
}

/** Use for Socket.IO connect — includes `/trail.json` when build env is empty. */
export async function resolveTrailOrigin(): Promise<string | undefined> {
  const fromQuery = trailFromQuery();
  if (fromQuery) return fromQuery;

  if (isProductionTrailHost()) {
    const canonical = await canonicalDeployOrigin();
    if (canonical) {
      clearStoredTrailOriginIfStale(canonical);
      return canonical;
    }
  }

  const fromBrowser = trailOverrideFromBrowser();
  if (fromBrowser) return fromBrowser;

  return canonicalDeployOrigin();
}
