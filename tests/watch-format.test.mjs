// Pure-logic tests for src/watch/format.ts. Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { followingFor, entityTypeLabel, metaLine, riskLine, scoreMovedLine } from "../src/watch/format.ts";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const ago = (h) => new Date(NOW - h * 3600_000).toISOString();

test("following duration", () => {
  assert.equal(followingFor(ago(23), NOW), "following 23 hours");
  assert.equal(followingFor(ago(1), NOW), "following 1 hour");
  assert.equal(followingFor(ago(0.2), NOW), "following less than an hour");
  assert.equal(followingFor(ago(72), NOW), "following 3 days");
  assert.equal(followingFor(undefined, NOW), null);
});

test("meta line uses only what exists", () => {
  assert.equal(metaLine({ entity_type: "exchange", created_at: ago(23) }, NOW), "Exchange · following 23 hours");
  assert.equal(metaLine({ created_at: ago(23) }, NOW), "following 23 hours");
  assert.equal(entityTypeLabel("defi_protocol"), "Defi protocol");
  assert.equal(entityTypeLabel(null), null);
});

test("risk line", () => {
  assert.equal(riskLine({ top_risk: "Rug pull", event_count: 4 }), "Top risk: Rug pull · 4 events");
  assert.equal(riskLine({ event_count: 1 }), "1 event");
  assert.equal(riskLine({ top_risk: null, event_count: null }), null);
});

test("score moved line", () => {
  assert.equal(scoreMovedLine("3 days ago", 72, 58), "Score last moved 3 days ago (72 → 58)");
  assert.equal(scoreMovedLine("3 days ago", null, 58), "Score last moved 3 days ago");
  assert.equal(scoreMovedLine("", 1, 2), null);
});
