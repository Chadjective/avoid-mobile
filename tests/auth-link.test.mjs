// Pure-logic tests for the magic-link URL parser (src/session/auth-link.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAuthLink, isAuthLink } from "../src/session/auth-link.ts";

test("PKCE code", () => {
  assert.deepEqual(parseAuthLink("avoid://auth?code=abc-123"), { kind: "code", code: "abc-123" });
});
test("implicit tokens in the fragment", () => {
  assert.deepEqual(
    parseAuthLink("avoid://auth#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=magiclink"),
    { kind: "tokens", accessToken: "a.b.c", refreshToken: "r1" },
  );
});
test("token_hash", () => {
  assert.deepEqual(parseAuthLink("avoid://auth?token_hash=h&type=email"), { kind: "token_hash", tokenHash: "h", type: "email" });
  assert.equal(parseAuthLink("avoid://auth?token_hash=h").type, "magiclink");
});
test("error in the fragment and in the query", () => {
  const a = parseAuthLink("avoid://auth#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  assert.equal(a.kind, "error");
  assert.match(a.message, /expired or was already used/);
  const b = parseAuthLink("avoid://auth?error=server_error&error_description=Boom%20now");
  assert.equal(b.kind, "error");
  assert.match(b.message, /Boom now/);
});
test("route variants are recognised, other links are not", () => {
  assert.ok(isAuthLink("avoid://auth"));
  assert.ok(isAuthLink("avoid:///auth?code=1"));
  assert.ok(isAuthLink("avoid://auth/"));
  assert.ok(!isAuthLink("avoid://entity/foo"));
  assert.ok(!isAuthLink("avoid://authors"));
  assert.ok(!isAuthLink(null));
  assert.deepEqual(parseAuthLink("avoid://entity/foo?code=1"), { kind: "none" });
  assert.deepEqual(parseAuthLink("avoid://auth"), { kind: "none" });
});
test("malformed encoding does not throw", () => {
  assert.deepEqual(parseAuthLink("avoid://auth?code=%E0%A4%A"), { kind: "code", code: "%E0%A4%A" });
});
