# EzraMOTA (EMOTA) — agent context

This repo is **EMOTA** — *Ezra Meeker’s Oregon Trail Adventure* — a Vite + TypeScript browser game with an optional Socket.IO server. It is **not** the Pizza Comrades Upsizer project.

Agents should treat this file and **`.agents/skills/`** as the source of truth for how to work here.

---

## Read order

1. **`.agents/skills/emota/SKILL.md`** — Project map, real file paths, and how to interpret generic OpusGameLabs skills. Read this **first** for any code change.
2. **Task-specific skill** — e.g. `improve-game`, `add-feature`, `game-qa`, `design-game`, `game-audio` — for checklists and process, **after** mapping paths through the `emota` skill.

---

## Bundled skills vs this repo

| Skill folder | Use on EMOTA |
|--------------|----------------|
| `emota` | **Always** — local project adapter. |
| `improve-game`, `qa-game`, `add-feature`, `make-game` | **Yes** — adapt steps to `engine.ts` / `config.ts` / `types.ts` (see `emota` skill). |
| `game-architecture` | **Principles yes** — centralized config, layers; **paths no** (no `EventBus`/`Game.js` here). |
| `game-qa`, `game-qa/*` | **Yes** for test mindset; prefer Vitest/playwright only if the project adds them. |
| `game-audio`, `add-audio` | **When adding sound** — new code should stay modular. |
| `phaser`, `threejs-game` | **Only** if explicitly porting minigames or adding Phaser/Three — default UI is DOM + canvas in `src/ui/`. |
| `meshyai`, `worldlabs`, `promo-video`, `fetch-tweet`, etc. | **Optional** — marketing/assets pipelines, not core trail gameplay. |

---

## Where gameplay code lives

| Area | Files |
|------|--------|
| **Phases / screen / trail logic** | `src/game/engine.ts` |
| **Config / tuning** | `src/game/config.ts` |
| **Types / store** | `src/game/types.ts`, `src/game/store.ts` |
| **Map / landmarks** | `src/game/map.ts` |
| **Encounters (text choices)** | `src/game/encounters.ts` |
| **Chance games** | `src/game/chance.ts` |
| **Trivia** | `src/game/trivia.ts` |
| **Land claim** | `src/game/landClaim.ts` |
| **Hunt minigame (overhead canvas)** | `src/ui/overhead.ts` — wired from `src/main.ts`, phases in `engine.ts` |
| **Land vista / minimap UI** | `src/ui/landView.ts`, `src/ui/trailMinimap.ts` |
| **Dashboard sidebar** | `src/ui/dashboard.ts` |
| **App shell / render loop** | `src/main.ts` |
| **Global UI** | `index.html`, `src/style.css` |
| **Multiplayer strip + client** | `src/net/multiplayer.ts` |
| **Server** | `server/index.ts` |

---

## Product direction (backlog hints)

When refactoring or extending systems, prefer **explainable** mechanics, **config-driven** numbers, and **clear phase boundaries** in `GameEngine`. Hunt overhaul ideas (species, ammo, zones, carry cap) remain design goals — see historical notes in the `emota` skill and `engine.ts` / `overhead.ts` for current behavior.

---

## Repo hygiene (future-proof)

- Keep **balance and copy** out of ad-hoc literals where possible — use `config.ts` and typed shapes in `types.ts`.
- **`npm run build`** should pass before merging substantive changes.
- New features: touch **`engine`** vs **`ui`** vs **`net`** deliberately; avoid circular imports.
