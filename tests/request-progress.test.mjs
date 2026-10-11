// Pure-logic tests for the request screen's arc and stage bar
// (src/retention/request-progress.ts). Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REQUEST_STAGES,
  DRAIN_INTERVAL_MS,
  stageFromStatus,
  arcWindowStart,
  arcFraction,
  formatCountdown,
  placeInLine,
} from "../src/retention/request-progress.ts";

test("stage from status: queued, running, fulfilled", () => {
  assert.deepEqual(stageFromStatus("queued"), { index: 0, complete: false, stopped: false });
  assert.deepEqual(stageFromStatus("running"), { index: 1, complete: false, stopped: false });
  const done = stageFromStatus("fulfilled");
  assert.equal(done.index, REQUEST_STAGES.length - 1);
  assert.equal(done.complete, true);
});

test("failed and rejected stop the bar; unknown status reads as queued", () => {
  assert.equal(stageFromStatus("failed").stopped, true);
  assert.equal(stageFromStatus("failed").index, 1);
  assert.equal(stageFromStatus("rejected").index, 0);
  assert.equal(stageFromStatus("rejected").stopped, true);
  assert.deepEqual(stageFromStatus("???"), { index: 0, complete: false, stopped: false });
});

test("arc window never starts before creation or more than one interval before the run", () => {
  const run = 10 * DRAIN_INTERVAL_MS;
  assert.equal(arcWindowStart(run - 1000, run), run - 1000);
  assert.equal(arcWindowStart(run - 3 * DRAIN_INTERVAL_MS, run), run - DRAIN_INTERVAL_MS);
  assert.equal(arcWindowStart(NaN, run), run - DRAIN_INTERVAL_MS);
});

test("arc fraction is clamped to 0..1 and halves at the midpoint", () => {
  assert.equal(arcFraction(0, 100, 50), 0.5);
  assert.equal(arcFraction(0, 100, -10), 0);
  assert.equal(arcFraction(0, 100, 500), 1);
  assert.equal(arcFraction(100, 100, 100), 1);
  assert.equal(arcFraction(0, 100, NaN), 0);
});

test("countdown formats m:ss, h:mm:ss and never goes negative", () => {
  assert.equal(formatCountdown(0), "0:00");
  assert.equal(formatCountdown(-5000), "0:00");
  assert.equal(formatCountdown(4_001), "0:05");
  assert.equal(formatCountdown(65_000), "1:05");
  assert.equal(formatCountdown(3_723_000), "1:02:03");
  assert.equal(formatCountdown(NaN), "0:00");
});

test("place in line: text, dots for people ahead, capped with overflow", () => {
  assert.deepEqual(placeInLine(3), { ahead: 2, dots: 2, more: 0, text: "You're #3 in line" });
  assert.equal(placeInLine(1).text, "You're next in line");
  assert.equal(placeInLine(1).dots, 0);
  const long = placeInLine(40, 10);
  assert.equal(long.dots, 10);
  assert.equal(long.more, 29);
  assert.equal(placeInLine(0).ahead, 0);
});
