// Pure-logic tests for the RPC fallback (src/solana/rpc-fallback.ts).
// Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { withFallback } from "../src/solana/rpc-fallback.ts";

test("uses the first endpoint when it answers", async () => {
  const seen = [];
  const out = await withFallback(["helius", "public"], async (e) => { seen.push(e); return `ok:${e}`; });
  assert.equal(out, "ok:helius");
  assert.deepEqual(seen, ["helius"]);
});

test("falls back to the public endpoint when the custom one throws", async () => {
  const out = await withFallback(["helius", "public"], async (e) => {
    if (e === "helius") throw new Error("429 Too Many Requests");
    return `ok:${e}`;
  });
  assert.equal(out, "ok:public");
});

test("a normal 'not found' answer is returned, not retried", async () => {
  const seen = [];
  const out = await withFallback(["helius", "public"], async (e) => { seen.push(e); return null; });
  assert.equal(out, null);
  assert.deepEqual(seen, ["helius"]);
});

test("throws the last error when every endpoint fails", async () => {
  await assert.rejects(
    withFallback(["helius", "public"], async (e) => { throw new Error(`down:${e}`); }),
    /down:public/,
  );
});
