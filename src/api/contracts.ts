/**
 * Response contracts that must be checkable without React Native.
 *
 * This module imports `zod` and nothing else on purpose: `tests/contracts.test.mjs`
 * loads it straight into Node (type stripping, no bundler) and feeds it JSON
 * copied from the server's own response construction. Anything that needs
 * `fetch`, Supabase or SecureStore stays in its own file and re-exports from
 * here, so no screen import changed.
 *
 * WHY THIS EXISTS. Two shape mismatches (Follow/Mute and push registration)
 * reached a phone because each schema was written from a spec sketch and
 * nothing ever compared it with what the route really returns. The rule now:
 * a schema here is copied from the `NextResponse.json({...})` call in the
 * route named above it, and the test holds a fixture copied from the same
 * place. When a route changes, change the fixture in the same commit.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Failure text. web/src/app/api/** answers failures as {error, message?, ...}.
// `error` is frequently a machine code ("rate_limited", "validation_failed"),
// and several routes send no `message` at all, so the client used to show the
// code to a person. This turns the codes into sentences.
// ---------------------------------------------------------------------------

const issueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])).optional(),
  message: z.string().optional(),
});

const errorBodySchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  issues: z.array(issueSchema).optional(),
});

export function describeErrorBody(
  status: number,
  payload: unknown,
): { code: string | null; message: string } {
  const parsed = errorBodySchema.safeParse(payload);
  const body = parsed.success ? parsed.data : {};
  const code = body.error ?? null;
  const fallback = `Request failed (${status})`;

  // A route-authored sentence always wins.
  if (body.message) return { code, message: body.message };

  // 400 {error:"validation_failed", issues} from parseJsonBody(): say which field.
  if (code === "validation_failed") {
    const first = body.issues?.find((i) => i.message);
    const field = first?.path?.length ? String(first.path[first.path.length - 1]) : null;
    if (first?.message) return { code, message: field ? `${field}: ${first.message}` : first.message };
    return { code, message: "That was not accepted. Check what you entered and try again." };
  }

  // 429 {error:"rate_limited", limit, scope} — /api/requests, /api/scan and
  // /api/submissions send no message. Screens with better words (they know
  // whether the caller is signed in) still override this.
  if (code === "rate_limited" || status === 429) {
    return { code, message: "You have hit the limit for now. Try again later." };
  }

  // 502 {id, status:"failed", error:"scan_failed"} from POST /api/scan.
  if (code === "scan_failed") {
    return {
      code,
      message:
        "The scan failed upstream. Try again in a minute — a failed scan is not charged against your daily limit.",
    };
  }

  return { code, message: body.error ?? fallback };
}

// ---------------------------------------------------------------------------
// Watchlist — web/src/app/api/v1/watchlist/route.ts, [id]/route.ts, _shared.ts
// ---------------------------------------------------------------------------

export const watchTargetKindSchema = z.enum(["investigation", "address"]);
export type WatchTargetKind = z.infer<typeof watchTargetKindSchema>;

/**
 * `band` is `PageTrustBand | null` from web/src/lib/trust-bands.ts. "VERIFIED"
 * is the pre-Sept-2026 name for the top band and is read as LOW_RISK so this
 * build parses a server from either side of the rename.
 */
export const watchlistItemSchema = z.object({
  id: z.string(),
  target_kind: watchTargetKindSchema,
  slug: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  chain: z.string().nullable().optional(),
  entity_name: z.string().nullable().optional(),
  trust_score: z.number().nullable().optional(),
  band: z
    .enum(["CRITICAL", "WARNING", "CAUTIONARY", "LOW_RISK", "VERIFIED"])
    .transform((b) => (b === "VERIFIED" ? ("LOW_RISK" as const) : b))
    .nullable()
    .optional(),
  muted: z.boolean(),
  created_at: z.string().optional(),
  // Added to the web route for the compact Watch rows. All optional: an older
  // server omits them and the row simply renders without that line.
  entity_type: z.string().nullable().optional(),
  top_risk: z.string().nullable().optional(),
  event_count: z.number().nullable().optional(),
  score_moved_at: z.string().nullable().optional(),
  previous_score: z.number().nullable().optional(),
});
export type WatchlistItem = z.infer<typeof watchlistItemSchema>;

/** GET → `{ items }`. */
export const watchlistResponseSchema = z.object({ items: z.array(watchlistItemSchema) });

/** POST (201 new / 200 already followed) and PATCH → `{ item }`. */
export const watchlistItemResponseSchema = z.object({ item: watchlistItemSchema });

// ---------------------------------------------------------------------------
// Devices — web/src/app/api/v1/devices/route.ts
// ---------------------------------------------------------------------------

export const pushDeviceSchema = z.object({
  id: z.string(),
  expo_push_token: z.string(),
  platform: z.string(),
  app_version: z.string().nullable().optional(),
  last_seen_at: z.string().optional(),
  disabled_at: z.string().nullable().optional(),
});
export type PushDevice = z.infer<typeof pushDeviceSchema>;

/** POST → 201 `{ id }` and nothing else (the upsert selects only the id). */
export const registerDeviceResponseSchema = z.object({ id: z.string() });

/** The route's `platform` enum. Anything else is a 400 validation_failed. */
export function toServerPlatform(os: string): "android" | "ios" {
  return os === "ios" ? "ios" : "android";
}

// ---------------------------------------------------------------------------
// Feed — web/src/app/api/v1/feed/route.ts (FEED_FIELDS) + migration 053
// ---------------------------------------------------------------------------

export const alertKindSchema = z.enum([
  "score_changed",
  "evidence_accepted",
  "review_verdict",
  "page_published",
  "request_fulfilled",
  "wallet_activity",
  "scan_complete",
]);
export type AlertKind = z.infer<typeof alertKindSchema>;

export const alertSchema = z.object({
  /** BIGINT identity column: a JSON number. */
  id: z.union([z.number(), z.string()]),
  kind: alertKindSchema,
  slug: z.string().nullable().optional(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  /** Not in FEED_FIELDS today; kept optional in case the route adds it. */
  channel: z.enum(["push", "email"]).optional(),
  created_at: z.string(),
  sent_at: z.string().nullable().optional(),
});
export type Alert = z.infer<typeof alertSchema>;

export const feedResponseSchema = z.object({ items: z.array(alertSchema) });

// ---------------------------------------------------------------------------
// Attestations — web/src/app/api/v1/attestations/route.ts (ATTESTATION_FIELDS)
// ---------------------------------------------------------------------------

export const attestationSchema = z.object({
  id: z.string(),
  submission_id: z.string(),
  signer_pubkey: z.string(),
  memo_signature: z.string(),
  slot: z.number().nullable().optional(),
  cluster: z.string(),
  created_at: z.string(),
});
export type Attestation = z.infer<typeof attestationSchema>;

/** POST 201 and the 200 duplicate → `{ attestation }`. */
export const attestationResponseSchema = z.object({ attestation: attestationSchema });
/** GET → `{ submission_id, attestations, total }`. */
export const attestationListResponseSchema = z.object({
  attestations: z.array(attestationSchema),
});

// ---------------------------------------------------------------------------
// Activity — web/src/app/api/v1/activity/route.ts (the object built in the map)
// ---------------------------------------------------------------------------

export const activityEventSchema = z.object({
  id: z.string(),
  slug: z.string(),
  entity_name: z.string(),
  decision: z.string(),
  /** Null on rows written before the moderation API assigned sequence numbers. */
  sequence_num: z.number().nullable(),
  created_at: z.string(),
  prev_score: z.number().nullable(),
  new_score: z.number().nullable(),
  score_delta: z.number().nullable(),
  actor_label: z.string().nullable(),
  decided_by: z.string().nullable(),
  anchor_status: z.string().nullable(),
  anchor_signature: z.string().nullable(),
  anchor_cluster: z.string().nullable(),
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const activityResponseSchema = z.object({ events: z.array(activityEventSchema) });

// ---------------------------------------------------------------------------
// Audit — web/src/app/api/v1/investigations/[slug]/audit/route.ts
// ---------------------------------------------------------------------------

export const decisionRowSchema = z.object({
  id: z.string(),
  /** Null on rows written before the moderation API assigned sequence numbers. */
  sequence_num: z.number().nullable(),
  decision: z.string(),
  created_at: z.string(),
  prev_score: z.number().nullable(),
  new_score: z.number().nullable(),
  score_delta: z.number().nullable(),
  actor_label: z.string().nullable(),
  decided_by: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  content_hash: z.string().nullable(),
  anchor_status: z.string().nullable(),
  anchor_signature: z.string().nullable(),
  anchor_slot: z.number().nullable(),
  anchor_block_time: z.string().nullable(),
  anchor_cluster: z.string().nullable(),
});
export type DecisionRow = z.infer<typeof decisionRowSchema>;

export const merkleRootSchema = z.object({
  root_hash: z.string(),
  leaf_count: z.number(),
  anchor_signature: z.string().nullable(),
  anchor_slot: z.number().nullable(),
  anchor_cluster: z.string().nullable(),
  published_at: z.string(),
});
export type MerkleRoot = z.infer<typeof merkleRootSchema>;

export const auditResponseSchema = z.object({
  slug: z.string(),
  events: z.array(decisionRowSchema),
  latest_root: merkleRootSchema.nullable(),
  total: z.number(),
});
export type AuditTrail = z.infer<typeof auditResponseSchema>;
