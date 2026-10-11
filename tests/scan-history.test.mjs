// Pure-logic tests for the scan-history merge, the "your evidence" wording and
// the new response fields. Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeScanLists } from "../src/retention/scan-merge.ts";
import { verdictWords, scoreMoveText } from "../src/retention/evidence.ts";
import {
  scanHistoryResponseSchema,
  meResponseSchema,
  investigationDetailResponseSchema,
} from "../src/api/types.ts";

const dev = (address, scannedAt, n = 2) => ({ address, scannedAt, holdings: new Array(n).fill({}) });
const srv = (address, created_at, over = {}) => ({ address, status: "complete", created_at, completed_at: null, position_count: 5, ...over });

test("merge: de-duplicated by address, newest first", () => {
  const out = mergeScanLists(
    [dev("A", "2026-09-30T00:00:00Z"), dev("B", "2026-09-20T00:00:00Z")],
    [srv("C", "2026-10-01T00:00:00Z"), srv("B", "2026-09-10T00:00:00Z")],
  );
  assert.deepEqual(out.map((e) => e.address), ["C", "A", "B"]);
});

test("merge: device wins for the snapshot but takes a newer server time", () => {
  const out = mergeScanLists([dev("A", "2026-09-01T00:00:00Z", 3)], [srv("A", "2026-09-05T00:00:00Z", { completed_at: "2026-09-06T00:00:00Z" })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].onDevice, true);
  assert.equal(out[0].positions, 3);
  assert.equal(out[0].scannedAt, "2026-09-06T00:00:00Z");
});

test("merge: server-only wallet is flagged (no diff on first re-scan) and failed scans are skipped", () => {
  const out = mergeScanLists([], [srv("S", "2026-10-01T00:00:00Z"), srv("F", "2026-10-02T00:00:00Z", { status: "failed" })]);
  assert.deepEqual(out.map((e) => [e.address, e.onDevice, e.positions]), [["S", false, 5]]);
});

test("verdict wording and score move", () => {
  assert.equal(verdictWords("under_review"), "under review");
  assert.equal(verdictWords("accepted"), "accepted");
  assert.equal(verdictWords("rejected"), "rejected");
  assert.equal(scoreMoveText({ prev_score: 58, new_score: 46 }), "score 58 → 46");
  assert.equal(scoreMoveText({ prev_score: null, new_score: 46 }), null);
  assert.equal(scoreMoveText({}), null);
});

test("schemas accept the new fields and an older server without them", () => {
  assert.equal(scanHistoryResponseSchema.safeParse({ scans: [{ id: "1", address: "A", status: "complete", created_at: "x" }] }).success, true);
  const me = { user_id: "u", email: null, account: null, rep: { repScore: 0, acceptedCount: 0, rejectedCount: 0, isTrusted: false } };
  assert.equal(meResponseSchema.safeParse(me).success, true);
  const withSubs = meResponseSchema.safeParse({
    ...me,
    recent_submissions: [{ id: "s", kind: "url", status: "accepted", created_at: "x", resolved_at: null, slug: "a", entity_name: "A", decision_reason: null, score_delta: -12, prev_score: 58, new_score: 46 }],
  });
  assert.equal(withSubs.success, true);
  const inv = { slug: "a", entity_name: "A", trust_score: 1, severity_base: null, score_modifier: null, confidence: null, status: "published", content_type: null, summary: null, sections: null, timeline: null, sources_used: null, source_tags: null, addresses: null, reviewed: null, reviewed_by: null, model_used: null, created_at: "x", updated_at: "x" };
  assert.equal(investigationDetailResponseSchema.safeParse({ investigation: inv }).success, true);
  assert.equal(investigationDetailResponseSchema.safeParse({ investigation: inv, follower_count: null }).success, true);
  assert.equal(investigationDetailResponseSchema.parse({ investigation: inv, follower_count: 7 }).follower_count, 7);
});
