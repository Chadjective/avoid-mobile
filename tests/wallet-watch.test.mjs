// Pure-logic tests for Profile's Wallet Guardian row (src/session/wallet-watch.ts).
// Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { walletWatchStatus } from "../src/session/wallet-watch.ts";

test("watched: on, green, says what triggers an alert", () => {
  const s = walletWatchStatus({ watched: true, reason: null, since: "2026-10-01T00:00:00Z" });
  assert.equal(s.title, "Wallet Guardian is on");
  assert.equal(s.tone, "verified");
  assert.match(s.detail, /flagged as risky/);
});

test("not watched yet: starts within 6 hours, muted", () => {
  const s = walletWatchStatus({ watched: false, reason: "no_slot", since: null });
  assert.equal(s.title, "Wallet Guardian starts within 6 hours");
  assert.equal(s.detail, "New wallets are added every 6 hours.");
  assert.equal(s.tone, "muted");
});

test("unknown: unavailable, muted, no second line", () => {
  const s = walletWatchStatus(null);
  assert.equal(s.title, "Alert monitoring status unavailable.");
  assert.equal(s.detail, null);
  assert.equal(s.tone, "muted");
});
