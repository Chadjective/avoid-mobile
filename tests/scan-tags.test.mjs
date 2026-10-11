// Pure-logic tests for src/scan/tags.ts. Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { holdingTagLine, holdingTagWords, canRequestHolding } from "../src/scan/tags.ts";

test("raw flags become plain words joined by a middle dot", () => {
  assert.equal(holdingTagLine(["no_page", "unpriced"]), "No page yet · no price found");
  assert.equal(holdingTagLine(["well_known"]), "Well-known token");
  assert.equal(holdingTagLine(["possible_match"]), "may match an existing page");
});

test("dust is dropped entirely", () => {
  assert.deepEqual(holdingTagWords(["no_page", "dust"]), ["No page yet"]);
  assert.equal(holdingTagLine(["dust"]), "");
});

test("unknown flags are never shown raw; duplicates collapse", () => {
  assert.deepEqual(holdingTagWords(["mystery", "no_page", "no_page"]), ["No page yet"]);
  assert.equal(holdingTagLine([]), "");
});

test("any token without a page can be requested, dust or not, named or not", () => {
  const base = { symbol: "ABC", name: null, slug: null };
  assert.equal(canRequestHolding({ ...base, flags: ["no_page"] }), true);
  assert.equal(canRequestHolding({ ...base, flags: ["no_page", "dust"] }), true);
  assert.equal(canRequestHolding({ ...base, flags: ["well_known"] }), false);
  assert.equal(canRequestHolding({ ...base, slug: "abc", flags: ["no_page"] }), false);
  // An unnamed mint can be asked for too (filed as "Token <mint prefix>").
  assert.equal(canRequestHolding({ symbol: " ", name: null, slug: null, flags: ["no_page"] }), true);
});
