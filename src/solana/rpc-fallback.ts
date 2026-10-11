/**
 * Try the configured RPC (Helius), then the public endpoint.
 *
 * Pure on purpose (no web3.js import) so tests/rpc-fallback.test.mjs runs it
 * under plain Node. The app's Helius key is shipped inside the APK, so it can
 * be extracted and its free allowance spent, or it can simply be rate limited.
 * Either way the phone should still verify an anchor and countersign, so a
 * failure on the primary endpoint is retried once on the next one.
 *
 * Only a THROW moves on. A normal answer, including "transaction not found"
 * (null), is returned as is: the public endpoint would say the same thing.
 */
export async function withFallback<C, T>(
  endpoints: readonly C[],
  run: (endpoint: C) => Promise<T>,
): Promise<T> {
  if (endpoints.length === 0) throw new Error("No RPC endpoint configured.");
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      return await run(endpoint);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
