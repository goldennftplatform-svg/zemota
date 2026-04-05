/**
 * TryCloudflare quick tunnel → local trail server (no dashboard login).
 * Override binary: CLOUDFLARED_PATH=C:\\path\\cloudflared.exe
 */
import { spawn } from "child_process";
import { existsSync } from "fs";

const PORT = Number(process.env.TRAIL_SERVER_PORT ?? process.env.PORT) || 3333;

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

const exe = findCloudflared();
const args = ["tunnel", "--url", `http://127.0.0.1:${PORT}`];

console.log(`Starting cloudflared: ${exe} ${args.join(" ")}\n`);

const child = spawn(exe, args, { stdio: "inherit", shell: false });
child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
