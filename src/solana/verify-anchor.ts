/**
 * On-device verification of an anchored decision (J6).
 *
 * "Trust by construction" is the demo moment: the phone fetches the Solana
 * transaction itself, reads the memo out of it, and compares the hash with the
 * one the page claims — no AVOID.NET server in the loop for the check.
 */
import { withRpc, DEFAULT_CLUSTER, type ClusterId } from "./cluster";
import { MEMO_PREFIX } from "./memo";

export type AnchorVerification = {
  signature: string;
  cluster: ClusterId;
  /** The memo string found in the transaction, if any. */
  memo: string | null;
  /** `h:` for a server decision anchor, `att:` for a user countersignature. */
  contentHash: string | null;
  slot: number | null;
  blockTime: number | null;
  /** True when the memo parsed and its hash equals `expectedHash`. */
  matches: boolean | null;
  error: string | null;
};

/**
 * Fetch a transaction and pull the AVOID.NET memo out of it.
 *
 * TODO(mobile, J6): this reads the memo out of the transaction's log messages,
 * which is the cheap path and is what `python -m src.verify_decision` does on
 * the server. It does NOT yet:
 *   - confirm the memo instruction's signer is the expected key (a memo in a
 *     transaction someone else paid for is not an attestation by them), which
 *     needs the parsed instruction's account keys rather than the logs;
 *   - verify the aggregate Merkle proof (`/proof` returns
 *     root_matches_published:false until the Merkle root worker is deployed —
 *     spec §3.2). D10 lists that verify as a cut candidate; the
 *     single-transaction check below is the one that must never be cut.
 * Until both are done, treat a `matches: true` here as "this transaction
 * carries this hash", not as "this wallet attested to it".
 */
export async function verifyAnchor(
  signature: string,
  options?: { cluster?: ClusterId; expectedHash?: string },
): Promise<AnchorVerification> {
  const cluster = options?.cluster ?? DEFAULT_CLUSTER;
  const base: AnchorVerification = {
    signature,
    cluster,
    memo: null,
    contentHash: null,
    slot: null,
    blockTime: null,
    matches: null,
    error: null,
  };

  try {
    const tx = await withRpc(cluster, (c) =>
      c.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      }),
    );
    if (!tx) return { ...base, error: "Transaction not found on this cluster." };

    const memo = extractMemo(tx.meta?.logMessages ?? []);
    const contentHash = memo ? extractHash(memo) : null;
    const matches =
      options?.expectedHash && contentHash
        ? contentHash.toLowerCase() === options.expectedHash.toLowerCase()
        : null;

    return {
      ...base,
      memo,
      contentHash,
      slot: tx.slot ?? null,
      blockTime: tx.blockTime ?? null,
      matches,
    };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Memo program logs look like: `Program log: Memo (len 92): "AVOID.NET|v1|…"`. */
function extractMemo(logs: readonly string[]): string | null {
  for (const line of logs) {
    const match = /Memo \(len \d+\): "(.*)"$/.exec(line);
    if (match && match[1].startsWith(MEMO_PREFIX)) return match[1];
  }
  return null;
}

/** `h:<hash>` on a server decision anchor, `att:<hash>` on a countersignature. */
function extractHash(memo: string): string | null {
  for (const part of memo.split("|")) {
    if (part.startsWith("h:")) return part.slice(2);
    if (part.startsWith("att:")) return part.slice(4);
  }
  return null;
}
