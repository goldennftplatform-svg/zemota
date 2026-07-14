# EMOTA — product vision (north star)

Human-facing name: **Ezra Meeker’s Oregon Trail Adventure (EMOTA)** — a Hop King / Meeker Mansion teaching game.

**Agents:** Read this file **before planning, roadmaps, architecture debates, or large feature scoping.** Use it to reject drift. For file paths and stack details, follow `AGENTS.md` → `PROMPTME.md` → `.agents/skills/emota/SKILL.md`.

---

## One sentence

Mobile-first Oregon Trail on every phone, with an optional **live trail wall** for classrooms and events — **chess club without boards**: each kid plays their own run; the room shares one map.

---

## Who it’s for

- **Primary:** Students and families on **phones** (~99% of play).
- **Secondary:** Teachers, museums, Hop King events — **TV / projector bigboard** as the shared “tournament hall display.”
- **Institutional voice:** Real Oregon Trail history, Ezra Meeker, Puyallup hops — not generic edutainment.

---

## Product pillars (do not trade away)

| Pillar | Meaning |
|--------|---------|
| **Mobile-first** | Tap, large type, easy-read, minimal scroll; no keyboard required. |
| **No signup wall** | Device-local save and resume; no account gate to start a run. |
| **Explainable trail** | Mechanics and numbers live in `config.ts` / `engine.ts`; players can understand outcomes. |
| **Honor-system commerce** | Gift shop opens external Hop King URL; no fake payments in-game. |
| **Spectacle, not sync** | Live play shows wagons on a map; **no** turn-based multiplayer or shared wagon state. |
| **CRT flavor on desktop** | Green phosphor / pixel charm where it helps; never at the cost of phone UX. |

---

## Core loops

1. **Solo trail** — name party → profile → store → travel → camp choices → Oregon / game over. Runs fully in the browser.
2. **Live trail (optional)** — same solo run, plus position and events on a **trail server** for the strip and bigboard.
3. **Bigboard** — spectator URL for wall/TV: map, wagons, ticker, dock panels, trail news. Not a second game client.
4. **Museum / Hop King** — trivia, mansion history, gift shop, land-claim endings tied to Meeker story.

---

## Live play model (today)

- **Game logic and saves:** client-side (`localStorage`, `GameEngine`). Scales with devices, not servers.
- **Trail server:** Socket.IO — wagon roster, feed events, top scores. **One global room**, cap **100** concurrent wagons per server (`MULTIPLAYER_CAP`).
- **Bigboard TVs:** spectators; they do not count toward the wagon cap.
- **Deploy split:** static UI on CDN (e.g. Vercel); trail server on a small always-on host (not free-tier sleep for events).

**Known limits (honest):** No per-classroom rooms yet; national same-hour spikes are **not** supported without sharding. Trail updates are **coalesced + rate-limited** (hostile floods inside the 100 cap are mitigated, not unlimited).

---

## Scale vision (future — not current scope)

**Go national the smart way:** stagger play across time zones and **one trail room per class**, not one map for the whole country.

| Stage | Rough scale | Infra posture (annual, order of magnitude) |
|-------|-------------|---------------------------------------------|
| Pilot | 1–30 classrooms | ~$100–600 — one paid trail VPS + Vercel |
| Regional | 50–200 schools / year | ~$1.5k–5k — rooms, Redis, small cluster |
| National (staggered) | 1k+ schools, TZ-spread peaks | ~$5k–20k — multi-tenant trail + DB |
| National (single-hour TV moment) | 10k+ concurrent | Event spike budget or managed realtime — **requires redesign** |

Do not imply unlimited live capacity in copy or UX until rooms and throttling exist.

---

## UX north star

- **Phone:** Play is the hero; dashboard and map support without eating the screen.
- **Classroom:** Teacher projects bigboard; kids use `/play` (or QR from `/join`). Banner should read **LIVE** when the wagon is on the wall.
- **Event / outdoor TV:** High contrast, map-forward, ticker + dock; minimal chrome; EMOTA branding on the **game** map top-center, not cluttering the bigboard map.

---

## What we are not building (anti-drift)

- MMO, shared wagon, or real-time co-op trail decisions.
- Account/login required to play.
- Desktop-only or keyboard-required flows.
- Replacing `GameEngine` with React, Phaser, or a full rewrite without explicit approval.
- Feature sprawl that bypasses phases in `engine.ts` or scatters balance in UI literals.
- Promising district-wide **simultaneous** live play on a single trail URL.

---

## Planning checklist (agents)

Before proposing a roadmap or large change, ask:

1. Does this help **mobile play** or **classroom spectacle** (or both)?
2. Does it stay **solo-run + optional live mirror**?
3. Does it respect **config-driven** balance and **phase boundaries**?
4. If it touches **live scale**, does it move toward **per-room sharding** and **throttled updates** — or does it assume one global room?
5. Is the diff **minimal** and consistent with existing `src/game` / `src/ui` / `src/net` / `server` split?

When in doubt, prefer **explainable teaching moments** and **event-ready polish** over novelty.

---

## Related docs

| File | Use |
|------|-----|
| `PROMPTME.md` | Machine-facing constraints and agent dos/don’ts |
| `AGENTS.md` | Repo map, skills, file locations |
| `DEPLOY.md` / `LIVE-TRAIL.md` | Vercel + trail server setup |
| `.agents/skills/emota/SKILL.md` | Paths and conventions for code changes |
