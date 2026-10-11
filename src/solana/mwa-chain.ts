import type { ClusterId } from "./cluster";

/**
 * The chain identifier MWA 2.0 wants in `authorize({chain})`.
 *
 * The spec's identifiers are `solana:mainnet`, `solana:testnet` and
 * `solana:devnet`. `mainnet-beta` is only the LEGACY `cluster` spelling, and
 * `solana:mainnet-beta` is neither: it is not a valid chain id. The protocol
 * library (`handleMobileWalletRequest`) translates the bare legacy names
 * (`mainnet-beta` -> `solana:mainnet`) but passes `solana:mainnet-beta`
 * through untouched, so an MWA 2.0 wallet is handed an identifier it has never
 * heard of, and a legacy-protocol wallet gets `cluster: undefined`. Both can
 * refuse with `-1 / authorization request failed`, the exact failure the first
 * Seeker test reported. Every `authorize` call goes through this function.
 */
export function mwaChain(cluster: ClusterId): "solana:mainnet" | "solana:testnet" | "solana:devnet" {
  switch (cluster) {
    case "devnet":
      return "solana:devnet";
    case "testnet":
      return "solana:testnet";
    default:
      return "solana:mainnet";
  }
}
