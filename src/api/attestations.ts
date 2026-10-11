/**
 * Evidence countersigned from the user's own wallet (D5).
 *
 * THE ROUTE NOW EXISTS: web/src/app/api/v1/attestations/route.ts. The shapes
 * below were read off that handler, not off the spec, and they differ from
 * what §8 sketched in one way that matters: both the 201 and the 200-duplicate
 * wrap the row in `{ attestation }`, so the schema is an envelope.
 *
 *   POST /api/v1/attestations ← {submission_id, signer_pubkey, memo_signature, cluster}
 *     The server refetches the transaction from the cluster the caller named
 *     and re-derives every fact from the chain: that it landed, that it
 *     succeeded, that it carries a memo starting with
 *     countersignMemoPrefix(content_hash, slug), and that signer_pubkey is
 *     among the transaction's signers.
 *       201 {attestation}  — recorded
 *       200 {attestation}  — this signature was already recorded (23505)
 *       401 {error}        — no session
 *       403 {error}        — no handle yet, OR signer_pubkey is not the
 *                            wallet linked to this account (wallet_verified_at
 *                            must be set; the bare pubkey is not enough)
 *       404 {error}        — no such submission
 *       422 {error, reason ∈ tx_not_found · tx_failed · memo_missing ·
 *                            memo_mismatch · signer_mismatch}
 *       502 {error, reason: "rpc_unavailable"} — transport, not a verdict.
 *                            Keep the signature and retry; do NOT re-send a
 *                            transaction.
 *   GET /api/v1/attestations?submission_id= → {submission_id, attestations, total}
 *     Public and cached (s-maxage=60); it is part of the audit trail.
 *
 * Backed by `evidence_attestations` (migration 054).
 */
import { z } from "zod";
import { apiRequest, ApiError } from "./client";
import {
  attestationListResponseSchema,
  attestationResponseSchema,
  type Attestation,
} from "./contracts";

export { attestationSchema, type Attestation } from "./contracts";

/**
 * The clusters the ROUTE accepts — `attestationCreateSchema` in
 * web/src/lib/schemas/api.ts is `z.enum(["mainnet-beta", "devnet"])`. The
 * app's own ClusterId also has "testnet", which this route would reject with
 * a 400, so the conversion is explicit rather than a cast.
 */
export const attestationClusterSchema = z.enum(["mainnet-beta", "devnet"]);
export type AttestationCluster = z.infer<typeof attestationClusterSchema>;

export function toAttestationCluster(cluster: string): AttestationCluster | null {
  return cluster === "mainnet-beta" || cluster === "devnet" ? cluster : null;
}

/** The 422 reasons the route returns, from lib/attestations.ts. */
export const attestationRejectReasonSchema = z.enum([
  "tx_not_found",
  "tx_failed",
  "memo_missing",
  "memo_mismatch",
  "signer_mismatch",
]);
export type AttestationRejectReason = z.infer<typeof attestationRejectReasonSchema>;

const rejectBodySchema = z.object({
  error: z.string().optional(),
  reason: attestationRejectReasonSchema,
});

/**
 * The reason a 422 gave, or null for any other failure. Lets a caller say
 * "that transaction does not carry this evidence's hash" rather than "422".
 */
export function rejectReasonOf(error: unknown): AttestationRejectReason | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;
  const parsed = rejectBodySchema.safeParse(error.body);
  return parsed.success ? parsed.data.reason : null;
}

/**
 * Plain words for each verdict — DESIGN.md §5 voice, second person, no jargon
 * the user cannot act on. Every one of the five says what happened AND what
 * to do, because three of them are retryable and two are not.
 */
export const REJECT_REASON_TEXT: Record<AttestationRejectReason, string> = {
  tx_not_found:
    "The network has not seen that transaction yet. It may still be confirming — retry verification in a moment.",
  tx_failed:
    "That transaction failed on-chain, so it vouches for nothing. Your evidence was still submitted; you can countersign again.",
  memo_missing:
    "That transaction carries no memo, so there is nothing for the server to check. Countersign again.",
  memo_mismatch:
    "The memo in that transaction does not name this evidence. Countersign again from this screen rather than reusing an older transaction.",
  signer_mismatch:
    "The wallet you named did not sign that transaction. Countersign with the wallet linked to your account.",
};

/** True when the failure is transport, not a verdict: keep the signature. */
export function isRpcUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 502;
}

/**
 * POST /api/v1/attestations. Returns the stored row from either the 201 or
 * the 200 duplicate — both are success as far as the app is concerned, since
 * both mean the chain and the database agree.
 */
export async function recordAttestation(body: {
  submission_id: string;
  signer_pubkey: string;
  memo_signature: string;
  cluster: AttestationCluster;
}): Promise<Attestation> {
  const res = await apiRequest("/api/v1/attestations", {
    method: "POST",
    body,
    schema: attestationResponseSchema,
    auth: "required",
  });
  return res.attestation;
}

/** GET /api/v1/attestations?submission_id= — public, cached, audit trail. */
export async function listAttestations(submissionId: string): Promise<Attestation[]> {
  const res = await apiRequest("/api/v1/attestations", {
    schema: attestationListResponseSchema,
    auth: "none",
    query: { submission_id: submissionId },
  });
  return res.attestations;
}
