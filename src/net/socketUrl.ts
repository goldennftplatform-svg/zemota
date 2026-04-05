/**
 * Optional trail server for production: static app on a CDN, Socket.IO on a small host.
 * Build with: VITE_TRAIL_SERVER_URL=https://your-trail-api.example.com
 */
export function trailServerOrigin(): string | undefined {
  const v = import.meta.env.VITE_TRAIL_SERVER_URL;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.replace(/\/$/, "");
}
