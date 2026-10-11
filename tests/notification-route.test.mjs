// Pure-logic tests for notification tap routing. Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { routeForNotificationData, isValidSlug } from "../src/notifications/route.ts";

const RID = "123e4567-e89b-12d3-a456-426614174000";

test("page notifications open the entity page", () => {
  for (const data of [
    { slug: "binance", event_id: "e1" },
    { slug: "ftx-exchange" },
    { slug: "usdt-tether", activity_id: "a", direction: "out" },
    { slug: "binance", url: "/entity/binance", test: true },
  ]) {
    assert.equal(routeForNotificationData(data), `/entity/${data.slug}`);
  }
});

test("a fulfilled request opens the page (slug wins over request_id)", () => {
  assert.equal(routeForNotificationData({ slug: "foo", request_id: RID }), "/entity/foo");
});

test("request_id alone opens the request screen", () => {
  assert.equal(routeForNotificationData({ request_id: RID }), `/request/${RID}`);
  assert.equal(routeForNotificationData({ request_id: "../x" }), "/alerts");
});

test("digest, empty and malformed payloads open Alerts", () => {
  assert.equal(routeForNotificationData({ digest: true, count: 4 }), "/alerts");
  assert.equal(routeForNotificationData({ digest: true, slug: "a" }), "/alerts");
  for (const bad of [undefined, null, "x", 5, [], {}, { slug: 5 }]) {
    assert.equal(routeForNotificationData(bad), "/alerts");
  }
});

test("invalid slugs are never routed", () => {
  for (const s of ["", "A", "a/b", "../x", "a b", "a?x=1", "-a", "a".repeat(121), "javascript:1"]) {
    assert.equal(isValidSlug(s), false, s);
    assert.equal(routeForNotificationData({ slug: s }), "/alerts");
  }
  assert.equal(isValidSlug("a"), true);
});
