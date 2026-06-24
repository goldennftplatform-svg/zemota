# Event guide

## Public internet event (recommended — phones work anywhere)

Players use one permanent link forever (event + at home). See **LIVE-TRAIL.md** for one-time trail-server setup.

| What | URL |
|------|-----|
| **Printable QR sign** | https://zemota.vercel.app/join |
| **Play (short link)** | https://zemota.vercel.app/play |
| **Live bigboard (TV)** | https://zemota.vercel.app/bigboard?wall=1 |

**Day-of:** open `/join` on a laptop → **Print this sign** → put it on a table. Phones scan → play. TV shows `/bigboard?wall=1`.

---

## Local laptop event (venue Wi‑Fi only)

Run everything on **one laptop** on venue Wi‑Fi. No cloud required.

## What you need

| Item | Notes |
|------|--------|
| Laptop | Windows or Mac, **Node.js 20+** ([nodejs.org](https://nodejs.org)) |
| Wi‑Fi | Same network for phones + projector/TV |
| Projector or TV | HDMI from laptop; open bigboard full-screen (F11) |
| Phones | Players use the game in the browser — no app install |

## First-time setup (~5 minutes)

```bash
git clone https://github.com/goldennftplatform-svg/zemota.git
cd zemota
npm install
npm run build
```

Copy the whole `zemota` folder to a USB drive if the venue PC has no git.

## Day-of — start the show

```bash
cd zemota
npm run build    # skip if already built
npm run server
```

Terminal prints:

- **Game:** `http://127.0.0.1:3333`
- **Bigboard:** `http://127.0.0.1:3333/bigboard`

### Find the laptop IP (for phones on Wi‑Fi)

**Windows (PowerShell):** `ipconfig` → look for **IPv4** (e.g. `192.168.1.42`)

**Mac:** System Settings → Network, or `ipconfig getifaddr en0`

Share with players:

```text
http://192.168.1.42:3333
```

If phones don’t connect automatically, add trail override:

```text
http://192.168.1.42:3333/?trail=http://192.168.1.42:3333
```

### Projector / TV

1. Plug in HDMI, extend display.
2. Open **`http://127.0.0.1:3333/bigboard`** on the projector screen.
3. Press **F11** (full screen).
4. Optional: add **`?wall=1`** for the clean wall layout:  
   `http://127.0.0.1:3333/bigboard?wall=1`

## Firewall (Windows)

If phones can’t connect, allow **Node** through Windows Firewall once, or allow inbound **TCP 3333** on private networks.

## Offline / no internet

Works fully offline after `npm install` + `npm run build`. Google Fonts load if online; game still runs if they’re cached or blocked.

## Optional: dev + hot reload (setup only)

```bash
npm run dev:stack
```

Vite on `:5173`, server on `:3333` — use only while tweaking; for events prefer **`npm run server`** only.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Bigboard says OFFLINE | Server not running — `npm run server` |
| Phones solo, no wagons on wall | Same Wi‑Fi? Use `?trail=http://LAPTOP-IP:3333` |
| Port in use | Close old terminal or set `TRAIL_SERVER_PORT=3334` |
| Scores empty | Normal until someone finishes a run to Oregon |

## Pack list

- [ ] Laptop + charger  
- [ ] HDMI cable  
- [ ] USB with repo OR git pull  
- [ ] Printed QR sign from **https://zemota.vercel.app/join** (or local `http://YOUR-IP:3333/join`)
- [ ] This file bookmarked  
