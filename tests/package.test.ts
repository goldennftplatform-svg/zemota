import { test } from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/game/engine";
import { TRIVIA_BANK, buildTriviaBank, pickTriviaForDay } from "../src/game/trivia";
import additional from "../src/data/triviaAdditional.json" with { type: "json" };
import { validateTriviaBank, restoreSeenTrivia } from "../src/game/triviaValidation";
import { sanitizeWagonIdentity } from "../src/game/wagonIdentity";
import { passportStops } from "../src/ui/trailPassport";
import { SpotlightQueue } from "../src/bigboard/spotlights";
import { feedBody, sanitizeTrailFeedList } from "../src/net/trailSanitize";
import { loadPersistedFeed, persistFeed } from "../server/trailDisk";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";

test("250 imported data-only additions are finalized, shuffled, and retain every seen ID through an engine save", () => {
  const original = [...TRIVIA_BANK];
  const originalAdditionalLength = additional.length;
  const extra = Array.from({ length: 250 }, (_, i) => ({ id: `synthetic_${i}`, q: `Test fixture ${i}?`, choices: ["Test A", "Test B", "Test C", "Test D"], answer: i % 4, teach: "Synthetic test content, not history.", endgameWeight: 1 }));
  try {
    // Exercise the same imported JSON object and builder used by app startup/build validation.
    (additional as unknown[]).push(...JSON.parse(JSON.stringify(extra)));
    const expanded = buildTriviaBank();
    assert.deepEqual(expanded, buildTriviaBank(), "shuffle must be deterministic");
    const finalized = expanded.slice(original.length);
    assert.equal(finalized.length, 250);
    for (const [i, row] of finalized.entries()) {
      assert.equal(row.choices.length, 4);
      assert.equal(row.choices[row.answer], extra[i].choices[extra[i].answer]);
    }
    assert.ok(finalized.some((row, i) => row.choices.join() !== extra[i].choices.join()), "must actually shuffle");
    TRIVIA_BANK.splice(0, TRIVIA_BANK.length, ...expanded);
    const engine = new GameEngine();
    engine.phase = "travel_menu";
    for (let i = 0; i < TRIVIA_BANK.length; i++) {
      const item = pickTriviaForDay(1, 50, engine.seenTriviaIds);
      assert.ok(!engine.seenTriviaIds.has(item.id));
      engine.seenTriviaIds.add(item.id);
    }
    const restored = new GameEngine();
    assert.ok(restored.applyRunSaveJSON(engine.toRunSaveJSON()!));
    assert.equal(restored.seenTriviaIds.size, original.length + 250);
    assert.deepEqual(restored.seenTriviaIds, engine.seenTriviaIds);
    assert.ok(restored.applyRunSaveJSON(JSON.stringify({ v: 1, phase: "travel_menu", seenTriviaIds: [extra[0].id, extra[0].id, "retired", null] })));
    assert.deepEqual([...restored.seenTriviaIds], [extra[0].id]);
    assert.equal(restoreSeenTrivia(undefined, TRIVIA_BANK).size, 0);
  } finally {
    additional.splice(originalAdditionalLength);
    TRIVIA_BANK.splice(0, TRIVIA_BANK.length, ...original);
  }
});

test("content rejects duplicate IDs, empty questions/answers, invalid indices and weights", () => {
  const row = TRIVIA_BANK[0];
  for (const bad of [{ ...row, id: "Bad ID" }, { ...row, q: " " }, { ...row, choices: ["", "B", "C", "D"] }, { ...row, choices: ["A", "A", "C", "D"] }, { ...row, answer: 4 }, { ...row, answer: 0.5 }, { ...row, teach: "" }, { ...row, endgameWeight: -1 }]) assert.throws(() => validateTriviaBank([bad]));
  assert.throws(() => validateTriviaBank([row, row]));
});

test("import pipeline accepts two- and three-option content (True/False) but rejects one-option rows and duplicate IDs across banks", () => {
  for (const choices of [["A", "B"], ["A", "B", "C"]]) {
    const row = { ...TRIVIA_BANK[0], id: "valid_options", choices, answer: 0 };
    assert.doesNotThrow(() => validateTriviaBank([row]));
    (additional as unknown[]).push(row);
    try { assert.doesNotThrow(() => buildTriviaBank()); }
    finally { additional.pop(); }
  }
  const oneOption = { ...TRIVIA_BANK[0], id: "invalid_options", choices: ["A"], answer: 0 };
  assert.throws(() => validateTriviaBank([oneOption]), /2 to 4/);
  (additional as unknown[]).push(oneOption);
  try { assert.throws(() => buildTriviaBank(), /2 to 4/); }
  finally { additional.pop(); }
  (additional as unknown[]).push(TRIVIA_BANK[0]);
  try { assert.throws(() => buildTriviaBank(), /duplicate id/); }
  finally { additional.pop(); }
});

test("True/False rows keep canonical order and map the correct answer", () => {
  const row = { ...TRIVIA_BANK[0], id: "tf_check", choices: ["False", "True"], answer: 1 };
  (additional as unknown[]).push(row);
  try {
    const finalized = buildTriviaBank().find((t) => t.id === "tf_check");
    assert.deepEqual(finalized?.choices, ["True", "False"]);
    assert.equal(finalized?.answer, 0);
  } finally {
    additional.pop();
  }
});

test("same-name sources have independent queue slots, dedupe, and cooldowns", () => {
  const q = new SpotlightQueue();
  const now = Date.now();
  const a = { id: "a1", sourcePeerId: "peer-a", displayName: "Twins", kind: "milestone", at: new Date(now).toISOString(), text: "Reached Fort Kearney", day: 4, miles: 304 };
  const b = { ...a, id: "b1", sourcePeerId: "peer-b" };
  assert.ok(q.add(a, now));
  assert.ok(q.add(b, now));
  assert.equal(q.add({ ...a, id: "a2", displayName: "Renamed" }, now), false);
  assert.equal(q.next(now)?.sourcePeerId, "peer-a");
  assert.equal(q.next(now)?.sourcePeerId, "peer-b");
  assert.equal(q.add({ ...a, id: "a3", text: "Another milestone" }, now), false);
  const synced = new SpotlightQueue();
  synced.remember(a);
  assert.equal(synced.add({ ...a, id: "replayed" }, now), false);
  assert.ok(synced.add(b, now));
  assert.equal(sanitizeTrailFeedList([a, b, { ...a, id: "duplicate" }]).length, 2);
});

test("persisted feed retains bounded source IDs and legacy rows without an ID", () => {
  const previous = process.env.EMOTA_TRAIL_DATA_DIR;
  const dir = mkdtempSync(path.join(process.env.TEMP!, "opencode", "emota-feed-unit-"));
  process.env.EMOTA_TRAIL_DATA_DIR = dir;
  try {
    const legacy = { id: "legacy", displayName: "Twins", kind: "milestone", at: new Date().toISOString(), text: "Reached Fort Kearney" };
    persistFeed([legacy, { ...legacy, id: "new", sourcePeerId: "server-peer" }, { ...legacy, id: "bounded", sourcePeerId: "x".repeat(100) }]);
    const rows = loadPersistedFeed();
    assert.equal(rows[0].sourcePeerId, undefined);
    assert.equal(rows[1].sourcePeerId, "server-peer");
    assert.equal(rows[2].sourcePeerId?.length, 64);
    assert.deepEqual(sanitizeTrailFeedList(rows).map((r) => r.sourcePeerId), [undefined, "server-peer", "x".repeat(64)]);
  } finally {
    if (previous === undefined) delete process.env.EMOTA_TRAIL_DATA_DIR;
    else process.env.EMOTA_TRAIL_DATA_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("identity is bounded, saved, and old saves get defaults; passport survives resume", () => {
  const e = new GameEngine();
  e.phase = "travel_menu";
  e.miles = 554;
  e.wagonIdentity = sanitizeWagonIdentity({ color: "sky", emblem: "pine", oxNames: ["Blue", "Belle"] });
  const restored = new GameEngine();
  assert.ok(restored.applyRunSaveJSON(e.toRunSaveJSON()!));
  assert.deepEqual(restored.wagonIdentity, e.wagonIdentity);
  assert.equal(passportStops(restored.miles).filter((s) => s.earned).length, 5);
  assert.equal(passportStops(553).filter((s) => s.earned).length, 4);
  assert.ok(restored.applyRunSaveJSON('{"v":1,"phase":"travel_menu","miles":554}'));
  assert.equal(restored.wagonIdentity.color, "canvas");
  const bad = sanitizeWagonIdentity({ color: "__proto__", emblem: "<svg>", oxNames: ["x".repeat(100), "<\u0000>", "extra"] });
  assert.equal(bad.color, "canvas");
  assert.equal(bad.emblem, "star");
  assert.deepEqual(bad.oxNames, ["x".repeat(20), "Bright"]);
});

test("spotlights dedupe, avoid sync replay, cap queue, share time and expire", () => {
  const q = new SpotlightQueue();
  const now = Date.now();
  const ev = (name: string, id = name) => ({ id, displayName: name, kind: "milestone", at: new Date(now).toISOString(), text: "Reached Fort Kearney", day: 4, miles: 304 });
  q.remember(ev("old"));
  assert.equal(q.add(ev("old"), now), false);
  assert.equal(q.add(ev("A"), now), true);
  assert.equal(q.add(ev("A", "duplicate"), now), false);
  assert.equal(q.add({ ...ev("A"), text: "Crossed 500 miles" }, now), false);
  for (const name of ["B", "C", "D"]) assert.ok(q.add(ev(name), now));
  assert.equal(q.add(ev("E"), now), false);
  assert.equal(q.next(now)?.displayName, "A");
  assert.equal(q.next(now)?.displayName, "B");
  assert.equal(q.next(now + 31_000), undefined);
  assert.equal(feedBody("Blue", "Blue reached Oregon"), "reached Oregon");
  assert.equal(feedBody("Blue", "Bluebird reached Oregon"), "Bluebird reached Oregon");
});
