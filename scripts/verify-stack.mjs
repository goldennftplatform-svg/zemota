/**
 * Check trail server (port 3333) and optional cloudflared process.
 * Run: npm run verify
 */
import { execSync } from "child_process";
import { existsSync } from "fs";

const PORT = Number(process.env.TRAIL_SERVER_PORT ?? process.env.PORT) || 3333;
const HEALTH = `http://127.0.0.1:${PORT}/health`;

function cloudflaredPath() {
  if (process.env.CLOUDFLARED_PATH && existsSync(process.env.CLOUDFLARED_PATH)) {
    return process.env.CLOUDFLARED_PATH;
  }
  if (process.platform === "win32") {
    const p = `${process.env["ProgramFiles(x86)"]}\\cloudflared\\cloudflared.exe`;
    if (existsSync(p)) return p;
  }
  return "cloudflared";
}

function isCloudflaredRunning() {
  try {
    if (process.platform === "win32") {
      const out = execSync('tasklist /FI "IMAGENAME eq cloudflared.exe" /NH', {
        encoding: "utf8",
      });
      if (/INFO: No tasks/i.test(out)) return false;
      return /cloudflared\.exe/i.test(out);
    }
    execSync("pgrep -x cloudflared", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function checkHealth() {
  try {
    const r = await fetch(HEALTH, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
    const j = await r.json();
    return { ok: true, detail: j };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg };
  }
}

console.log("EMOTA stack check\n");

const health = await checkHealth();
if (health.ok) {
  console.log(`✓ Trail server  ${HEALTH}`);
  console.log(`  ${JSON.stringify(health.detail)}`);
} else {
  console.log(`✗ Trail server  not reachable (${HEALTH})`);
  console.log(`  ${health.detail}`);
  console.log(`  → Run: npm run server`);
}

const cf = isCloudflaredRunning();
const cfPath = cloudflaredPath();
console.log("");
if (cf) {
  console.log("✓ cloudflared process appears to be running");
} else {
  console.log("✗ cloudflared process not found");
  console.log(`  → Optional for public URL: npm run tunnel`);
  console.log(`  → Binary: ${cfPath}`);
}

console.log("\n—");
console.log(
  "Local play: npm run server + npm run dev (no tunnel). Vercel multiplayer needs a running tunnel + VITE_TRAIL_SERVER_URL.",
);

process.exit(health.ok ? 0 : 1);
