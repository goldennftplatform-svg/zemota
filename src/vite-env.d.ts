/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** e.g. https://trail-server.fly.dev — omit for same-origin (dev proxy / single host) */
  readonly VITE_TRAIL_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}