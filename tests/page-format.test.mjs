// Pure-logic tests for the page screen helpers (src/page/format.ts) and the
// scan "Request page" rule (src/search/request-offer.ts).
// Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionBlockState,
  agoText,
  againInText,
  arrangeActions,
  anchorDetailLine,
  anchoredLabel,
  auditSummaryLine,
  buildContents,
  contentsHeading,
  countUniqueSources,
  factCheckButtonLabel,
  decisionHeading,
  deltaTone,
  formatDelta,
  isoDate,
  needsClamp,
  shortHash,
} from "../src/page/format.ts";
import { canRequestHoldingPage, holdingRequest } from "../src/search/request-offer.ts";

test("score delta reads like the website: -7, +3, 0, nothing", () => {
  assert.equal(formatDelta(-7), "-7");
  assert.equal(formatDelta(3), "+3");
  assert.equal(formatDelta(0), "0");
  assert.equal(formatDelta(null), null);
  assert.equal(deltaTone(-7), "critical");
  assert.equal(deltaTone(3), "verified");
  assert.equal(deltaTone(0), "muted");
  assert.equal(deltaTone(null), "muted");
});

test("decision heading is #seq KIND, without the number on old rows", () => {
  assert.equal(decisionHeading(3, "review_revise"), "#3 REVIEW REVISE");
  assert.equal(decisionHeading(null, "review"), "REVIEW");
});

test("hash, date and anchor label", () => {
  assert.equal(shortHash("6WzQUpFLsPzH"), "6WzQ…");
  assert.equal(shortHash("abc"), "abc");
  assert.equal(shortHash(null), null);
  assert.equal(isoDate("2026-06-03T03:57:00.758089+00:00"), "2026-06-03");
  assert.equal(anchoredLabel(), "Recorded on Solana ✓");
  assert.equal(anchorDetailLine(423949560, "6WzQ…"), "slot 423949560 · hash 6WzQ…");
  assert.equal(anchorDetailLine(null, "6WzQ…"), "hash 6WzQ…");
  assert.equal(anchorDetailLine(null, null), null);
});

test("long review text is clamped, short text is not", () => {
  assert.equal(needsClamp("short"), false);
  assert.equal(needsClamp("x".repeat(500)), true);
  assert.equal(needsClamp(null), false);
});

test("audit summary line", () => {
  const a = { anchor_signature: "s" };
  const n = { anchor_signature: null };
  assert.equal(auditSummaryLine([a, a, a], 3), "Recorded on Solana · 3 decisions");
  assert.equal(auditSummaryLine([a], 1), "Recorded on Solana · 1 decision");
  assert.equal(auditSummaryLine([a, n], 2), "Recorded on Solana · 1 of 2 decisions");
  assert.equal(auditSummaryLine([n, n], 2), "2 decisions · not recorded yet");
  assert.equal(auditSummaryLine([a, a], 30), "Recorded on Solana · 2 of the latest 2 decisions");
  assert.equal(auditSummaryLine([], 0), "No decisions yet");
});

test("contents: section titles, then the timeline with its count", () => {
  const items = buildContents({ sectionHeadings: ["Overview", " ", "Risks"], timelineCount: 16 });
  assert.deepEqual(
    items.map((i) => i.label),
    ["Overview", "Section 2", "Risks", "Timeline (16 events)"],
  );
  assert.deepEqual(
    items.map((i) => i.key),
    ["section-0", "section-1", "section-2", "timeline"],
  );
  assert.equal(buildContents({ sectionHeadings: [], timelineCount: 1 })[0].label, "Timeline (1 event)");
  assert.deepEqual(buildContents({ sectionHeadings: [], timelineCount: 0 }), []);
  assert.equal(contentsHeading(17, 16), "Contents · 17 sources · 16 events");
  assert.equal(contentsHeading(0, 1), "Contents · 1 event");
});

const holding = (over = {}) => ({
  symbol: "FOO",
  name: "Foo Coin",
  mint: "Mint1111",
  slug: null,
  flags: ["no_page"],
  ...over,
});

test("Request page shows only for named, non-dust NO_PAGE tokens", () => {
  assert.equal(canRequestHoldingPage(holding()), true);
  assert.equal(canRequestHoldingPage(holding({ symbol: null })), true);
  assert.equal(canRequestHoldingPage(holding({ symbol: null, name: null })), false);
  assert.equal(canRequestHoldingPage(holding({ symbol: " ", name: "" })), false);
  assert.equal(canRequestHoldingPage(holding({ flags: ["no_page", "dust"] })), false);
  assert.equal(canRequestHoldingPage(holding({ flags: ["well_known"] })), false);
  assert.equal(canRequestHoldingPage(holding({ slug: "foo" })), false);
});

test("the request names the token and carries the mint as context", () => {
  const r = holdingRequest(holding());
  assert.equal(r.entity, "FOO");
  assert.match(r.context, /Foo Coin \(FOO\)/);
  assert.match(r.context, /Mint1111/);
  assert.equal(holdingRequest(holding({ symbol: null })).entity, "Foo Coin");
  // Unnamed: the mint prefix names it, the full mint rides in the context.
  const bare = holdingRequest(holding({ symbol: null, name: null }));
  assert.match(bare.entity, /^Token \S{8}$/);
  assert.match(bare.context, /mint /);
});

test("source count dedupes page-level and section-level sources by URL", () => {
  const a = { name: "A", url: "https://a.example" };
  const b = { name: "B", url: "https://b.example" };
  assert.equal(countUniqueSources([a], [{ sources: [a, b] }, { sources: [b] }]), 2);
  assert.equal(countUniqueSources(null, [{ sources: null }, {}]), 0);
  assert.equal(countUniqueSources(undefined, undefined), 0);
  assert.equal(countUniqueSources([{ name: "N", url: "" }], [{ sources: [{ name: "N", url: "" }] }]), 1);
});

test("fact-check button label carries the outcome", () => {
  assert.equal(factCheckButtonLabel(null, false), "Request fact-check");
  assert.equal(factCheckButtonLabel(null, true), "Requesting…");
  assert.equal(factCheckButtonLabel("requested", false), "Fact-check requested ✓");
  assert.equal(factCheckButtonLabel("already", false), "Already requested today ✓");
  assert.equal(factCheckButtonLabel("error", false), "Request fact-check");
});

// ---- action block states ----
const NOW = Date.parse("2026-10-08T12:00:00Z");
const ago = (ms) => new Date(NOW - ms).toISOString();
const H = 3600e3;
const D = 24 * H;

test("ago / again-in wording", () => {
  assert.equal(agoText(ago(14 * H), NOW), "14 hours ago");
  assert.equal(agoText(ago(1 * D + H), NOW), "yesterday");
  assert.equal(agoText(ago(120 * D), NOW), "4 months ago");
  assert.equal(agoText(null, NOW), "");
  assert.equal(againInText(new Date(NOW + 6.4 * D).toISOString(), NOW), "again in 6 days");
  assert.equal(againInText(new Date(NOW + 5 * H).toISOString(), NOW), "again in 5 hours");
  assert.equal(againInText(ago(H), NOW), "");
});

test("normal state: nothing promoted, last updated in the button", () => {
  const s = actionBlockState({ now: NOW, contentUpdatedAt: ago(120 * D), updatedAt: ago(1 * D), reviewed: false });
  assert.equal(s.promoteSubmit, false);
  assert.equal(s.update.disabled, false);
  assert.equal(s.update.sublabel, "last updated 4 months ago");
  assert.deepEqual(s.factCheck, { label: "Request fact-check", disabled: false });
  assert.deepEqual(arrangeActions(["follow", "submit", "update", "factcheck"], false), [["follow", "submit"], ["update", "factcheck"]]);
  assert.deepEqual(arrangeActions(["follow", "submit", "update"], false), [["follow", "submit"], ["update"]]);
});

test("older server: falls back to updated_at, fact-checked pages hide the button", () => {
  const s = actionBlockState({ now: NOW, updatedAt: ago(3 * D), reviewed: true });
  assert.equal(s.promoteSubmit, false);
  assert.equal(s.update.sublabel, "last updated 3 days ago");
  assert.equal(s.factCheck, null);
  assert.equal(actionBlockState({ now: NOW }).update.sublabel, "last update unknown");
});

test("recently updated: submit promoted, update greyed with countdown", () => {
  const s = actionBlockState({ now: NOW, contentUpdatedAt: ago(14 * H), reviewed: false });
  assert.equal(s.recentlyUpdated, true);
  assert.equal(s.promoteSubmit, true);
  assert.equal(s.submitSublabel, "Recently updated. Know something it missed? Send it in.");
  assert.equal(s.update.disabled, true);
  assert.equal(s.update.sublabel, "updated 14 hours ago · again in 6 days");
  assert.deepEqual(arrangeActions(["follow", "submit", "update", "factcheck"], true), [["submit"], ["follow", "update"], ["factcheck"]]);
});

test("server next-allowed date wins; a past date means not recent", () => {
  const s = actionBlockState({ now: NOW, contentUpdatedAt: ago(14 * H), updateNextAllowedAt: ago(H) });
  assert.equal(s.recentlyUpdated, false);
});

test("recently fact-checked: submit promoted, fact-check greyed even on a reviewed page", () => {
  const s = actionBlockState({
    now: NOW,
    contentUpdatedAt: ago(90 * D),
    lastFactCheckedAt: ago(2 * D),
    factCheckNextAllowedAt: new Date(NOW + 5 * D).toISOString(),
    reviewed: true,
  });
  assert.equal(s.recentlyFactChecked, true);
  assert.equal(s.promoteSubmit, true);
  assert.equal(s.submitSublabel, "Fact-checked 2 days ago. New evidence still goes to review.");
  assert.deepEqual(s.factCheck, { label: "Fact-checked", disabled: true, sublabel: "2 days ago · again in 5 days" });
  assert.equal(s.update.disabled, false);
});

test("both recent: updated message wins, both buttons greyed", () => {
  const s = actionBlockState({ now: NOW, contentUpdatedAt: ago(2 * H), lastFactCheckedAt: ago(1 * D), reviewed: true });
  assert.equal(s.promoteSubmit, true);
  assert.equal(s.submitSublabel, "Recently updated. Know something it missed? Send it in.");
  assert.equal(s.update.disabled, true);
  assert.equal(s.factCheck.disabled, true);
});

test("cooldown reply from the POST puts the page in the fact-checked state", () => {
  const s = actionBlockState({
    now: NOW,
    contentUpdatedAt: ago(90 * D),
    reviewed: false,
    cooldownReply: true,
    cooldownNextAllowedAt: new Date(NOW + 4 * D).toISOString(),
  });
  assert.equal(s.promoteSubmit, true);
  assert.equal(s.factCheck.disabled, true);
  assert.equal(s.factCheck.sublabel, "again in 4 days");
  assert.equal(s.submitSublabel, "Fact-checked recently. New evidence still goes to review.");
  const noDate = actionBlockState({ now: NOW, cooldownReply: true });
  assert.equal(noDate.recentlyFactChecked, true);
});
