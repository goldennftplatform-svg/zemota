/** Runtime trail origin for Vercel — reads VITE_TRAIL_SERVER_URL without a full client rebuild. */
export default function handler(_request, response) {
  const origin = String(process.env.VITE_TRAIL_SERVER_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
  response.status(200).send(`${JSON.stringify({ origin }, null, 2)}\n`);
}
