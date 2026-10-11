/**
 * The countersign flow, end to end (J5 / D5).
 *
 * Five steps, in this order, because each one is harder to undo than the last:
 *
 *   1. build the memo text — byte-identical to web/src/lib/attestations.ts;
 *   2. ask the wallet to sign AND send it (MWA `signAndSendTransactions`);
 *   3. write the signature to SecureStore BEFORE anything else can fail;
 *   4. wait for the cluster to confirm it, bounded;
 *   5. POST /api/v1/attestations so the server can re-derive it from chain.
 *
 * Step 3 is the one that is easy to leave out and expensive to leave out: the
 * route answers 502 when it cannot reach an RPC, and that is not a verdict —
 * the transaction may be perfectly good. See pending-attestations.ts.
 *
 * Nothing here trusts the client's own view of the chain. The app confirms the
 * transaction only so it does not hand the server a signature that is
 * certainly not visible yet (`tx_not_found`); the verification that counts is
 * the server's, from the cluster, on every field.
 */
import type { Web3MobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  recordAttestation,
  rejectReasonOf,
  isRpcUnavailable,
  REJECT_REASON_TEXT,
  type Attestation,
  type AttestationCluster,
} from "../api/attestations";
import { withRpc } from "./cluster";
import { assertCountersignable, buildCountersignTransaction } from "./memo";
import type { ConnectedWallet } from "./use-mobile-wallet";
import {
  clearPendingAttestation,
  markPendingError,
  savePendingAttestation,
  type PendingAttestation,
} from "./pending-attestations";

export type CountersignInput = {
  submissionId: string;
  contentHash: string;
  slug: string;
  cluster: AttestationCluster;
  /** The wallet that must sign: the account's verified `wallet_pubkey`. */
  expectedSigner: string;
  withWallet: <T>(
    callback: (wallet: Web3MobileWallet, account: ConnectedWallet) => Promise<T>,
  ) => Promise<T>;
};

export type CountersignResult =
  | { ok: true; attestation: Attestation }
  /** On-chain, not recorded. The signature is kept; offer "retry verification". */
  | { ok: false; retryable: true; pending: PendingAttestation; message: string }
  /** Nothing was sent, or the server ruled it out for good. */
  | { ok: false; retryable: false; message: string };

/** How long to wait for the cluster to see the transaction before posting. */
const CONFIRM_TRIES = 30;
const CONFIRM_INTERVAL_MS = 1_500;

export async function countersignSubmission(
  input: CountersignInput,
): Promise<CountersignResult> {
  assertCountersignable(input.contentHash, input.slug);

  let signature: string;
  let memo: string;
  try {
    const { blockhash } = await withRpc(input.cluster, (c) => c.getLatestBlockhash("confirmed"));

    const sent = await input.withWallet(async (wallet, account) => {
      // The wallet can hand back a different account than the one linked to
      // the AVOID.NET account (multiple wallets, an account switch inside the
      // wallet app). Sending in that case would burn a fee on a transaction
      // the route will reject with 403, so it is caught here instead.
      if (account.address !== input.expectedSigner) {
        throw new Error(
          `This wallet is signing as ${short(account.address)}, but the wallet linked to your account is ${short(input.expectedSigner)}. Switch accounts in your wallet app and try again.`,
        );
      }
      const built = buildCountersignTransaction(input.contentHash, input.slug, {
        feePayer: account.publicKey,
        recentBlockhash: blockhash,
      });
      const signatures = await wallet.signAndSendTransactions({
        transactions: [built.transaction],
      });
      const first = signatures[0];
      if (!first) throw new Error("The wallet returned no signature.");
      return { signature: first, memo: built.memo };
    });

    signature = sent.signature;
    memo = sent.memo;
  } catch (err) {
    // Nothing was sent (or we cannot know it was): no pending entry, because
    // an entry with no signature is not something a retry could use.
    return {
      ok: false,
      retryable: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const pending: PendingAttestation = {
    submission_id: input.submissionId,
    slug: input.slug,
    content_hash: input.contentHash,
    signer_pubkey: input.expectedSigner,
    memo_signature: signature,
    cluster: input.cluster,
    memo,
    created_at: new Date().toISOString(),
    last_error: null,
  };
  await savePendingAttestation(pending);

  await waitForConfirmation(input.cluster, signature);

  return recordPendingAttestation(pending);
}

/**
 * Step 5 on its own: hand a signature already on-chain to the server. This is
 * what "retry verification" calls, and it never sends a transaction.
 */
export async function recordPendingAttestation(
  pending: PendingAttestation,
): Promise<CountersignResult> {
  try {
    const attestation = await recordAttestation({
      submission_id: pending.submission_id,
      signer_pubkey: pending.signer_pubkey,
      memo_signature: pending.memo_signature,
      cluster: pending.cluster,
    });
    await clearPendingAttestation(pending.submission_id);
    return { ok: true, attestation };
  } catch (err) {
    // 502: the server could not reach an RPC. Not a verdict — keep it.
    if (isRpcUnavailable(err)) {
      const message =
        "The server could not reach Solana to check your transaction. Your countersignature is on-chain and saved on this phone — retry verification in a moment.";
      await markPendingError(pending.submission_id, message);
      return { ok: false, retryable: true, pending: { ...pending, last_error: message }, message };
    }

    // 422: a verdict. Only "not seen yet" is worth retrying with the same
    // signature; the other four say this transaction will never verify.
    const reason = rejectReasonOf(err);
    if (reason) {
      const message = REJECT_REASON_TEXT[reason];
      if (reason === "tx_not_found") {
        await markPendingError(pending.submission_id, message);
        return { ok: false, retryable: true, pending: { ...pending, last_error: message }, message };
      }
      await clearPendingAttestation(pending.submission_id);
      return { ok: false, retryable: false, message };
    }

    // 401/403/404 and anything else: the server's own words, kept verbatim.
    const message = err instanceof Error ? err.message : String(err);
    await markPendingError(pending.submission_id, message);
    return { ok: false, retryable: true, pending: { ...pending, last_error: message }, message };
  }
}

/**
 * Bounded wait for the cluster to acknowledge the signature. Returns whether
 * it was seen; a false is not fatal, it just means the first POST is likely to
 * come back `tx_not_found`, which is retryable.
 *
 * getSignatureStatuses rather than confirmTransaction: the latter opens a
 * websocket subscription, and a bounded HTTP poll is the thing that behaves
 * predictably on a phone that may be switching networks mid-flow.
 */
async function waitForConfirmation(
  cluster: AttestationCluster,
  signature: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < CONFIRM_TRIES; attempt += 1) {
    try {
      const { value } = await withRpc(cluster, (c) => c.getSignatureStatuses([signature]));
      const status = value[0];
      if (status && (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")) {
        return true;
      }
      if (status?.err) return true; // Landed and failed; let the server say so.
    } catch {
      // A flaky RPC is not a reason to stop waiting.
    }
    await sleep(CONFIRM_INTERVAL_MS);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function short(address: string): string {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}
