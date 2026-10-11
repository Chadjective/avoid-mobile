/**
 * The wording of Profile's one pinned sign-in button. Pure, so it is tested
 * without React Native (tests/signin.test.mjs).
 *
 * Both labels start the same single wallet trip (`signInWithSolana` connects
 * and signs in inside one `transact` session); the second only tells the owner
 * which wallet it will ask, when one is already connected on this phone.
 */
export function signInActionLabel(opts: { connecting: boolean; walletConnected: boolean }): string {
  if (opts.connecting) return "Waiting for wallet…";
  return opts.walletConnected ? "Sign in with this wallet" : "Sign in with Solana";
}
