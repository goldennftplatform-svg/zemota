import { test, expect, type Page } from "@playwright/test";
import { GameEngine } from "../../src/game/engine";
import { io } from "socket.io-client";
import type { TrailFeedEvent } from "../../src/net/trailProtocol";

const origin = "http://127.0.0.1:4341";
const query = `?nosplash=1&trail=${encodeURIComponent(origin)}`;

test.beforeEach(async ({ context }) => {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === origin || url.protocol === "data:" ? route.continue() : route.abort();
  });
  await context.routeWebSocket(/.*/, (ws) => {
    if (new URL(ws.url()).host === "127.0.0.1:4341") ws.connectToServer();
    else ws.close();
  });
});

async function dismissOverlays(page: Page) {
  await expect(page.locator(".emota-trail-interstitial")).toHaveCount(0);
  for (let i = 0; i < 8; i++) {
    const close = page.locator('.emota-popup__ok, .journey-recap__close').filter({ visible: true }).first();
    if (!await close.count()) break;
    await close.click();
  }
}

async function dockFits(page: Page) {
  const box = await page.locator("#run-tools-dock").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  const screen = await page.locator("#screen").boundingBox();
  expect(screen!.y + screen!.height).toBeLessThanOrEqual(box!.y + 1);
  for (const sel of ["#supply-strip", ".supply-strip-host", "#travel-menu-mobile-hud"]) {
    const el = page.locator(sel).first();
    if (await el.count() && await el.isVisible()) {
      const rect = await el.boundingBox();
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(box!.y + 1);
    }
  }
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test(`identity setup, refresh, board and dock ${viewport.width}`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/play${query}`);
    await expect(page.locator("#run-tools-dock")).toBeHidden();
    expect(await page.locator("#run-tools-dock").evaluate((e) => getComputedStyle(e).display)).toBe("none");
    await page.locator('#screen [data-n="1"]').click();
    await page.locator("#party-wagon-input").fill(`Blue-${viewport.width}`);
    await page.locator("#party-names-input").fill("Ada, Ben, Cal, Dot, Eli");
    await page.locator('[name="wagon-color"]').selectOption("sky");
    await page.locator('[name="wagon-emblem"]').selectOption("pine");
    await page.locator('[name="ox-0"]').fill("Blue");
    await page.locator('[name="ox-1"]').fill("Belle");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.locator('#screen [data-n="1"]').click();
    await expect(page.locator(".choices--store")).toBeVisible();
    await expect(page.locator('[data-n="8"]')).toContainText("food & rest 1 day");
    if (viewport.width === 390) await dockFits(page);
    await page.screenshot({ path: `test-results/local-package/store-${viewport.width}.png` });
    await page.reload();
    await page.locator("#run-rename").click();
    await expect(page.locator('[name="wagon-color"]')).toHaveValue("sky");
    await expect(page.locator('[name="wagon-emblem"]')).toHaveValue("pine");
    await expect(page.locator('[name="ox-1"]')).toHaveValue("Belle");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const board = await context.newPage();
    await board.setViewportSize({ width: 1440, height: 1000 });
    await board.goto(`/bigboard${query}&wall=1`);
    const wagon = board.locator(`.bb-wagon[data-display-name="Blue-${viewport.width}"]`);
    await expect(wagon.locator("svg")).toHaveAttribute("aria-label", "sky canvas, Pine pennant");
    expect(await wagon.locator(".bb-wagon__icon").evaluate((el) => getComputedStyle(el).filter)).not.toContain("hue-rotate");
    expect(await wagon.locator("svg").evaluate((el) => getComputedStyle(el).getPropertyValue("--wagon-color").trim())).toBe("#89bde0");
    await page.locator('#screen [data-n="1"]').click();
    await page.locator('#screen [data-n="1"]').click();
    await page.locator('#screen [data-n="2"]').click();
    await page.locator('#screen [data-n="2"]').click();
    await page.locator('#screen [data-n="7"]').click();
    await dismissOverlays(page);
    await expect(page.locator('#screen [data-n="1"]')).toContainText("Travel (uses 1 day)");
    if (viewport.width === 390) await dockFits(page);
    await page.screenshot({ path: `test-results/local-package/camp-${viewport.width}.png` });
    expect(errors).toEqual([]);
  });
}

test("real landmark transition earns passport and one live spotlight; refresh never replays", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const e = new GameEngine();
  e.phase = "travel_menu";
  e.miles = 300;
  e.day = 5;
  e.party = ["Ada", "Ben", "Cal", "Dot", "Eli"].map((name) => ({ name, health: 100, alive: true }));
  e.inv = { oxen: 4, foodLbs: 2000, ammo: 100, moneyCents: 10000, clothes: 5, spareAxles: 2, spareWheels: 2 };
  await page.addInitScript((save) => {
    Math.random = () => 0.99; // Deterministic hazard roll; travel still runs through the real engine.
    if (!localStorage.getItem("emota_run_save_v1")) localStorage.setItem("emota_run_save_v1", save);
    localStorage.setItem("emota_display_name", "Passport Team");
  }, e.toRunSaveJSON()!);
  await page.goto(`/play${query}`);
  const board = await context.newPage();
  await board.setViewportSize({ width: 1440, height: 1000 });
  await board.emulateMedia({ reducedMotion: "reduce" });
  await board.goto(`/bigboard${query}&wall=1`);
  await expect(board.locator('.bb-wagon[data-display-name="Passport Team"]')).toBeVisible();
  await page.locator("#run-passport").click();
  await expect(page.locator(".passport-stop.is-earned")).toHaveCount(3);
  await page.keyboard.press("1");
  await expect(page.locator(".passport-stop.is-earned")).toHaveCount(3);
  await page.getByRole("button", { name: "Close passport" }).click();
  await page.locator('#screen [data-n="1"]').click();
  await expect(board.locator("#bb-popup-host")).toBeVisible();
  await expect(board.locator(".bb-popup__title")).toHaveText("TRAIL MILESTONE");
  await expect(board.locator(".bb-popup__body")).toContainText("Reached Fort Kearney");
  await board.screenshot({ path: "test-results/local-package/board-spotlight.png" });
  expect((await board.locator(".bb-popup__body").innerText()).match(/Passport Team/g)).toHaveLength(1);
  expect(await board.locator(".bb-popup__card").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await dismissOverlays(page);
  await page.reload();
  await dismissOverlays(page);
  await page.locator("#run-passport").click();
  await expect(page.locator(".passport-stop.is-earned")).toHaveCount(4);
  await page.screenshot({ path: "test-results/local-package/passport-mobile.png" });
  await board.reload();
  await expect(board.locator('.bb-wagon[data-display-name="Passport Team"]')).toBeVisible();
  await expect(board.locator("#bb-popup-host")).toBeHidden();
  await expect(board.locator('#feed-list .bb-feed__item').filter({ hasText: "Reached Fort Kearney" })).toHaveCount(1);
});

test("server sanitizes identity; repeated event and reconnect do not flood spectator", async ({ page, request }) => {
  const socket = io(origin, { transports: ["websocket"], forceNew: true });
  try {
    await new Promise<void>((resolve) => socket.on("connect", resolve));
    socket.emit("trail:hello", { displayName: "Protocol Team", clientId: "local-package-protocol" });
    socket.emit("trail:update", { miles: 304, day: 5, identity: { color: "url(evil)", emblem: "<svg>", oxNames: ["x".repeat(100), "<bad>", "extra"] } });
    const peer = await new Promise<any>((resolve) => socket.on("trail:room", (list) => {
      const p = list.find((r: any) => r.displayName === "Protocol Team");
      if (p?.identity) resolve(p);
    }));
    expect(peer.identity).toEqual({ color: "canvas", emblem: "star", oxNames: ["x".repeat(20), "bad"] });
    const before = await (await request.get(`${origin}/health`)).json();
    await page.goto(`/bigboard${query}&wall=1`);
    await expect(page.locator('.bb-wagon[data-display-name="Protocol Team"]')).toBeVisible();
    const after = await (await request.get(`${origin}/health`)).json();
    expect(after.peers).toBe(before.peers);
    const event = { kind: "milestone", text: "Protocol Team reached Fort Kearney", miles: 304, day: 5 };
    socket.emit("trail:event", event);
    await expect(page.locator("#bb-popup-host")).toBeVisible();
    await page.waitForTimeout(1100); // Server's event rate floor, not a UI readiness wait.
    socket.emit("trail:event", event);
    await expect(page.locator("#bb-popup-host")).toBeHidden({ timeout: 7000 });
    await expect(page.locator("#feed-list .bb-feed__item").filter({ hasText: "Protocol Team" }).filter({ hasText: "reached Fort Kearney" })).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.bb-wagon[data-display-name="Protocol Team"]')).toBeVisible();
    await expect(page.locator("#bb-popup-host")).toBeHidden();
    await expect(page.locator("#feed-list .bb-feed__item").filter({ hasText: "Protocol Team" }).filter({ hasText: "reached Fort Kearney" })).toHaveCount(1);
  } finally { socket.disconnect(); }
});

test("same-name live peers get independent spotlights and their own badges; source spoofing is ignored", async ({ page }) => {
  const first = io(origin, { transports: ["websocket"], forceNew: true });
  const second = io(origin, { transports: ["websocket"], forceNew: true });
  try {
    await Promise.all([first, second].map((socket) => new Promise<void>((resolve) => socket.on("connect", resolve))));
    first.emit("trail:hello", { displayName: "Twin Wagons", clientId: "local-twin-first" });
    first.emit("trail:update", { miles: 304, day: 5, identity: { color: "sky", emblem: "pine" } });
    second.emit("trail:hello", { displayName: "Twin Wagons", clientId: "local-twin-second" });
    second.emit("trail:update", { miles: 304, day: 5, identity: { color: "rose", emblem: "sun" } });
    await page.goto(`/bigboard${query}&wall=1`);
    const markers = page.locator('.bb-wagon[data-display-name="Twin Wagons"]');
    await expect(markers).toHaveCount(2);
    await expect(markers.locator('[aria-label="sky canvas, Pine pennant"]')).toHaveCount(1);
    await expect(markers.locator('[aria-label="rose canvas, Sun pennant"]')).toHaveCount(1);
    const event = { kind: "milestone", text: "Reached Fort Kearney", miles: 304, day: 5 };
    const secondAppend = new Promise<TrailFeedEvent>((resolve) => second.once("trail:feed:append", resolve));
    second.emit("trail:event", { ...event, sourcePeerId: first.id });
    expect((await secondAppend).sourcePeerId).toBe(second.id);
    await expect(page.locator("#bb-popup-host .wagon-badge")).toHaveAttribute("aria-label", "rose canvas, Sun pennant");
    const firstAppend = new Promise<TrailFeedEvent>((resolve) => first.once("trail:feed:append", resolve));
    first.emit("trail:event", { ...event, sourcePeerId: second.id });
    expect((await firstAppend).sourcePeerId).toBe(first.id);
    await expect(page.locator("#bb-popup-host .wagon-badge")).toHaveAttribute("aria-label", "sky canvas, Pine pennant");
    await expect(page.locator("#feed-list .bb-feed__item").filter({ hasText: "Twin Wagons" })).toHaveCount(2);
    await page.reload();
    await expect(markers).toHaveCount(2);
    await expect(page.locator("#bb-popup-host")).toBeHidden();
    await expect(page.locator("#feed-list .bb-feed__item").filter({ hasText: "Twin Wagons" })).toHaveCount(2);
  } finally {
    first.disconnect();
    second.disconnect();
  }
});

test("QR sign preserves local trail and opens board as a spectator popup", async ({ page, context, request }) => {
  await page.goto(`/join${query}`);
  const gameLink = page.getByRole("link", { name: "Open game", exact: true });
  expect(new URL((await gameLink.getAttribute("href"))!).searchParams.get("trail")).toBe(origin);
  await expect(page.locator("#join-play-qr")).toBeVisible();
  expect(await page.locator("#join-play-qr").evaluate((canvas: HTMLCanvasElement) => new Set(canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data).size)).toBeGreaterThan(2);
  const before = await (await request.get(`${origin}/health`)).json();
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "Open bigboard", exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(new URL(popup.url()).searchParams.get("trail")).toBe(origin);
  await expect(popup.locator(".bb-live--ok")).toBeVisible();
  const after = await (await request.get(`${origin}/health`)).json();
  expect(after.peers).toBe(before.peers);
  await popup.close();
});
