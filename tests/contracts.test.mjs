// Contract tests: the app's response parsers against fixtures copied from what
// the web routes actually construct. Each fixture names the route and the
// statement it was copied from. When a route's response changes, change the
// fixture here in the same commit. Run: npm run test:logic
//
// Only src/api/contracts.ts and src/api/types.ts are imported: they depend on
// zod alone, so Node 22 runs them directly with no bundler.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  watchlistResponseSchema,
  watchlistItemResponseSchema,
  registerDeviceResponseSchema,
  feedResponseSchema,
  attestationResponseSchema,
  attestationListResponseSchema,
  activityResponseSchema,
  auditResponseSchema,
  describeErrorBody,
  toServerPlatform,
} from "../src/api/contracts.ts";
import {
  requestCreateResponseSchema,
  requestListResponseSchema,
  notifyEmailResponseSchema,
  scanCreateResponseSchema,
  scanReportSchema,
  meResponseSchema,
  meUpdateResponseSchema,
  submissionCreateResponseSchema,
  searchResponseSchema,
  investigationListResponseSchema,
  lookupResponseSchema,
} from "../src/api/types.ts";

const ok = (schema, fixture) => {
  const r = schema.safeParse(fixture);
  assert.ok(r.success, r.success ? "" : JSON.stringify(r.error.issues));
  return r.data;
};

// --- v1/watchlist/_shared.ts enrichWatchlistRows + route.ts jsonNoStore({item}) ---
const watchRow = {
  id: "5d0b3b9e-0000-4000-8000-000000000001",
  target_kind: "investigation",
  slug: "ftx",
  address: null,
  chain: "solana",
  muted: false,
  created_at: "2026-09-26T10:00:00.000Z",
  entity_name: "FTX",
  trust_score: 12,
  band: "CRITICAL",
};

test("watchlist: GET {items}, POST/PATCH {item}, all four bands, legacy VERIFIED", () => {
  ok(watchlistResponseSchema, { items: [watchRow] });
  const created = ok(watchlistItemResponseSchema, { item: watchRow });
  assert.equal(created.item.id, watchRow.id);
  for (const band of ["CRITICAL", "WARNING", "CAUTIONARY", "LOW_RISK", null]) {
    assert.equal(ok(watchlistItemResponseSchema, { item: { ...watchRow, band } }).item.band, band);
  }
  // A server from before the rename still parses, and reads as the new value.
  assert.equal(ok(watchlistItemResponseSchema, { item: { ...watchRow, band: "VERIFIED" } }).item.band, "LOW_RISK");
  // An address follow has no page to enrich from.
  ok(watchlistItemResponseSchema, {
    item: { ...watchRow, target_kind: "address", slug: null, address: "So11111111111111111111111111111111111111112", entity_name: null, trust_score: null, band: null },
  });
  // The bare row (what the app used to expect) must NOT be accepted.
  assert.equal(watchlistItemResponseSchema.safeParse(watchRow).success, false);
});

// --- v1/devices/route.ts: jsonNoStore({ id }, 201) ---
test("devices: 201 {id} only", () => {
  ok(registerDeviceResponseSchema, { id: "8e1f0c1a-0000-4000-8000-000000000002" });
  assert.equal(toServerPlatform("android"), "android");
  assert.equal(toServerPlatform("ios"), "ios");
  assert.equal(toServerPlatform("web"), "android"); // the route's enum has no "web"
});

// --- v1/feed/route.ts FEED_FIELDS on notifications_outbox (migration 053) ---
test("feed: {items} of outbox rows; id is a BIGINT number, data never null", () => {
  ok(feedResponseSchema, {
    items: [
      { id: 41, kind: "score_changed", slug: "ftx", title: "FTX score changed", body: "12 to 9", data: { slug: "ftx" }, created_at: "2026-09-26T10:00:00+00:00", sent_at: null },
      { id: 42, kind: "scan_complete", slug: null, title: "Scan done", body: "3 flagged", data: {}, created_at: "2026-09-26T10:00:00+00:00", sent_at: "2026-09-26T10:00:15+00:00" },
    ],
  });
  ok(feedResponseSchema, { items: [] });
});

// --- v1/attestations/route.ts ---
const attestationRow = {
  id: "a1", submission_id: "s1", signer_pubkey: "So11111111111111111111111111111111111111112",
  memo_signature: "5".repeat(88), slot: 301234567, cluster: "mainnet-beta", created_at: "2026-09-26T10:00:00+00:00",
};
test("attestations: {attestation} on 201 and 200; GET {submission_id, attestations, total}", () => {
  ok(attestationResponseSchema, { attestation: attestationRow });
  ok(attestationListResponseSchema, { submission_id: "s1", attestations: [attestationRow], total: 1 });
});

// --- v1/activity/route.ts ---
test("activity: {events}", () => {
  const event = {
    id: "e1", slug: "ftx", entity_name: "FTX", decision: "accept", sequence_num: 7,
    created_at: "2026-09-26T10:00:00+00:00", prev_score: 12, new_score: 9, score_delta: -3,
    actor_label: "analyzer:0.91", decided_by: "analyzer", anchor_status: "confirmed",
    anchor_signature: "sig", anchor_cluster: "mainnet-beta",
  };
  ok(activityResponseSchema, { events: [event] });
  ok(activityResponseSchema, { events: [] }); // the route's empty short-circuit
  ok(activityResponseSchema, { events: [{ ...event, sequence_num: null, prev_score: null, decided_by: null, anchor_signature: null }] });
});

// --- v1/investigations/[slug]/audit/route.ts ---
test("audit: {slug, events, latest_root, total}", () => {
  const event = {
    id: "e1", sequence_num: 7, decision: "accept", created_at: "2026-09-26T10:00:00+00:00",
    prev_score: 12, new_score: 9, score_delta: -3, actor_label: "analyzer:0.91", decided_by: "analyzer",
    content_hash: "ab", reason: null, anchor_status: "confirmed", anchor_signature: "sig",
    anchor_slot: 301234567, anchor_block_time: "2026-09-26T10:00:05+00:00", anchor_cluster: "mainnet-beta",
  };
  ok(auditResponseSchema, { slug: "ftx", events: [event], latest_root: null, total: 1 });
  ok(auditResponseSchema, {
    slug: "ftx", events: [], total: 0,
    latest_root: { root_hash: "r", leaf_count: 3, anchor_signature: null, anchor_slot: null, anchor_cluster: null, published_at: "2026-09-26T10:00:00+00:00" },
  });
});

// --- requests/route.ts: the three POST outcomes, GET list, requests/[id] PATCH ---
test("requests: 201 created, 200 already published, 200 duplicate (with and without edit_token)", () => {
  const created = ok(requestCreateResponseSchema, {
    request: { id: "r1", status: "queued", priority: 0, created_at: "2026-09-26T10:00:00+00:00", slug: "foo", entity_name: "Foo" },
    edit_token: "t".repeat(43), signed_in: false, message: "Request received.",
  });
  assert.equal(created.request.id, "r1");
  ok(requestCreateResponseSchema, { duplicate: true, slug: "foo", message: "Investigation already published." });
  // The duplicate row is `id, status, priority, created_at` only: no slug, no entity_name.
  ok(requestCreateResponseSchema, {
    duplicate: true, request: { id: "r1", status: "queued", priority: 5, created_at: "2026-09-26T10:00:00+00:00" },
    notify: "sign_in_or_new_request", message: "You already have a pending request for this entity.",
  });
});
test("requests: GET list and PATCH answers", () => {
  ok(requestListResponseSchema, {
    requests: [{ id: "r1", entity_name: "Foo", slug: "foo", status: "fulfilled", priority: 5, created_at: "2026-09-26T10:00:00+00:00", fulfilled_investigation_id: "i1", rejected_reason: null }],
  });
  ok(notifyEmailResponseSchema, { ok: true, notify_email: "a@b.co", confirmed: false, confirmation_sent: true });
  ok(notifyEmailResponseSchema, { ok: true, notify_email: "a@b.co", confirmed: false, confirmation_sent: false, throttled: true, retry_after_seconds: 540 });
});

// --- scan/route.ts ---
test("scan: 201 fresh, 200 duplicate, 502 failed body all parse as a create response", () => {
  ok(scanCreateResponseSchema, { id: "s1", status: "complete", position_count: 12, unknown_count: 3, requests_created: 1, requests_bumped: 0 });
  ok(scanCreateResponseSchema, { id: "s1", status: "running", duplicate: true });
  const failed = ok(scanCreateResponseSchema, { id: "s1", status: "failed", error: "scan_failed" });
  assert.equal(failed.status, "failed");
});
test("scan/[id]: report", () => {
  ok(scanReportSchema, {
    scan: {
      id: "s1", account_id: null, address: "So11111111111111111111111111111111111111112", chain: "solana", status: "complete", error: null,
      wallet_identity: null, total_value_usd: 10.5, covered_value_usd: 5, risk_score: 40, position_count: 2, covered_count: 1,
      unknown_count: 1, unpriced_count: 0, requests_created: 0, requests_bumped: 0,
      created_at: "2026-09-26T10:00:00+00:00", completed_at: "2026-09-26T10:00:20+00:00", expires_at: null,
    },
    holdings: [{
      id: "h1", mint: "m", symbol: "SOL", name: "Solana", amount: 1, value_usd: 10, investigation_id: null, slug: null,
      trust_score: null, goplus_summary: null, request_id: null, flags: ["no_page", "dust"], rank: 1,
    }],
  });
});

// --- me/route.ts ---
const account = {
  id: "acc1", user_id: "u1", handle: "chad", display_name: null, anon_by_default: false,
  created_at: "2026-09-26T10:00:00+00:00", updated_at: "2026-09-26T10:00:00+00:00",
  wallet_pubkey: null, wallet_verified_at: null, seeker_verified_at: null, skr_tier: "none", skr_checked_at: null,
  seeker_verified: false,
};
test("me: GET with and without an accounts row; PATCH {account, created}", () => {
  const rep = { repScore: 0, acceptedCount: 0, rejectedCount: 0, isTrusted: false };
  ok(meResponseSchema, { user_id: "u1", email: "a@b.co", account, rep, wallet_watch: { watched: false, reason: null, since: null } });
  ok(meResponseSchema, { user_id: "u1", email: null, account: null, rep });
  ok(meUpdateResponseSchema, { account, created: true });
});

// --- submissions/route.ts ---
test("submissions: 201 with auto_decision null, 200 duplicate", () => {
  const row = { id: "s1", status: "under_review", content_hash: "h", kind: "url", valence: "incriminating", created_at: "2026-09-26T10:00:00+00:00", submitter_account_id: null };
  ok(submissionCreateResponseSchema, {
    submission: row, canonical_string_preview: "{}", page: { slug: "ftx", entity_name: "FTX" }, auto_decision: null, auto_accepted: null,
  });
  ok(submissionCreateResponseSchema, { duplicate: true, submission: { id: "s1", status: "accepted", content_hash: "h", kind: "url", valence: "incriminating", created_at: "2026-09-26T10:00:00+00:00" }, message: "This resource was already submitted for this page." });
});

// --- public reads ---
test("search / lookup / investigations list", () => {
  ok(searchResponseSchema, { results: [{ slug: "ftx", entity_name: "FTX", trust_score: 12, match_source: "investigation", matched_entity: null }] });
  ok(lookupResponseSchema, { matches: [{ slug: "ftx", entity_name: "FTX", trust_score: 12, confidence: 0.8, status: "published", content_type: "exchange", source_tags: [], updated_at: "2026-09-26T10:00:00+00:00" }], total: 1 });
  ok(investigationListResponseSchema, { investigations: [{ slug: "ftx", entity_name: "FTX", trust_score: null, confidence: null, status: "published", content_type: null, summary: null, source_tags: null, reviewed: null, created_at: "2026-09-26T10:00:00+00:00", updated_at: "2026-09-26T10:00:00+00:00" }], total: 1, limit: 25, offset: 0 });
});

// --- failure bodies: what the person is shown ---
test("error text: codes become sentences, route-authored messages win", () => {
  // requests + scan + submissions 429: {error:"rate_limited", limit, scope} — no message.
  const rl = describeErrorBody(429, { error: "rate_limited", limit: 3, scope: "ip" });
  assert.equal(rl.code, "rate_limited");
  assert.doesNotMatch(rl.message, /rate_limited/);
  // requests/[id] PATCH 429 has its own message.
  assert.equal(describeErrorBody(429, { error: "rate_limited", message: "Too many notification changes. Try again later." }).message, "Too many notification changes. Try again later.");
  // parseJsonBody 400.
  const v = describeErrorBody(400, { error: "validation_failed", issues: [{ path: ["entity"], message: "Too big: expected string to have <=200 characters" }] });
  assert.match(v.message, /^entity: /);
  // watchlist 409 keeps its code and the route's sentence.
  assert.equal(describeErrorBody(409, { error: "Watchlist limit reached", limit: 10 }).message, "Watchlist limit reached");
  // scan 502.
  assert.doesNotMatch(describeErrorBody(502, { id: "s1", status: "failed", error: "scan_failed" }).message, /scan_failed/);
  // no body at all.
  assert.equal(describeErrorBody(500, null).message, "Request failed (500)");
});
