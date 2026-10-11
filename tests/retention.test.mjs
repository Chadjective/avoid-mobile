// Pure-logic tests for the retention loops (src/retention/diff.ts, time.ts,
// queue-schedule.ts). Plain JavaScript on purpose: tsc and Metro ignore it,
// and Node 22 imports the .ts modules directly with type stripping, so no
// test runner is added to the app's dependencies. Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { pageChanges, homeChanges, watchMoves, scanDiff, scanDiffIsEmpty, decisionKind } from "../src/retention/diff.ts";
import { relativeTime, elapsed } from "../src/retention/time.ts";
import { nextDrainAt, drainsSince, untilInWords, serverEstimate } from "../src/retention/queue-schedule.ts";

const snap = { slug: "a", entity_name: "A", score: 61, updated_at: "2026-09-20T00:00:00Z", seenAt: "2026-09-22T00:00:00Z" };
const ev = (id, decision, at, p = null, n = null, slug = "a") =>
  ({ id, decision, created_at: at, prev_score: p, new_score: n, slug, entity_name: slug.toUpperCase() });

test("first visit reports nothing", () => {
  assert.equal(pageChanges(null, { score: 10, updated_at: "2026-09-25T00:00:00Z" }, [ev("1","accept","2026-09-25T00:00:00Z")]), null);
  assert.equal(homeChanges(null, [ev("1","accept","2026-09-25T00:00:00Z")], [], {}), null);
  assert.deepEqual(watchMoves(null, [{slug:"a",entity_name:"A",trust_score:1}], []), []);
  assert.equal(scanDiff(null, {scannedAt:"x",risk_score:1,holdings:[]}), null);
});
test("no change -> null", () => {
  assert.equal(pageChanges(snap, { score: 61.2, updated_at: snap.updated_at }, [ev("1","accept","2026-09-21T00:00:00Z")]), null);
});
test("page changes counted by kind, only after seenAt", () => {
  const c = pageChanges(snap, { score: 49, updated_at: snap.updated_at }, [
    ev("1","accept","2026-09-23T00:00:00Z"), ev("2","review_approve","2026-09-24T00:00:00Z"),
    ev("3","reject","2026-09-24T01:00:00Z"), ev("4","accept","2026-09-21T00:00:00Z")]);
  assert.ok(c);
  assert.deepEqual(c.score, { from: 61, to: 49 });
  assert.equal(c.newEvidence, 1); assert.equal(c.newReviews, 1); assert.equal(c.otherDecisions, 1);
  assert.deepEqual(c.newDecisionIds, ["1","2","3"]);
  assert.equal(c.pageUpdated, false);
});
test("page rewritten counts", () => {
  const c = pageChanges(snap, { score: 61, updated_at: "2026-09-25T00:00:00Z" }, []);
  assert.equal(c?.pageUpdated, true);
});
test("decisionKind", () => { assert.equal(decisionKind("review"), "review"); assert.equal(decisionKind("publish"), "other"); });
test("home changes + yours + saturation", () => {
  const act = [ev("1","accept","2026-09-25T00:00:00Z",61,49,"a"), ev("2","publish","2026-09-24T00:00:00Z",null,null,"b")];
  const h = homeChanges("2026-09-23T00:00:00Z", act, [{slug:"b",updated_at:"2026-09-24T00:00:00Z"},{slug:"c",updated_at:"2026-09-01T00:00:00Z"}], { a: snap });
  assert.ok(h);
  assert.equal(h.decisions, 2); assert.equal(h.pagesTouched, 2); assert.equal(h.scoreMoves, 1);
  assert.equal(h.pagesUpdated, 1); assert.equal(h.saturated, true);
  assert.equal(h.yours.length, 1); assert.deepEqual(h.yours[0].score, {from:61,to:49});
  const h2 = homeChanges("2026-09-24T12:00:00Z", act, [], {});
  assert.equal(h2.saturated, false); assert.equal(h2.decisions, 1);
  assert.equal(homeChanges("2026-09-26T00:00:00Z", act, [], {}), null);
});
test("watch moves: score diff and events, sorted", () => {
  const prev = { seenAt: "2026-09-23T00:00:00Z", scores: { a: 61, b: 30, c: 50 } };
  const m = watchMoves(prev, [
    {slug:"a",entity_name:"A",trust_score:61},{slug:"b",entity_name:"B",trust_score:20},
    {slug:"c",entity_name:"C",trust_score:50},{slug:"d",entity_name:"D",trust_score:5}],
    [ev("1","accept","2026-09-25T00:00:00Z",null,null,"a"), ev("2","accept","2026-09-22T00:00:00Z",null,null,"c")]);
  assert.deepEqual(m.map(x=>x.slug), ["a","b"]);
  assert.deepEqual(m[1].score, {from:30,to:20});
  assert.equal(m[0].score, null);
});
test("scan diff", () => {
  const prev = { scannedAt: "2026-09-20T00:00:00Z", risk_score: 62, holdings: [
    {mint:"m1",symbol:"A",slug:"a",trust_score:40},{mint:"m2",symbol:"B",slug:null,trust_score:null},{mint:"m3",symbol:"C",slug:null,trust_score:null}]};
  const cur = { scannedAt: "2026-09-26T00:00:00Z", risk_score: 55, holdings: [
    {mint:"m1",symbol:"A",slug:"a",trust_score:20},{mint:"m2",symbol:"B",slug:"b",trust_score:10},{mint:"m4",symbol:"D",slug:null,trust_score:null}]};
  const d = scanDiff(prev, cur);
  assert.deepEqual(d.risk, {from:62,to:55});
  assert.equal(d.scoreChanges.length,1); assert.equal(d.newlyCovered[0].mint,"m2");
  assert.equal(d.added[0].mint,"m4"); assert.equal(d.removed[0].mint,"m3");
  assert.equal(scanDiffIsEmpty(scanDiff(cur, cur)), true);
});
test("time", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");
  assert.equal(relativeTime("2026-09-26T11:59:30Z", now), "just now");
  assert.equal(relativeTime("2026-09-26T09:00:00Z", now), "3 hours ago");
  assert.equal(relativeTime("2026-09-25T10:00:00Z", now), "yesterday");
  assert.equal(relativeTime("2026-09-26T13:00:00Z", now), "just now");
  assert.equal(relativeTime("bad", now), "");
  assert.equal(elapsed("2026-09-24T12:00:00Z", now), "2 days");
});
test("queue schedule", () => {
  // Every four hours: 00, 04, 08, 12, 16, 20 UTC (moved from 12/17/23 on 2026-10-02).
  assert.equal(nextDrainAt(new Date("2026-09-26T05:00:00Z")).toISOString(), "2026-09-26T08:00:00.000Z");
  assert.equal(nextDrainAt(new Date("2026-09-26T12:00:00Z")).toISOString(), "2026-09-26T16:00:00.000Z");
  assert.equal(nextDrainAt(new Date("2026-09-26T23:30:00Z")).toISOString(), "2026-09-27T00:00:00.000Z");
  assert.equal(nextDrainAt(new Date("2026-09-30T23:30:00Z")).toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(drainsSince("2026-09-25T11:00:00Z", new Date("2026-09-26T05:00:00Z")), 5);
  assert.equal(drainsSince("2026-09-26T04:30:00Z", new Date("2026-09-26T05:00:00Z")), 0);
  assert.equal(untilInWords(new Date("2026-09-26T12:00:00Z"), new Date("2026-09-26T09:05:00Z")), "in about 3 hours");
});

// Review fixes, 2026-09-26.
test("home: a score move from before the read is never shown as yours", () => {
  const read = { slug: "a", entity_name: "A", score: 40, updated_at: "2026-09-20T00:00:00Z", seenAt: "2026-09-23T00:00:00Z" };
  const act = [
    ev("new", "reject", "2026-09-24T00:00:00Z", null, null, "a"), // after the read, no score
    ev("old", "accept", "2026-09-22T00:00:00Z", 55, 50, "a"), // before the read, scored
  ];
  const h = homeChanges("2026-09-21T00:00:00Z", act, [], { a: read });
  assert.equal(h.yours.length, 1);
  assert.equal(h.yours[0].score, null);
});
test("scan: a mint re-linked to another page is not a score move; capped scans skip added/removed", () => {
  const prev = { scannedAt: "2026-09-20T00:00:00Z", risk_score: 50, holdings: [{ mint: "m1", symbol: "A", slug: "a", trust_score: 40 }] };
  const cur = { scannedAt: "2026-09-26T00:00:00Z", risk_score: 50, holdings: [{ mint: "m1", symbol: "A", slug: "b", trust_score: 10 }] };
  assert.equal(scanDiff(prev, cur).scoreChanges.length, 0);
  const many = Array.from({ length: 300 }, (_, i) => ({ mint: `x${i}`, symbol: null, slug: null, trust_score: null }));
  const d = scanDiff({ ...prev, holdings: many }, { ...cur, holdings: many.slice(1) });
  assert.equal(d.positionsCapped, true);
  assert.equal(d.removed.length, 0);
});

// "Update this page" button states (src/api/update-request-state.ts).
import { stateFromResponse, stateFromFailure, updateRequestText, updateRequestDone } from "../src/api/update-request-state.ts";
test("request update: queued vs already requested both end the offer", () => {
  assert.deepEqual(stateFromResponse({}), { kind: "queued" });
  assert.deepEqual(stateFromResponse({ already_requested: true }), { kind: "already" });
  assert.equal(updateRequestDone(stateFromResponse({})), true);
  assert.equal(updateRequestDone(stateFromResponse({ already_requested: true })), true);
  assert.equal(updateRequestDone(null), false);
});
test("request update: failures map to the states a person can act on", () => {
  assert.deepEqual(stateFromFailure(401, null, "x"), { kind: "signed_out" });
  assert.deepEqual(stateFromFailure(429, { error: "rate_limited", limit: 10 }, "x"), { kind: "limit", limit: 10 });
  assert.deepEqual(stateFromFailure(429, null, "x"), { kind: "limit", limit: null });
  assert.deepEqual(stateFromFailure(503, null, "x"), { kind: "unavailable" });
  assert.deepEqual(stateFromFailure(0, null, "x"), { kind: "offline" });
  assert.deepEqual(stateFromFailure(500, null, "boom"), { kind: "error", message: "boom" });
  assert.equal(updateRequestDone(stateFromFailure(429, { limit: 10 }, "x")), false); // may retry tomorrow
  assert.match(updateRequestText({ kind: "limit", limit: 10 }), /\(10\)/);
  assert.equal(updateRequestText(null), "Update this page");
});
test("request update: 7-day cooldown (409 recently_updated) is a done state with the date", () => {
  const s = stateFromFailure(409, { error: "recently_updated", next_allowed_at: "2026-10-09T12:00:00.000Z" }, "x");
  assert.deepEqual(s, { kind: "recently_updated", nextAllowedAt: "2026-10-09T12:00:00.000Z" });
  assert.equal(updateRequestText(s), "Updated recently · again on Oct 9");
  assert.equal(updateRequestDone(s), true); // no retry
  assert.deepEqual(stateFromFailure(409, { error: "recently_updated" }, "x"), { kind: "recently_updated", nextAllowedAt: null });
  assert.match(updateRequestText({ kind: "recently_updated", nextAllowedAt: null }), /Updated recently/);
  // Any other 409 stays a plain error.
  assert.deepEqual(stateFromFailure(409, { error: "other" }, "nope"), { kind: "error", message: "nope" });
});
test("request offer: near-miss and empty offer, exact match hides, <2 chars hides", async () => {
  const { shouldOfferRequest } = await import("../src/search/request-offer.ts");
  const near = [{ slug: "uwulend", entity_name: "UwuLend" }];
  assert.equal(shouldOfferRequest("Shadow", near), true);
  assert.equal(shouldOfferRequest("Shadow", []), true);
  assert.equal(shouldOfferRequest("UWULEND", near), false);
  assert.equal(shouldOfferRequest("a", []), false);
});
test("server queue estimate is used only when present, valid and still in the future", () => {
  const now = new Date("2026-10-02T13:00:00Z");
  const e = serverEstimate(4, "2026-10-02T16:00:00Z", now);
  assert.equal(e?.position, 4);
  assert.equal(e?.runAt.toISOString(), "2026-10-02T16:00:00.000Z");
  assert.equal(serverEstimate(undefined, "2026-10-02T16:00:00Z", now), null);
  assert.equal(serverEstimate(null, null, now), null);
  assert.equal(serverEstimate(0, "2026-10-02T16:00:00Z", now), null);
  assert.equal(serverEstimate(2, "not a date", now), null);
  assert.equal(serverEstimate(2, "2026-10-02T12:00:00Z", now), null);
});
test("home changes keep the per-page lists behind the counts", () => {
  const act = [ev("1","accept","2026-09-24T00:00:00Z",61,49,"a"), ev("2","publish","2026-09-25T00:00:00Z",null,null,"b")];
  const recent = [
    {slug:"b",entity_name:"B",trust_score:30,updated_at:"2026-09-24T00:00:00Z"},
    {slug:"d",entity_name:"D",trust_score:80,updated_at:"2026-09-26T00:00:00Z"},
    {slug:"c",entity_name:"C",trust_score:5,updated_at:"2026-09-01T00:00:00Z"},
  ];
  const h = homeChanges("2026-09-23T00:00:00Z", act, recent, {});
  assert.deepEqual(h.decisionEvents.map((e) => e.id), ["2","1"]);
  assert.deepEqual(h.updatedPages.map((p) => [p.slug, p.trust_score]), [["d",80],["b",30]]);
  assert.equal(h.pagesUpdated, h.updatedPages.length);
  assert.equal(h.decisions, h.decisionEvents.length);
});
