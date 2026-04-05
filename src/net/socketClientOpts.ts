/**
 * Socket.IO client defaults for EMOTA.
 * Polling *before* WebSocket: Cloudflare quick tunnels (and some proxies) drop WS upgrades;
 * Engine.IO polling over HTTPS still works through the tunnel.
 */
export const EMOTA_SOCKET_BASE = {
  path: "/socket.io",
  transports: ["polling", "websocket"] as const,
  timeout: 20_000,
  withCredentials: false,
} as const;
