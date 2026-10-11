/**
 * The wording of Profile's Wallet Guardian status row. Pure, so it is tested
 * without React Native (tests/wallet-watch.test.mjs).
 *
 * `wallet_watch` on /api/me. src/helius_watcher.py hands out the free Helius
 * tier's 100 slots every six hours, so a wallet that signed in minutes ago is
 * not watched yet: say that, rather than imply it lost out. The bot
 * (src/bots/wallet_guardian.py) writes an alert when the wallet trades with
 * something whose page scores 50 or below, which is what the Alerts tab lists.
 */
export type WalletWatchInput = {
  watched: boolean;
  reason: string | null;
  since: string | null;
} | null;

export type WalletWatchStatus = {
  title: string;
  /** Second, muted line. Null when there is nothing more to say. */
  detail: string | null;
  /** "verified" = green icon; "muted" = grey. */
  tone: "verified" | "muted";
};

export function walletWatchStatus(watch: WalletWatchInput): WalletWatchStatus {
  if (!watch) {
    return { title: "Alert monitoring status unavailable.", detail: null, tone: "muted" };
  }
  if (!watch.watched) {
    return {
      title: "Wallet Guardian starts within 6 hours",
      detail: "New wallets are added every 6 hours.",
      tone: "muted",
    };
  }
  return {
    title: "Wallet Guardian is on",
    detail: "You get an alert if this wallet trades with a token or address we've flagged as risky.",
    tone: "verified",
  };
}
