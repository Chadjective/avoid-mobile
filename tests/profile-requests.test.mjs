// Pure-logic tests for Profile's requests-first section. Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupRequests,
  collapse,
  moreLabel,
  formatUtcTime,
  queueSubline,
  rowDisplayName,
  rowScore,
  publishedSubline,
  newPublished,
  markSeen,
  unreadAlertCount,
  evidenceCount,
  boostCopy,
} from "../src/profile/requests-view.ts";
import { SKR_PERKS, SKR_HOLDER_MIN, SKR_STAKER_MIN } from "../src/session/skr.ts";

const row = (id, status, created_at, slug = null) => ({ id, entity: id, status, slug, created_at });

test("groupRequests splits by status, newest first", () => {
  const g = groupRequests([
    row("a", "queued", "2026-10-01T10:00:00Z"),
    row("b", "fulfilled", "2026-10-02T10:00:00Z", "b"),
    row("c", "running", "2026-10-03T10:00:00Z"),
    row("d", "failed", "2026-10-04T10:00:00Z"),
    row("e", "fulfilled", "2026-10-05T10:00:00Z", "e"),
    row("f", "fulfilled", "2026-10-06T10:00:00Z", null),
  ]);
  assert.deepEqual(g.queue.map((r) => r.id), ["c", "a"]);
  assert.deepEqual(g.published.map((r) => r.id), ["e", "b"]);
  assert.deepEqual(g.other.map((r) => r.id), ["f", "d"]);
});

test("collapse shows three and counts the rest", () => {
  const items = [1, 2, 3, 4, 5];
  assert.deepEqual(collapse(items, false), { shown: [1, 2, 3], more: 2 });
  assert.deepEqual(collapse(items, true), { shown: items, more: 0 });
  assert.deepEqual(collapse([1, 2, 3], false), { shown: [1, 2, 3], more: 0 });
  assert.equal(moreLabel(2), "+ 2 more · See all →");
});

test("formatUtcTime pads", () => {
  assert.equal(formatUtcTime(new Date(Date.UTC(2026, 9, 8, 4, 5))), "04:05 UTC");
});

test("queueSubline", () => {
  assert.equal(queueSubline({ status: "queued" }, "2 hours ago"), "requested 2 hours ago · in the next run");
  assert.equal(queueSubline({ status: "queued" }, "2 hours ago", 3), "#3 in line · requested 2 hours ago");
  assert.equal(queueSubline({ status: "running" }, "1 hour ago"), "requested 1 hour ago · being researched now");
});

test("newPublished: first visit seeds a baseline, later visits flag unseen", () => {
  const first = newPublished(["a", "b"], null);
  assert.equal(first.newIds.size, 0);
  assert.deepEqual(first.baseline, ["a", "b"]);
  const later = newPublished(["a", "b", "c"], ["a", "b"]);
  assert.deepEqual([...later.newIds], ["c"]);
  assert.equal(later.baseline, null);
});

test("markSeen appends once and caps", () => {
  assert.deepEqual(markSeen(null, "a"), ["a"]);
  assert.deepEqual(markSeen(["a", "b"], "a"), ["b", "a"]);
  assert.equal(markSeen(["a", "b", "c"], "d", 3).length, 3);
});

test("unreadAlertCount", () => {
  const alerts = [{ created_at: "2026-10-02T00:00:00Z" }, { created_at: "2026-10-04T00:00:00Z" }];
  assert.equal(unreadAlertCount(alerts, null), 2);
  assert.equal(unreadAlertCount(alerts, "2026-10-03T00:00:00Z"), 1);
  assert.equal(unreadAlertCount([], null), 0);
});

test("evidenceCount takes the larger of list and tally", () => {
  assert.equal(evidenceCount(undefined, null), 0);
  assert.equal(evidenceCount([1, 2], { acceptedCount: 1, rejectedCount: 0 }), 2);
  assert.equal(evidenceCount([1], { acceptedCount: 3, rejectedCount: 2 }), 5);
});

const input = (tier) => ({ tier, holderMin: SKR_HOLDER_MIN, stakerMin: SKR_STAKER_MIN, perks: SKR_PERKS });

test("boostCopy comes from the SKR constants", () => {
  assert.deepEqual(boostCopy(input("none")), {
    kind: "card",
    heading: "Boost your rank",
    lines: ["Hold 69 SKR: queue priority +1", "Stake 420 SKR: queue priority +2"],
  });
  assert.deepEqual(boostCopy(input("holder")), {
    kind: "applied",
    applied: "Queue priority +1 applied (SKR holder).",
    next: "Stake 420 SKR to move up one more (+2).",
  });
  assert.deepEqual(boostCopy(input("staker")), {
    kind: "applied",
    applied: "Queue priority +2 applied (SKR staker).",
    next: null,
  });
});

test("rowDisplayName prefers the page entity name", () => {
  assert.equal(rowDisplayName({ entity: "foo", page_entity_name: "Foo Exchange" }), "Foo Exchange");
  assert.equal(rowDisplayName({ entity: "foo", page_entity_name: null }), "foo");
  assert.equal(rowDisplayName({ entity: "foo", page_entity_name: "  " }), "foo");
  assert.equal(rowDisplayName({ entity: "foo" }), "foo");
});

test("rowScore accepts finite numbers only", () => {
  assert.equal(rowScore({ page_trust_score: 42 }), 42);
  assert.equal(rowScore({ page_trust_score: 0 }), 0);
  assert.equal(rowScore({ page_trust_score: null }), null);
  assert.equal(rowScore({}), null);
  assert.equal(rowScore({ page_trust_score: NaN }), null);
});

test("publishedSubline uses published_at when present", () => {
  assert.equal(publishedSubline({ published_at: "2026-10-01T00:00:00Z" }, "2 days ago", "5 days ago"), "published 2 days ago");
  assert.equal(publishedSubline({ published_at: null }, "", "5 days ago"), "requested 5 days ago");
  assert.equal(publishedSubline({}, "", ""), "requested");
});
