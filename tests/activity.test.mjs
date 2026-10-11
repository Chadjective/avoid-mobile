// Pure-logic tests for Profile's "Your activity" wording. Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { requestOutcome, evidenceOutcome, activityCounts, tokenCountText } from "../src/retention/evidence.ts";

test("request status maps to a pill", () => {
  assert.deepEqual(requestOutcome("fulfilled"), { label: "Published", tone: "verified" });
  assert.deepEqual(requestOutcome("queued"), { label: "In queue", tone: "neutral" });
  assert.deepEqual(requestOutcome("running"), { label: "Researching", tone: "caution" });
  assert.deepEqual(requestOutcome("failed"), { label: "Failed", tone: "critical" });
  assert.deepEqual(requestOutcome("rejected"), { label: "Rejected", tone: "warning" });
});

test("an unknown request status shows as-is", () => {
  assert.deepEqual(requestOutcome("on_hold"), { label: "on_hold", tone: "neutral" });
  assert.equal(requestOutcome("").label, "Unknown");
});

test("evidence status maps to a pill", () => {
  assert.equal(evidenceOutcome("accepted").label, "Accepted");
  assert.equal(evidenceOutcome("rejected").tone, "critical");
  assert.equal(evidenceOutcome("revoked").label, "Withdrawn");
  assert.equal(evidenceOutcome("under_review").label, "Under review");
  assert.equal(evidenceOutcome("anything-new").label, "Under review");
});

test("counter row", () => {
  const c = activityCounts(
    [{ status: "fulfilled" }, { status: "queued" }, { status: "fulfilled" }],
    { acceptedCount: 4, rejectedCount: 1 },
    [{ status: "complete" }, { status: "failed" }, { status: "partial" }],
  );
  assert.deepEqual(c, { requests: 3, published: 2, accepted: 4, rejected: 1, scans: 2 });
  assert.deepEqual(activityCounts([], null, []), { requests: 0, published: 0, accepted: 0, rejected: 0, scans: 0 });
});

test("token count text", () => {
  assert.equal(tokenCountText(12), "12 tokens");
  assert.equal(tokenCountText(1), "1 token");
  assert.equal(tokenCountText(null), null);
  assert.equal(tokenCountText(undefined), null);
});

import { markRequestsStale, requestsVersion } from "../src/retention/ledger-cache.ts";

test("markRequestsStale bumps the version the Profile list compares", () => {
  const before = requestsVersion();
  markRequestsStale();
  assert.equal(requestsVersion(), before + 1);
});
