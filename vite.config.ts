import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  if (
    mode === "production" &&
    process.env.VERCEL &&
    !String(process.env.VITE_TRAIL_SERVER_URL ?? "").trim()
  ) {
    console.warn(
      "\n[emota] VITE_TRAIL_SERVER_URL is not set in Vercel — bigboard / multiplayer will not connect. Add your tunnel HTTPS origin (no trailing slash), then redeploy.\n",
    );
  }

  return {
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        bigboard: path.resolve(__dirname, "bigboard.html"),
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
};
});
