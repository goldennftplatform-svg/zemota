import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Connect } from "vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTION_TRAIL_ORIGIN = "https://emota-trail.onrender.com";

function resolveTrailOriginForBuild(): string {
  let v = String(process.env.VITE_TRAIL_SERVER_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!v) return PRODUCTION_TRAIL_ORIGIN;
  try {
    if (/\.trycloudflare\.com$/i.test(new URL(v).hostname)) return PRODUCTION_TRAIL_ORIGIN;
  } catch {
    return PRODUCTION_TRAIL_ORIGIN;
  }
  return v;
}

function trailJsonMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const pathOnly = req.url?.split("?")[0] ?? "";
    if (pathOnly !== "/trail.json") {
      next();
      return;
    }
    const origin = resolveTrailOriginForBuild();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(`${JSON.stringify({ origin }, null, 2)}\n`);
  };
}

export default defineConfig(({ mode }) => {
  if (mode === "production" && process.env.VERCEL) {
    console.log(`[emota] Vercel build — /trail.json served at runtime via api/trail (Render fallback).`);
  }

  return {
    root: ".",
    publicDir: "public",
    plugins: [
      {
        name: "emota-html-routes",
        configureServer(server) {
          server.middlewares.use(trailJsonMiddleware());
          server.middlewares.use((req, _res, next) => {
            const pathOnly = req.url?.split("?")[0] ?? "";
            if (pathOnly === "/join" || pathOnly === "/event") req.url = "/join.html";
            else if (pathOnly === "/play") req.url = "/index.html";
            else if (pathOnly === "/bigboard") req.url = "/bigboard.html";
            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use(trailJsonMiddleware());
        },
      },
      {
        name: "emota-trail-json-origin",
        /** Non-Vercel static deploys only — Vercel uses api/trail.js (static file would override the rewrite). */
        closeBundle() {
          if (mode !== "production") return;
          const distTrail = path.resolve(__dirname, "dist/trail.json");
          if (process.env.VERCEL) {
            try {
              fs.unlinkSync(distTrail);
            } catch {
              /* no static trail.json — rewrite to /api/trail wins */
            }
            return;
          }
          try {
            fs.writeFileSync(
              distTrail,
              JSON.stringify({ origin: resolveTrailOriginForBuild() }, null, 2) + "\n",
            );
          } catch (e) {
            console.warn("[emota] could not write dist/trail.json:", e);
          }
        },
      },
    ],
    build: {
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
          bigboard: path.resolve(__dirname, "bigboard.html"),
          join: path.resolve(__dirname, "join.html"),
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/socket.io": {
          target: "http://127.0.0.1:3333",
          ws: true,
        },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        "/socket.io": {
          target: "http://127.0.0.1:3333",
          ws: true,
        },
      },
    },
  };
});
