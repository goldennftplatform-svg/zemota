/**
 * EMOTA — fill the **bigboard** (wagons + feed + leaderboard) with simulated travelers.
 *
 * ### Fastest: 30 “people” on the wall (no Playwright)
 *   npm run build && npm run server
 *   Open http://127.0.0.1:3333/bigboard
 *   npm run bigboard:simulate
 * Sim clients pulse ~2.4s with deaths / river / milestones / occasional victory+wipeout (bigboard popups). Faster room: `npm run bigboard:simulate:fast` or `--interval-ms=600`. More wagons: `npm run trail:bots:local -- --count=60`
 *
 * ### Playwright hammer — 30 real Chromium tabs + stress hook (default base URL :3333)
 *   npm run build && npm run server
 *   npx playwright install chromium   # once
 *   npm run test:stress:hammer
 * Uses `?trail=http://127.0.0.1:3333` automatically on local server. Deployed: set PLAYWRIGHT_BASE_URL + PLAYWRIGHT_TRAIL_ORIGIN.
 *
 * ### Gameplay auto-play (not bigboard-focused)
 *   npm run test:stress
 *
 * `STRESS_INSTANCES` caps at MULTIPLAYER_CAP (100). STRESS_HOLD_MS keeps hammer tabs open longer after the step loop.
 * “Stress hook missing” → old bundle; use fresh `npm run build` + server, or PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 for preview.
 */

import { test, expect, type Browser, type Page } from "@playwright/test";
import { MULTIPLAYER_CAP, TOTAL_TRAIL_MILES } from "../../src/game/config";

const DEFAULT_GAMEPLAY_INSTANCES = 30;
/** Default concurrent “travelers” for hammer → bigboard wall (wagons + feed + scores). */
const DEFAULT_HAMMER_INSTANCES = 30;
const MAX_STEPS_GAMEPLAY = 2200;
const MAX_STEPS_HAMMER = 3500;
const STEP_GAMEPLAY_MS = 30;
const STEP_HAMMER_MS = Math.max(8, parseInt(process.env.STRESS_STEP_MS ?? "15", 10) || 15);

function stressHoldOpenMs(): number {
  const n = parseInt(process.env.STRESS_HOLD_MS ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(600_000, n) : 0;
}

function gameplayInstanceCount(): number {
  const n = parseInt(process.env.STRESS_INSTANCES ?? String(DEFAULT_GAMEPLAY_INSTANCES), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(MULTIPLAYER_CAP, n) : DEFAULT_GAMEPLAY_INSTANCES;
}

function hammerInstanceCount(): number {
  const n = parseInt(process.env.STRESS_INSTANCES ?? String(DEFAULT_HAMMER_INSTANCES), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(MULTIPLAYER_CAP, n) : DEFAULT_HAMMER_INSTANCES;
}

/** `npm run server` serves game + Socket.IO on :3333 — no extra env for local hammer. */
function defaultTrailOriginFromGameBase(gameBase: string): string | undefined {
  try {
    const base = gameBase.endsWith("/") ? gameBase : `${gameBase}/`;
    const u = new URL(base);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && port === "3333") {
      return `${u.protocol}//${u.host}`;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function resolveStressTrailOrigin(gameBase: string): string | undefined {
  const ex =
    process.env.PLAYWRIGHT_TRAIL_ORIGIN?.trim().replace(/\/$/, "") ||
    process.env.EMOTA_STRESS_TRAIL?.trim().replace(/\/$/, "");
  if (ex) return ex;
  return defaultTrailOriginFromGameBase(gameBase);
}

/** Game URL; `trailOrigin` forces `?trail=` so the page joins the same Socket.IO room as the bigboard. */
function buildGameEntryUrl(baseURL: string, trailOrigin?: string): string {
  const base = new URL("./", baseURL.endsWith("/") ? baseURL : `${baseURL}/`);
  const trail =
    trailOrigin?.trim().replace(/\/$/, "") ||
    process.env.PLAYWRIGHT_TRAIL_ORIGIN?.trim()?.replace(/\/$/, "") ||
    process.env.EMOTA_STRESS_TRAIL?.trim()?.replace(/\/$/, "");
  if (trail) {
    base.searchParams.set("trail", trail);
  }
  base.searchParams.set("nosplash", "1");
  return base.href;
}

async function readPartyAlive(page: Page): Promise<{ alive: number; cap: number } | null> {
  return page.evaluate(() => {
    const labs = [...document.querySelectorAll(".dash-tile__lab")];
    const partyLab = labs.find((e) => e.textContent?.trim() === "Party");
    if (!partyLab?.parentElement) return null;
    const valEl = partyLab.parentElement.querySelector(".dash-tile__val");
    const raw = valEl?.textContent?.trim() ?? "";
    const m = raw.match(/^(\d+)\s*\/\s*(\d+)/);
    if (!m) return null;
    return { alive: parseInt(m[1]!, 10), cap: parseInt(m[2]!, 10) };
  });
}

async function readScreenPhase(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const chip = document.querySelector(".dash-chip");
    return chip?.textContent?.trim() ?? null;
  });
}

const PHASE_IGNORE_DEATH_TILE: Set<string> = new Set([
  "Party",
  "Training",
  "Quiz",
  "Profession",
  "Supplies",
]);

const STRESS_LANDMARKS = [
  "Independence",
  "Kansas River",
  "Fort Kearny",
  "Chimney Rock",
  "Fort Laramie",
  "South Pass",
  "Fort Boise",
  "The Dalles",
] as const;

/** Synthetic miles / party / scores / feed lines for the live bigboard (via `main.ts` hook). */
async function stressSimulateTrailPulse(page: Page, index: number, steps: number): Promise<void> {
  const miles = Math.min(
    TOTAL_TRAIL_MILES,
    Math.floor(((steps * 6 + index * 47) % (TOTAL_TRAIL_MILES + 400)) * 0.94),
  );
  const day = 1 + Math.min(68, Math.floor(steps / 12) + (index % 8));
  const landmark = STRESS_LANDMARKS[(steps + index) % STRESS_LANDMARKS.length]!;
  const alive = Math.max(1, 5 - Math.floor((steps / 180 + index) % 4));
  const phase = steps % 110 < 55 ? "travel_menu" : "trail_event";
  const botName = `Stress-${String(1000 + index).slice(-4)}`;
  const doScore = steps === 9 || steps % 28 === 0;
  const doFeed = steps % 48 === 0;
  await page.evaluate(
    ({
      miles: m,
      day: d,
      landmark: lm,
      alive: a,
      phase: ph,
      botName: bn,
      doScore: ds,
      doFeed: df,
    }) => {
      const w = window as unknown as {
        __emotaTrailStress?: {
          applySimulationStep: (o: Record<string, unknown>) => void;
          submitScore: (name: string, score: number) => void;
          emitTrailFeed: (kind: string, text: string, miles?: number, day?: number) => void;
        };
      };
      w.__emotaTrailStress?.applySimulationStep?.({
        miles: m,
        day: d,
        phase: ph,
        landmark: lm,
        alive: a,
        partyCap: 5,
        profileTitle: "Sim wagon",
        party: [
          { name: "Rider", health: 80, alive: a >= 1 },
          { name: "Scout", health: 72, alive: a >= 2 },
          { name: "Cook", health: 64, alive: a >= 3 },
          { name: "Smith", health: 56, alive: a >= 4 },
          { name: "Doc", health: 48, alive: a >= 5 },
        ],
      });
      if (ds) w.__emotaTrailStress?.submitScore?.(bn, 1100 + m + d * 3);
      if (df) w.__emotaTrailStress?.emitTrailFeed?.("milestone", `${bn} · ${m} mi · ${lm}`, m, d);
    },
    {
      miles,
      day,
      landmark,
      alive,
      phase,
      botName,
      doScore,
      doFeed,
    },
  );
}

function targetMetHeavyLoss(
  party: { alive: number; cap: number },
  phaseChip: string | null,
  bodyText: string,
): boolean {
  if (party.cap < 2) return false;
  if (phaseChip && PHASE_IGNORE_DEATH_TILE.has(phaseChip)) return false;
  if (party.alive === 1) return true;
  if (party.alive === 0 && /the trail wins|game over|the end/i.test(bodyText)) return true;
  return false;
}

async function dismissPopupIfAny(page: Page): Promise<boolean> {
  const ok = page.locator(".emota-popup__ok");
  if (await ok.isVisible().catch(() => false)) {
    await ok.click();
    return true;
  }
  return false;
}

async function runOneInstance(
  browser: Browser,
  baseURL: string,
  index: number,
  opts: {
    maxSteps: number;
    stepMs: number;
    quitOnGameOver?: boolean;
    holdOpenMs?: number;
    /** Push synthetic trail + scores for bigboard (hammer). */
    simulateTrail?: boolean;
    /** Same origin the bigboard uses (`?trail=`). */
    trailOrigin?: string;
  },
): Promise<{ steps: number; reason: string }> {
  const quitOnGameOver = opts.quitOnGameOver !== false;
  const holdOpenMs = Math.max(0, opts.holdOpenMs ?? 0);
  const simulateTrail = opts.simulateTrail === true;
  const context = await browser.newContext();
  await context.addInitScript(
    ({ idx }) => {
      const id = `stress-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("emota_trail_client_id", id.slice(0, 36));
      localStorage.setItem("emota_display_name", `Stress-${String(1000 + idx).slice(-4)}`);
    },
    { idx: index },
  );
  const page = await context.newPage();
  const entry = buildGameEntryUrl(baseURL, opts.trailOrigin);
  await page.goto(entry, { waitUntil: "domcontentloaded" });
  if (simulateTrail) {
    await page
      .waitForFunction(
        () =>
          typeof (window as unknown as { __emotaTrailStress?: { applySimulationStep?: unknown } })
            .__emotaTrailStress?.applySimulationStep === "function",
        { timeout: 25_000 },
      )
      .catch(() => {
        throw new Error(
          "Stress hook missing: deploy a build that includes window.__emotaTrailStress (see src/main.ts), or you opened an old cached bundle.",
        );
      });
    await page.waitForTimeout(600);
  }

  let steps = 0;
  let reason = "max_steps";

  try {
    for (; steps < opts.maxSteps; steps++) {
      if (await dismissPopupIfAny(page)) {
        await page.waitForTimeout(opts.stepMs);
        continue;
      }

      if (simulateTrail && steps > 0 && steps % 9 === 0) {
        await stressSimulateTrailPulse(page, index, steps);
      }

      const bodyText = await page.locator("#screen").innerText().catch(() => "");
      const phaseChip = await readScreenPhase(page);
      const party = await readPartyAlive(page);
      if (
        quitOnGameOver &&
        party &&
        targetMetHeavyLoss(party, phaseChip, bodyText)
      ) {
        reason = `party_alive_${party.alive}_of_${party.cap}`;
        break;
      }

      if (quitOnGameOver && /the trail wins/i.test(bodyText)) {
        reason = "game_over_screen";
        break;
      }

      const choices = page.locator("#screen .choices li");
      const n = await choices.count();
      if (n > 0) {
        const labels = await Promise.all(
          [...Array(Math.min(n, 9))].map((_, i) => choices.nth(i).innerText().catch(() => "")),
        );
        let pickIdx = Math.floor(Math.random() * n);

        if (/new game/i.test(bodyText)) {
          const skip = labels.findIndex((t) => /skip training/i.test(t));
          if (skip >= 0) pickIdx = skip;
        }
        if (/general store/i.test(bodyText)) {
          const leave = labels.findIndex((t) => /(^|\n)\s*7\s*·|leave/i.test(t));
          if (leave >= 0) pickIdx = leave;
        }

        await choices.nth(pickIdx).click();
        await page.waitForTimeout(opts.stepMs);
        continue;
      }

      const input = page.locator("#screen input.line-input");
      if (await input.isVisible().catch(() => false)) {
        await input.press("Enter");
        await page.waitForTimeout(opts.stepMs);
        continue;
      }

      const phase = phaseChip;
      if (phase === "Hunt" || phase === "Games" || phase === "Build") {
        await page.keyboard.press("1");
        await page.waitForTimeout(opts.stepMs);
        continue;
      }

      await page.keyboard.press(String(Math.min(9, Math.max(1, 1 + Math.floor(Math.random() * 9)))));
      await page.waitForTimeout(opts.stepMs);
    }

    const finalBody = await page.locator("#screen").innerText().catch(() => "");
    const finalPhase = await readScreenPhase(page);
    const finalParty = await readPartyAlive(page);
    if (
      quitOnGameOver &&
      finalParty &&
      targetMetHeavyLoss(finalParty, finalPhase, finalBody)
    ) {
      reason = `party_alive_${finalParty.alive}_of_${finalParty.cap}`;
    }
    if (holdOpenMs > 0) {
      await page.waitForTimeout(holdOpenMs);
    }
  } finally {
    await context.close();
  }

  return { steps, reason };
}

/** Shared trail-room flood for hammer + event tests (bigboard + leaderboard). */
async function runTrailEventHammer(browser: Browser, baseURL: string | undefined): Promise<void> {
  expect(browser).toBeTruthy();
  const origin = baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3333";
  const trail = resolveStressTrailOrigin(origin);
  test.skip(
    !trail,
    "Set PLAYWRIGHT_TRAIL_ORIGIN (tunnel / trail host), or run against http://127.0.0.1:3333 with `npm run build && npm run server`.",
  );

  const count = hammerInstanceCount();

  const holdMs = stressHoldOpenMs();
  console.log(
    `Event / hammer: ${count} concurrent travelers (cap ${MULTIPLAYER_CAP}) → ${origin} ?trail=${trail}`,
  );
  console.log(
    `Step ${STEP_HAMMER_MS}ms (STRESS_STEP_MS); hold +${holdMs}ms (STRESS_HOLD_MS). Scores pulse often → bigboard TRAIL LEADERBOARD fills. No early quit on game over.`,
  );

  const results = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      runOneInstance(browser!, origin, i + 100, {
        maxSteps: MAX_STEPS_HAMMER,
        stepMs: STEP_HAMMER_MS,
        quitOnGameOver: false,
        holdOpenMs: holdMs,
        simulateTrail: true,
        trailOrigin: trail,
      }),
    ),
  );

  const summary = results.map((r, i) => `bot ${i + 1}: ${r.reason} (${r.steps} steps)`).join("\n");
  console.log(summary);

  expect(results.length).toBe(count);
  const anyProgress = results.filter((r) => r.steps > 8).length;
  console.log(`Bots with >8 steps: ${anyProgress}/${count}`);
}

test.describe("Stress (gameplay)", () => {
  test("contexts auto-play until heavy losses or wipeout", async ({ browser, baseURL }) => {
    expect(browser).toBeTruthy();
    const origin = baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3333";
    const count = gameplayInstanceCount();

    const results = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        runOneInstance(browser!, origin, i, {
          maxSteps: MAX_STEPS_GAMEPLAY,
          stepMs: STEP_GAMEPLAY_MS,
        }),
      ),
    );

    const summary = results.map((r, i) => `instance ${i + 1}: ${r.reason} (${r.steps} steps)`).join("\n");
    console.log(summary);

    if (process.env.STRESS_SKIP_GAME_ASSERT === "1") {
      console.log("STRESS_SKIP_GAME_ASSERT=1 — skipping outcome assertion.");
      return;
    }

    const ok = results.filter(
      (r) => r.reason.startsWith("party_alive_") || r.reason === "game_over_screen",
    );
    const need = Math.max(1, Math.floor(count * 0.8));
    expect(
      ok.length,
      `expected ≥${need}/${count} to hit heavy losses or game over; got ${ok.length}\n${summary}`,
    ).toBeGreaterThanOrEqual(need);
  });
});

test.describe("Live trail server hammer (event simulation)", () => {
  test("hammer: flood Socket.IO + bigboard with N wagons", async ({ browser, baseURL }) => {
    await runTrailEventHammer(browser!, baseURL);
  });

  test("event: party wall — 30–100 concurrent travelers (STRESS_INSTANCES)", async ({
    browser,
    baseURL,
  }) => {
    await runTrailEventHammer(browser!, baseURL);
  });
});
