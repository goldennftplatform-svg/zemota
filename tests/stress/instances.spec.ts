/**
 * EMOTA — 30-browser-context stress run (manual / post-deploy).
 *
 * Do NOT rely on this until your server exposes MULTIPLAYER_CAP=50 and the client is deployed.
 *
 * Prereqs:
 *   npm run build && npx playwright install chromium
 *   Start app: npm run preview (default base http://127.0.0.1:4173) OR set PLAYWRIGHT_BASE_URL
 * Optional trail server: npm run server (game works without it)
 *
 * Run:
 *   npm run test:stress
 *
 * Goal per instance: drive a run with random menu clicks until the dashboard Party tile
 * shows at most 1 living member (4/5 dead) or the game reaches game over / title after wipeout.
 */

import { test, expect, type Browser, type Page } from "@playwright/test";

const INSTANCE_COUNT = 30;
const MAX_STEPS_PER_INSTANCE = 2200;
const STEP_DELAY_MS = 30;

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

function targetMet(alive: number | undefined): boolean {
  if (alive === undefined) return false;
  return alive <= 1;
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
  _index: number,
): Promise<{ steps: number; reason: string }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const url = new URL("./", baseURL.endsWith("/") ? baseURL : `${baseURL}/`);
  await page.goto(url.href, { waitUntil: "domcontentloaded" });

  let steps = 0;
  let reason = "max_steps";

  try {
    for (; steps < MAX_STEPS_PER_INSTANCE; steps++) {
      if (await dismissPopupIfAny(page)) {
        await page.waitForTimeout(STEP_DELAY_MS);
        continue;
      }

      const party = await readPartyAlive(page);
      if (party && targetMet(party.alive)) {
        reason = `party_alive_${party.alive}_of_${party.cap}`;
        break;
      }

      const bodyText = await page.locator("#screen").innerText().catch(() => "");
      if (/the trail wins/i.test(bodyText)) {
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
        await page.waitForTimeout(STEP_DELAY_MS);
        continue;
      }

      const input = page.locator("#screen input.line-input");
      if (await input.isVisible().catch(() => false)) {
        await input.press("Enter");
        await page.waitForTimeout(STEP_DELAY_MS);
        continue;
      }

      const phase = await readScreenPhase(page);
      if (phase === "Hunt" || phase === "Games" || phase === "Build") {
        await page.keyboard.press("1");
        await page.waitForTimeout(STEP_DELAY_MS);
        continue;
      }

      await page.keyboard.press(String(Math.min(9, Math.max(1, 1 + Math.floor(Math.random() * 9)))));
      await page.waitForTimeout(STEP_DELAY_MS);
    }

    const finalParty = await readPartyAlive(page);
    if (finalParty && targetMet(finalParty.alive)) {
      reason = `party_alive_${finalParty.alive}_of_${finalParty.cap}`;
    }
  } finally {
    await context.close();
  }

  return { steps, reason };
}

test.describe("LAN-scale stress (30 instances)", () => {
  test("30 contexts auto-play until ≤1 party alive (or wipeout)", async ({ browser, baseURL }) => {
    expect(browser).toBeTruthy();
    const origin = baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

    const results = await Promise.all(
      Array.from({ length: INSTANCE_COUNT }, (_, i) => runOneInstance(browser!, origin, i)),
    );

    const summary = results.map((r, i) => `instance ${i + 1}: ${r.reason} (${r.steps} steps)`).join("\n");
    console.log(summary);

    const ok = results.filter(
      (r) => r.reason.startsWith("party_alive_") || r.reason === "game_over_screen",
    );
    expect(
      ok.length,
      `expected ≥24/30 to hit heavy losses or game over; got ${ok.length}/${INSTANCE_COUNT}\n${summary}`,
    ).toBeGreaterThanOrEqual(24);
  });
});
