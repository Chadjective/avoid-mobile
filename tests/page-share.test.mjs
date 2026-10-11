// Pure-logic tests for the Share message (src/page/share.ts).
// Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSharePayload } from "../src/page/share.ts";
import { bandForPageScore } from "../src/design/bands.ts";

const build = (i) =>
  buildSharePayload({ ...i, bandLabel: typeof i.score === "number" && !Number.isNaN(i.score) ? bandForPageScore(i.score).label : null });

const url = "https://avoid.net/some-exchange";

test("scored page: name, score, band label, link in the message", () => {
  const p = build({ name: "SomeEx", score: 12, reviewed: false, url });
  assert.equal(p.message, `SomeEx scores 12/100 (CRITICAL) on AVOID.NET\n${url}`);
  assert.equal(p.url, url);
  assert.equal(p.title, "SomeEx");
});

test("reviewed page adds the fact-checked suffix", () => {
  const p = build({ name: "SomeEx", score: 80, reviewed: true, url });
  assert.equal(p.message, `SomeEx scores 80/100 (LOW RISK) on AVOID.NET · fact-checked\n${url}`);
});

test("band labels at the edges of the four-band scale", () => {
  const label = (s) => build({ name: "X", score: s, reviewed: false, url }).message.match(/\((.+)\)/)[1];
  assert.equal(label(25), "CRITICAL");
  assert.equal(label(26), "WARNING");
  assert.equal(label(51), "CAUTIONARY");
  assert.equal(label(76), "LOW RISK");
});

test("missing score: no number, no band", () => {
  for (const score of [null, undefined, NaN]) {
    const p = build({ name: "Concept", score, reviewed: false, url });
    assert.equal(p.message, `Concept on AVOID.NET\n${url}`);
  }
  assert.equal(
    build({ name: "Concept", score: null, reviewed: true, url }).message,
    `Concept on AVOID.NET · fact-checked\n${url}`,
  );
});

test("no tracking params in the link", () => {
  const p = build({ name: "A", score: 50, reviewed: false, url });
  assert.ok(!p.message.includes("?"));
});
