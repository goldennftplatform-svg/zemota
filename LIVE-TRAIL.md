# Live trail — easy setup (game + bigboard)

Players only need **one link** on their phone. You set up the trail server **once**.

## For players (share this)

**Easiest:** scan the QR on the printed sign, or open:

**https://zemota.vercel.app/play**

(Short link — same as the main game.)

1. Tap **Play now**  
2. Play the game — your wagon shows on the **live board** automatically  

**Printable sign with QR codes (for you):**  
**https://zemota.vercel.app/join** — open on a laptop, tap **Print this sign**, put it on a table.

**Live board (TV / projector):**  
**https://zemota.vercel.app/bigboard?wall=1**

If the board says **Live** (green) and your wagon still does not appear, wait 10 seconds or close and reopen the game.

---

## For you (one-time host setup, ~10 minutes)

### Step 1 — Start the trail server on Render (free)

1. Push this repo to GitHub (already done).  
2. Go to [render.com](https://render.com) → **New** → **Blueprint** → connect the **zemota** repo.  
3. Render reads `render.yaml` and creates **emota-trail**.  
4. When deploy finishes, copy the URL, e.g. `https://emota-trail.onrender.com` (no trailing slash).

### Step 2 — Tell Vercel about it

1. Open [vercel.com](https://vercel.com) → **zemota** project → **Settings** → **Environment Variables**  
2. **Edit** the existing `VITE_TRAIL_SERVER_URL` (do not add a second one — Vercel will reject duplicates).  
3. Set the value to your Render URL **with no trailing slash**, e.g. `https://emota-trail.onrender.com`  
4. **Deployments** → latest → **⋯** → **Redeploy** (required — `trail.json` is baked at build time).

Check: open **https://zemota.vercel.app/trail.json** — `origin` must be `https://emota-trail.onrender.com` (not `trycloudflare.com`). If it still shows the old URL, **Redeploy** on Vercel after editing the variable.

### Step 3 — Test

1. **Sign:** **https://zemota.vercel.app/join** — print or show on a tablet; scan the big QR with your phone  
2. Phone should open **/play** and banner says **LIVE — your wagon is on the big screen**  
3. TV: **https://zemota.vercel.app/bigboard?wall=1** — top should say **Live**, wagon count ≥ 1  

---

## Quick test without Render (laptop + tunnel)

For a demo before Render is set up:

```bash
npm run build
npm run live
```

Copy the `VITE_TRAIL_SERVER_URL=…` line from the terminal into Vercel, redeploy, then use the public links above.

Or on the same Wi‑Fi, open on phones once (saves the room):

```text
https://zemota.vercel.app/?trail=PASTE-TUNNEL-URL-HERE
```

Bigboard:

```text
https://zemota.vercel.app/bigboard?trail=SAME-URL-HERE&wall=1
```

The `?trail=` link is remembered on that phone after the first visit.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Render deploy keeps looping / never goes Live | Open **emota-trail** → **Logs**. Often `NODE_ENV=production` skipped `tsx` — redeploy after latest repo fix, or set build to `npm install --include=dev && npm run build` |
| Vercel says variable already exists | **Edit** the existing `VITE_TRAIL_SERVER_URL` — do not create a new one |
| `trail.json` still shows trycloudflare.com | Vercel was not **redeployed** after editing the variable |
| Bigboard says **Offline** or “not set up” | `VITE_TRAIL_SERVER_URL` missing or wrong on Vercel — edit + redeploy |
| Phone banner says **phone only** | Same — trail server URL not baked into the build |
| Render sleeps (free tier) | First visitor waits ~30s while server wakes; open bigboard first at an event |
| Name shows as **Party 1** | Tap to name your wagon in Step 1 of the game — that name appears on the board |
| Need a printed QR sign | Open **/join** on a laptop → **Print this sign** |
