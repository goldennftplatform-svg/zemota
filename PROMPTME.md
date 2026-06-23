# PROMPTME.md — EMOTA (Ezra Meeker’s Oregon Trail Adventure)

Machine-facing context for AI agents working in this repo. Human docs: `README.md`, `AGENTS.md`, `.agents/skills/emota/SKILL.md`.

## System role

You are helping ship **EMOTA** — a browser Oregon Trail–style game for **Hop King / Meeker Mansion** audiences. **~99% of players are on phones.** Optimize for **tap, large type, no keyboard, minimal scroll**, not desktop CRT nostalgia.

**Leadership alignment (h wonder / PROMPTME philosophy):**

- Be **intentional** — encode tribal knowledge here, not scattered guesses.
- **Mobile-first, easy-read** — every flow must work one-handed on a phone.
- **No signup wall** — device-local save (`localStorage`); refresh resumes in-progress runs.
- **Honor-system commerce** — gift shop opens `MEEKER_GIFT_SHOP_URL` (Hop King Meeker-branded collection); never fake payments in-game.
- **Security** — do not commit secrets; trail server optional; client never embeds API keys.

## Technology stack

| Layer | Stack |
|-------|--------|
| Client | Vite 6, TypeScript, DOM UI, canvas minigames (`src/ui/overhead.ts`) |
| State | `GameEngine` in `src/game/engine.ts` — no React, no Phaser |
| Styles | `src/style.css`, `src/css/easy-read.css`, `src/css/mobile-play.css`, `html.emota-mobile` |
| Save | `src/game/runSave.ts` — auto-resume after refresh |
| Optional server | `server/index.ts` — Socket.IO trail + scores; `/bigboard` spectator |

## Core product flows (mobile)

1. **Land** → skip boot on mobile → auto-resume if saved → else **title**
2. **Title** → **Play now** (choice 1) → party name + wagon name → profile → **store (tap to buy)** → trail
3. **Camp / travel** → sticky bottom choices; sidebar only when it helps (on trail)
4. **Gift shop** → choice opens Hop King URL in new tab; claim is honor-system food/rest

## Example interactions

**Good:** “Make store Leave button sticky on mobile and hide land vista below 900px.”  
**Good:** “Shorten title coach for easy-read; keep engine rules in `engine.ts`.”  
**Avoid:** “Add Redux” or “Rewrite in Next.js” — out of scope.  
**Avoid:** “Require account login before play” — conflicts with product vision.

## Important constraints

- **`engine.ts`** owns phases and rules; **`main.ts`** owns DOM render loop.
- **`MEEKER_GIFT_SHOP_URL`** lives in `src/game/config.ts` only.
- Multiplayer strip is **hidden** on main client; bigboard is separate entry.
- Tests/build: `npm run build` after gameplay or UI changes.
- Commits: user expects **commit + push** to `goldennftplatform-svg/zemota` when asked.

## Best practices for AI agents

1. Read `.agents/skills/emota/SKILL.md` before other game skills.
2. Prefer **CSS + small `main.ts` hooks** for mobile UX over new frameworks.
3. Touch targets ≥ **48px** (we target ~68px on `html.emota-mobile`).
4. When changing phases, update `runSave.ts` labels if player-facing.
5. Keep diffs minimal; match existing VT323 / green CRT aesthetic on desktop.

## Integration patterns

- **Display name (leaderboard):** `getDisplayName()` / `setDisplayName()` in `src/net/multiplayer.ts`; edited on `party_names` screen.
- **Deploy:** Vercel from `dist/`; `vercel.json` rewrites `/bigboard`.
- **Assets:** `public/art/` — drunkcowboy sprites, USA map under minimap/bigboard.

## Security

- Never commit `.env`, tokens, or `emota_*` overrides with secrets.
- Gift shop is external HTTPS only (`thehopking.com`).
- Trail stress hooks (`window.__emotaTrailStress`) are dev/test only.
