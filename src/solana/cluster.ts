/**
 * Cluster configuration and explorer links.
 *
 * docs/MOBILE_APP_SPEC.md D5: reads and countersigns default to mainnet-beta,
 * with a settings toggle for devnet. But note the caveat in the same decision —
 * the server's own anchor worker defaults to devnet, so explorer links must
 * follow the CLUSTER ON THE ROW (`decision_events.anchor_cluster`), not the
 * app's selected cluster. `explorerTxUrl` therefore takes the row's cluster and
 * defaults to devnet when it is null, exactly as web/src/app/[slug]/audit
 * does.
 */
import { clusterApiUrl, Connection } from "@solana/web3.js";
import { withFallback } from "./rpc-fallback";

export type ClusterId = "mainnet-beta" | "devnet" | "testnet";

const ENV_CLUSTER = process.env.EXPO_PUBLIC_SOLANA_CLUSTER;

export const DEFAULT_CLUSTER: ClusterId =
  ENV_CLUSTER === "devnet" || ENV_CLUSTER === "testnet" ? ENV_CLUSTER : "mainnet-beta";

/** A custom RPC (Helius) if provided, else the public endpoint. */
export function rpcEndpoint(cluster: ClusterId = DEFAULT_CLUSTER): string {
  return rpcEndpoints(cluster)[0];
}

/**
 * Every endpoint to try for a cluster, in order: the custom RPC (Helius) when
 * one is set for the default cluster, then the public endpoint. The custom key
 * ships inside the APK, so it can be rate limited or used up; the public
 * endpoint is the fallback (see withRpc).
 */
export function rpcEndpoints(cluster: ClusterId = DEFAULT_CLUSTER): string[] {
  const custom = process.env.EXPO_PUBLIC_SOLANA_RPC_URL?.trim();
  const fallback = clusterApiUrl(cluster);
  return custom && cluster === DEFAULT_CLUSTER && custom !== fallback ? [custom, fallback] : [fallback];
}

const connections = new Map<string, Connection>();

function connectionFor(url: string): Connection {
  let c = connections.get(url);
  if (!c) {
    // No built-in 429 retry loop: a rate-limited endpoint should hand over to
    // the next one at once, not hold the user for several backoff rounds.
    c = new Connection(url, { commitment: "confirmed", disableRetryOnRateLimit: true });
    connections.set(url, c);
  }
  return c;
}

/** The first endpoint's connection, for callers that do not need the fallback. */
export function getConnection(cluster: ClusterId = DEFAULT_CLUSTER): Connection {
  return connectionFor(rpcEndpoints(cluster)[0]);
}

/**
 * Run one RPC call against the custom endpoint, and again against the public
 * one if it throws (rate limit, revoked or exhausted key, network error).
 */
export function withRpc<T>(
  cluster: ClusterId,
  call: (connection: Connection) => Promise<T>,
): Promise<T> {
  return withFallback(rpcEndpoints(cluster).map(connectionFor), call);
}

/**
 * The explorer link for a transaction, following the cluster the row recorded.
 * Same rule as web/src/app/[slug]/audit/page.tsx explorerUrl().
 */
export function explorerTxUrl(signature: string, cluster: string | null): string {
  const c = cluster ?? "devnet";
  const param = c === "mainnet-beta" ? "" : `?cluster=${c}`;
  return `https://explorer.solana.com/tx/${signature}${param}`;
}

export function explorerAddressUrl(address: string, cluster: string | null): string {
  const c = cluster ?? DEFAULT_CLUSTER;
  const param = c === "mainnet-beta" ? "" : `?cluster=${c}`;
  return `https://explorer.solana.com/address/${address}${param}`;
}
