/**
 * The on-chain audit trail for a page: the ordered decision events and the
 * Solana transaction each one was anchored in.
 *
 * contract: docs/MOBILE_APP_SPEC.md §8 — and a gap in it, now closed.
 *
 * §8 lists the public reads the app uses "unchanged" and an audit-trail route
 * was not among them: on 2026-09-16 no route under web/src/app/api returned
 * `decision_events`, and the website rendered /[slug]/audit by querying
 * Supabase from a server component holding the service key, which a native
 * client cannot do. `GET /api/v1/investigations/:slug/audit` was added for
 * this screen (web/src/app/api/v1/investigations/[slug]/audit/route.ts), so
 * the app reads it over HTTP with the same `s-maxage=300` as the rest of /v1
 * rather than needing an RLS read policy on the table.
 *
 * The route publishes a NARROWER row than the columns web's audit page selects
 * for itself, and the schema below matches the route, not the page:
 *
 *   - `reason` — the moderator's decision reason, derived server-side from
 *     the canonical bytes (which are never returned; `content_hash` is).
 *   - `decided_by` — public; the page renders it as a pill.
 *   - `submission_id` is NOT returned — a join key into submitter-linked rows;
 *     the source-URL / Wayback provenance the web page shows under each
 *     decision is not available to the app yet.
 *   - `anchored_at` is NOT returned — operational, never rendered.
 *
 * `anchor_block_time` is a TIMESTAMPTZ (migration 004), so it arrives as an
 * ISO string, not a unix number.
 */
import { z } from "zod";
import { apiRequest } from "./client";
import { auditResponseSchema, type AuditTrail, type DecisionRow } from "./contracts";

export {
  decisionRowSchema,
  merkleRootSchema,
  type DecisionRow,
  type MerkleRoot,
  type AuditTrail,
} from "./contracts";

/**
 * contract: docs/MOBILE_APP_SPEC.md §8.
 *
 * Newest decision first. `before` is an exclusive cursor on sequence_num —
 * pass back the smallest one already held to page further into the history.
 */
export async function getAuditPage(
  slug: string,
  options: { limit?: number; before?: number } = {},
): Promise<AuditTrail> {
  return apiRequest(`/api/v1/investigations/${encodeURIComponent(slug)}/audit`, {
    schema: auditResponseSchema,
    auth: "none",
    query: { limit: options.limit, before: options.before },
  });
}

/** The first page of decisions, newest first. */
export async function getAuditTrail(slug: string): Promise<DecisionRow[]> {
  const res = await getAuditPage(slug);
  return res.events;
}

/**
 * GET /api/v1/investigations/:slug/proof?event_id= — this one DOES exist.
 * Merkle membership proof for one decision event. `merkle_roots` has 0 rows
 * until the Merkle root worker is deployed, so `root_matches_published` comes
 * back false today (spec §3.2).
 */
export const proofResponseSchema = z.looseObject({
  root_matches_published: z.boolean().optional(),
});

export async function getProof(slug: string, eventId: string) {
  return apiRequest(`/api/v1/investigations/${encodeURIComponent(slug)}/proof`, {
    schema: proofResponseSchema,
    auth: "none",
    query: { event_id: eventId },
  });
}
