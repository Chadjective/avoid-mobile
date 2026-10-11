// Pure-logic tests for the email sign-up handle step (src/session/handle.ts).
// Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidHandle, handleFailureMessage, HANDLE_RULE } from "../src/session/handle.ts";

test("isValidHandle matches the server rule (web/src/lib/auth-client.ts)", () => {
  for (const ok of ["abc", "a_b-c", "ABC123", "x".repeat(32)]) assert.equal(isValidHandle(ok), true, ok);
  for (const bad of ["", "ab", "x".repeat(33), "has space", "dot.dot", "emoji😀x", " abc"]) {
    assert.equal(isValidHandle(bad), false, bad);
  }
});

test("failure words are plain and never carry a code", () => {
  assert.match(handleFailureMessage(409, "Handle already taken"), /taken/i);
  assert.ok(handleFailureMessage(400, "handle must be 3-32 chars").includes(HANDLE_RULE));
  assert.match(handleFailureMessage(0, "network"), /reach avoid\.net/);
  assert.match(handleFailureMessage(401), /signed out/i);
  assert.match(handleFailureMessage(500, "duplicate key value violates unique constraint"), /Try again/);
  for (const s of [400, 401, 409, 429, 500, 0]) {
    assert.doesNotMatch(handleFailureMessage(s, "validation_failed"), /validation_failed|constraint|23505/);
  }
});
