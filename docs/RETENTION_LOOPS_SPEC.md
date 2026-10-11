# AVOID.NET Retention Loops — Attention, Reward and Community

**Status:** proposal · **Created:** 2026-09-21 · **Owner:** product
**Pairs with:** [HOMEPAGE_V2_SPEC.md](HOMEPAGE_V2_SPEC.md) (the front door this builds on) · [MOBILE_APP_SPEC.md](MOBILE_APP_SPEC.md) (watchlist, push, notification outbox) · [DATA_PAGE_SPEC.md](DATA_PAGE_SPEC.md) (dashboards) · [STIGMERGY.md](../STIGMERGY.md) (submission and reputation mechanics) · `CLAUDE.md` (caching and cost rules every item below must respect)

> **The question this answers.** Why would someone come back to AVOID.NET
> tomorrow? Today the site is an archive: it answers a question once and
> gives the visitor no reason to expect it will have changed. This document
> describes what the brain actually rewards, audits which of those rewards
> the site delivers today (verified in code on 2026-09-21), and proposes a
> prioritised set of "loops" that give people a reason to return, a way to
> be seen, and a sense that the record moves because of them.

Terms are defined the first time they appear. A glossary is in §10.

---

## 0. Summary

- **Dopamine is about anticipation, not pleasure.** It fires when something
  is *about to* happen and hardest when the outcome beats expectation. A
  site earns return visits by making people expect change and then
  delivering a little more than they expected.
- **Today the site has one strong loop (request → notify → page published)
  and one strong hook (wallet scan), and everything else is a dead end.**
  The homepage v2 that shows the record moving is built but not switched
  on. A follow/watch system is built for the mobile app but has no button
  on the website. Contributors see a private score with no public credit
  and no visible impact.
- **Six loops, in priority order:** (1) switch on the living homepage,
  (2) "Follow" on every page + a weekly "what moved" digest, (3) "since
  your last visit" on the homepage and on each page, (4) an impact ledger
  on the account page, (5) public credit and profiles for contributors,
  (6) wallet re-scan diffs and alerts.
- **Community comes from being seen, not from a chat room.** Public
  handles, credit on the pages people helped build, and a shared goal
  (the milestones on `/data/growth`) are the cheapest, most durable form.
- **Guardrails matter more here than on most sites.** This is a trust
  brand. No fake urgency, no streak shaming, no infinite feeds. Every
  attention pull must be backed by a real change in the record.

---

## 1. What the brain actually rewards (plain-language model)

Six mechanisms, each with the question a visitor is unconsciously asking.
Every proposal in §4 is tagged with the mechanisms it uses.

| # | Mechanism | The visitor's question | What triggers it |
|---|---|---|---|
| M1 | **Anticipation** (reward prediction) | "Is something about to happen?" | A pending outcome with a known arrival: "your request is running", "your evidence is under review". |
| M2 | **Variable reward** | "What changed?" | Change that is real, frequent enough to expect, and not fully predictable: score movements, new pages, new evidence on a page you follow. |
| M3 | **Personal relevance** | "Does this affect *me*?" | Anything tied to the visitor's own holdings, requests, follows or contributions. Strongest of the six. |
| M4 | **Progress** (goal gradient) | "Am I getting somewhere?" | Visible movement toward a goal: reputation rising toward "trusted", a milestone bar filling, a request moving queued → running → published. |
| M5 | **Recognition** (social reward) | "Was I seen?" | Credit with a name on it, a badge, a rank, a page saying "first evidence submitted by @handle". |
| M6 | **Curiosity gap** | "Why?" | A number that moved with the reason one click away: "−12 this week · see what changed". |

Two consequences drive the whole design:

1. **The record must visibly change between visits, and the visitor must
   have a reason to *expect* it to.** An archive that changes silently is
   indistinguishable from one that never changes.
2. **Relevance beats volume.** One alert about a token the visitor holds
   is worth more than a feed of fifty movements they have no stake in.

A useful frame for each loop is the four-step *Hook model* (trigger →
action → variable reward → investment): the visitor is prompted, does
something small, gets an unpredictable but real reward, and leaves
something behind (a follow, a request, evidence) that makes the next
trigger more relevant. §4 lays each loop out in those four steps.

---

## 2. Audit: what the site delivers today (verified 2026-09-21)

| Surface | What exists | Mechanisms hit | Where it dead-ends |
|---|---|---|---|
| **Homepage `/`** (`web/src/app/page.tsx`) | Static index: two inputs, four buttons, 200 cards, footer "200 entities tracked · record updated YYYY-MM". | none | Nothing signals change. Month-granularity timestamp says "not alive". |
| **Homepage v2 `/preview/home`** (`web/src/components/home/*`) | North-star count-up, 7-day pulse strip with deltas, movers rail (score changes), trending shelf, queue peek, on-chain proof line, heartbeat dot, "the record needs you" prompt. Built, merged (#167, #168), **not switched on**: gates G1–G5 in HOMEPAGE_V2_SPEC §7 are all unticked. | M2, M4, M6 (once live) | Not on `/`. Nothing on it is personal (M3) by design: the route is cached for everyone. |
| **Investigation page `/[slug]`** | Trust score, sections, timeline, sources, GoPlus/Helius/Vybe live data, graph, submissions section with accepted/under-review counts, view count, request-review button, audit history at `/[slug]/audit`. | M6 (weakly) | **No "Follow" button** although the watchlist table and `/api/v1/watchlist` exist (built for mobile, migration 051). No "what changed since you last read this". No named credit on accepted evidence. |
| **Request flow `/request/[id]`** | Status page, "tell me when this publishes" with confirmed email (migration 055), edit token so the requester owns the request. | **M1, M3** — the best loop on the site | The fulfilment email is not yet sent (the Fulfilment bot in MOBILE_APP_SPEC §9.2 is [new]). After publish there is no "you asked for this" mark, and no nudge to request another. |
| **Wallet scan `/scan`** | Paste an address → positions, % of value covered by the index, risk score. Stored per account. | **M3** — the strongest hook | One-shot. No re-scan diff ("2 positions changed band since last scan"), no "watch this wallet" on the web (the address watch exists in the watchlist schema). |
| **Account page `/me`** | Handle, private stats (accepted / rejected / rep score, trusted badge at rep ≥ 3), recent requests, scans, submissions. | M4 (weakly) | Private only. No public profile. No impact ("your evidence moved a score"). Rep formula shown as a maths expression, not as a goal. Submissions listed by status only, no reason for rejection, no link to the page. |
| **Submit `/submit`** | Evidence form with entity picker. Reputation computed from accepted submissions (`lib/stigmergy/rep.ts`). | M1 (under review) | Verdict arrives silently: no notification, no reason, no credit. 4 distinct submitters total (HOMEPAGE_V2_SPEC T2 baseline). |
| **Dashboards `/data/*`** | Corpus totals, activity by period, growth milestones, ops, API telemetry. | M2, M4 | Operator-facing. Not linked from `/` today (fixed by the v2 nav). Milestones are not framed as a community goal. |
| **Notifications** | Outbox table (053), push device registry (052), 20 pushes/day cap, dedupe keys, transactional email helper (`lib/email.ts`). Dispatcher worker planned. | — | **No web-facing use yet.** No email digest. Nothing tells a web user anything after they leave. |
| **Community** | Handles on accounts, trusted-contributor flag, on-chain countersign schema (054). | M5 (barely) | Nobody can see anybody else. No profiles, no leaderboard, no credit lines, no place where contributors are named. |

Baseline numbers (HOMEPAGE_V2_SPEC §7, 2026-09-07): 156 human page views
per 7 days, 4 distinct evidence submitters, 6 queued requests. The
retention problem is therefore **not** "keep thousands engaged"; it is
"give the first few hundred people a reason to come back twice". Design
for depth with a small cohort, not breadth.

---

## 3. Constraints every loop must respect

These come from `CLAUDE.md` and the Sept 2026 Vercel usage warning. They
shape *how* personal features are built, not whether.

- **Cached pages cannot know who is looking.** `/`, `/[slug]` and the v2
  homepage are served from cache (ISR, six hours for investigation pages).
  Reading a session cookie in their render tree would turn the whole route
  back into per-visit rendering, which caused two Supabase lockouts. So
  every personal element (M3, M4, M5) is either a **client-side island**
  fed by `use-current-account.ts` / `/api/me`, or computed **entirely in
  the browser** from local storage plus already-public cached data.
- **Every new API route that reads a session** must be added to the proxy
  matcher and `proxy-scope.ts` in the same commit, and each one doubles the
  invocation cost of its calls. Prefer extending `/api/me` over adding
  routes.
- **No new pollers.** Anything that refreshes uses `use-poll.ts` (bounded,
  backs off, pauses in hidden tabs). "Live" on the homepage means "changes
  every five minutes on the server", not a ticker.
- **All outbound notifications go through the outbox** (migration 053
  rules): dedupe key mandatory, per-account cap, no wallet addresses in
  bodies, no allegations stated as fact. Email joins push as a second
  channel through the same table.
- **Anything that changes a page calls `POST /api/revalidate`** rather
  than shortening cache windows.

---

## 4. The loops

Ordered by (value ÷ effort). Each is a Hook: trigger → action → variable
reward → investment. "Exists" means verified in code.

### Loop 1 — The living front door (switch on homepage v2)

*Mechanisms: M2, M4, M6.*

| Step | Design |
|---|---|
| Trigger | Habit ("let me see what moved") and search engines. |
| Action | Land on `/`. |
| Reward | Pulse strip deltas, movers rail with direction, trending shelf, queue peek, heartbeat dot: the record is visibly alive. Count-up on the north-star number gives a small anticipation beat once. |
| Investment | Command bar: request a page, or follow (Loop 2). |

**Exists:** everything, on `/preview/home`. **Missing:** the cut-over
(HOMEPAGE_V2_SPEC task 3.5) behind five operational gates, of which G1
(heartbeat worker) and G4 (at least one upward score change) are the
blockers that need owners. Nothing in this document is worth more than
closing those gates; every later loop assumes the homepage shows change.

**Add on top of v2 (small):**

- Give every mover a *reason* link (M6): the arrow and delta already exist;
  link the card to `/[slug]/audit` where the decision that moved it lives,
  with the one-line reason as hover text.
- Show the **queue as a countdown**, not a list: "6 queued · oldest 3 d ·
  next drain tonight" (from the drain cadence once one is scheduled). A
  known arrival time is the cheapest anticipation there is.

### Loop 2 — Follow + "what moved" digest

*Mechanisms: M1, M2, M3.*

| Step | Design |
|---|---|
| Trigger | Weekly email (or push, for app users): "3 things you follow moved this week". |
| Action | Click through to the page. |
| Reward | The change, highlighted: new score with the old one struck through, the decision line, any new accepted evidence. |
| Investment | Follow one more page. Each follow makes next week's digest more relevant. |

**Exists:** watchlist table with entity and address targets, mute flag, tier
cap (10 free / 50 for SKR holders), `/api/v1/watchlist` collection and item
routes, outbox with dedupe and daily cap, transactional email sender.
**Missing:**

1. A **Follow button on `/[slug]`**, a client island: signed-out visitors see
   the button and get a sign-in prompt with the page slug preserved in
   `?next=`; signed-in users toggle through `/api/v1/watchlist`. Show the
   follower count next to it once it is above a small threshold (M5, and a
   quiet social proof that the page matters).
2. A **Watchlist Alert writer** (already specified in MOBILE_APP_SPEC §9.1)
   that turns `decision_events` and score changes into outbox rows for
   followers. Same rows serve push and email.
3. An **email channel on the dispatcher**: batch one account's unsent rows
   for the week into one digest through `sendTransactional`. Daily is too
   often at today's change rate; weekly with an immediate send for a band
   change (e.g. a page crossing into "avoid") is the right default. Every
   email carries a one-click unsubscribe (mute all) and links back to
   `/me#watchlist`.
4. A **watchlist section on `/me`** with the same rows the mobile app will
   show: name, band, last change, mute.

Metric: follows per signed-in user; digest open and click rate; 7-day
return rate of accounts with at least one follow versus none.

### Loop 3 — "Since your last visit"

*Mechanisms: M2, M3, M6.* Works for **signed-out** visitors, which is most
of the audience, and costs nothing on the server.

| Step | Design |
|---|---|
| Trigger | Returning to `/` or to a page read before. |
| Action | None; it is there on arrival. |
| Reward | Homepage: "Since you were here on Tue: 4 new pages · 7 score changes · 2 you have read moved". Page: a slim bar under the score: "Changed since you last read this: score 61 → 49 · 1 new accepted evidence". |
| Investment | Reading the change updates the marker; the visitor has taught the site what they care about without an account. |

**How, within the constraints:** the browser stores a timestamp per route
(and the score it saw) in local storage, wrapped in try/catch. The v2
homepage already receives `scoreChanges7d` and `recentInvestigations`
from the cached `fetchHomeSignals`; a client island filters them against
the stored timestamp. For a page, the island compares the stored score to
the one in the server HTML. No new reads, no session, no personalisation
in the cached render. Signed-in users get the same island fed by their
follows too.

Metric: share of visits where the island renders with at least one change;
click rate on the "see what changed" link.

### Loop 4 — The impact ledger on `/me`

*Mechanisms: M4, M5 (private), M1.* Turns the account page from a list of
things you did into a record of what your doing *changed*.

| Step | Design |
|---|---|
| Trigger | "Your evidence on X was accepted" (email/push via outbox) or habit. |
| Action | Open `/me`. |
| Reward | Impact lines, not counts: "Your evidence moved Foo Exchange from 58 to 46" · "The page you requested (Bar Token) has been read 212 times" · "2 pages you follow changed this week". |
| Investment | Submit again; request again; follow more. |

**Exists:** rep score, accepted/rejected counts, trusted threshold, recent
requests/scans/submissions, view counts per page, decision events with
score deltas. **Missing:**

- **Rep as a goal, not a formula.** Replace "Σ(analyzer confidence …)" with
  a progress bar: "2.4 / 3 to Trusted contributor · one more accepted
  submission gets you there". Progress toward a named threshold is M4 in
  its purest form.
- **Impact lines** joining the account's accepted submissions to the
  decision events they contributed to (score delta, page views since).
- **Verdict notifications**: accepted (with the decision line) and rejected
  (with the reason, which the analyzer already records). A rejection with a
  reason is a lesson; a silent rejection is a churn event.
- **Request outcomes** already list status; add the page's view count once
  published ("your request has been read 212 times") and a "request
  another" prompt.

Metric: `/me` visits per active account per week; second submission rate
after a first accepted one; second request rate after a fulfilled one.

### Loop 5 — Public credit and profiles (community)

*Mechanisms: M5, M4, M2.*

| Step | Design |
|---|---|
| Trigger | Seeing a handle on a page; being named in a digest ("@handle's evidence on X was accepted"). |
| Action | Visit a profile; submit to be on one. |
| Reward | A public record of what you contributed to the record. |
| Investment | The profile is a possession; people maintain possessions. |

**Exists:** handles, trusted flag, the on-chain countersign schema (an
independent signature under evidence from the submitter's own wallet).
**Missing, in order:**

1. **Credit lines on the page.** In the submissions section, accepted
   evidence shows "submitted by @handle" (opt-in per account; default on
   for accounts that set a handle). First accepted evidence on a page earns
   "first evidence" in the credit line. This is the single cheapest
   community feature: contributors become visible where their work is.
2. **Public profile `/u/[handle]`**: trusted badge, accepted count, pages
   contributed to, requests fulfilled, join date, wallet countersign count.
   Static and cacheable (no session read), revalidated when a submission is
   decided.
3. **Contributors panel on `/data/growth`** (or a new `/contributors`):
   the top handles this month by accepted evidence, plus "newest
   contributors". A leaderboard is a small-cohort feature and works best
   while the cohort is small; cap it at ten and rotate the window monthly
   so newcomers can appear.
4. **Named milestones as shared goals.** The T1–T4 targets in
   HOMEPAGE_V2_SPEC §7 are already milestone rows; frame them publicly:
   "450 fact-checked pages · 316 so far · 8 this week". Include the
   contributor count so people see themselves in the bar.
5. **Badges, sparingly, tied to record behaviour** rather than activity
   volume: *Trusted contributor* (exists), *Exonerator* (evidence that moved
   a score up, which the homepage gate G4 also needs), *Countersigned*
   (wallet-signed evidence), *Requester* (first fulfilled request).

Metric: distinct submitters (T2, target ≥ 10); share of accepted
submissions with a public handle; profile views.

### Loop 6 — Wallet re-scan and guardian alerts

*Mechanism: M3, above all.* The scan is the one moment the site is about the
visitor's own money; today it ends when the page closes.

| Step | Design |
|---|---|
| Trigger | "1 position in your last scan changed band" (push/email) or a return to `/scan`. |
| Action | Re-scan, one tap (the address is stored). |
| Reward | A diff, not a report: positions that changed band since last time, pages newly published for holdings that were "unknown" before. |
| Investment | "Watch this wallet" writes an address row to the watchlist. |

**Exists:** scans stored per account with risk score, coverage and
position count; address target kind on the watchlist. **Missing:** the diff
view (compare the latest two scans of the same address), the "watch this
wallet" toggle on the report page, and the Wallet Guardian writer
(MOBILE_APP_SPEC §9.3). Addresses stay out of push and email bodies
(outbox rule 4).

Metric: re-scan rate per address; watched wallets per account.

---

## 5. Where each mechanism lives on each surface

| Surface | Anticipation M1 | Variable reward M2 | Relevance M3 | Progress M4 | Recognition M5 | Curiosity M6 |
|---|---|---|---|---|---|---|
| `/` (v2) | queue countdown | pulse, movers, trending | since-last-visit island | milestone bar | contributors strip (P2) | mover reason links |
| `/[slug]` | "evidence under review: 2" | change bar since last read | Follow button, follower count | — | credit lines on evidence | "why did the score move" → audit |
| `/request/[id]` | status + expected drain time | — | notify-me (exists) | queued → running → published | "requested by you" on the page | — |
| `/scan` | — | re-scan diff | the whole page | coverage % rising over time | — | "3 unknowns · request pages" |
| `/me` | pending verdicts | this week's changes on follows | everything | rep progress bar | trusted badge, profile link | impact lines |
| `/u/[handle]` | — | — | — | contribution history | the page itself | — |
| Email / push | verdict arriving | weekly "what moved" | only what you follow or hold | milestone reached | "@you were credited" | one-line reason |

---

## 6. Attention design rules

- **One ask per surface.** The homepage's ask is the command bar; the page's
  ask is Follow; the scan's ask is Watch this wallet; `/me`'s ask is the next
  step toward Trusted. Do not stack asks.
- **The change signal lives above the fold**, and every signal that shows
  a number moving links to the reason.
- **Notify on change, digest on schedule.** Immediate for a band crossing on
  something you follow or hold, weekly for everything else. The 20/day cap
  and dedupe keys already prevent floods; the digest prevents drips.
- **Timestamps in relative human units** ("3 hours ago"), never "2026-09".
  Freshness is the proof of life.
- **Reduced motion is respected** (already in `globals.css`); the count-up
  is the only animation and it runs once.

---

## 7. Guardrails (what we will not build)

The product sells trust. Techniques that are standard elsewhere would
undercut the brand here, and the outbox rules already encode part of this.

- No fake urgency or scarcity ("only 2 spots", countdowns not backed by a
  real schedule).
- No streaks with loss framing. A "days active" counter that shames a
  missed day is out; a "member since" line and a contribution history are
  in.
- No infinite feed. Shelves are capped (15 cards on v2) and end.
- No notification without a real change in the record behind it, and never
  more than the cap.
- No allegation stated as fact in a notification body; scores and statuses
  only (outbox rule 5).
- Reputation never decays for inactivity; it only moves on verdicts.
- Every credit line and profile is opt-out per account.

---

## 8. Metrics and baselines

| Metric | Source | Baseline (Sept 2026) | First goal |
|---|---|---|---|
| Human 7-day return rate | `visitor_days` (migration 036) | not yet reported | report it on `/data/growth`, then target +50% |
| Human page views / 7 d | `fetchActivityStats` | 156 | reported, not a goal (as in v2 spec) |
| Distinct evidence submitters | `distinctSubmitters` | 4 | ≥ 10 (T2) |
| Follows per signed-in account | watchlist | 0 (no UI) | median ≥ 3 within 30 days of the button |
| Digest click-through | outbox `data` + `/api/pv` type | — | ≥ 25% |
| Second action rate | requests, submissions per account | — | ≥ 40% of first-accepted submitters submit again within 30 d |
| `/me` weekly visits per active account | page views | — | ≥ 1 |
| Re-scans per scanned address | `wallet_scans` | — | ≥ 1.5 |

Add the return-rate row to the Milestones panel on `/data/growth` so the
site tracks its own retention in public, the same way it tracks the corpus.

---

## 9. Sequencing

| Phase | Items | Depends on | Effort (one engineer) |
|---|---|---|---|
| **P0** | Close v2 gates G1 (heartbeat worker) and G4 (one upward score change); cut over `/` (Loop 1). Follow button + `/me` watchlist section (Loop 2, items 1 and 4). "Since your last visit" islands (Loop 3). | Heartbeat worker scheduled; drain cadence | ~4 days |
| **P1** | Watchlist Alert writer + email digest channel on the dispatcher (Loop 2, items 2–3). Verdict notifications and rep progress bar (Loop 4). Credit lines on accepted evidence (Loop 5, item 1). | Notify dispatcher worker deployed (MOBILE_APP_SPEC) | ~5 days |
| **P2** | Impact lines on `/me` (Loop 4). Public profiles and contributors panel (Loop 5, items 2–4). Mover reason links and queue countdown on `/`. | P1 | ~5 days |
| **P3** | Wallet re-scan diff, watch-this-wallet, Wallet Guardian writer (Loop 6). Badges (Loop 5, item 5). | P1 | ~4 days |

P0 needs no new tables and no new workers beyond the heartbeat already
owed to the v2 launch. P1 rides on the mobile botfleet work that is in
flight for the October hackathons, so the web and the app get the same
alerts from the same rows.

---

## 9a. Mobile app (added 2026-09-26)

The app in `mobile/` is the easier place to build personal loops. It has
no ISR cache to protect: a native screen is personal by nature, and the
phone has its own storage for "last seen" markers. The cost rules still
apply in full. Every call to `/api/v1` is a billed Vercel invocation, so the
app follows three rules:

- **Markers live on the phone.** Last-seen times, the score a reader saw,
  and the last scan of a wallet are kept in on-device storage
  (`mobile/src/retention/memory.ts`). The server never learns what anyone
  read, and no new route or table is needed.
- **Loops reuse reads the app already makes.** The home feed, the Watch
  tab's "what moved" section and the Alerts tab all share **one** cached
  `GET /api/v1/activity?limit=50` per app session (public, `s-maxage=300`).
  Comparisons happen on the phone (`mobile/src/retention/diff.ts`).
- **No polling.** Nothing added for retention refreshes on a timer.
  Pull-to-refresh is the only refetch. The one poller in the app (request
  status) keeps its existing bounded 5 s → 10 s → 20 s schedule, which
  stops after five minutes.

### Loop → screen map

| Loop | Mechanism (§1) | App screen | What it shows | Data it uses | State |
|---|---|---|---|---|---|
| 1 Living front door | M2, M6 | **Search tab, empty state** (`app/(tabs)/index.tsx`) | "Recently updated" and "Latest decisions", each row with a relative time and a score move `58→46` | `/api/v1/investigations?sort=updated`, `/api/v1/activity` | Exists (0.2.1) |
| 3 Since your last visit (home) | M2, M3, M6 | **Search tab**, top card | "Since you were here 2 days ago: 14 decisions on 9 pages · 3 score moves · 2 pages you read moved", each of *yours* a tappable row | activity feed + the phone's page memory | Built 2026-09-26, untested on device |
| 3 Since your last visit (page) | M2, M3, M6 | **Entity screen**, bar under the gauge | "Changed since you last read this (3 days ago): score 61 → 49 · 1 accepted evidence · 1 fact-check verdict", with the new rows marked **NEW** in the audit trail below (the reason for each change) | the audit trail the screen already loads + page memory | Built 2026-09-26 |
| 2 Follow | M1, M3 | **Entity screen**, one Follow toggle | Follow / ✓ Following (tap again to unfollow), the cap message on 409 (10 free, 50 for SKR holders), and what a follow will alert on | `/api/v1/watchlist` GET once per session (shared), POST, DELETE | Built 2026-09-26 |
| 2 What moved | M2, M3, M6 | **Watch tab**, first card | Each followed page whose score moved or that had a decision since the last Watch visit, each change linking to the entity screen, where the audit trail holds the reason | watchlist + shared activity feed + the phone's watch snapshot | Built 2026-09-26 |
| 2 Follower count | M5 | Entity screen | **Not shown.** No route exposes a count, and the watchlist table is service-role only. Proposal below. | — | Missing server-side |
| 2 Alerts | M1, M2 | **Alerts tab** | The outbox rows, newest first, relative times, rows newer than the last Alerts visit marked NEW | `/api/v1/feed` | Built 2026-09-26 (NEW markers) |
| Anticipation on requests | M1, M4 | **Request screen** (`app/request/[id]`) | A three-step rail, queued → investigating → published; how long it has waited; the **real** drain schedule ("next queue run in about 3 hours · up to 10 requests per run, highest priority first"); and whether this phone will be notified | `GET /api/requests/:id` + the published Routine schedule (`docs/CRON_RUNBOOK.md`) | Built 2026-09-26 |
| 4 Impact ledger | M4, M5, M1 | **Profile tab** | Rep as a goal ("2.1 of 3 toward Trusted contributor"), accepted/rejected verdict counts, requests with their outcome, and "pages you helped publish" (fulfilled requests, linked) | `/api/me` rep, `GET /api/requests` (signed in) or the ids this phone made (signed out) | Built 2026-09-26; per-submission verdicts missing server-side |
| 5 Public credit | M5 | — | Not in the app for the hackathon | — | Deferred |
| 6 Re-scan diff | M3 | **Scan tab** | "Scan again" for wallets this phone has scanned; after a re-scan: "since your last scan (4 days ago): exposure 62 → 55 · 1 holding's score moved · 1 now has a page · 2 new positions" | the scan the user asked for + the phone's last-scan snapshot | Built 2026-09-26 |
| 6 Watch this wallet | M3 | **Scan tab**, after a scan | One button that adds the address to the watchlist (`target_kind: 'address'`, `chain: 'solana'`), subject to the same cap | `/api/v1/watchlist` POST | Built 2026-09-26 |

### Attention rules applied to the app (§6)

- **One ask per screen.** Entity: Follow. Scan: Watch this wallet. Profile:
  the next step toward Trusted. Request: Notify me.
- **The change signal sits above the fold:** the entity bar sits directly
  under the gauge, and the home card sits above the feed.
- **Every relative time in words** ("3 hours ago") through one helper,
  `mobile/src/retention/time.ts`.
- **Reduced motion.** The app has no animation today, so nothing needs to
  be turned off. Any future animation must check
  `AccessibilityInfo.isReduceMotionEnabled()` first.

### Guardrails applied to the app (§7)

- A change is reported only when a score really differs or a decision is
  newer than the marker. A first visit reports nothing rather than calling
  everything new.
- No streaks, no counters of days, no badges for opening the app.
- Every list is capped: the home card shows at most 5 of your pages, the
  feed shows 10, and the Watch card shows what moved and then ends.
- The request screen's "next run" comes from the published Routine schedule
  and is phrased as a schedule, not a promise. The UI says when a request
  waits for more than one run.
- Change lines state scores and statuses only: "score 61 → 49", never a
  characterisation of the entity.

### Server-side gaps found while building (proposals, not built)

1. **Follower count.** A public, cached count per slug, shown only above a
   threshold (e.g. ≥ 3) so it is social proof and not a zero. One option is
   a SQL function behind the existing public investigation route, so the
   app gets `follower_count` on `GET /api/v1/investigations/:slug` with no
   new invocation:
   ```sql
   -- proposal only; take the next free migration number at build time
   create or replace function watchlist_follower_count(p_slug text)
   returns integer language sql stable security definer as $$
     select count(*)::int from watchlist
     where target_kind = 'investigation' and slug = p_slug and not muted
   $$;
   ```
2. **Per-account submission verdicts.** `/api/me` returns counts only. The
   impact ledger needs `[{submission_id, slug, entity_name, status,
   decided_at, score_delta}]` for the account's last 20 submissions. The
   best home for this is `/api/me` itself (spec §3: extend `/api/me` rather
   than add a session-reading route).
3. **Queue position and next-run time from the server.** The app currently
   hard-codes the drain Routine's schedule
   (`mobile/src/retention/queue-schedule.ts`). A `next_drain_at` and a
   `queue_position` on `GET /api/requests/:id` would keep the app honest if
   the schedule changes.
4. **Scan history per account.** Re-scan diffs are on-device only. A
   signed-in user who changes phones loses the "last scan". `GET /api/scan`
   (the account's last few scans, Bearer) would fix that.

## 10. Glossary

- **Dopamine loop / hook**: a repeatable cycle of prompt → small action →
  unpredictable-but-real reward → something left behind that makes the next
  prompt more relevant.
- **Variable reward**: a payoff that is real and roughly expected but not
  exactly predictable; the brain pays more attention to these than to
  fixed ones.
- **Goal gradient**: effort increases as a visible goal gets closer; a
  progress bar exploits it.
- **ISR (Incremental Static Regeneration)**: the page is built once, served
  from cache to everyone, and rebuilt on a timer or when told to. It is why
  cached pages cannot know who is looking.
- **Client island**: a small piece of the page that runs in the visitor's
  browser after the cached HTML arrives, and so *can* be personal.
- **Watchlist**: the table of (account, thing) pairs that says who follows
  which page or wallet address.
- **Outbox**: the table every notification is written to before a worker
  sends it; it enforces dedupe and the daily cap.
- **Decision event**: a recorded, on-chain-anchored change to a page (score
  change, evidence accepted, review verdict).
- **Trusted contributor**: an account whose reputation score is at least 3
  (confidence-weighted accepted evidence minus half a point per rejection).
