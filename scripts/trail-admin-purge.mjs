#!/usr/bin/env node
/**
 * Remove simulation scores + feed lines from the trail server (Bot-*, Stress-*, stress meta).
 *
 *   EMOTA_TRAIL_ADMIN_TOKEN=secret TRAIL_ORIGIN=http://127.0.0.1:3333 node scripts/trail-admin-purge.mjs
 *
 * Or: npm run trail:admin:purge-sim
 */
const origin = (process.env.TRAIL_ORIGIN || "http://127.0.0.1:3333").replace(/\/$/, "");
const token = process.env.EMOTA_TRAIL_ADMIN_TOKEN?.trim();
if (!token) {
  console.error("Set EMOTA_TRAIL_ADMIN_TOKEN (same value as on the server).");
  process.exit(1);
}
const url = `${origin}/trail/admin/purge-simulation`;
const r = await fetch(url, {
  method: "POST",
  headers: { "X-Emota-Admin": token, "Content-Type": "application/json" },
});
const j = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error(r.status, j);
  process.exit(1);
}
console.log("OK:", j);
