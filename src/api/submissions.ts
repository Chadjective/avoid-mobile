/**
 * Community evidence. Six kinds, a SHA-256 content hash, per-IP rate limits,
 * and a dedupe that returns the existing row rather than an error.
 */
import { apiRequest } from "./client";
import {
  submissionCreateResponseSchema,
  submissionListResponseSchema,
  type SubmissionKind,
  type SubmissionValence,
} from "./types";

export type SubmissionPayload =
  | { kind: "url"; url: string }
  | { kind: "tx"; chain: string; tx_hash: string }
  | { kind: "address"; chain: string; address: string }
  | { kind: "account"; platform: string; handle: string }
  | { kind: "claim"; text: string }
  | { kind: "file"; filename: string; sha256: string; size_bytes: number };

/** POST /api/submissions */
export async function createSubmission(body: {
  slug: string;
  kind: SubmissionKind;
  payload: SubmissionPayload;
  valence?: SubmissionValence;
  note?: string;
  show_handle?: boolean;
  /** Ignored by the server when a session is present. */
  submitter_handle?: string;
}) {
  return apiRequest("/api/submissions", {
    method: "POST",
    body,
    schema: submissionCreateResponseSchema,
    auth: "optional",
  });
}

/** GET /api/submissions?slug= — public, every submission on a page. */
export async function listSubmissions(slug: string) {
  const res = await apiRequest("/api/submissions", {
    schema: submissionListResponseSchema,
    auth: "none",
    query: { slug },
  });
  return res.submissions;
}
