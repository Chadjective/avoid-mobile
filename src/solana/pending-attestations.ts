/**
 * Countersignatures that are on-chain but not yet recorded by the server.
 *
 * THE PROBLEM THIS SOLVES. The countersign flow has two irreversible halves:
 * the wallet sends a transaction (real lamports, permanent), and the server
 * records it. Between the two, `POST /api/v1/attestations` can answer 502 —
 * the route returns that when it cannot reach the Solana RPC, deliberately, so
 * the app does NOT treat an unreachable RPC as a verdict about the
 * transaction. If the app forgot the signature at that point the user would
 * have paid for an attestation that nothing can ever claim, and the only
 * remedy would be to sign a second one.
 *
 * So the signature is written here the moment the wallet returns it, before
 * the first POST, and cleared only when the server has accepted it or has
 * given a verdict that a retry cannot change. A killed app comes back, reads
 * this, and offers "retry verification" — which re-POSTs, and never re-sends a
 * transaction.
 *
 * WHY SECURESTORE. Not because a signature is a secret (it is public the
 * moment it lands on-chain) but because this is the same keystore-backed,
 * app-private storage the session already uses, and the chunking adapter in
 * src/api/secure-storage.ts already handles SecureStore's 2048-byte value
 * limit. AsyncStorage would work; using two stores for credentials-adjacent
 * state would not be worth the second thing to reason about.
 */
import { secureStorage } from "../api/secure-storage";
import type { AttestationCluster } from "../api/attestations";

const KEY = "avoid.pending_attestations";

/** Oldest entries past this are dropped; a phone does not need a backlog. */
const MAX_ENTRIES = 20;

export type PendingAttestation = {
  submission_id: string;
  slug: string;
  content_hash: string;
  signer_pubkey: string;
  memo_signature: string;
  cluster: AttestationCluster;
  /** The exact memo text signed — kept so a support case can be reproduced. */
  memo: string;
  created_at: string;
  /** Why it is still here: the last failure the server gave. */
  last_error: string | null;
};

type Store = Record<string, PendingAttestation>;

async function read(): Promise<Store> {
  try {
    const raw = await secureStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Store;
  } catch {
    // Corrupt state must not break a submission flow; start from empty.
    return {};
  }
}

async function write(store: Store): Promise<void> {
  const entries = Object.values(store)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_ENTRIES);
  const next: Store = {};
  for (const entry of entries) next[entry.submission_id] = entry;
  try {
    await secureStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A device with no keystore loses the retry affordance, not the signature
    // — which is on-chain either way.
  }
}

/** Record a signature the wallet has produced. Keyed by submission_id. */
export async function savePendingAttestation(entry: PendingAttestation): Promise<void> {
  const store = await read();
  store[entry.submission_id] = entry;
  await write(store);
}

/** Note why the last attempt to record it failed, without dropping it. */
export async function markPendingError(submissionId: string, message: string): Promise<void> {
  const store = await read();
  const entry = store[submissionId];
  if (!entry) return;
  store[submissionId] = { ...entry, last_error: message };
  await write(store);
}

/** Forget it — the server has accepted it, or has ruled it out for good. */
export async function clearPendingAttestation(submissionId: string): Promise<void> {
  const store = await read();
  if (!(submissionId in store)) return;
  delete store[submissionId];
  await write(store);
}

export async function getPendingAttestation(
  submissionId: string,
): Promise<PendingAttestation | null> {
  const store = await read();
  return store[submissionId] ?? null;
}

/** Newest first. */
export async function listPendingAttestations(): Promise<PendingAttestation[]> {
  const store = await read();
  return Object.values(store).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
