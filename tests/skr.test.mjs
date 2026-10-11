// Pure-logic tests for Profile's SKR line (src/session/skr.ts). Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { skrLine, formatSkrAmount, normalizeSkrTier, SKR_PERKS } from "../src/session/skr.ts";

test("holder with amounts: title, perks, next step", () => {
  assert.deepEqual(skrLine("holder", 182, 0), {
    title: "182 SKR · Holder",
    perks: "50 follows · 30 scans a day · queue priority +1",
    next: "Stake 420 SKR to become a Staker",
  });
});

test("none: member perks and the way to Holder", () => {
  const l = skrLine("none", 12, 0);
  assert.equal(l.title, "12 SKR · Member");
  assert.equal(l.perks, "10 follows · 10 scans a day · queue priority +0");
  assert.equal(l.next, "Hold 69 SKR to become a Holder");
});

test("staker: full perks in the next line", () => {
  const l = skrLine("staker", 100, 500);
  assert.equal(l.title, "600 SKR · Staker");
  assert.equal(l.next, "Staker perks: 200 follows · 50 scans a day · 25 requests a day · queue priority +2");
});

test("null amounts (older server) show just the tier", () => {
  assert.equal(skrLine("holder", null, null).title, "Holder");
  assert.equal(skrLine("holder").title, "Holder");
  assert.equal(skrLine(null).title, "Member");
});

test("amounts floor and use thousands separators", () => {
  assert.equal(formatSkrAmount(1234.9), "1,234");
  assert.equal(formatSkrAmount(1234567), "1,234,567");
  assert.equal(formatSkrAmount(68.99), "68");
  assert.equal(formatSkrAmount(-3), "0");
  assert.equal(formatSkrAmount(NaN), "0");
  assert.equal(skrLine("staker", 0.5, 419.9).title, "420 SKR · Staker");
});

test("unknown tiers read as none; perks table matches entitlements.ts", () => {
  assert.equal(normalizeSkrTier("whale"), "none");
  assert.deepEqual(SKR_PERKS.staker, { follows: 200, scansPerDay: 50, requestsPerDay: 25, queuePriority: 2 });
  assert.deepEqual(SKR_PERKS.holder, { follows: 50, scansPerDay: 30, requestsPerDay: 15, queuePriority: 1 });
});
