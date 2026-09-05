# EMOTA Package Handoff

No commits, pushes, deployments, or production requests were made. The initial tracked worktree was clean. Existing untracked `tmp-*` QA folders were preserved.

## Implemented

- Names/Restart honor `hidden`. Names/Passport/Restart occupy a reserved flex row, without measured floating offsets.
- Fixed the gift-perk replacement character. New feed bodies omit the wagon name; older persisted name-prefixed bodies are normalized and duplicate feed rows are suppressed.
- Wagon canvas palette, illustrated pennant and two ox names are editable at setup and through Names, saved in v1 run snapshots, and allowlisted/bounded on the server and receiving clients. Local map popup, passport, and live-board marker share a local SVG illustration. Old saves get default identity.
- Passport shows 13 landmark stamps, visited/unvisited progress and existing landmark blurbs. Stamps derive from saved monotonic mileage, so old saves need no fabricated stamp history. River stamps mean arrival, not crossing success.
- Existing live victory/loss spotlights now include landmark celebrations. Queue holds at most four pending events, allows one pending slot per source peer and a 30-second peer cooldown, expires stale events after 30 seconds, deduplicates semantic events with bounded memory, and never plays feed-sync history. The server derives `sourcePeerId` from the registered socket ID, ignoring client-submitted source IDs. Queue keys, feed deduplication, and badge lookup use that ID, so identical display names do not interfere. Reduced-motion CSS and polite spectator status semantics are included. No shared game decisions.
- Additional questions are automatically imported from JSON and validated during builds. Exactly four distinct nonempty options are required, matching the existing shuffle/game contract; two/three-option content is rejected before finalization. See `QUESTION-CONTENT.md`. The extra content file is empty until reviewed questions arrive; no historical facts were invented.
- Fixed a connection-order race that lost the first progress/identity update after refresh, plus TypeScript failures encountered during verification. Removed an undefined obsolete `hitNudgePad` call that could crash touch dragging in the hunt.
- QR sign links/codes preserve the resolved trail origin.

## Verification

Passed on the local Windows environment:

| Command | Result |
| --- | --- |
| `npm run build` | Content validation + Vite production build pass |
| `npx tsc --noEmit` | Client typecheck pass |
| `npx tsc --project tsconfig.node.json --noEmit` | Server typecheck pass |
| `npm run test:package` | 7 tests pass; 250 synthetic entries use the actual imported JSON builder/validation/finalization/shuffle path, then all 316 seen IDs round-trip through engine saves |
| `npm run test:integration` | 6 Chromium tests pass in 25.1 seconds against a fresh local server after review fixes |
| `git diff --check` | No whitespace errors |

Integration uses the built app and a Playwright-owned server at `http://127.0.0.1:4341`. Game entry is explicitly `http://127.0.0.1:4341/play?nosplash=1&trail=http%3A%2F%2F127.0.0.1%3A4341`; board and QR sign use the same explicit trail. HTTP and WebSocket routes block nonlocal traffic, including production sockets. Each invocation uses a separate temporary trail data directory under `%TEMP%/opencode`. Playwright does not reuse existing servers and tears down its own server.

Coverage: 390x844 and desktop setup/refresh, board identity and computed canvas color, computed hidden title dock, store/camp nonoverlap, a real engine travel transition across Fort Kearney, passport earning/resume, keyboard isolation while passport is open, milestone spotlight, reduced motion, duplicate append and sync suppression, bounded server identity, spectator peer count, and QR new-tab handling. A two-client same-name integration test verifies independent queued spotlights, correct distinct badges, ignored source-ID spoofing, and preservation of both feed rows without replay after board refresh. Unit tests also cover source cooldowns across renames, persisted source-ID retention/bounds and legacy rows. Travel hazards use a deterministic random roll in the landmark test; the test still clicks the real travel choice, not the simulation hook.

Screenshots are in ignored `test-results/local-package/`: `store-390.png`, `store-1440.png`, `camp-390.png`, `camp-1440.png`, `passport-mobile.png`, `board-spotlight.png`. Failed runs retain Playwright traces; a fresh passing run clears previous failure artifacts.

## Limits And Wiring

- Chromium desktop and emulated viewport only; not real iOS/Safari or Android hardware. External fonts are blocked by local-only routing, so screenshots exercise the fallback font. No 100-wagon stress test or full end-to-end Oregon victory run was performed in this package.
- Live events remain the existing client-reported, server-rate-limited honor-system protocol, not authoritative gameplay proof. `sourcePeerId` is server-generated and stable for the socket connection, matching the live roster's `TrailPeer.id`; reconnecting creates a new peer ID. Persisted events retain their original bounded ID. Only legacy feed without an ID falls back to a name key/lookup; an unmatched source ID never borrows another same-name wagon's badge. Feed history never becomes a celebration on connection.
- Previously truncated saves cannot recover seen IDs already lost. Missing fields default safely; retired question IDs are discarded. New-cycle repeats still begin only after the loaded bank is exhausted.
- `vercel.json` builds `dist`, rewrites `/play`, `/bigboard`, `/join`, `/event`, and maps `/trail.json` to `api/trail.js`. The API reads runtime `VITE_TRAIL_SERVER_URL`, falling back to `https://emota-trail.onrender.com`. Client query `?trail=` takes priority. No live deployment settings were inspected.
- Both static UI and trail server must be deployed for live identity and source-keyed fairness: an old server drops the identity field and does not assign feed source IDs. Solo identity/passport saves do not need the server.
- `render.yaml` currently specifies a free plan without a persistent disk. That conflicts with the vision's always-on event-server guidance; sleep and nonpersistent trail archives remain deployment risks. Blueprint changes/deployment are left to the parent.
- QR origin preservation is implemented, but a QR pointing at `127.0.0.1` is only a test artifact. Real phone events require a reachable shared trail URL.

## Exact Files

Modified:

```text
index.html
package.json
server/index.ts
server/trailDisk.ts
src/bigboard/bigboard.css
src/bigboard/main.ts
src/css/run-tools.css
src/game/chance.ts
src/game/engine.ts
src/game/trivia.ts
src/game/types.ts
src/join/main.ts
src/main.ts
src/net/multiplayer.ts
src/net/socketClientOpts.ts
src/net/trailProtocol.ts
src/net/trailSanitize.ts
src/style.css
src/ui/dashboard.ts
src/ui/overhead.ts
src/ui/playHud.ts
src/ui/trailMapPopup.ts
```

Added:

```text
docs/PACKAGE-VERIFICATION.md
docs/QUESTION-CONTENT.md
playwright.local.config.ts
scripts/validate-content.ts
src/bigboard/spotlights.ts
src/css/wagon-passport.css
src/data/triviaAdditional.json
src/game/triviaValidation.ts
src/game/wagonIdentity.ts
src/ui/trailPassport.ts
src/ui/wagonIdentity.ts
tests/local/package.spec.ts
tests/package.test.ts
```
