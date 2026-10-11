# AVOID.NET Mobile — Technical Specification

**Status:** v1 — D1–D4 locked 2026-09-16 (Expo · `mobile/` in this repo · Expo cloud builds via GitHub Actions · Seeker available for testing) · **Owner:** product
**Pairs with:** [SPEC.md](SPEC.md) (system spec, canonical) · [WALLET_SCAN_SPEC.md](WALLET_SCAN_SPEC.md) · [AGENT_ACCESS_ROADMAP.md](AGENT_ACCESS_ROADMAP.md) · [HACKATHON_ROADMAP.md](HACKATHON_ROADMAP.md) (Colosseum Frontier, May 2026 — the previous hackathon) · [RETENTION_LOOPS_SPEC.md](RETENTION_LOOPS_SPEC.md) §9a (why people come back: the loops, screen by screen) · [MOBILE_HACKATHON_READINESS.md](MOBILE_HACKATHON_READINESS.md) (status as of 26 Sep)

> **Read this first.** This document does three things: (1) pins the hard
> constraints of the two hackathons we are submitting to, (2) specifies the
> mobile app and the platform changes it needs, and (3) proposes the
> "botfleet" — the set of automated workers that serve mobile users. Every
> claim about what already exists was verified against the repo on
> 2026-09-16; a feature is marked **[exists]**, **[built, not deployed]**,
> or **[new]**. Nothing in here is shipped yet unless marked **[exists]**.

Terms are defined the first time they appear; there is a glossary in §13.

---

## 0. One-paragraph summary

AVOID.NET today is a web encyclopedia of crypto risk: ~1,600 published
investigation pages with a 0–100 trust score, sourced evidence, and an
audit log anchored on Solana. The mobile app turns that archive into a
**pocket "check before you sign" tool**: paste or scan a wallet, see which
of your holdings have a risk page, follow entities and addresses, and get a
push notification the moment something you follow changes. It is built for
the Solana Seeker phone (Solana Mobile's Android device), signs the user in
with their own wallet, and lets them countersign evidence on-chain from
their own key. Behind it sits a small fleet of bots that watch the
database, the chain, and the web, and deliver alerts — the first time
AVOID.NET *pushes* intelligence to a person instead of waiting to be
searched. We submit the same build to two hackathons whose windows overlap
almost exactly.

---

## 1. Hackathon constraints (the non-negotiables)

Both submissions come from **one codebase and one demo**, framed two ways.
The constraints below were pulled from the organisers' own pages on
2026-09-16 (CLOCK IN's schedule and scoring weights come from the
organiser's live hackathon API, which the site itself reads).

### 1.1 CLOCK IN — Solana Mobile hackathon (run by Radiants)

| Item | Fact |
|---|---|
| Submissions open | 2026-09-08 16:00 UTC |
| **Submissions close** | **2026-10-09 06:59 UTC** (= Thu 8 Oct, 11:59 PM Pacific) |
| Judging window | 2026-10-10 → 2026-11-09 |
| Prize distribution | 2026-11-11 |
| Main track prizes (USDC) | #1 $30k + a Seeker per team member · #2 $25k · #3 $20k · #4 $15k · #5 $10k · #6–#10 $5k each |
| Bonus | $10k **SKR Integration Prize** (SKR = the native token of the Solana Mobile ecosystem) |
| **Judging weights** | **AI 20% · SKR Integration 20% · UX 15% · UI 15% · Innovation 15% · Ecosystem Impact 15%** |
| Must submit | A **functional Android APK** (the installable app file) with a direct download link · GitHub repo · demo video · pitch deck or brief presentation. No late entries. |
| Must be | "An Android app that produces a functional APK, integrates the Solana Mobile Stack and Mobile Wallet Adapter, is built for mobile from the ground up, and interacts meaningfully with the Solana network." |
| Pre-existing projects | Allowed **"if they show significant new mobile development during the hackathon. A pre-existing project with no new work is not eligible."** The form has a dedicated "New mobile development" field. |
| dApp Store | Not required by the deadline; **winners must publish to the Solana dApp Store within 30 days of the announcement** to claim the prize. |
| Payout | USDC to a Solana wallet; only participants in the eligible-countries list can receive it. |
| After submitting | Team is locked; no edits; all winners get a technical review (code verification + follow-up questions). |

What this means for us: the app must be **native Android** (not a mobile
website), must use **Mobile Wallet Adapter** (MWA — the standard way a
Solana Android app asks the phone's wallet to sign things), must do at
least one **real on-chain action**, and the scoring rewards **AI** and
**SKR** as heavily as it rewards design. AVOID.NET is an AI-drafted corpus,
so the AI criterion is ours to lose; SKR integration is entirely new work.

### 1.2 Crypto World's Fair — Colosseum (online, cross-ecosystem)

| Item | Fact |
|---|---|
| Window | **2026-09-14 → 2026-10-12** (submission deadline) |
| Prizes | $30k grand prize · $300k across the next 20 ($15k each) · $5k Public Good · $5k University · **Solana track $100k (10 × $10k)**; ~$840k total; **$2.5M in seed funding** reserved for hackathon teams; winners interviewed for the accelerator ($250k pre-seed) |
| Judging | One general pool regardless of chain. Judges look for: founder + market fit, unique insight and market opportunity, product quality and execution speed, addressable market, founder clarity, business viability, existing traction/revenue. Prizes go to teams "who intend to build full-time and develop products with potentially viable business models." Shortlisted teams get a 15-minute Zoom interview; winners announced roughly a month after the deadline. |
| Must submit | Product name and description · chains/tools integrated · team backgrounds and location · logo · GitHub link (private allowed with access granted to hackathon@colosseum.com) · **a 2–3 minute presentation video** · **a product demo video of no more than 3 minutes** · go-to-market, demand validation, distribution plan |
| Prior work | "Teams may begin development before the hackathon, but **products are judged only on the work completed between the competition's start and end dates**." Pre-existing code is allowed but **must be disclosed** on the form. Misrepresentation = disqualification and bans. |
| Team rules | One product per builder; one team per builder; solo allowed. |

What this means for us: Colosseum will judge **only what we build between
14 Sep and 12 Oct** — the mobile app, the botfleet, and the platform
changes they require — and we must **disclose** that avoid.net, the
pipeline, and the Solana anchoring predate the window (we already
submitted the platform to Colosseum Frontier in May 2026; say so). The
narrative must be a business, not a demo: distribution through the
Seeker dApp Store, a paid tier, and the agent API.

### 1.3 The combined calendar

```
Sep 16 (today)  ──────────────────────────────────────────────►  Oct 8    Oct 12
                W1: decide + scaffold   W2: alerts + chain   W3: polish   ▲        ▲
                                                             + videos   CLOCK IN  CWF
                                                                         closes   closes
```

- **22 days** to the CLOCK IN deadline, **26 days** to Crypto World's Fair.
- Per Colosseum's own guide: spend the first ~4 weeks engineering and the
  last week on testing and the videos. We do not have 5 weeks, so the
  engineering sprint is **three weeks**, with the videos cut in week 3
  and only re-recorded in the final two days.
- **Record before the deadline, not at it** (the rule we set ourselves in
  the Frontier roadmap and are keeping).

---

## 2. Product definition

### 2.1 Who it is for

1. **The Seeker owner** who trades tokens from their phone and wants a
   one-tap "is this thing a scam?" check before they sign. Primary user
   for CLOCK IN.
2. **The retail holder** on any Android phone who wants to know which of
   the tokens already in their wallet have a risk page, and to be told
   when one of them changes. Primary user for the Colosseum business
   story.
3. **The contributor** who already submits evidence on avoid.net and wants
   to do it from the phone with their wallet as identity.

### 2.2 Jobs the app must do (v1, hackathon scope)

| # | Job | Why it matters to judges |
|---|---|---|
| J1 | Search any entity or address and open its investigation page (score, verdict band, sections, timeline, sources, audit trail) | Core value; reuses the whole corpus |
| J2 | Scan the connected wallet's holdings against the corpus (the existing `/scan` feature, mobile-native) | The most "mobile-shaped" feature we have; uses MWA to get the address without typing |
| J3 | Follow an entity or an address (watchlist) and receive a **push notification** on a score change, a new accepted evidence item, a new fact-check verdict, or a newly published page | Turns an archive into intelligence; the whole botfleet exists to feed this |
| J4 | Request an investigation of something that has no page, and be notified when it publishes | Closes a loop the website promises but never delivers (the `notify_email` field is written and never read — verified) |
| J5 | Submit evidence from the phone and **countersign it on-chain from the user's own wallet** | The "interacts meaningfully with Solana" requirement, done in a way that strengthens our audit model rather than as a gimmick |
| J6 | Verify an anchored decision on-device: fetch the Solana transaction and compare the memo hash with the page | The "trust by construction" demo moment, now in the palm of the hand |
| J7 | Recognise a Seeker owner (Seeker Genesis Token) and an SKR holder, and give them something for it | SKR Integration criterion (20% of the CLOCK IN score) |

**Why people come back.** J1–J7 are what the app *does*. What makes
someone open it again tomorrow — "since your last visit", follow and "what
moved", request progress, the impact ledger, re-scan diffs — is specified in
[RETENTION_LOOPS_SPEC.md](RETENTION_LOOPS_SPEC.md) §9a, which maps each loop
to a screen here and states the cost and guardrail rules it obeys.

### 2.3 Explicitly out of scope for the hackathon build

- iOS (Mobile Wallet Adapter does not support iOS; CLOCK IN is Android only).
- EVM chains in the wallet scan (v1 of the scan is Solana-only).
- A paid tier in production (we specify the gate; we do not take money in
  the hackathon build).
- Real-time exploit alerts to the public from the Signals detectors
  (legal exposure; see §9.4 and SIGNALS_DETECTOR_FAMILY.md §5).
- Replacing the admin token with role-based access (still deferred, per SPEC).

---

## 3. What exists vs what must be built

The two subagent inventories behind this table are summarised here; the
recurring pattern in this repo is *"built, tested, not deployed, nothing
calls it"*, so the third column matters.

### 3.1 Platform pieces the app will reuse as-is **[exists]**

| Piece | Where | Notes for mobile |
|---|---|---|
| Public read API, CDN-cached 5 min, no auth | `web/src/app/api/v1/` — list, detail by slug, `lookup?address=`, Merkle `proof` | The app's primary data source. Zero cost per request when the CDN serves it. |
| Search with wallet/domain fallback | `GET /api/search?q=` | Same shape as the website's search box |
| Wallet risk scan | `POST /api/scan`, `GET /api/scan/:id`, migration 045 | Address travels in the request body, never the URL, so it never lands in logs. Keep that. |
| Evidence submission with dedupe + rate limit | `POST /api/submissions` | Six evidence kinds, SHA-256 content hash, per-IP limits |
| Investigation queue + live progress | `POST /api/requests`, `GET /api/requests/:id`, `investigation_run_events` with Supabase Realtime enabled | Realtime is the ready-made channel for a live "your investigation is running" screen |
| Trust score model and band colours | `web/src/lib/trust-bands.ts`, `components/ui/TrustGauge.tsx` | Port the two band scales exactly (4-band page verdict, 5-bucket corpus browsing); do not invent a third |
| Design language | `web/DESIGN.md` | Dossier-in-a-terminal: dashed 1px borders, Geist Mono for data, no gradients, no blue. Port the tokens, not the CSS. |
| Auth: Supabase magic-link email | `/login`, `auth/callback`, `lib/auth.ts` | Works in-app via deep link; becomes the *secondary* sign-in |
| On-chain audit log | `decision_events` anchored by `src/decision_anchor_worker.py` (Railway, recovered Sep 2026; 3,822 anchored) | Memo format `AVOID.NET\|v1\|h:<hash>\|d:dec:<event_id>\|t:<iso>` — the thing J6 verifies |
| Helius wallet-activity webhook | `POST /api/helius/webhook` → `wallet_activity` table; `src/helius_watcher.py` keeps ≤100 tracked addresses in sync | The raw feed for the Wallet Guardian bot |
| MCP server (3 tools: search, lookup, get) | `POST /api/v1/mcp` | The Telegram/Discord answer bot calls this rather than duplicating logic |
| Brand voice for automated posting | `voice/social/REFERENCE_POSTS.json` (50 exemplars, each with an `auto_publish_safe` flag) | The Social Changelog bot's few-shot corpus; nothing reads it today |

### 3.2 Pieces that are built but not deployed **[built, not deployed]**

| Piece | State | Needed by |
|---|---|---|
| Merkle root worker (`src/merkle_root_worker.py`) | Was absent from `railway.toml` and, on inspection, could never have anchored: it called a method that did not exist and swallowed the error. Fixed and added as Railway service 12 on 2026-09-16; `merkle_roots` fills once the service is created. | J6 on-device verify of the *aggregate* proof. |
| Wayback workers (svc 6 & 7) | Defined in Railway, stopped; ~28k source URLs and ~800 submissions pending | Nice-to-have for the "two witnesses" story; not blocking |
| Signals detectors (`src/signals/`) | Pure logic + 30 tests; no scheduler, no table, no route | Post-hackathon Signals bot (§9.4) |
| Telegram watcher (`src/watcher.py`) | Not deployable without a session string | Not needed for mobile |
| ed25519 API keys (`POST /api/v1/keys`) | Live, 0 registered keys; metering built, not enforced | The paid-tier story for Colosseum; not in the build |

### 3.3 Gaps the app forces us to close **[new]**

| Gap | Verified fact | What we build |
|---|---|---|
| **No token-based auth on any route** | Every session route reads the Supabase cookie via `getCurrentAccount()`; a native app has no cookie jar the server trusts | A `Bearer <Supabase JWT>` path (§5.3) |
| **No wallet identity** | `accounts` has no wallet column; SPEC §7 defers Sign-in-with-Solana | `accounts.wallet_pubkey` + Sign in with Solana (§5.3) |
| **No watchlist / follow** | No table, no route (the `wallet_subscriptions` table is Helius plumbing, not a user feature) | `watchlist` table + `/api/v1/watchlist` |
| **No push, no PWA, no service worker, no viewport export** | Confirmed across `web/src` and `web/public` | `push_devices` + `notifications_outbox` + a dispatch worker (§6) |
| **Nobody reads `notify_email`** | Written by `PATCH /api/requests/:id`, never consumed | The Fulfilment bot (§9.2) closes it for email *and* push |
| **No user-signed on-chain action** | The only signer is the server's decision key | Countersign memo from the user's wallet (§5.5) |
| **No Seeker / SKR awareness** | Zero references to SGT, SKR, or Seeker | SGT check + SKR holder gate (§5.6) |
| **No Solana client library in `web/`** | Only `bs58` + `tweetnacl` | The app gets `@solana/web3.js` (or `@solana/kit`); the web app stays as is |

---

## 4. Architecture

### 4.1 Overview

```
┌──────────────────── Seeker / Android ────────────────────┐
│  AVOID mobile (Expo / React Native, TypeScript)          │
│   ├─ Mobile Wallet Adapter ── Seed Vault / any wallet    │
│   ├─ Solana RPC (Helius) ── read anchors, SGT, SKR       │
│   └─ HTTPS ── avoid.net/api/v1/*  (+ Bearer JWT)     │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────── Vercel (Next.js 16, web/) ──────────────┐
│  /api/v1/* public reads (CDN 5 min) ─── unchanged        │
│  /api/v1/watchlist, /devices, /feed, /attestations [new] │
│  /api/me, /submissions, /scan, /requests + Bearer [ext.] │
└───────────────────────────┬──────────────────────────────┘
                            │ Supabase Postgres (+ Realtime)
┌────────────────── Railway (Python, src/) ────────────────┐
│  existing: decision_anchor, correction, heartbeat,       │
│            structured_cron, helius_watcher (+ merkle)    │
│  botfleet: watch_dispatch, fulfilment, wallet_guardian,  │
│            answer_bot (Telegram), social_changelog       │
└──────────────────────────────────────────────────────────┘
```

The app never talks to Supabase's database directly for reads; it goes
through `/api/v1` so the CDN absorbs the traffic (see the cost rule in
CLAUDE.md: every origin request is a billed invocation). It *does* talk to
Supabase Auth directly to sign in, and subscribes to Supabase Realtime for
one screen (live investigation progress), because Realtime is a websocket
that bypasses Vercel entirely.

### 4.2 Repository layout

The app lives in **`mobile/`** at the root of this repo, next to `web/` and
`src/`. See decision D2 for the alternative and why this is recommended.

```
mobile/
  app/                 Expo Router screens (file-based routing)
  src/api/             typed client for /api/v1 (zod schemas copied from web/src/lib/schemas)
  src/solana/          MWA session, memo builder, SGT + SKR checks, anchor verify
  src/design/          tokens ported from web/DESIGN.md
  src/notifications/   Expo push registration
  eas.json             build profiles (preview APK, production AAB)
```

Platform-side changes (migrations, routes, workers) stay in `web/` and
`src/` where they belong.

---

## 5. Key planning and architecture decisions

Each decision states the recommendation, the alternatives, and what it
costs to change later. **D1–D4 must be locked in week 1; the rest can
slide a few days.**

### D1 — App framework: Expo (React Native) via `create-solana-dapp` · **LOCKED**

**Recommendation:** Expo, TypeScript, using Solana Mobile's official Expo
template (`npx create-solana-dapp` with the Expo preset) which ships with
Mobile Wallet Adapter wired up.

- *Why:* Solana Mobile documents React Native / Expo as first-class with a
  `useMobileWallet` hook; the web app is already TypeScript so the zod
  schemas, trust-band logic and API types port with a copy; EAS Build
  produces the signed APK the rules require without a local Android
  toolchain; the team is one or two people.
- *Alternatives:* **Kotlin** (native; best SKR/Seed Vault depth; slowest for
  us). **Web app wrapped as an APK** (fastest; but the Publisher Policy
  restricts apps that "load untrusted web content", the CLOCK IN rules say
  "built for mobile from the ground up", and it would score poorly on UX/UI
  which is 30% of the grade). **Flutter** (supported, but no shared code).
- *Cost to change later:* high. Pick once.

### D2 — Where the code lives: `mobile/` in this monorepo, public mirror at submission · **LOCKED**

**Recommendation:** develop in `mobile/` here (shared types, one PR flow,
one CLAUDE.md), and at submission time publish a **public mirror
repository** of `mobile/` with history preserved (`git subtree split`),
plus grant judges read access to this repo as Colosseum allows.

- *Why:* CLOCK IN scores "technical depth based on GitHub commits" and
  Colosseum judges only in-window work; a clean repo whose entire history
  is inside the window makes both easy to see. README currently says the
  platform code is closed; the mobile app can be open without opening
  `src/`.
- *Alternative:* a separate `avoid-mobile` repo from day one. Cleaner
  disclosure, but the app needs new migrations and routes here anyway, so
  the work is split across two repos for three weeks.
- *Cost to change later:* low.

### D3 — Identity: Sign in with Solana first, magic link second, one Supabase session either way

**Recommendation:** the primary sign-in is the wallet. The app calls MWA
`authorize` with a **Sign-In-With-Solana (SIWS) payload** — a standard
message ("avoid.net wants you to sign in with your Solana account…") that
the wallet signs — and exchanges the signed message for a normal
**Supabase session** using Supabase Auth's Web3 (Solana) provider. Email
magic link stays as the fallback for users without a wallet, using the
existing callback route via an app deep link (`avoid://auth`).

- *Server change:* one helper, `getCurrentAccountFromRequest(req)`, that
  accepts `Authorization: Bearer <Supabase JWT>` and falls back to the
  cookie path. Wire it into `/api/me`, `/api/submissions`, `/api/scan`,
  `/api/requests`. This is the **only** change to existing routes.
- *Schema:* `accounts.wallet_pubkey TEXT UNIQUE`, `wallet_verified_at`.
  Linking a wallet to an existing email account is a `PATCH /api/me` with
  a fresh SIWS proof.
- *Week-1 spike (half a day):* confirm the pinned `@supabase/supabase-js`
  accepts a pre-signed SIWS message for the Solana provider. If it does
  not, the fallback is a tiny `POST /api/mobile/siws` route that verifies
  the signature with `tweetnacl` (already a dependency) and returns a
  Supabase session for that user via the admin client. Either way the app
  ends up holding an ordinary Supabase JWT, so nothing downstream cares.
- *Why not wallet-only:* the contributor reputation (`computeRep`) and
  `/me` already key on `accounts`; we keep one identity table.
- *Cost to change later:* medium.

### D4 — API shape: extend `/api/v1`, no separate backend-for-frontend

**Recommendation:** add the four routes the app needs under `/api/v1`
(`watchlist`, `devices`, `feed`, `attestations`), all Bearer-authenticated,
all `Cache-Control: private, no-store`, each declared `force-dynamic`.
(The rendering contract in `web/scripts/verify-rendering-contract.mjs`
classifies page routes only, so API routes are not registered there.)

- **Do not** widen the proxy matcher in `web/src/proxy.ts`. Bearer routes
  do not need cookie refresh, and the proxy doubles the invocation cost
  of anything it matches. `web/tests/proxy_matcher.test.ts` pins the list
  and will fail if someone tries.
- **Do not** poll from the app. Push (§6) replaces polling everywhere
  except the live investigation screen, which uses Supabase Realtime.
- *Alternative:* a separate Node/Python backend for mobile. Rejected: a
  second deploy target with three weeks left.
- *Cost to change later:* low.

### D5 — On-chain action: user-signed **countersign** memo, no new program

**Recommendation:** when a signed-in wallet user submits evidence (J5), the
app offers "Countersign on-chain": the wallet signs an SPL Memo
transaction from the *user's own key* containing
`AVOID.NET|v1|att:<submission content_hash>|s:<slug>|t:<iso>`. The server
records `{submission_id, signer_pubkey, signature, slot}` in a new
`evidence_attestations` table and the page's audit trail shows it next to
the server's own decision anchor.

- *Why this and not a smart contract:* SPEC §6's v1 target wants
  corroboration counted by **distinct submitters**; a wallet signature is
  the cheapest honest way to make "distinct" mean something. It reuses the
  memo format everyone already verifies, costs ~5,000 lamports, needs no
  program deployment, and demos in ten seconds. The `avoid-trust` and
  `avoid-meter` Anchor programs are written but have placeholder IDs and
  have never been deployed; deploying them under deadline is the single
  biggest schedule risk we could add, so we do not.
- *Cluster:* reads and countersigns default to **mainnet-beta** (real
  money, negligible cost; judges test on real Seekers). A settings toggle
  switches to devnet for testing. Note the server's own anchors: the
  anchor worker's default RPC is devnet; check `decision_events.anchor_cluster`
  in production before the demo and make the app's explorer links follow
  the row's cluster, as `about/keys` already does.
- *Cost to change later:* low; attestations are additive.

### D6 — Seeker and SKR: verify on the server, reward with access, not money

**Recommendation (SKR Integration, 20% of CLOCK IN):**
1. **Seeker Genesis Token (SGT) check.** After SIWS, the server queries the
   wallet's Token-2022 holdings for an SGT (Solana Mobile's docs say the
   client-side platform check can be spoofed and a backend RPC check is
   the reliable method). Store `accounts.seeker_verified_at`. The profile
   shows a `[SEEKER VERIFIED]` bracket label in the site's house style.
2. **SKR holder tier.** Read SKR balance server-side at sign-in and once a
   day. Holding ≥ **69 SKR** (set 2026-09-16 as a memorable placeholder;
   `SKR_HOLDER_MIN` env override; retune once real holders appear) unlocks the
   `signed` scan limit ×3, a watchlist of 50 instead of 10, and
   "priority" on investigation requests (bumps `investigation_requests.priority`
   the same way a second wallet scan already does).
3. **Optional, if time (week 3):** "Boost this investigation" — a real SKR
   transfer to an AVOID treasury address via MWA that bumps a queued
   request to the top. This is a payment for a service; the user must
   decide whether we want to accept SKR at all (see §11).
- *Why access not cash:* no token launch, no treasury custody problem, no
  securities question, and it is honest about what SKR is for (a
  membership signal in the Solana Mobile ecosystem).

### D7 — Push delivery: Expo Push Service + an outbox table · **LOCKED** (APK builds: EAS Build triggered from GitHub Actions on every push to `mobile/`; needs an `EXPO_TOKEN` repo secret)

**Recommendation:** Expo's push service (which fronts Firebase Cloud
Messaging on Android) for delivery, and a Postgres **outbox** —
`notifications_outbox` — as the single queue every bot writes to and one
dispatcher drains. See §6. Raw FCM is the fallback if Expo's service is
ever a problem; the outbox design does not change.

### D8 — Scoring caveat is shown, not hidden

Verified: `severity_base` is NULL on ~98% of investigation rows (the
deterministic scorer is bypassed by the 3×/day drain-queue runs), and 519
published pages carry an unresolved `review_revise` verdict. The website
already renders a "provisional" caveat on the gauge when `severity_base`
is null; **the app must too**, and the watchlist alert for a score change
must say *which* component moved (`severity_base` vs `score_modifier`).
Score Model v2 (SCORING_V2_RFC) is not on the hackathon path.

### D9 — Two submissions, one build, full disclosure

The CLOCK IN form asks "what is the new mobile development?" and Colosseum
asks for prior work. Both answers are the same text: *the platform
(avoid.net, pipeline, anchoring) predates both windows and was submitted
to Colosseum Frontier in May 2026; everything in `mobile/`, migrations
050+, the four `/api/v1` mobile routes, the Bearer auth path, and the
botfleet workers were built between 14 Sep and 12 Oct 2026.* Keep a
dated changelog in `mobile/CHANGELOG.md` from the first commit so this is
provable.

### D10 — What we cut if week 2 slips

In order: (1) Boost-with-SKR, (2) the Social Changelog bot, (3) the Blink,
(4) Discord (keep Telegram), (5) on-device Merkle proof verify (keep the
single-transaction memo verify, which needs nothing deployed).
**Never cut:** MWA sign-in, wallet scan, watchlist + push, countersign.

---

## 6. Notification substrate (shared by every bot)

Two tables, one worker. Every bot in §9 writes rows; nothing else sends.

```sql
-- 052_push_devices.sql
create table push_devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null default 'android',
  app_version text,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz
);

-- 053_notifications_outbox.sql (+ 055: recipient_email, account_id nullable
-- for channel='email' only, under a CHECK — see the note below the table)
create table notifications_outbox (
  id bigint generated always as identity primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  kind text not null check (kind in
    ('score_changed','evidence_accepted','review_verdict','page_published',
     'request_fulfilled','wallet_activity','scan_complete')),
  slug text,
  dedupe_key text not null unique,      -- e.g. 'score_changed:<slug>:<event_id>:<account_id>'
  title text not null,
  body text not null,
  data jsonb not null default '{}',     -- deep-link target
  channel text not null default 'push' check (channel in ('push','email')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text
);
create index on notifications_outbox (sent_at) where sent_at is null;
```

**Migration 055 — addressing someone with no account.** An anonymous requester
has no `accounts` row, so the Fulfilment bot could not write them a row at all
(it logged "email delivery deferred" and skipped). 055 adds
`recipient_email text` and relaxes `account_id` to nullable for the email
channel only:

```sql
check ((channel = 'push'  and account_id      is not null)
    or (channel = 'email' and recipient_email is not null))
```

A push has nowhere to go without an account (`push_devices` is keyed by it); an
email has nowhere to go without an address. The bot also requires
`investigation_requests.notify_email_confirmed_at` before queueing an email row —
an unconfirmed address is an inbox nobody has proved they can read.

**Dispatcher** — `src/notify_dispatch_worker.py`, Railway service #9, runs
under the existing `worker_loop.supervise()` so one failure cannot kill it
(the outage pattern this repo has already paid for). Every 15 s: select
unsent rows, batch by account, call Expo's push API (≤100 per call),
mark `sent_at`, back off on error, disable a device on `DeviceNotRegistered`.
Email channel: the dispatcher POSTs to Resend directly from Python
(`https://api.resend.com/emails`, `RESEND_API_KEY`, from `alerts@avoid.net`),
using the row's `title` as the subject and `body` as the text. A 4xx parks the
row with the reason in `last_error`; a 5xx or transport error is retried; no
API key settles it with `last_error='email disabled'`.

**Rules every bot obeys**
1. Write to the outbox only; never call a push provider directly.
2. `dedupe_key` is mandatory; a retried run must not double-notify.
3. Per-account rate cap: 20 pushes/day, then collapse into one digest row.
4. Never include a wallet address in a push body (it shows on lock screens).
5. A push may state a *score* or a *status*; it never states an allegation
   as fact (the casefile voice rule applies to 60-character bodies too).

---

## 7. Data model changes (migrations 050–054)

| Migration | Adds | Used by |
|---|---|---|
| `050_accounts_wallet.sql` | `accounts.wallet_pubkey text unique`, `wallet_verified_at`, `seeker_verified_at`, `skr_tier text default 'none'`, `skr_checked_at` | D3, D6 |
| `051_watchlist.sql` | `watchlist(id, account_id, target_kind 'investigation'\|'address', slug, address, chain, muted bool, created_at)`, unique on (account_id, target_kind, coalesce(slug,address)) | J3, bots §9.1–9.3 |
| `052_push_devices.sql` | above | §6 |
| `053_notifications_outbox.sql` | above | §6 |
| `054_evidence_attestations.sql` | `evidence_attestations(id, submission_id → community_submissions, signer_pubkey, memo_signature unique, slot bigint, cluster text, created_at)` | D5 |

All additive; nothing existing changes shape. RLS: service-role only on
the new tables (the app reads them through routes), same as `api_keys`.

---

## 8. API contract (new and extended)

All new routes: `Authorization: Bearer <Supabase JWT>` required (401
otherwise), `Cache-Control: private, no-store`, registered as dynamic in
the rendering contract, wrapped in `withApiLogging` like the rest of v1
(the caller hash is a daily-rotating salted hash; raw IPs are never stored).

| Route | Method | Body / params | Returns |
|---|---|---|---|
| `/api/v1/watchlist` | GET | — | `{items:[{target_kind, slug?, address?, entity_name?, trust_score?, band, muted}]}` (joined with `investigations` for the score) |
| `/api/v1/watchlist` | POST | `{target_kind, slug?, address?, chain?}` | 201 item; 409 if over the tier cap (10 free / 50 SKR) |
| `/api/v1/watchlist/:id` | DELETE / PATCH `{muted}` | — | 204 / item |
| `/api/v1/devices` | POST | `{expo_push_token, platform, app_version}` | 201; idempotent on token |
| `/api/v1/devices/:token` | DELETE | — | 204 (sign-out) |
| `/api/v1/feed` | GET `?since=` | — | Last 50 outbox rows for the account (the in-app "Alerts" tab is the outbox, so push and in-app never disagree) |
| `/api/v1/attestations` | POST | `{submission_id, signer_pubkey, memo_signature, cluster}` | Server fetches the transaction, checks the memo text matches the submission's `content_hash`, checks the signer is the account's server-verified `wallet_pubkey` (`wallet_verified_at` set); 201, 422 `{error, reason}` with reason ∈ tx_not_found · tx_failed · memo_missing · memo_mismatch · signer_mismatch, or 502 when the RPC is unreachable. GET `?submission_id=` is public and cached (part of the audit trail). |
| `/api/me` | GET / PATCH | + `{wallet_pubkey, siws_message, siws_signature}` on PATCH to link a wallet | existing shape + `wallet_pubkey`, `seeker_verified`, `skr_tier` |
| `/api/submissions`, `/api/scan`, `/api/requests` | existing | unchanged bodies | now accept Bearer as well as cookie |

Public reads the app uses unchanged: `/api/v1/investigations`,
`/api/v1/investigations/:slug`, `/api/v1/investigations/:slug/proof`,
`/api/v1/lookup`, `/api/search`, `/api/requests/:id`.

---

## 9. The botfleet

**Definition.** A *bot* here is an unattended worker that acts **for a
user** — it watches something and delivers a result to a person or an
agent — as opposed to the *editorial* agents (`avoid-scout`,
`avoid-investigator`, `avoid-reviewer`, `avoid-judge`) that produce the
corpus. Today AVOID.NET has an editorial fleet (run from one laptop's
launchd schedule) and infrastructure workers on Railway, but **zero
user-serving bots**: no Telegram bot, no Discord bot, no posting bot, no
Blink, no alerts to anyone but the operator's inbox. Verified.

Every bot below: runs on Railway under `worker_loop.supervise()`, writes to
`notifications_outbox` (never sends directly), never calls the Anthropic
API directly (CLAUDE.md rule — anything needing an LLM goes through a
Claude Code subagent on the scheduled drain path), and is **read-only
against the corpus** unless stated. Priority is the build order.

### 9.1 Watchlist Alert bot — `src/bots/watch_dispatch.py` · **P0**

- **Watches:** `decision_events` (new rows), `investigations.trust_score`
  (change), `review_findings` (new run), `investigations.status → published`.
- **For whom:** every account with a matching `watchlist` row.
- **Emits:** `score_changed` ("Drift Protocol: 34 → 21 [CRITICAL] — score
  modifier moved after 2 accepted evidence items"), `evidence_accepted`,
  `review_verdict`, `page_published`.
- **Mechanics:** cursor on `decision_events.id` stored in a small
  `bot_cursors` table; one pass per 30 s; `dedupe_key = kind:slug:event_id:account`.
- **Cost:** zero LLM; one Postgres query per pass.
- **Why first:** it is the entire reason to have the app on your phone,
  and it is the cheapest bot to build (a day).

### 9.2 Fulfilment bot — `src/bots/fulfilment.py` · **P0**

- **Watches:** `investigation_requests` transitioning to `done` with a
  published slug.
- **For whom:** the requester (`notify_email`, but only once
  `notify_email_confirmed_at` is set — PATCH /api/requests/[id] authorises the
  write with a session or the per-request edit token, then mails a confirmation
  link) and any account that scanned a wallet holding that token
  (`wallet_scan_holdings` joined to the request's `source='wallet_scan'`).
- **Emits:** `request_fulfilled` by push if a device exists, else by email.
- **Why:** it makes a promise the website already makes come true, and it
  is the live "AI in the loop" demo: request → Claude Code investigator →
  page → phone buzzes. Pair with a scheduled `drain-queue` run during
  the recording window.

### 9.3 Wallet Guardian bot — `src/bots/wallet_guardian.py` · **P1**

- **Watches:** `wallet_activity` (Helius webhook rows) for addresses the
  user follows *or* the user's own signed-in wallet.
- **Logic:** an inbound token whose mint has a published page in the
  CRITICAL or WARNING band → `wallet_activity` push ("You received a token
  with a CRITICAL page: <entity>"). Outbound transfers to an address on a
  published page → same.
- **Constraint:** Helius free tier tracks 100 addresses and
  `helius_watcher.py` already trims to it. **Decided 2026-09-16: stay on the
  free plan** and revisit on need and funding. Guardian therefore gets only
  the slots left after investigation addresses, allocated to SKR-holder
  wallets first, then by sign-in recency; the app tells a user when their
  wallet is not being watched rather than implying it is.
- **Never:** seeds a page about the holder (WALLET_SCAN_SPEC bright line).

### 9.4 Signals bot — `src/bots/signals_watch.py` · **P2, post-hackathon for public alerts**

- **Reuses:** the shipped peg-watch and oracle-divergence detectors in
  `src/signals/` (pure, tested, unscheduled).
- **Hackathon scope:** run on a schedule, write `Signal` rows to a new
  `signals` table, and notify **only the operator** (Slack) plus users who
  follow the affected entity *and* only at `critical` severity *and* only
  after a human approves the row (`signals.approved_at`). The detector
  family doc is explicit that naming a live exploit in public is
  counsel-gated; a push is public.
- **Why still list it:** it is the one bot with a genuinely *leading*
  signal, the Drift-hack replay test proves the logic, and it is the
  strongest Colosseum "where this goes" slide.

### 9.5 Answer bot (Telegram, then Discord) — `src/bots/answer_bot.py` · **P1**

- **What:** a Telegram **Bot API** bot (a real `@BotFather` bot, unlike
  the Telethon *user-account* connector we use for ingestion) that answers
  `/check <entity | address | url>` by calling our own MCP tools
  (`search_risk`, `lookup_entity`, `get_investigation`) over
  `POST /api/v1/mcp`, and replies with score, band, one-line summary, and
  the page link. `/follow <slug>` links a Telegram chat to a watchlist for
  users who prefer Telegram to push. Discord is the same code behind a
  second adapter.
- **Why:** distribution. Scam victims already live in Telegram groups; a
  read-only lookup bot is the cheapest wedge into them, and it is
  demonstrably "ecosystem impact" for both juries. Read-only means no new
  legal surface beyond what the website already publishes.
- **Rate limit:** reuse the MCP per-caller limit (30/min) by passing a
  per-chat caller id.

### 9.6 "Check before you sign" Blink — `web/src/app/api/actions/check/route.ts` · **P2** (link-only version built)

- **What:** a Solana **Action** (a Blink is a link that wallets and
  social clients render as an interactive card) whose GET returns the
  trust score and band for `?address=` or `?slug=`, and whose POST returns
  the countersign memo transaction from §D5 for the caller to sign. Needs
  `actions.json` at the web root and CORS headers per the spec.
- **Why:** it lets any wallet or feed surface AVOID's verdict inline, and
  it is a second, wallet-agnostic route to the same on-chain action the
  app performs. Deferred in the Frontier roadmap; cheap now that the memo
  builder exists.

**Status: built (link-only version).** `GET /api/actions/check?slug=` or
`?address=` (Solana or EVM) returns a Solana Action card: the entity name,
its trust score and band label (`LOW RISK` for the top band, from
`lib/trust-bands.ts`), whether the page is fact-checked, and one
`external-link` action, "Open the full case file", that opens
`https://avoid.net/<slug>`. An unknown or hidden (draft, held,
quarantine) page gets a "No AVOID.NET page for this yet" card with a
"Request a page" link; hidden pages are indistinguishable from unknown ones.
`/actions.json` maps a shared `avoid.net/<slug>` URL to
`/api/actions/check/<slug>` (path form, because the spec only substitutes `*`
in path segments; the `?slug=` form still works). Address
lookup shares `lib/lookup.ts` with `/api/v1/lookup`. The route is CDN cached
(`s-maxage=300`), reads no cookies, is outside the proxy matcher, and sends
the Actions CORS headers plus `X-Action-Version` and `X-Blockchain-Ids`
(Solana mainnet).

- **Included:** the card, the link action (its POST returns
  `{type: "external-link", externalLink}` and never a transaction), OPTIONS
  preflight, `actions.json`.
- **Not included:** the countersign memo transaction. It needs a submission
  and wallet auth, so the POST that builds a transaction is still to do.
- **Try it:** paste
  `https://dial.to/?action=solana-action:https://avoid.net/api/actions/check/ftx`
  into a browser. This is the dial.to format as of the last check, but the
  Blink spec moves; confirm against the current Solana Actions docs if it
  stops working.

### 9.7 Social Changelog bot — `src/bots/social_changelog.py` · **P3**

- **What:** posts to X when a page publishes or a verdict lands, drafted
  by few-shotting `voice/social/REFERENCE_POSTS.json` and **only** from
  exemplars where `auto_publish_safe` is `true`, through a Claude Code
  subagent on the drain schedule (not the API). Every post ends with the
  verifiable `python -m src.verify_decision <event_id>` line the
  exemplars already carry.
- **Why last:** it is the most visible and the least reversible; the voice
  guide exists precisely so this can be automated, but a human approves
  the first hundred posts.

### 9.8 Existing fleet that feeds the bots (no change, but name it in the pitch)

`avoid-scout` → `investigation_requests` → `avoid-investigator` (drain-queue)
→ `avoid-reviewer` → `avoid-judge` → `decision_events` → `decision_anchor_worker`
→ Solana. Plus `correction_worker`, `structured_cron_worker` (OFAC, SEC,
CFTC, DeFiLlama, W3IGG, CryptoScamDB), `helius_watcher`, `heartbeat_worker`.
This is the supply side; §9.1–9.7 is the demand side that did not exist.

### 9.9 Fleet substrate to add

- `bot_cursors(bot text primary key, cursor text, updated_at)` — resumable.
- `bot_runs(id, bot, started_at, finished_at, rows_in, rows_out, error)` —
  the `/data/ops` page gets a "Bots" panel reading this; the same honesty
  scoreboard we use for crawlers.
- Railway: one service per bot, same Dockerfile, `startCommand` override,
  `restartPolicy ON_FAILURE`, secrets only via the shared variable group.

---

## 10. Build plan and timeline

| Week | Dates | Deliverables | Exit test |
|---|---|---|---|
| **W1** | Sep 16–22 | Lock D1–D4. `mobile/` scaffold from `create-solana-dapp` (Expo). MWA connect + SIWS spike. Migrations 050–054. Bearer helper on the four routes. Screens: Search, Entity page (score, band, sections, timeline, sources, audit list), Scan (address from MWA). Design tokens ported. | APK installs on an emulator and a Seeker; sign in with a wallet; open a page from `/api/v1`; run a scan. |
| **W2** | Sep 23–29 | Watchlist routes + screen. Push registration + outbox + dispatcher on Railway. Watchlist Alert bot + Fulfilment bot live. Countersign memo (D5) + attestations route. SGT check + SKR tier (D6). Deploy the Merkle root worker. | Follow an entity → a real decision event → phone buzzes within 60 s. Countersign a submission and see it in the audit trail. Seeker-verified badge shows on a real Seeker. |
| **W3** | Sep 30–Oct 6 | Telegram answer bot. Wallet Guardian (capped). On-device anchor verify screen. UI polish pass against DESIGN.md (UX+UI = 30% of CLOCK IN). Blink if time. Demo script locked **Oct 1**; demo video first cut **Oct 3**; pitch deck first cut **Oct 4**. `mobile/CHANGELOG.md` and disclosure text final. | A stranger can install the APK from a link and complete J1–J6 without help. Both videos under 3 minutes. |
| **Freeze** | Oct 7–8 | Signed release APK uploaded to a direct-download link. Public mirror repo published. Final video cut. **Submit CLOCK IN by Oct 8, 6 PM Pacific** (deadline is 11:59 PM Pacific; do not use the margin). | Submission confirmed on the Radiants portal. |
| **CWF** | Oct 9–11 | Colosseum form: 2–3 min presentation video (business framing), ≤3 min demo (can reuse the CLOCK IN demo), GTM + traction section, prior-work disclosure. **Submit Oct 11.** | Submission confirmed on colosseum.com. |
| Post | Oct 13 → Nov 8 | dApp Store publisher onboarding (needed within 30 days if we win), Signals bot behind human approval, Social Changelog. Judging runs Oct 10 → Nov 9. | — |

Daily questions (carry into each session's task list): Is the APK still
installing from a clean device? Has the demo script been touched today? Is
any P2/P3 bot eating P0 time? Are the Railway bots green on `/data/ops`?

---

## 11. Decisions the user must make (blocking)

1. **Team and eligibility.** Who is on the team, which country is each
   member in (USDC payout eligibility), and which Solana wallet receives
   prizes. Both hackathons lock the team at submission.
2. **SKR: access-gate only, or also accept SKR payments (Boost)?** D6.
   Accepting SKR means holding a treasury and a refund policy. *Threshold
   set to 69 SKR on 2026-09-16; Boost still open until the app runs on a
   device.*
3. ~~**Helius plan.**~~ *Decided 2026-09-16: free plan; Guardian capped
   (§9.3).*
4. ~~**Mainnet for user countersigns?**~~ *Decided 2026-09-16: mainnet.
   The app already defaults to mainnet-beta (`mobile/src/solana/cluster.ts`).*
5. **Public mirror of `mobile/`** at submission (D2), and who is granted
   read access to this repo for Colosseum.
6. **Colosseum track:** Solana track (recommended; $100k pool, 10 winners)
   — and whether to also flag the Public Good prize, given the anchored
   audit log and the free API.
7. **Telegram bot name and Discord** — the answer bot needs a BotFather
   token and a name; Discord is a cut candidate.

---

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| SIWS ↔ Supabase session exchange does not work with the pinned client | Medium | Half-day spike in W1; fallback route specified in D3 |
| No physical Seeker to test on | Low (owner has one) | Solana Mobile's emulator + `npx solana-mobile@latest doctor`; borrow a Seeker for W3; the judges' technical review will run the APK on one |
| Push delivery flaky during the demo recording | Medium | Record the buzz with the phone on screen and the outbox row visible on `/data/ops`; keep a second phone |
| Scoring caveat undermines the pitch | Medium | Show it. "Provisional" on the gauge is the honesty signal both juries reward; Score v2 is the roadmap slide |
| Legal exposure from pushes | Low–medium | §6 rule 5; Signals stays human-gated; pushes carry scores and statuses, never allegations |
| Demo video re-records eat the last two days | High (it did in May) | Script locked Oct 1, first cut Oct 3, final Oct 7 |
| Railway workers die silently again | Medium | Every bot under `supervise()`; `bot_runs` panel; heartbeat already on chain |
| Scope creep from the bot list | High | §9 priority order and D10 cut list are the contract; P2/P3 do not start until W2 exits green |

---

## 13. Glossary

- **APK** — the installable file for an Android app. CLOCK IN requires a
  direct download link to one.
- **Seeker** — Solana Mobile's Android phone. Has a hardware key store
  (**Seed Vault**) and ships with a **Seeker Genesis Token (SGT)**, an NFT
  minted once per device that proves ownership.
- **SKR** — the native token of the Solana Mobile ecosystem; a judging
  criterion in CLOCK IN.
- **Mobile Wallet Adapter (MWA)** — the standard protocol an Android app
  uses to ask a wallet app (or Seed Vault) to sign a message or
  transaction. Not available on iOS.
- **Sign-In-With-Solana (SIWS)** — signing a standard "sign me in" message
  with a wallet to prove you control it; MWA supports it directly.
- **Expo / React Native / EAS** — a way to build native Android apps in
  TypeScript; EAS is Expo's cloud build service that produces the APK.
- **JWT / Bearer token** — a signed string the app sends with each request
  to prove who it is, instead of a browser cookie.
- **Supabase** — our database (Postgres), auth, and Realtime (websocket
  updates) provider.
- **Outbox** — a database table used as a queue: writers add rows, one
  worker sends them. Makes retries and de-duplication safe.
- **Push notification** — a message delivered to the phone's lock screen
  by the OS; needs a per-device **push token**.
- **Webhook** — a URL a third party (here Helius) calls when something
  happens on-chain, instead of us polling.
- **SPL Memo** — a Solana instruction that writes a short text string into
  a transaction; the whole audit log is memos.
- **Merkle proof** — a compact way to prove one record is inside a batch
  whose single fingerprint was anchored on-chain.
- **MCP** — Model Context Protocol; a standard way for AI agents to call
  tools. Our server exposes three tools already.
- **Blink / Solana Action** — a URL that wallets and feeds render as a
  button that can build a transaction for you to sign.
- **BotFather** — Telegram's tool for creating a real bot account (unlike
  the user-account "Telethon" client we use to read channels).
- **Rendering contract** — our post-build check that every web route is
  cached the way we said it would be; new routes must be registered.

---

## 14. Sources

Hackathon facts: Radiants' CLOCK IN site and its public hackathon API
(schedule, prizes, scoring weights, rules text), Solana Mobile
documentation (MWA, dApp Store publishing, Seeker detection, publisher
policy), Colosseum's Crypto World's Fair page and hackathon rules page,
and press coverage (CryptoBriefing, Coinfomania) retrieved 2026-09-16.
Repo facts: two full-repo audits performed the same day; see §3 for
file-level references. Re-verify the CLOCK IN deadline on the Radiants
portal the week of submission; organisers have extended deadlines before.
