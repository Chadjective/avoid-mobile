/**
 * Response schemas, each mirrored from the web route that produces it.
 *
 * Every field below was read off the route handler named in the comment above
 * it — nothing is invented. Where a column is nullable in Postgres the schema
 * is `.nullable()`, and unknown extra keys are allowed (zod objects strip by
 * default) so a new column on the web side cannot break the app.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared pieces — web/src/lib/schemas/investigation.ts
// ---------------------------------------------------------------------------

export const sourceSchema = z.object({
  name: z.string(),
  url: z.string(),
  type: z.string(),
  credibility: z.number().nullable().optional(),
  // Two field names exist in production; readers must tolerate both.
  wayback_url: z.string().nullable().optional(),
  archive_url: z.string().nullable().optional(),
  archive_timestamp: z.string().nullable().optional(),
  anchor_signature: z.string().nullable().optional(),
  anchor_cluster: z.string().nullable().optional(),
});
export type Source = z.infer<typeof sourceSchema>;

/** The archive snapshot URL for a source, under either field name. */
export function sourceArchiveUrl(source: Source): string | null {
  return source.wayback_url ?? source.archive_url ?? null;
}

export const sectionSchema = z.object({
  heading: z.string(),
  content: z.string(),
  severity: z.string().nullable().optional(),
  sources: z.array(sourceSchema).nullable().optional(),
});
export type InvestigationSection = z.infer<typeof sectionSchema>;

export const timelineEventSchema = z.object({
  /** `YYYY-MM-DD`, `YYYY-MM` or `YYYY` — only as precise as the source supports. */
  date: z.string(),
  event: z.string(),
  source: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  date_evidence: z.string().nullable().optional(),
  date_original: z.string().nullable().optional(),
});
export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export const addressEntrySchema = z.union([
  z.string(),
  z.object({
    chain: z.string().nullable().optional(),
    address: z.string(),
    label: z.string().nullable().optional(),
  }),
]);

// ---------------------------------------------------------------------------
// GET /api/v1/investigations — web/src/app/api/v1/investigations/route.ts
// LIST_FIELDS is the exact column list that route selects.
// ---------------------------------------------------------------------------

export const investigationListItemSchema = z.object({
  slug: z.string(),
  entity_name: z.string(),
  trust_score: z.number().nullable(),
  confidence: z.number().nullable(),
  status: z.string(),
  content_type: z.string().nullable(),
  summary: z.string().nullable(),
  source_tags: z.array(z.string()).nullable(),
  reviewed: z.boolean().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type InvestigationListItem = z.infer<typeof investigationListItemSchema>;

export const investigationListResponseSchema = z.object({
  investigations: z.array(investigationListItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

// ---------------------------------------------------------------------------
// GET /api/v1/investigations/[slug] — DETAIL_FIELDS in that route.
// ---------------------------------------------------------------------------

export const investigationDetailSchema = z.object({
  slug: z.string(),
  entity_name: z.string(),
  trust_score: z.number().nullable(),
  /**
   * NULL on ~98% of rows. NULL means "this number was not produced by the
   * deterministic scorer" and the gauge must show the Provisional caveat —
   * docs/MOBILE_APP_SPEC.md D8.
   */
  severity_base: z.number().nullable(),
  score_modifier: z.number().nullable(),
  confidence: z.number().nullable(),
  status: z.string(),
  content_type: z.string().nullable(),
  summary: z.string().nullable(),
  sections: z.array(sectionSchema).nullable(),
  timeline: z.array(timelineEventSchema).nullable(),
  sources_used: z.array(sourceSchema).nullable(),
  source_tags: z.array(z.string()).nullable(),
  addresses: z.array(addressEntrySchema).nullable(),
  reviewed: z.boolean().nullable(),
  reviewed_by: z.string().nullable(),
  model_used: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  /**
   * Added by the web API for the page action block; ALL optional because an
   * older server omits them (the app then falls back to `updated_at` and the
   * normal, no-cooldown state).
   */
  content_updated_at: z.string().nullable().optional(),
  update_next_allowed_at: z.string().nullable().optional(),
  last_fact_checked_at: z.string().nullable().optional(),
  fact_check_next_allowed_at: z.string().nullable().optional(),
});
export type InvestigationDetail = z.infer<typeof investigationDetailSchema>;

export const investigationDetailResponseSchema = z.object({
  investigation: investigationDetailSchema,
  /**
   * Un-muted followers of the page; null when fewer than 3 (the server
   * withholds tiny counts). Absent on an older server, so optional.
   */
  follower_count: z.number().nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/search — web/src/app/api/search/route.ts, type Suggestion.
// ---------------------------------------------------------------------------

export const searchSuggestionSchema = z.object({
  slug: z.string(),
  entity_name: z.string(),
  trust_score: z.number().nullable(),
  // A plain string, not an enum: the server also sends "merged" (and may add
  // more), and an unknown value must not fail the whole search response.
  match_source: z.string().optional(),
  matched_entity: z
    .object({ kind: z.string(), value: z.string() })
    .nullable()
    .optional(),
});
export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchSuggestionSchema),
});

// ---------------------------------------------------------------------------
// GET /api/v1/lookup — RESULT_FIELDS in web/src/app/api/v1/lookup/route.ts.
// ---------------------------------------------------------------------------

export const lookupMatchSchema = z.object({
  slug: z.string(),
  entity_name: z.string(),
  trust_score: z.number().nullable(),
  confidence: z.number().nullable(),
  status: z.string(),
  content_type: z.string().nullable(),
  source_tags: z.array(z.string()).nullable(),
  updated_at: z.string(),
});
export type LookupMatch = z.infer<typeof lookupMatchSchema>;

export const lookupResponseSchema = z.object({
  matches: z.array(lookupMatchSchema),
  total: z.number(),
});

// ---------------------------------------------------------------------------
// Wallet scan — web/src/app/api/scan/route.ts (POST) and
// web/src/app/api/scan/[id]/route.ts (GET, shape from lib/wallet-scan-store.ts).
// ---------------------------------------------------------------------------

export const scanStatusSchema = z.enum(["pending", "running", "complete", "partial", "failed"]);
export type ScanStatus = z.infer<typeof scanStatusSchema>;

/** POST /api/scan → 201 fresh scan, or 200 with duplicate:true, or 502 failed. */
export const scanCreateResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  duplicate: z.boolean().optional(),
  position_count: z.number().nullable().optional(),
  unknown_count: z.number().nullable().optional(),
  requests_created: z.number().optional(),
  requests_bumped: z.number().optional(),
  error: z.string().optional(),
});
export type ScanCreateResponse = z.infer<typeof scanCreateResponseSchema>;

/** GET /api/scan — the signed-in account's last 10 scans (web/src/app/api/scan/route.ts). */
export const scanHistoryRowSchema = z.object({
  id: z.string(),
  address: z.string(),
  chain: z.string().optional(),
  status: z.string(),
  risk_score: z.number().nullable().optional(),
  position_count: z.number().nullable().optional(),
  covered_count: z.number().nullable().optional(),
  unknown_count: z.number().nullable().optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
});
export type ScanHistoryRow = z.infer<typeof scanHistoryRowSchema>;
export const scanHistoryResponseSchema = z.object({ scans: z.array(scanHistoryRowSchema) });

/** web/src/lib/goplus.ts DerivedSummary. */
export const goplusSummarySchema = z.object({
  score: z.number(),
  risk_level: z.enum(["very_low", "low", "medium", "high", "extremely_high", "unknown"]),
  high: z.array(z.string()),
  medium: z.array(z.string()),
  low: z.array(z.string()),
});

/** web/src/lib/wallet-scan.ts HoldingFlag. */
export const holdingFlagSchema = z.enum([
  "no_page",
  "well_known",
  "possible_match",
  "unpriced",
  "dust",
  "baseline_pending",
  "goplus_high",
  "goplus_medium",
  "request_created",
  "request_bumped",
]);

export const scanRowSchema = z.object({
  id: z.string(),
  account_id: z.string().nullable(),
  address: z.string(),
  chain: z.string(),
  status: scanStatusSchema,
  error: z.string().nullable(),
  wallet_identity: z
    .object({
      type: z.string().nullable(),
      name: z.string().nullable(),
      category: z.string().nullable(),
      tags: z.array(z.string()),
      summary: z.object({
        risk_level: z.string(),
        high: z.array(z.string()),
        medium: z.array(z.string()),
        low: z.array(z.string()),
      }),
    })
    .nullable(),
  total_value_usd: z.number().nullable(),
  covered_value_usd: z.number().nullable(),
  risk_score: z.number().nullable(),
  position_count: z.number().nullable(),
  covered_count: z.number().nullable(),
  unknown_count: z.number().nullable(),
  unpriced_count: z.number().nullable(),
  requests_created: z.number(),
  requests_bumped: z.number(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  expires_at: z.string().nullable(),
});
export type ScanRow = z.infer<typeof scanRowSchema>;

export const holdingRowSchema = z.object({
  id: z.string(),
  mint: z.string(),
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  amount: z.number().nullable(),
  value_usd: z.number().nullable(),
  investigation_id: z.string().nullable(),
  slug: z.string().nullable(),
  trust_score: z.number().nullable(),
  goplus_summary: goplusSummarySchema.nullable(),
  request_id: z.string().nullable(),
  flags: z.array(holdingFlagSchema),
  rank: z.number().nullable(),
});
export type HoldingRow = z.infer<typeof holdingRowSchema>;

export const scanReportSchema = z.object({
  scan: scanRowSchema,
  holdings: z.array(holdingRowSchema),
});
export type ScanReport = z.infer<typeof scanReportSchema>;

// ---------------------------------------------------------------------------
// GET /api/me — web/src/app/api/me/route.ts returns { ...CurrentAccount, rep }.
// CurrentAccount is web/src/lib/auth.ts; rep is lib/stigmergy/rep.ts RepResult.
// ---------------------------------------------------------------------------

export const accountSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  handle: z.string(),
  display_name: z.string().nullable(),
  anon_by_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  // Migration 050 + web/src/app/api/me/route.ts (docs/MOBILE_APP_SPEC.md §8).
  // `seeker_verified` is derived server-side from `seeker_verified_at`, and
  // `wallet_verified_at` — not the bare pubkey — is what means the wallet was
  // proved. Still optional: an older deployment of the web app may not send
  // them, and the app degrades to "no wallet linked" rather than failing to
  // parse the account.
  wallet_pubkey: z.string().nullable().optional(),
  wallet_verified_at: z.string().nullable().optional(),
  seeker_verified: z.boolean().nullable().optional(),
  skr_tier: z.string().nullable().optional(),
  // Migration 071: the balances behind skr_tier, in whole SKR. Null until the
  // wallet is read; absent from an older server, where Profile shows the tier only.
  skr_liquid: z.number().nullable().optional(),
  skr_staked: z.number().nullable().optional(),
});
export type Account = z.infer<typeof accountSchema>;

export const repSchema = z.object({
  repScore: z.number(),
  acceptedCount: z.number(),
  rejectedCount: z.number(),
  isTrusted: z.boolean(),
});

/** One of the caller's own submissions with its verdict: GET /api/me `recent_submissions`. */
export const recentSubmissionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  /** under_review | accepted | rejected | revoked */
  status: z.string(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
  slug: z.string().nullable(),
  entity_name: z.string().nullable(),
  decision_reason: z.string().nullable(),
  score_delta: z.number().nullable(),
  prev_score: z.number().nullable().optional(),
  new_score: z.number().nullable().optional(),
});
export type RecentSubmission = z.infer<typeof recentSubmissionSchema>;

const usageWindowSchema = z.object({
  used: z.number().optional(),
  limit: z.number().optional(),
  resets_at: z.string().nullable().optional(),
});

export const meResponseSchema = z.object({
  user_id: z.string(),
  email: z.string().nullable(),
  /** null until the user picks a handle: PATCH /api/me creates the row. */
  account: accountSchema.nullable(),
  rep: repSchema,
  /**
   * Whether Helius is tracking the linked wallet for the Wallet Guardian bot
   * (spec §9.3). The free tier has 100 slots, so "not watched" is a normal
   * answer the Profile screen must state plainly. Optional so an older server
   * still parses.
   */
  wallet_watch: z
    .object({
      watched: z.boolean(),
      reason: z.string().nullable(),
      since: z.string().nullable(),
    })
    .optional(),
  /**
   * The account's last 20 submissions with verdicts. Optional so an older
   * server (and a failed lookup, which the server omits) still parses.
   */
  recent_submissions: z.array(recentSubmissionSchema).optional(),
  /**
   * Today's perk usage (web/src/lib/account-usage.ts), counted like the server
   * enforces it. Every field optional: an older server omits `usage`, and
   * session/perks.ts hasUsage() hides the meters unless all three counters came.
   */
  usage: z
    .object({
      scans: usageWindowSchema.optional(),
      requests: usageWindowSchema.optional(),
      follows: usageWindowSchema.optional(),
      queue_boost: z.number().optional(),
      tier_effective: z.string().optional(),
    })
    .optional(),
});
export type Me = z.infer<typeof meResponseSchema>;

/** PATCH /api/me → { account, created }. */
export const meUpdateResponseSchema = z.object({
  account: accountSchema,
  created: z.boolean(),
});

// ---------------------------------------------------------------------------
// Investigation requests — web/src/app/api/requests/route.ts.
// ---------------------------------------------------------------------------

export const investigationRequestSchema = z.object({
  id: z.string(),
  entity_name: z.string().optional(),
  slug: z.string().optional(),
  status: z.string(),
  priority: z.number().nullable().optional(),
  created_at: z.string(),
  /** Only GET /api/requests/:id selects this one; the list route does not. */
  updated_at: z.string().nullable().optional(),
  fulfilled_investigation_id: z.string().nullable().optional(),
  rejected_reason: z.string().nullable().optional(),
  /**
   * Only GET /api/requests/:id sends these, and only while the request is
   * queued (null otherwise): the 1-based place in drain order, the next
   * scheduled run, and the run this request is expected to be in. Estimates.
   * Older servers omit them; the screen then falls back to the local schedule.
   */
  queue_position: z.number().int().positive().nullable().optional(),
  /**
   * GET /api/requests (the list) also sends these per row; all optional and
   * nullable because an older server omits them. Score/band/name describe the
   * published page; queue_position is the 1-based place in line for queued rows.
   */
  page_trust_score: z.number().nullable().optional(),
  // Any string: the app never reads it, and an unknown band must not fail the list.
  page_band: z.string().nullable().optional(),
  page_entity_name: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  next_run_at: z.string().nullable().optional(),
  estimated_run_at: z.string().nullable().optional(),
});
export type InvestigationRequest = z.infer<typeof investigationRequestSchema>;

export const requestListResponseSchema = z.object({
  requests: z.array(investigationRequestSchema),
});

/**
 * POST /api/requests has three success shapes: a created request (201), a
 * "already published" short-circuit (200, `slug`), and a "you already asked"
 * dedupe (200, `request`).
 */
export const requestCreateResponseSchema = z.object({
  duplicate: z.boolean().optional(),
  slug: z.string().optional(),
  /** `slug` exists but is still a draft (404s in the app). Absent on older servers. */
  draft: z.boolean().optional(),
  request: investigationRequestSchema.optional(),
  signed_in: z.boolean().optional(),
  message: z.string().optional(),
  /** `kind: "update"` responses: an open update for this page already exists. */
  already_requested: z.boolean().optional(),
  kind: z.string().optional(),
  /**
   * The capability that authorises PATCH /api/requests/:id later. Returned
   * once, on creation and to a signed-in owner asking again; never to an
   * anonymous duplicate, which gets `notify: "sign_in_or_new_request"` instead
   * because dedupe keys on an IP hash and an IP is not a person.
   */
  edit_token: z.string().optional(),
  notify: z.string().optional(),
});
export type RequestCreateResponse = z.infer<typeof requestCreateResponseSchema>;

/**
 * PATCH /api/requests/:id. `confirmed` is true only when the address needed no
 * proof (a signed-in caller's own account email) or was already confirmed;
 * otherwise a confirmation link has been mailed and nothing is sent to that
 * address until it is followed.
 */
export const notifyEmailResponseSchema = z.object({
  ok: z.boolean(),
  notify_email: z.string().optional(),
  confirmed: z.boolean().optional(),
  confirmation_sent: z.boolean().optional(),
  throttled: z.boolean().optional(),
  retry_after_seconds: z.number().optional(),
});
export type NotifyEmailResponse = z.infer<typeof notifyEmailResponseSchema>;

// ---------------------------------------------------------------------------
// Evidence submissions — web/src/app/api/submissions/route.ts.
// ---------------------------------------------------------------------------

export const submissionKindSchema = z.enum(["url", "tx", "address", "account", "claim", "file"]);
export type SubmissionKind = z.infer<typeof submissionKindSchema>;

export const submissionValenceSchema = z.enum(["incriminating", "exonerating", "neutral"]);
export type SubmissionValence = z.infer<typeof submissionValenceSchema>;

export const submissionRowSchema = z.object({
  id: z.string(),
  status: z.string(),
  content_hash: z.string(),
  kind: submissionKindSchema,
  valence: submissionValenceSchema,
  created_at: z.string(),
  submitter_account_id: z.string().nullable().optional(),
});
export type SubmissionRow = z.infer<typeof submissionRowSchema>;

export const decisionEventSchema = z.object({
  id: z.string(),
  sequence_num: z.number(),
  content_hash: z.string(),
  anchor_status: z.string(),
});

export const autoDecisionSchema = z.object({
  route: z.enum(["accept", "reject"]),
  decision_event: decisionEventSchema,
  score: z.object({
    prev: z.number(),
    new: z.number(),
    delta: z.number(),
    modifier: z.number(),
  }),
  version_id: z.string().nullable(),
  analyzer: z
    .object({ confidence: z.number(), severity: z.string(), notes: z.string() })
    .optional(),
});

/** 201 create, or 200 with duplicate:true and only `submission`. */
export const submissionCreateResponseSchema = z.object({
  duplicate: z.boolean().optional(),
  message: z.string().optional(),
  submission: submissionRowSchema,
  canonical_string_preview: z.string().optional(),
  page: z.object({ slug: z.string(), entity_name: z.string() }).optional(),
  auto_decision: autoDecisionSchema.nullable().optional(),
  auto_accepted: autoDecisionSchema.nullable().optional(),
});

/** GET /api/submissions?slug= */
export const submissionListResponseSchema = z.object({
  submissions: z.array(
    z.object({
      id: z.string(),
      kind: submissionKindSchema,
      payload: z.unknown(),
      valence: submissionValenceSchema,
      status: z.string(),
      note: z.string().nullable(),
      submitter_handle: z.string().nullable(),
      wayback_status: z.string().nullable(),
      wayback_url: z.string().nullable(),
      analyzer_confidence: z.number().nullable(),
      analyzer_severity: z.string().nullable(),
      created_at: z.string(),
      resolved_at: z.string().nullable(),
    }),
  ),
});
