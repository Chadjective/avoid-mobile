# AVOID.NET Mobile — Hackathon Readiness Audit

> **Historical snapshot (26 Sep 2026). Superseded; do not quote its status.**
> Since then: every mobile PR is merged and main carries **0.2.3**; the
> Railway notify services are running (verified 4 Oct); the queue drains every
> four hours (00/04/08/12/16/20 UTC); migrations through 070 are applied; the
> Expo quota reset on 30 Sep. **Wallet sign-in succeeded on the Seeker on
> 6 Oct (0.2.3)**; follow and request work; push needs Firebase
> (google-services.json + FCM key) in the next build. Current test plan:
> `docs/MOBILE_DEVICE_TEST_0.2.3.md`. Current submission checklist:
> `docs/HACKATHON_SUBMISSION_CHECKLIST.md` (PR #258).

**As of:** 2026-09-26 (overnight session 5) · **Deadline that matters:** CLOCK IN, **Thu 8 Oct, 6 PM Pacific** (portal closes 11:59 PM) · Colosseum Crypto World's Fair closes **12 Oct**
**Pairs with:** [MOBILE_APP_SPEC.md](MOBILE_APP_SPEC.md) (§2.2 jobs, §10 build plan) · [RETENTION_LOOPS_SPEC.md](RETENTION_LOOPS_SPEC.md) · [MOBILE_DEMO_SCRIPT.md](MOBILE_DEMO_SCRIPT.md) · `mobile/CHANGELOG.md`

> **How this was checked.** Every row below was checked against the code on
> `main` (commit `4e72aa8`) and, where it could be done safely, against the
> live site with a read-only request: `GET /api/v1/watchlist` and
> `/api/v1/feed` answered 401 "Not signed in", so they are deployed;
> `/api/v1/activity` and `/api/v1/attestations` answered 200, so the
> countersign table (migration 054) exists in production. The live ops page
> (`/data/ops`) and the queue schedule were read too. **Nothing was tested on
> a phone.** "Built" means the code exists and compiles. It does not mean it
> works on a Seeker.

## Status key

| Mark | Meaning |
|---|---|
| **DONE** | Built and confirmed working somewhere real (on a device, or live in production). |
| **BUILT** | Code exists and compiles, but has never been run on a phone, or its server half is not confirmed running. |
| **MISSING** | Not built. |
| **OWNER** | Only the owner can do it (a device, an account, a secret, or a decision). |

---

> **UPDATE 2026-09-26 06:50 UTC — the Expo account is out of free Android
> builds until Thu 1 Oct.** The #212 build was refused with "This account has
> used its Android builds from the Free plan this month". **No new APK can be
> made for Saturday's device test** unless the owner either upgrades the Expo
> plan for this month (then re-runs the job from GitHub Actions), or builds
> locally (`npx eas build --platform android --profile preview --local`, which
> needs the Android SDK). Waiting until 1 Oct leaves one week to test, record
> and submit. **Recommendation: upgrade for one month.** It is the cheapest way
> to protect the schedule. Also confirmed by the same log: the Supabase anon
> key *is* set in the EAS preview environment (O4 below is done).

## 1. The one-paragraph answer

The app is **feature-complete on paper and almost entirely untested on a
phone**. Every job J1–J6 has screens and a deployed server route. The only
device run so far (18 Sep) found three sign-in bugs. The fixes were written
the same day and have never been run on a device. Two things block the demo
and cannot be fixed from a cloud session. First, **nobody has confirmed that
the alert bots and the push sender are running on Railway**: the live ops
panel shows "no data" for every worker, and zero notifications were sent in
the last 24 hours. Without them, J3 (push when something you follow changes)
and J4 (push when your request publishes) show nothing. Second, **wallet
sign-in has never succeeded on the Seeker**. The critical path to 8 Oct runs
through one device session: install the latest APK, sign in, follow a page,
and watch a real decision reach the phone. It should happen this weekend.

---

## 2. Jobs J1–J6 (and J7 SKR) against the code

| Job | What the judge sees | App | Server | Status | What is left |
|---|---|---|---|---|---|
| **J1** Search + case file | Search box, home feed, entity page with gauge, band, sections, timeline, sources, audit trail | `app/(tabs)/index.tsx`, `app/entity/[slug].tsx` | `/api/search`, `/api/v1/investigations[/:slug]`, `/api/v1/activity`, `/:slug/audit`, all live and cached (`s-maxage=300`) | **BUILT** (the 18 Sep APK installed and opened on a Seeker, but no record says a page was read end to end) | Device test. Tonight's build adds "since your last visit" to both screens. |
| **J2** Wallet scan | Connect wallet → scan → holdings with bands | `app/(tabs)/scan.tsx` | `POST /api/scan`, `GET /api/scan/:id` (Bearer-aware) | **BUILT** | Device test with a real wallet. Tonight adds re-scan diff + "watch this wallet". |
| **J3** Follow + push | Follow a page; phone buzzes on a change | Follow button, Watch tab, Alerts tab, push registration. **Two bugs on `main` made every successful Follow/Mute and every push registration show an error** (response-shape mismatches); fixed in #212 | Routes **live** (401 probe). Bots `watch_dispatch`, `notify_dispatch_worker` **written**; ops panel shows **NO DATA** for both, and "0 waiting · 0 sent 24h" | **BUILT, server half unconfirmed** | **OWNER:** confirm Railway services 9 and 10 exist and are running (see §5). Then do the W2 exit test on a device. |
| **J4** Request → notified on publish | Ask for a missing page; see queued → running → published; get told | `app/request/[id].tsx` | `POST/GET /api/requests`, **live**. The queue is drained by a cloud Routine at 12:00 / 17:00 / 23:00 UTC, up to 10 per run; it is enabled and its last run succeeded (25 Sep 23:01 UTC). The `fulfilment` bot is written; the ops panel shows NO DATA | **BUILT**; publishing works, notification unconfirmed | Same Railway check (service 11). Tonight adds a progress rail and the real schedule to the screen. |
| **J5** Submit evidence + countersign on-chain | Submit → sign a memo from your own wallet → it shows in the audit trail | `app/entity/[slug]/submit.tsx`, `src/solana/countersign.ts` | `POST /api/submissions`, `POST /api/v1/attestations` (live; table exists) | **BUILT** | Needs a working wallet sign-in first (the account must have a verified wallet). Device test on mainnet: costs about 0.000005 SOL. |
| **J6** Verify an anchor on the phone | Tap "verify" on an audit row; the phone reads Solana itself and says whether the hash matches | `DecisionRowView` + `src/solana/verify-anchor.ts` | No server in the loop. Decisions are being anchored on **mainnet-beta** today (the latest row seen at audit time: Kelp DAO, 26 Sep 05:18 UTC). | **BUILT** | Device test. Known limit: it checks the memo's hash, not which key signed it (CHANGELOG 0.2.0). |
| **J7** Seeker + SKR | `[SEEKER VERIFIED]` and SKR tier on Profile; SKR holders get 50 follows instead of 10, 3× scans, request priority | Profile pills | `web/src/lib/seeker.ts` (SGT + SKR balance, holder minimum **69 SKR**), wired into `/api/me`, the watchlist cap, the scan limit and request priority | **BUILT** | Needs wallet sign-in to work. **OWNER:** the Boost (pay SKR) decision is still open. |

---

## 3. Build plan W1–W3 (MOBILE_APP_SPEC §10), deliverable by deliverable

### W1 — Sep 16–22

| Deliverable | Status | Evidence / note |
|---|---|---|
| Lock D1–D4 | **DONE** | Spec header, 2026-09-16 |
| `mobile/` scaffold (Expo) | **DONE** | CHANGELOG 0.1.0 |
| MWA connect + SIWS | **BUILT** | Connect worked on the Seeker. SIWS **failed** (`-1/authorization request failed`). A two-prompt fallback was built on 18 Sep and has never been run. |
| Migrations 050–054 | **DONE** (054 confirmed live); 050–053 very likely | The routes that need them answer normally. `lib/auth.ts` also has a pre-050 fallback, so the owner should confirm 050 in the Supabase dashboard. |
| Bearer auth on the routes | **DONE** | `/api/v1/_auth.ts`, `getCurrentAccountFromRequest` |
| Screens: Search, Entity, Scan | **BUILT** | |
| Design tokens | **DONE** | `mobile/src/design/` |
| **Exit test:** installs on a Seeker · wallet sign-in · open a page · run a scan | **Partly.** It installs. Sign-in **failed**. The page and the scan are not recorded. | **OWNER: device session #1** |

### W2 — Sep 23–29 (this week)

| Deliverable | Status | Evidence / note |
|---|---|---|
| Watchlist routes + screen | **BUILT**; routes live | 401 probe. The screen lists follows with mute/unfollow. |
| Push registration + outbox + dispatcher | **BUILT**; dispatcher running **unconfirmed** | `src/notify_dispatch_worker.py`, Railway service 9. The ops panel shows NO DATA and 0 sent in 24h. |
| Watchlist Alert bot + Fulfilment bot live | **BUILT**; running **unconfirmed** | Services 10 and 11. `docs/ROADMAP.md` A4 says "confirm which alert bots are deployed". |
| Countersign memo + attestations route | **BUILT**; route live | |
| SGT check + SKR tier | **BUILT** | `web/src/lib/seeker.ts` |
| Deploy the Merkle root worker | **MISSING** (never deployed) | `railway.toml` service 12: "never deployed". The ops panel shows NO DATA. `latest_root` is null in every audit response. |
| **Exit test:** follow → real decision → phone buzzes within 60 s · countersign shows in audit trail · Seeker badge on a real Seeker | **Not run** | **OWNER: device session #2** |

A caveat on the ops panel: it shows NO DATA even for the decision-anchor
worker, which *is* running (anchors land on mainnet every day). The per-worker
run log was only added on 23 Sep (#196), and the workers probably have not
been redeployed since. So "NO DATA" proves nothing either way. **The Railway
dashboard is the only reliable source until the workers are redeployed.** The
push-queue line ("0 waiting · 0 sent 24h") is read from the outbox itself and
*is* meaningful: no notification has been written or sent in a day in which
pages were published and reviewed.

### W3 — Sep 30–Oct 6

| Deliverable | Status | Note |
|---|---|---|
| Telegram answer bot | **BUILT** | `src/bots/answer_bot.py`. **OWNER:** needs a `TELEGRAM_BOT_TOKEN` from @BotFather and Railway service 13. |
| Wallet Guardian (capped) | **BUILT** | Service 14. Profile says plainly when a wallet is not watched. |
| On-device anchor verify | **BUILT** | Per-row "verify" on the entity page (J6). |
| UI polish pass (UX + UI = 30% of CLOCK IN) | **In progress** | #212: relative times, empty and loading states, change markers, TalkBack hints. Device feedback drives round 2. |
| Blink ("check before you sign") | **MISSING** | Cut candidate #3 in D10. Leave it cut. |
| Demo script locked **Oct 1** | **Draft** | [MOBILE_DEMO_SCRIPT.md](MOBILE_DEMO_SCRIPT.md), first draft tonight |
| Demo video first cut **Oct 3** | **MISSING** | Needs a working device run first. |
| Pitch deck first cut **Oct 4** | **MISSING** | |
| CHANGELOG + disclosure text final | **Ongoing** | Disclosure paragraph drafted in the demo script. |
| **Exit test:** a stranger installs from a link and does J1–J6 unaided; both videos under 3 min | **Not run** | |

### Freeze — Oct 7–8

| Item | Status | Note |
|---|---|---|
| Signed release APK at a direct link | **Needs a decision** | `eas.json` `production` builds an **AAB** (Play Store format), which CLOCK IN does **not** accept. The `preview` profile builds an **APK** and is what the CI already makes. Either submit a `preview` APK or add an `apk` release profile. It is a one-line change; do it in the freeze week, not now. |
| Public mirror of `mobile/` (D2) | **OWNER** | `git subtree split`; decide who gets read access for Colosseum |
| Submit CLOCK IN by Oct 8, 6 PM PT | **OWNER** | |

---

## 4. Critical path to 8 October

Everything below depends on the item above it. Nothing else is on the
critical path. The Telegram bot, the Merkle worker, Wallet Guardian and the
Blink all make the story better, and none of them is required for a
submission.

1. **Confirm the Railway services 9 (notify-dispatch), 10 (watch-dispatch) and
   11 (fulfilment) exist and are running** (owner, ~20 min; `docs/RAILWAY_DEPLOY.md`
   §10–11 are the checklists). Without these, J3 and J4 are silent.
2. **Merge the band-rename PR #187, then tonight's build PR #212** (two trivial conflicts, described in #212), then install the
   APK that CI produces. Builds 0.2.1 and older cannot read the new
   `LOW_RISK` band, so the Watch tab breaks on an old build once #187 deploys.
   Install a fresh one.
3. **Device session #1: sign in with the wallet on the Seeker.** If the
   fallback also fails, that is the one bug worth a whole day. Everything
   personal (follow, alerts, countersign, Seeker badge, SKR) sits behind it.
   The email magic link is a working plan B for the demo, but the SKR and
   Seeker criteria (20%) need the wallet.
4. **Device session #2: the W2 exit test.** Follow a page, trigger a real
   decision, watch the phone buzz, then countersign one submission.
5. **Lock the demo script (Oct 1)**, record the first cut (Oct 3), deck (Oct 4).
6. **Freeze (Oct 7):** APK at a direct link, mirror repo, and submit **Oct 8
   by 6 PM Pacific**.

---

## 5. What only the owner can do

| # | Item | Why it cannot be done from a cloud session | How long |
|---|---|---|---|
| O1 | **Device tests on the Seeker** (sessions #1 and #2 above, then the stranger test) | Nothing here has a phone | 1–2 h each |
| O2 | **Railway: confirm or create services 9–11** (then 13–14 if wanted) | No Railway access here | 20–60 min |
| O3a | **Expo build quota is used up until 1 Oct.** Upgrade the plan or build locally (see the update at the top). This comes first. | Expo account | 10 min |
| O3 | **EXPO_TOKEN**: already set and working (CI queued an APK build tonight). **But watch the free build quota.** Every branch push that touches `mobile/` queues a build, and four other branches queued one tonight between 05:16 and 05:21 UTC. Consider limiting the workflow to `main` plus manual runs until the freeze. | Expo account | 5 min |
| O4 | **EAS environment variable `EXPO_PUBLIC_SUPABASE_ANON_KEY`** on expo.dev, if not already set. Without it, sign-in is dead in every build (the 18 Sep bug). | Expo account | 5 min |
| O5 | **Team and eligibility** (spec §11.1): who is on the team, which country each member is in (USDC payout eligibility), and the prize wallet. Both hackathons lock the team at submission. | A decision | — |
| O6 | **SKR decision** (§11.2): access-gate only (built, 69 SKR), or also accept SKR payments ("Boost")? The recommendation is gate only for the hackathon; Boost is cut item #1. | A decision | — |
| O7 | **Telegram bot token** from @BotFather + a bot name (§11.7) | A Telegram account | 10 min |
| O8 | Public mirror repo and Colosseum reviewer access (§11.5) and the Colosseum track (§11.6) | Decisions | — |
| O9 | Confirm migration 050 in the Supabase dashboard (the others are implied by live routes) | Production database | 5 min |

---

## 6. Day by day, 26 Sep → 8 Oct

Tight but doable. The rule from May still holds: **record before the
deadline, not at it.**

| Date | Owner | Claude sessions | Done when |
|---|---|---|---|
| **Fri 26 Sep** | Read this doc + the overnight report. Merge the build PR if it looks right. **O2** (Railway 9–11). | — | Services 9–11 show a recent run on Railway |
| **Sat 27 Sep** | Merge #187. Install the fresh APK. **Device session #1** (sign-in, open page, scan). Send a screen recording of anything that fails. | Fix whatever session #1 finds, same day | Wallet sign-in works on the Seeker |
| **Sun 28 Sep** | **Device session #2** (follow → decision → buzz; countersign) | Fix; start the pitch outline | W2 exit test passes |
| **Mon 29 Sep** | O5 team/eligibility, O6 SKR decision | UX polish round 2 from device feedback | Decisions written into spec §11 |
| **Tue 30 Sep** | O7 Telegram token (optional) | Telegram bot live (if token); demo script revision | — |
| **Wed 1 Oct** | **Lock the demo script** | Script v2 from owner notes | Script frozen |
| **Thu 2 Oct** | Rehearse the script on the device twice | Fix anything the rehearsal hits | Rehearsal clean |
| **Fri 3 Oct** | **Record demo video first cut** | Pitch deck draft | Cut 1 < 3 min |
| **Sat 4 Oct** | Review the cut. **Deck first cut.** | Deck revision | — |
| **Sun 5 Oct** | Stranger test: someone else installs from the link and does J1–J6 unaided | Fix only what the stranger hit | Stranger completes J1–J6 |
| **Mon 6 Oct** | Re-record if needed | CHANGELOG + disclosure final; release APK profile | — |
| **Tue 7 Oct** | **Freeze.** Final APK at a direct link. Mirror repo. Final video. | No feature work. Only blockers. | Everything uploaded |
| **Thu 8 Oct** | **Submit CLOCK IN by 6 PM Pacific** | — | Confirmation on the Radiants portal |
| Thu 9–Sat 11 Oct | Colosseum form: presentation video, GTM, prior-work disclosure | Draft the form text | Submitted by 11 Oct |

**Cut list if the week slips** (spec D10, unchanged): Boost-with-SKR →
Social Changelog → Blink → Discord → on-device Merkle verify. **Never cut:**
wallet sign-in, wallet scan, watchlist + push, countersign.

---

## 7. Risks that changed since the spec was written

| Risk | Now | Mitigation |
|---|---|---|
| Push never demonstrated | **High.** No evidence that any notification has ever been sent. | O2 first; record the buzz with the phone on screen and `/data/ops` showing the outbox row. |
| SIWS never worked on the Seeker | **High** | Device session #1 on Saturday; email link is the fallback for everything except J7. |
| EAS free build quota | **Medium.** Other sessions queue builds on every push. | O3: limit the workflow to `main` + manual until the freeze. |
| Old builds break on `LOW_RISK` | **Medium**, certain once #187 deploys | Install a fresh build after merging. |
| `production` profile makes an AAB, not an APK | Low (easy fix), but it would fail submission on the day | Decide in the freeze week (§3). |
| `app.json` says version 0.2.0 while CHANGELOG says 0.2.1 | Low | Bump when cutting the release APK. |

---

## Number and claim check (2026-10-05)

Task H3 of the hackathon freeze plan. Every number or factual claim in the hackathon-facing text was checked and given one verdict: **VERIFIED** (evidence cited), **OUTDATED** (current figure and source given), or **UNVERIFIABLE** (why, and what the founder must check). Docs only; no code was changed.

**What was read, and when.** All reads were on Mon 5 Oct 2026, between about 18:50 and 19:30 UTC.

| Key | Source |
|---|---|
| `main` | `origin/main` at 40e5d98: `docs/MOBILE_DEMO_SCRIPT.md` (draft 1, cited as `main_demo`), `docs/POSITIONING.md`, code under `web/`, `mobile/`, `src/` |
| `demo2` | `origin/claude/pitch-and-demo-script` at fda1b80, `docs/MOBILE_DEMO_SCRIPT.md` (draft 2) |
| `pitch` | same branch, `docs/COLOSSEUM_PITCH_2026-10.md` |
| `sub` | `origin/claude/hackathon-submission-readme` at 64addf8, `docs/HACKATHON_SUBMISSION_2026-10.md` |
| `mrd` | same branch, `mobile/README.md` |
| `scripts` | `origin/claude/hackathon-pitch-scripts-6f6312` at 015be7a, `docs/HACKATHON_PITCH_SCRIPTS.md` |
| `forms` | same branch, `docs/HACKATHON_FORM_ANSWERS.md` |
| live | `https://avoid.net/api/v1/stats`, `/data`, `/data/api`, `/data/audit`, `/data/activity`, `/data/ops`, read by curl on 5 Oct. The `/data` corpus totals say "computed 2026-10-04 20:14 UTC", so they are about a day old (the activity page shows 10 new investigations in the last 24 hours). |

Line numbers are those of the branch tips above. They differ from the line numbers in the 4 Oct submission checklist because those branches have been edited since. If a branch moves, the numbers move with it.

**Limits of this check.** There was no database credential, so nothing here was queried from Supabase. Figures marked "review (DB)" come from `DATA_DASHBOARD_REVIEW.md` (an earlier session's read-only queries, 4 Oct; it is not in this branch) and figures marked "report (DB)" from `docs/USAGE_REPORT_2026-09.md` (26 Sep). I did not re-run them. The 30-day API class mix and MCP count are not in the public HTML of `/data/api` (only the 24-hour mix is), so those come from the review. **The pitch deck itself is not in the repo: the founder must paste its text, and every number in it needs this same check.** Nothing was tested on a phone.

### Summary

| Verdict | Rows |
|---|---|
| OUTDATED | 13 (O1 to O13) |
| UNVERIFIABLE | 15 (U1 to U15) |
| VERIFIED | 24 (V1 to V24) |

### A. OUTDATED (fix these first)

| Claim | Where it is said | Verdict | Evidence or current figure | Suggested wording |
|---|---|---|---|---|
| **O1.** "Entities investigated" 2,091 and "reviewed and published" 304, as if both were the size of the public record | In the app itself: `mobile/app/(tabs)/index.tsx:538-540` (labels "entities investigated" = `stats.investigations`, "reviewed & published" = `stats.reviewed`). The demo puts this card on camera: `demo2:140,144`. On the website: the `/data` headline reads "2,091 entities investigated · 304 verified · 4,421 on chain anchors" and a tile "Reviewed & published 304 (14.5% of total)". The scripts already warn: `demo2:28,82`, `pitch:115`, `scripts:262`, `sub:142`. | OUTDATED (label is misleading) | `/data` (5 Oct): 2,091 rows = **1,818 published** + 189 draft + 59 merged + 25 under_investigation; "Only published pages are indexed". `/api/v1/stats` has no published field. The 304 counts `reviewed = true` on any status (`web/src/lib/data-stats.ts:1376`); 296 of them are published (review (DB), 4 Oct). `/data` says "verified"; the project's own rule is never to say "verified" (`demo2:25`). The app label cannot be changed without a code change. | On camera at the stats card, do not read the labels aloud. Say: "about 1,800 published pages, about 300 of them fact-checked, and more than 4,400 decisions anchored on Solana." Do not point a judge at `/data` as the source of "verified". |
| **O2.** "About 2,000 pages" (corpus size) | `demo2:28,80,82,259`; `pitch:79,115`; `scripts:91,169,262,352`; `forms:49,168,221`. | OUTDATED (now that `/data` has been read) | The checklist said to use "about 2,000" only if `/data` could not be read. It can: **1,818 published** on 4 Oct 20:14 UTC. "About 2,000" overstates the public record by about 10 percent; 2,091 includes drafts and merged duplicates. | "More than 1,800 published pages" (re-read `/data` on the day; round at or below the true figure). |
| **O3.** "About 15 new published pages a day (26 Sep)" | `forms:153`. Also `docs/USAGE_REPORT_2026-09.md:14-16,34` (suggested wording). `pitch:59,116` already says the line is retired. | OUTDATED | review (DB), 4 Oct: last 7 days added 59 published pages, about **8 a day**; the last 8 weeks were 60, 35, 37, 23, 40, 74, 79, 46 per week. Public cross-check: published pages went from 1,801 (26 Sep, report (DB):44) to 1,818 (`/data`, 4 Oct 20:14 UTC), a **net +17 in 8 days**, because 59 duplicates were merged away. A "pages per day" claim can be attacked either way. | Drop the rate. Say "more than 1,800 published pages". If a rate is wanted: "about 8 new pages a day over the last week" with the date. |
| **O4.** "1,757 published investigations as of 2026-09-23 (1,935 including drafts)" | `main`: `docs/POSITIONING.md:59` | OUTDATED | Now 1,818 published, 2,091 total (`/data`, 4 Oct). | "1,818 published investigations as of 4 Oct" (or "more than 1,800"). |
| **O5.** "Agents already read us more than people do. That's the customer we found, not the one we planned." | `main`: `docs/POSITIONING.md:79`. Already marked "do not use" at `pitch:129` and `scripts:266`. | OUTDATED / not supported | review (DB), 4 Oct, API origin requests in 30 days: 8,035 total; **AI crawlers 4,427 (55%)**, search-engine crawlers 13%, our own site 10%, SEO tools 9%, browsers 7%. **MCP tool calls: 44.** `api_keys` table: 0 rows (also `docs/MOBILE_APP_SPEC.md:181`). Live `/data/api` (5 Oct): 7,724 requests and 3,661 callers in 30 days; last 24 h, AI crawlers 49 of 89 (55%). Digest 28 Sep: 13,574 human page views against 7,700 API calls, most of them crawlers. The claim is true only of crawlers that index content, not of agents using the record as a tool. | "AI crawlers are the largest class of caller on our API, about half of API requests over 30 days. Agent tool use through MCP is early: 44 calls in 30 days." Say "caller", never "customer" or "user". Strike line 79 from POSITIONING. |
| **O6.** "No source-quality layer yet … does not exist yet" | `main`: `docs/POSITIONING.md:70-72` | OUTDATED | Source quality display shipped 28 Sep: `docs/ROADMAP.md:53` (A3), classifier `web/src/lib/source-quality.ts`, a line on every page and `source_quality` in the v1 JSON. 73% of cited URLs are still unrated. | "Each page shows a source-quality line; about three-quarters of cited URLs are not yet rated." |
| **O7.** "…and a daily heartbeat memo" (anchoring) | `forms:77` (A5) | OUTDATED / false | The heartbeat worker is **not deployed**: `web/src/lib/fleet-generated.ts:49-57` and `src/fleet.py:139-152` ("Owner decision (2026-10): heartbeat-worker is not being deployed"). `/data/audit` (5 Oct) says "No heartbeats recorded yet — daily on-chain pulse coming soon". review (DB): 0 heartbeat rows ever. The `/data` pulse dot is hard-coded green. | Delete the phrase. Say only "every editorial decision is anchored as an SPL Memo". |
| **O8.** Draft 1 of the demo script is still the one on `main` | `main_demo` = `docs/MOBILE_DEMO_SCRIPT.md`: `:29` drains "at 12:00, 17:00 or 23:00 UTC"; `:101` "next queue run in about 3 hours"; `:104` "drain three times a day"; `:48` "~1,750 published"; `:151` "Sybil-resistant"; `:166` "first commit 16 Sep". | OUTDATED | `docs/CRON_RUNBOOK.md:27-28` and live `/data/ops`: drain every 4 hours (00, 04, 08, 12, 16, 20 UTC), `/drain-queue 10`. First `mobile/` commit is 17 Sep (`git log origin/main -- mobile`). Replaced wholesale by `demo2` (PR #237). Note `docs/CRON_RUNBOOK.md:187-188` still lists the old slots (11/16/22 and 12/17/23 UTC). | Merge #237, or do not read from `main`'s copy. Fix the two old slot lists in the runbook. Say "every four hours". |
| **O9.** "Submit Sat 11 Oct" | `pitch:3` | OUTDATED (wrong weekday) | 8 Oct 2026 is a Thursday, so 11 Oct is a **Sunday**; the window closes Mon 12 Oct (`sub:8`). The readiness doc's own weekday labels are a day early (known, checklist S14). | "Submit by Sun 11 Oct (window closes Mon 12 Oct)". |
| **O10.** "Every one was built, typically within about an hour" | `pitch:79` (spoken line). The table row at `pitch:119` and `forms:144-146` carry the correct wording. | OUTDATED / overstated | report (DB):24-27: 385 of 397 `user` requests fulfilled (97%); one genuine request (a website name with no context) was not built. Live `/data`: 16 failed and 7 rejected of 1,271 requests. | "97 percent of user requests were built, the median in about an hour (as of 26 Sep)." |
| **O11.** Request split "776 scout, 5 wallet scans, 397 user" | `pitch:117` (labelled 26 Sep) | OUTDATED if quoted | Live `/data` (computed 4 Oct): 1,271 = 798 scout + 5 wallet scans + **468 user-tagged**. Do not say "468 people": 300 of the 397 user requests carried no submitter fingerprint (report (DB):19-23), and `/data` labels all 468 "from people". | Quote only the total ("1,271 requests") or the live split with "tagged as user requests". |
| **O12.** "947 of 1,757 published pages in the lowest band" | `pitch:183` (23 Sep) | OUTDATED | review (DB), 4 Oct: **978 of 1,818** (54%) score 19 or below. `/data` score bands (all 2,091 rows, band is 0 to 20): Critical 1,161. | "About half of pages sit in the lowest band" or the dated 978 of 1,818. |
| **O13.** "Every source snapshotted to the Wayback Machine" / "cited URLs are archived" | `main`: `docs/POSITIONING.md:21,54`; `pitch:43`; `forms:55-56` | OUTDATED / overstated ("every") | `/data` (5 Oct): sources archived **88.3%** (31,806 of 36,006, across 2,085 pages). | "About 88 percent of cited sources are archived (31,806 of 36,006)." |

### B. UNVERIFIABLE (founder to check)

| Claim | Where it is said | Verdict | Why, and what to check | Suggested wording |
|---|---|---|---|---|
| **U1.** "At least $154 billion in crypto went to illicit addresses, $17 billion taken by scams" (Chainalysis) | `scripts:70-71,260-261` | UNVERIFIABLE | No source in the repo. The draft itself says it was "found via web search on 30 Sep; not read from the report itself". Check the figures, the year and the exact wording in the Chainalysis report. | Cut, or use only a figure read from the report, with the year and attribution. |
| **U2.** Anchors are "on Solana mainnet" (all 4,421) | `demo2:62,177,249`; `scripts:197,268`; `forms:75`; `mrd:127`; `sub:177,200` | UNVERIFIABLE | The `/data/audit` label "on Solana mainnet" is a hard-coded string (`web/src/app/data/audit/page.tsx:83`). The anchor worker's default RPC is devnet (`src/decision_anchor_worker.py:126`), and the app comment at `mobile/app/entity/[slug].tsx:433-436` says the worker "has historically written to devnet". Only one mainnet row (Kelp DAO, 26 Sep) is cited anywhere. Run: `select anchor_cluster, count(*) from decision_events where anchor_status = 'anchored' group by 1;` | If every row is mainnet: "anchored on Solana mainnet". Otherwise: "anchored on Solana", and pick a mainnet row for the verify beat (`demo2` P8). |
| **U3.** "97 requests from 59 people since May" | `pitch:79,118,193`; `scripts:121,264`; `forms:143` | UNVERIFIABLE today (VERIFIED as of 26 Sep, see V17) | Live `/data` (computed 4 Oct) shows "59 distinct requesters behind 468 human requests", so the 59 may still hold, but the 97 (fingerprinted requests) cannot be re-derived from public pages. Run: `select count(*), count(distinct submitter_ip_hash) from investigation_requests where source = 'user' and submitter_ip_hash is not null;` | Keep "97 outside requests from 59 people since May, as of 26 Sep", or the new figure from the query. |
| **U4.** "13,574 human page views in 30 days to 28 Sep" | `pitch:79,122,129`; `scripts:266`; `forms:152` | UNVERIFIABLE (figure matches the digest; whether it is fair is open) | It is what `docs/digests/demand-2026-09-28-30d.md` says. But the live rate is far lower: `/data/activity` (5 Oct) shows 67 page views in 24 hours (365 bots filtered), and review (DB) found the beacon counter at 88 to 132 a day on 2 to 4 Oct, against 2,272 to 2,779 "visitor-days" a day from the newer proxy counter (85 to 90% single-hit). 13,574 over 30 days is about 450 a day. The window also overlaps the outage. Which counter is right is unverified. Recount with `demand-digest.mjs`. | Cut it, or say "as of 28 September" and do not call it "people reading us". |
| **U5.** Railway services running: notify-dispatch every 69 s, watch-dispatch every 7 min, fulfilment hourly | `demo2:42,57`; `sub:101`; `mrd:244`; `pitch:142` | UNVERIFIABLE by me (config VERIFIED, see V21) | Intervals and `deployed: true` match the registry (`web/src/lib/fleet-generated.ts:110-136`), but that is configuration, not proof they run. Live `/data/ops` (5 Oct) shows **"NO DATA"** for every bot ("telemetry unavailable"). Check in the Railway dashboard and with the latest `bot_runs` row per bot (`select bot, max(started_at) from bot_runs group by 1;`, column names unchecked). | Keep "running (Railway dashboard, date)" only if seen on the day. |
| **U6.** The queue-drain Routine is enabled and its last run succeeded | `demo2:118,253`; `scripts:267` | UNVERIFIABLE (schedule VERIFIED, see V5) | Live `/data/ops` shows the drain as "NO DATA — newest run ledger unreadable (migration 064 may not be applied)". Check the Claude Code Routines list (trigger `trig_01Mxs9du6Ru3dje8LSVW6rSY`) and that migration 064 is applied. | "Every four hours" is true of the schedule; say "last run succeeded at …" only after looking. |
| **U7.** Migrations 050 to 068 and 070 are applied | `sub:99`; `demo2:219` | UNVERIFIABLE | Files exist for 050 to 055, 057 and 066 (V13). Production evidence is indirect: `GET /api/v1/watchlist` answers 401 (route deployed). Check `select version from supabase_migrations.schema_migrations order by 1;` for 050 to 057, 064, 066. | "Applied" only after the query. |
| **U8.** Device-test outcomes: Seeker sessions 18 Sep, 29 Sep, 3 Oct, 4 Oct; wallet sign-in never succeeded; no push has reached a phone; what 0.2.3 does on a phone | `demo2:34-35`; `sub:133`; `mrd:15-20,231-250`; `scripts:7`; `forms:14-19` | UNVERIFIABLE (founder-only knowledge) | `mobile/CHANGELOG.md:15,54,64,216` corroborates the 3 Oct sign-in failure ("siws: Chain ID is not valid") and "never succeeded on the Seeker", but not the session dates or push. The 0.2.3 device test is still pending in every draft. | Keep "implemented, device test pending" until the founder has seen it work. Replace each `[OWNER: update after 0.2.3 device test]`. |
| **U9.** "57 logic tests" | `sub:74`; `mrd:251,577` | UNVERIFIABLE | `node --test` over the seven files in `test:logic` ran here: 40 tests, 38 pass, 2 files failed to load (missing `zod`, no `npm install` in this worktree). So 57 could not be confirmed. Run `cd mobile && npm ci && npm run test:logic`. | "Logic tests pass" with the count from the run. |
| **U10.** External facts: Colosseum and CLOCK IN judging weights, deadlines (Thu 8 Oct 6 PM Pacific; 12 Oct), "$100k pool, 10 winners", "$10k" SKR prize, dApp Store 30-day rule, payout-country eligibility, Seeker install base "150k preorders, 200k+ devices", the May 2026 Frontier submission | `demo2:8-10`; `sub:6-11,140,190`; `forms:271`; `scripts:27-34,275` | UNVERIFIABLE | Behind logins or third-party sites; the drafts say so themselves (`scripts:275`, `sub:140`). Re-read both portals and the Colosseum page on 6 Oct, and confirm the Frontier submission date and project name. | Quote prize and install-base figures only after reading the source that day. |
| **U11.** Team, location, "pre-revenue / zero revenue / zero paying customers", the ask and use of funds, "intend to build full-time", the 22 Sep industry call and its "three challenges" | `pitch:46,126,171,196`; `scripts:145,318-339`; `forms:93-100` | UNVERIFIABLE | Not in the repo. The drafts mark these `[FOUNDER TO CONFIRM]`. Zero registered API keys is verified (V24); zero revenue is not. | State only what you can prove. "Pre-revenue" if true. |
| **U12.** "Every claim is cited" / "every section cites a source" | `main`: `docs/POSITIONING.md:50`; `scripts:90`; `forms:50` | UNVERIFIABLE (as worded) | `/data`: 36,006 sources across 2,085 pages (about 17 a page), but "every claim" cannot be checked from here and 73% of cited URLs are unrated (`docs/ROADMAP.md:53`). The `/data` "pages with evidence 455 (21.8%)" tile counts community-submitted evidence, not citations. | "Sourced sections", not "every claim". |
| **U13.** "About 98% of pages carry a provisional score"; "about 561 hollow pages"; "306 candidate duplicate clusters" | `mrd:76,565`; `sub:142`; `pitch:183`; `forms:189-193` | UNVERIFIABLE today | Dated: 98% is 16 Sep (`docs/MOBILE_APP_SPEC.md:395`, `severity_base` NULL); 561 hollow and 306 clusters are `docs/ROADMAP.md:52`, measured 26 Sep, before 59 pages were merged. Re-query before quoting. | "Most pages" for the provisional share; drop the other two or date them. |
| **U14.** "69 SKR" is the live holder threshold | `demo2:144,196`; `sub:181`; `mrd:63,171`; `scripts:211,269`; `forms:121,275` | UNVERIFIABLE (default VERIFIED, see V6) | `web/src/lib/seeker.ts:84-88` lets the env var `SKR_HOLDER_MIN` override the default. Check that the Vercel production environment does not set it. | "69 SKR" if the variable is unset; the drafts already say "tuned once real holders appear". |
| **U15.** The pitch deck text | not in the repo | UNVERIFIABLE (absent) | The founder must paste it. Apply this table to every number and claim in it. | n/a |

### C. VERIFIED

| Claim | Where it is said | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| **V1.** 4,421 decisions anchored | `demo2:144`; `pitch:79,116`; `sub:142`; `mrd:127`; `scripts:263`; `forms:76` | VERIFIED (snapshot) | `/api/v1/stats` `anchors: 4421` read 5 Oct; `/data/audit`: 4,421 of 4,421 anchored, 0 pending, 0 failed. Snapshot is from 4 Oct 20:14 UTC; the true number is now higher (11 anchored in the last 24 h, `/data/activity`). The checklist figure 4,421 "as of 4 Oct" still matches. | "More than 4,400 decisions anchored on Solana." |
| **V2.** 304 reviewed (fact-checked) pages | `demo2:144`; `pitch:79,116`; `sub:142` | VERIFIED (snapshot) | `/api/v1/stats` `reviewed: 304`. Counts any status (`web/src/lib/data-stats.ts:1376`); 296 are published (review (DB)). | "About 300 pages fact-checked." |
| **V3.** 1,271 investigation requests | `demo2:144`; `pitch:117`; `sub:142,213` | VERIFIED (snapshot) | `/api/v1/stats` `requests: 1271`; `/data`: 468 user + 798 scout + 5 wallet scan. | "More than 1,200 requests." |
| **V4.** 2,091 rows, of which 1,818 published | `demo2:28,82`; `sub:142` | VERIFIED | `/data` (5 Oct): "1,818 of 2,091 carry status published — 189 draft, 59 merged, 25 under_investigation". | "More than 1,800 published pages." |
| **V5.** Queue drains every 4 hours (00, 04, 08, 12, 16, 20 UTC), up to 10 requests a run; scout at 03, 11, 19 UTC; "six times a day" | `demo2:43,59,116,118,195`; `mrd:139,245`; `scripts:173,180,267`; `forms:294` | VERIFIED (schedule only; running state is U6) | `docs/CRON_RUNBOOK.md:27-28` (`0 0,4,8,12,16,20 * * *`, `/drain-queue 10`; scout `0 3,11,19 * * *`); `mobile/src/retention/queue-schedule.ts:27,30` (`DRAIN_HOURS_UTC`, `DRAIN_BATCH = 10`); live `/data/ops` shows the same cron strings. | "The queue drains every four hours, up to ten requests a run." |
| **V6.** SKR holder threshold defaults to 69 | `demo2:144,196`; `mrd:63,171`; `sub:181` | VERIFIED (code default; env override is U14) | `web/src/lib/seeker.ts:82` (`DEFAULT_SKR_HOLDER_MIN = 69`), `:126` (tier = holder when balance is at least the minimum). The comment at `:79-80` ("not wired yet") is stale and still on `main`. | "Holders of 69 SKR or more." |
| **V7.** 50 follows for holders instead of 10 | `demo2:142,196`; `pitch:141`; `scripts:212,269`; `forms:122,276` | VERIFIED | `web/src/app/api/v1/watchlist/_shared.ts:74-75` (`FREE_WATCHLIST_LIMIT = 10`, `HOLDER_WATCHLIST_LIMIT = 50`) and `:83`. | As written. |
| **V8.** Three times the daily wallet scans | `demo2:142,196`; `scripts:212,269`; `forms:122,276`; `mrd:173` | VERIFIED | `web/src/lib/wallet-scan.ts:38-39,45,57-60`: anonymous 2 a day, signed in 10, holders 10 x 3 = 30. The 3x is on the signed-in limit, not the anonymous one. | "Three times the daily scans of a signed-in user (30 instead of 10)." |
| **V9.** Request priority bump for holders | `demo2:144,196`; `pitch:141`; `scripts:212,269`; `forms:123,277` | VERIFIED, but modest | Holders get `bumpedPriority(5)` (`web/src/lib/requests.ts:407`, `web/src/lib/wallet-scan.ts:414-416`: plus 1, capped at 10; signed base is 5 in `web/src/lib/request-limits.ts:17`). So 6 against 5. The checklist's pointer to `web/src/app/api/requests/route.ts:68-71` is out of date: that file now only handles update requests (`:43`); the create path is `requests.ts`. Also applied to update requests (`web/src/lib/update-requests.ts:150`). | "A small priority bump in the queue". Do not imply "front of the queue". |
| **V10.** Request update: 7-day cooldown per page and 10 a day | `demo2:124` | VERIFIED | `web/src/lib/update-requests.ts:13-14,101` (7 days, any asker); `web/src/lib/request-limits.ts:12` (`SIGNED_PER_DAY = 10`, shared across both kinds). Signed-out label: `mobile/src/api/update-request-state.ts:64`. | As written. |
| **V11.** Mobile is version 0.2.3 on `main` (#276, 4 Oct) | `demo2:36`; `sub:68`; `forms:182` | VERIFIED | `mobile/app.json:6`, `mobile/package.json:3`; commit 40e5d98 "Mobile 0.2.3 … (#276)". | As written. |
| **V12.** First `mobile/` commit 17 Sep; 35 commits touch `mobile/`; repo's first commit 19 Apr 2026 | `demo2:27,215`; `sub:31,52,123`; `forms:106` | VERIFIED | `git log --reverse origin/main -- mobile`: de1e998 on 2026-09-17, second 8dd5aef on 2026-09-18; count 35 on 5 Oct; first repo commit 0500845 on 2026-04-19. | "Started 16 Sep, first commit on main 17 Sep." Re-count on submission day. |
| **V13.** Migrations 050 to 055, 057 and 066 exist | `demo2:219`; `sub:83-90`; `mrd:268-272` | VERIFIED (existence; applied is U7) | `web/supabase/migrations/050_accounts_wallet.sql` … `055_request_notify_auth.sql`, `057_agent_requests.sql`, `066_investigation_requests_kind.sql`. | As written. |
| **V14.** `release-apk` build profile exists | `mrd:217-221`; `sub:235` | VERIFIED (profile; not yet built) | `mobile/eas.json:48-54` (extends `production`, `buildType: apk`, `distribution: internal`). | As written. |
| **V15.** GoPlus scans "across 10 chains" | `forms:84-85` | VERIFIED | `web/src/lib/goplus.ts:8-19`: 10 entries (Solana, Ethereum, BNB, Polygon, Arbitrum, Optimism, Base, Avalanche, Fantom, Blast). | As written. |
| **V16.** Digest figures to 28 Sep: 13,574 human views, 7,700 API calls, 3,374 AI-crawler calls (Meta-ExternalAgent 1,562, ClaudeBot 1,097, Amazonbot 378, GPTBot 251, OAI-SearchBot 59), 1,701 distinct pages, 34 searches, 22 gaps; referrers Google 213, Google app 208, avoid.net 75, chatgpt.com 52; "AI crawlers the largest class" | `pitch:122-125,129`; `scripts:266`; `forms:147-152` | VERIFIED as dated figures (fairness of the human-view count is U4) | `docs/digests/demand-2026-09-28-30d.md` at-a-glance table and lines 42, 46. AI crawler 3,374 vs unclassified 2,250 is the largest class. | Always "as of 28 September"; "caller", not "customer". |
| **V17.** Usage report figures (26 Sep): 97 fingerprinted requests from 59 submitters; 385 of 397 user requests fulfilled (97%); 12 unfulfilled = 7 test text, 2 bare address, 1 empty, 2 duplicates; median 1.1 h, 90th percentile 13.2 h | `pitch:118-120`; `scripts:121,264-265`; `forms:142-146` | VERIFIED against the report (not re-run) | `docs/USAGE_REPORT_2026-09.md:19-29,55-73,89-103`. | Date every one "as of 26 September". |
| **V18.** Page pill wording: "✓ fact-checked" / "under review" / "AI-drafted · awaiting fact-check"; not "verified" | `demo2:25,63` | VERIFIED | `mobile/app/entity/[slug].tsx:424-428`; web `web/src/app/entity/page.tsx:243` ("✓ FACT-CHECKED"). | Say what the screen says. |
| **V19.** Four pipeline roles: scout, investigator, reviewer, judge | `scripts:270`; `forms:51`; `mrd:108`; `demo2:195` | VERIFIED | `.claude/agents/avoid-scout.md`, `avoid-investigator.md`, `avoid-reviewer.md`, `avoid-judge.md`; `CLAUDE.md` (three subagents plus scout). No agent count appears in any draft. | "Four roles"; never "35 agents". |
| **V20.** Agents run as Claude Code subagents, not direct API calls | `sub:177`; `mrd:137` | VERIFIED as policy and docs (production environment not checked) | `CLAUDE.md` rules; `web/tests/no_paid_api.test.ts` exists; `docs/RAILWAY_DEPLOY.md:79,243` says `ANTHROPIC_API_KEY` and `LLM_BACKEND` must not be set on any worker. Legacy direct-API code remains in `src/llm_backend.py`, `src/pipeline.py` and `src/youtube_pipeline.py`; whether the Railway environment is clean was not checked. | Say it of the investigation, review and judge pipeline. |
| **V21.** Telegram answer bot, Wallet Guardian and heartbeat worker are "written, not deployed"; notify-dispatch (69 s), watch-dispatch (420 s) and fulfilment (3600 s) are configured as deployed | `demo2:154,224`; `sub:101`; `pitch:143` | VERIFIED (configuration) | `web/src/lib/fleet-generated.ts`: `answer_bot` (`:146`), `wallet_guardian` (`:156`) and `heartbeat` (`:56`) are `deployed: false`; `notify_dispatch` (`:113`), `watch_dispatch` (`:123`), `fulfilment` (`:133`) are `deployed: true`. | Keep "written, not deployed" for the first three. |
| **V22.** Fact-check verdicts are anchored decisions | `demo2:195`; `mrd:119-125` | VERIFIED | `/data` "Decisions by actor": reviewer 1,339, judge 1,055 (of 4,421, all anchored). | As written. |
| **V23.** App stack: Expo 57, React Native 0.86, React 19 | `mrd:193` | VERIFIED | `mobile/package.json`: `expo ~57.0.23`, `react-native 0.86.3`, `react 19.2.3`. | As written. |
| **V24.** Free MCP server; zero registered API keys; the MCP route exists | `demo2:200`; `forms:57-58`; `sub:212`; `main`: `docs/POSITIONING.md:34` | VERIFIED | `web/src/app/api/v1/mcp/route.ts` exists; live `GET /api/v1/mcp` answers 405 (route deployed, POST only); `docs/MOBILE_APP_SPEC.md:181` ("0 registered keys"); review (DB): `api_keys` 0 rows. | "Free API and MCP server; no keys issued yet." |

**Phrases that must not appear.** "35 agents" and "truth escrow" were searched in all seven files above. Every hit is a prohibition, not a use: `demo2:16,276`, `pitch:15`, `sub:148,239`, `scripts:19`, `forms:350`, `main_demo:17` (plus `CLAUDE.md`). `mrd` and `pos` have none. Also checked: "complete record" appears only as "never say" (`forms:350`, `scripts:42,307`).

**Not checked.** Anything inside the pitch deck; `docs/MOBILE_APP_SPEC.md` outside the lines cited; the CHANGELOG's per-version claims beyond lines 15, 54, 64, 216; the word counts and timings of the voice-over (`demo2:72-73`, the `scripts` word counts); Colosseum and CLOCK IN portals; Solana Explorer rows; anything needing a database credential (queries listed above; the standard queries are in `docs/ROADMAP.md` Appendix A). One more trap noticed in passing: the "Page views per week" chart on `/data` stops at the week of 20 Jul, so do not show it.

### Safe wording (round numbers at or below the true one)

Re-read on 7 Oct and again on submission day; keep the date next to every figure.

- "More than 1,800 published pages." (1,818 on 4 Oct.) Never "2,000 published" or "2,091 investigated".
- "More than 4,400 decisions anchored on Solana." (4,421.) Say "mainnet" only after U2.
- "About 300 pages fact-checked." (304 reviewed, 296 published.) Say "fact-checked", never "verified".
- "More than 1,200 investigation requests." (1,271.) Do not call them all "from people".
- "97 percent of user requests were built, the median in about an hour, as of 26 September." Not "every request".
- "97 outside requests from 59 people since May, as of 26 September", or the figure from the U3 query.
- "AI crawlers are the largest class of caller on our API, about half of requests over 30 days. Agent tool use through MCP is early: 44 calls in 30 days." Not "agents read us more than people", not "customers".
- "The queue drains every four hours, up to ten requests a run." Add "last run succeeded" only after U6.
- "Holders of 69 SKR or more get 50 follows instead of 10, three times the daily scans, and a small priority bump. All applied on the server." Add "on the phone" only after the 0.2.3 device test.
- "Anchored on Solana" (not "mainnet", not "daily heartbeat") until U2 is resolved.
- "About 88 percent of cited sources are archived."
- Drop: the $154B and $17B figures (U1), "about 15 pages a day", "13,574 human views" (or date it 28 Sep), "every claim cited", "every source archived", "98% provisional" (say "most pages").
