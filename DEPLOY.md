# Public deploy (edge + trail server)

**Split:** static UI on a **CDN/edge** (cheap, global “horsepower” for JS/CSS/HTML) · **Socket.IO** on a **small always-on** host (the real “workload” for live rooms).

| Piece | Role | Typical free/cheap option |
|--------|------|---------------------------|
| **Game + bigboard** | `npm run build` → `dist/` | **Vercel**, **Cloudflare Pages**, **Netlify**, **GitHub Pages** — edge caching, high bandwidth |
| **Trail server** | `server/index.ts` (Express + Socket.IO) | **Fly.io**, **Render**, **Railway** free tier (may sleep) or **~$5/mo** VPS |

## Environment variable

At **build** time (Vercel project settings → Environment Variables):

```bash
VITE_TRAIL_SERVER_URL=https://your-trail-server.fly.dev
```

Use your real trail API origin (no trailing slash). Omit locally: Vite proxies `/socket.io` to port 3333.

## Vercel

- Connect repo; framework “Other”; output `dist`; build `npm run build`.
- Set `VITE_TRAIL_SERVER_URL` to your deployed trail server **HTTPS** URL.
- `vercel.json` maps `/bigboard` → `bigboard.html` and long-cache hashes under `/assets/`.

## Trail server in production

- Listen on `process.env.PORT` (many hosts set this).
- CORS is already permissive (`origin: true`) for Socket.IO.
- Serve `dist/` from the same process only if you want one box; otherwise static on CDN + server URL above is enough.

## GitHub repo “public”

- **Public repo** = free hosting of source; **not** the same as traffic delivery — use the table above for that.
- If using **GitHub Pages** with a project URL (`/repo/`), set Vite `base: '/repo-name/'` and rebuild.
