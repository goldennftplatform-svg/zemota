/**
 * TryCloudflare quick tunnel → local trail server (no dashboard login).
 * Set TUNNEL_VERBOSE=1 for full cloudflared logs.
 * Override binary: CLOUDFLARED_PATH=C:\\path\\cloudflared.exe
 */
import { spawn } from "child_process";
import { existsSync } from "fs";

const PORT = Number(process.env.TRAIL_SERVER_PORT ?? process.env.PORT) || 3333;
const verbose =
  process.env.TUNNEL_VERBOSE === "1" || process.env.TUNNEL_VERBOSE === "true";

function findCloudflared() {
  if (process.env.CLOUDFLARED_PATH && existsSync(process.env.CLOUDFLARED_PATH)) {
    return process.env.CLOUDFLARED_PATH;
  }
  if (process.platform === "win32") {
    const p = `${process.env["ProgramFiles(x86)"]}\\cloudflared\\cloudflared.exe`;
    if (existsSync(p)) return p;
  }
  return "cloudflared";
}

function showLine(line) {
  const L = line.trim();
  if (!L) return false;
  if (L.includes("trycloudflare.com")) return true;
  if (L.includes("quick Tunnel has been created") || L.includes("Thank you for trying")) return true;
  if (L.includes("Registered tunnel connection")) return true;
  if (/\bWRN\b/.test(L)) return true;
  if (/\bERR\b/.test(L)) {
    if (L.includes("Cannot determine default origin certificate")) return false;
    if (L.includes("Cannot determine default configuration path")) return false;
    return true;
  }
  return false;
}

function extractPublicUrl(line) {
  const m = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i);
  return m ? m[0] : null;
}

const exe = findCloudflared();
const baseArgs = ["tunnel", "--loglevel", "info", "--url", `http://127.0.0.1:${PORT}`];

console.log(
  "Tunnel → http://127.0.0.1:" + PORT + "    (TUNNEL_VERBOSE=1 for full logs)\n",
);

let lastUrl = "";
let printedHint = false;

function printVercelLine() {
  if (!lastUrl || printedHint) return;
  printedHint = true;
  console.log("\n── Vercel env (copy one line) ────────────────────────");
  console.log("VITE_TRAIL_SERVER_URL=" + lastUrl);
  console.log("──────────────────────────────────────────────────────\n");
}

function handleChunk(chunk) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (showLine(line)) console.log(line);
    const u = extractPublicUrl(line);
    if (u) {
      lastUrl = u;
      printVercelLine();
    }
  }
}

if (verbose) {
  const child = spawn(exe, baseArgs, { stdio: "inherit", shell: false });
  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 0);
  });
} else {
  const child = spawn(exe, baseArgs, { stdio: ["ignore", "pipe", "pipe"], shell: false });
  child.stdout.on("data", handleChunk);
  child.stderr.on("data", handleChunk);
  child.on("exit", (code, signal) => {
    if (lastUrl && !printedHint) printVercelLine();
    if (signal) process.exit(1);
    process.exit(code ?? 0);
  });
}
