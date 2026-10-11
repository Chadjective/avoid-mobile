/**
 * Countersign memo — the user-signed on-chain action (docs/MOBILE_APP_SPEC.md D5).
 *
 * SOURCE OF TRUTH: `web/src/lib/attestations.ts`. The two functions below are
 * a line-for-line port of `buildCountersignMemo()` and
 * `countersignMemoPrefix()` from that file, and they must stay that way.
 * `POST /api/v1/attestations` refetches the transaction and accepts it only if
 * some memo in it `startsWith(countersignMemoPrefix(content_hash, slug))` —
 * so a single character of drift here (a lowercased hash, a reordered field, a
 * different separator) turns every countersign from this app into a
 * `memo_mismatch` 422. Change the web file first, then mirror it here.
 *
 * The verified prefix is
 *   AVOID.NET|v1|att:<submission content_hash>|s:<slug>|
 * and the app appends `t:<iso>`. The timestamp is deliberately NOT verified
 * (web/src/lib/attestations.ts explains why): it only exists so two
 * countersigns of the same submission by the same wallet produce different
 * transaction bytes.
 *
 * No program deployment, ~5,000 lamports, and it makes "distinct submitters"
 * in SPEC §6 mean something a server cannot fake.
 */
import { Buffer } from "buffer";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

/**
 * SPL Memo v2. The same program the anchor worker writes through, and the
 * same id `MEMO_PROGRAM_ID` names in web/src/lib/attestations.ts.
 */
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export const MEMO_PREFIX = "AVOID.NET|v1";

/**
 * Everything in the memo that the server pins, up to and including the bar.
 *
 * Ported verbatim from `countersignMemoPrefix()` in web/src/lib/attestations.ts.
 * Note what it does NOT do: it does not normalise the case of `contentHash`.
 * The hash is echoed back exactly as `POST /api/submissions` returned it
 * (Node's `createHash(...).digest("hex")`, already lowercase), because the
 * server compares the prefix byte for byte.
 */
export function countersignMemoPrefix(contentHash: string, slug: string): string {
  return `AVOID.NET|v1|att:${contentHash}|s:${slug}|`;
}

/**
 * The canonical memo text for a countersignature.
 *
 * Ported verbatim from `buildCountersignMemo()` in web/src/lib/attestations.ts.
 * Call it exactly as the server's own helper is called:
 *
 *   buildCountersignMemo(submission.content_hash, slug, new Date().toISOString())
 */
export function buildCountersignMemo(
  contentHash: string,
  slug: string,
  isoNow: string,
): string {
  return `${countersignMemoPrefix(contentHash, slug)}t:${isoNow}`;
}

/**
 * A guard the server does not need but the app does: a malformed hash or a
 * slug containing the separator would build a memo that can never verify, and
 * finding that out costs a real transaction. Called before signing, not
 * inside the memo builders — those stay byte-identical to the web file.
 */
export function assertCountersignable(contentHash: string, slug: string): void {
  if (!/^[0-9a-f]{64}$/i.test(contentHash)) {
    throw new Error("contentHash must be the submission's 64-char hex SHA-256.");
  }
  if (slug.includes("|")) {
    throw new Error("slug must not contain the memo separator.");
  }
}

/**
 * The SPL Memo v2 instruction carrying `text`, signed by `signer`.
 *
 * Memo v2 takes the signer as a read-only signer key. That key is what makes
 * the memo attributable to this wallet rather than merely present in a
 * transaction it happened to pay for, and it is what the route's
 * `signerKeys()` check reads back off the chain.
 */
export function buildMemoInstruction(text: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(text, "utf8"),
  });
}

/**
 * The unsigned countersign transaction for the user's wallet to sign.
 *
 * The flow this belongs to (app/entity/[slug]/submit.tsx):
 *   1. POST /api/submissions            → { submission: { id, content_hash } }
 *   2. buildCountersignMemo(hash, slug, new Date().toISOString())
 *   3. buildCountersignTransaction(...) → this transaction
 *   4. withWallet(w => w.signAndSendTransactions({ transactions: [tx] }))
 *   5. POST /api/v1/attestations        → { submission_id, signer_pubkey,
 *                                           memo_signature, cluster }
 */
export function buildCountersignTransaction(
  contentHash: string,
  slug: string,
  options: { feePayer: PublicKey; recentBlockhash: string; isoNow?: string },
): { transaction: Transaction; memo: string } {
  assertCountersignable(contentHash, slug);
  const memo = buildCountersignMemo(
    contentHash,
    slug,
    options.isoNow ?? new Date().toISOString(),
  );

  const tx = new Transaction();
  tx.feePayer = options.feePayer;
  tx.recentBlockhash = options.recentBlockhash;
  tx.add(buildMemoInstruction(memo, options.feePayer));
  return { transaction: tx, memo };
}
