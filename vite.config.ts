import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
});
