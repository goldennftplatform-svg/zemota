/**
 * Trail server origin for Socket.IO (Express + server/index.ts).
 * Priority: VITE_TRAIL_SERVER_URL → ?trail= → localStorage emota_trail_server
 * Vercel has no Socket.IO; set env or open with ?trail=https://your-tunnel.trycloudflare.com
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
