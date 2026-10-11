// Pure-logic tests for the Your perks meters (src/session/perks.ts). Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  meterFraction,
  meterBand,
  segmentFills,
  resetsInText,
  meterLabel,
  hasUsage,
  tierTable,
} from "../src/session/perks.ts";
import { SKR_PERKS } from "../src/session/skr.ts";

const NOW = Date.parse("2026-10-07T12:00:00Z");
const inHours = (h) => new Date(NOW + h * 3_600_000).toISOString();

test("fraction is remaining over limit, clamped", () => {
  assert.equal(meterFraction(3, 10), 0.7);
  assert.equal(meterFraction(0, 10), 1);
  assert.equal(meterFraction(10, 10), 0);
  assert.equal(meterFraction(14, 10), 0);
  assert.equal(meterFraction(-2, 10), 1);
  assert.equal(meterFraction(1, 0), 0);
  assert.equal(meterFraction(NaN, 10), 0);
});

test("colour bands: ok above 30%, low at or below, empty at 0", () => {
  assert.equal(meterBand(1), "ok");
  assert.equal(meterBand(0.31), "ok");
  assert.equal(meterBand(0.3), "low");
  assert.equal(meterBand(0.1), "low");
  assert.equal(meterBand(0), "empty");
});

test("segments fill left to right with a partial one", () => {
  assert.deepEqual(segmentFills(1, 4), [1, 1, 1, 1]);
  assert.deepEqual(segmentFills(0, 4), [0, 0, 0, 0]);
  assert.deepEqual(segmentFills(0.5, 4), [1, 1, 0, 0]);
  const s = segmentFills(0.3, 10);
  assert.equal(s.slice(0, 3).every((x) => Math.abs(x - 1) < 1e-9), true);
  assert.equal(Math.abs(s[3]) < 1e-9, true);
});

test("resets-in text is relative", () => {
  assert.equal(resetsInText(inHours(5), NOW), "resets in 5h");
  assert.equal(resetsInText(new Date(NOW + 12 * 60_000).toISOString(), NOW), "resets in 12m");
  assert.equal(resetsInText(inHours(30), NOW), "resets in 1d");
  assert.equal(resetsInText(inHours(-1), NOW), "resets now");
  assert.equal(resetsInText(null, NOW), null);
  assert.equal(resetsInText("garbage", NOW), null);
});

test("label: 7 of 10 left with reset, none when unused or no reset time", () => {
  assert.equal(meterLabel({ used: 3, limit: 10, resets_at: inHours(5) }, NOW), "7 of 10 left · resets in 5h");
  assert.equal(meterLabel({ used: 0, limit: 10, resets_at: null }, NOW), "10 of 10 left");
  assert.equal(meterLabel({ used: 12, limit: 10 }, NOW), "0 of 10 left");
});

test("hasUsage needs all three counters", () => {
  const m = { used: 1, limit: 10 };
  assert.equal(hasUsage({ scans: m, requests: m, follows: m }), true);
  assert.equal(hasUsage({ scans: m, requests: m }), false);
  assert.equal(hasUsage(undefined), false);
  assert.equal(hasUsage({ scans: m, requests: m, follows: { used: "1", limit: 10 } }), false);
});

test("tier table mirrors SKR_PERKS and marks the current tier", () => {
  const t = tierTable(SKR_PERKS, "holder");
  assert.deepEqual(t.rows.map((r) => r.tier), ["Member", "Holder", "Staker"]);
  assert.deepEqual(t.rows[1].cells, ["30", "15", "50", "+1"]);
  assert.deepEqual(t.rows.map((r) => r.current), [false, true, false]);
  assert.equal(tierTable(SKR_PERKS, "member").rows[0].current, true);
  assert.equal(tierTable(SKR_PERKS, "none").rows[0].current, true);
});
