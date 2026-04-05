# Ezra Meeker’s Oregon Trail Adventure (EMOTA)

Teaching-oriented Oregon Trail–style game centered on **Ezra Meeker**. You replace trivia and store copy with your public records.

## Run locally

```bash
npm install
npm run dev
```

Optional trail room (up to **25** simultaneous connections on your LAN):

```bash
npm run server
```

With the server running, `npm run dev` proxies WebSocket traffic so travelers appear in the strip at the top. Without the server, the game works offline.

## Deploy static client (Vercel)

- Connect the repo to Vercel.
- Build command: `npm run build`
- Output directory: `dist`

The **Socket.IO server is not deployed** by this config; it is for local or future hosted infrastructure. On Vercel, players get local high scores in the browser only unless you add a managed realtime backend later.

## Content hooks for your archive

- `src/game/trivia.ts` — question bank and teaching blurbs.
- `src/game/profiles.ts` — starting cash and modifiers.
- `src/game/landClaim.ts` — Oregon vs Washington vs Puyallup “Hop King” ending.
- `src/game/map.ts` — landmark blurbs.

## Display name (leaderboard)

Stored in `localStorage` under `emota_display_name`. From the browser console:

```js
localStorage.setItem("emota_display_name", "Your Name");
```

High scores use `emota_high_scores`.
