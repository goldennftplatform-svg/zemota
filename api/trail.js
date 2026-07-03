/** Runtime trail origin for Vercel — reads VITE_TRAIL_SERVER_URL without a full client rebuild. */
const PRODUCTION_TRAIL_ORIGIN = "https://emota-trail.onrender.com";

function resolveTrailOrigin() {
  const raw = String(process.env.VITE_TRAIL_SERVER_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!raw) return PRODUCTION_TRAIL_ORIGIN;
  try {
    if (/\.trycloudflare\.com$/i.test(new URL(raw).hostname)) return PRODUCTION_TRAIL_ORIGIN;
  } catch {
    return PRODUCTION_TRAIL_ORIGIN;
  }
  return raw;
}

export default function handler(_request, response) {
  const origin = resolveTrailOrigin();
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  response.status(200).send(`${JSON.stringify({ origin }, null, 2)}\n`);
}
