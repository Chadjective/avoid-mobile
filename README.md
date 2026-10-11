# AVOID.NET mobile

**Check a crypto project before you sign. On the phone you sign with.**

AVOID.NET mobile is an Android app for the [AVOID.NET](https://avoid.net)
crypto risk record. You can search any exchange, token, protocol or person,
read a sourced case file with a trust score, scan your own wallet against the
record, follow pages and get pushed when they change, and check on the phone
itself that a decision really was written to Solana.

Built for the Solana Seeker and any Android phone with a Solana wallet,
during **CLOCK IN** (Solana Mobile) and **Crypto World's Fair** (Colosseum),
from 16 Sep 2026.

> **Read this first: honest status.** The submitted build is **version 0.2.7**
> (8 Oct 2026). Every screen below has code and a live server route behind it.
> The app has been run on a Solana Seeker in device-test sessions from
> 18 Sep to 8 Oct. On the Seeker the owner has seen these working: wallet
> sign-in, search and case files, the wallet scan, follow, investigation
> requests, push alerts, and tapping Verify on an anchored decision.
> Countersigning evidence and the Seeker/SKR badges are **implemented** but
> not claimed as device-proven. See
> [Status](#status-what-has-and-has-not-been-tested) for the detail.
> Numbers that change daily are dated.

Contents: [The problem](#the-problem) · [What the app does](#what-the-app-does) ·
[How it works](#how-it-works) · [Solana Mobile](#solana-mobile-what-is-built) ·
[Tech stack](#tech-stack) · [Install the APK](#install-the-apk) ·
[Status](#status-what-has-and-has-not-been-tested) ·
[What was built when](#what-was-built-when) · [Links](#links) ·
[Developer notes](#developer-notes)

---

## The problem

Before you buy a token or sign a transaction on your phone you have a few
seconds to decide whether the thing is a scam. The tools that exist today
answer a different question:

- Chainalysis, TRM and Elliptic sell private wallet forensics to compliance
  teams. The output is a paid report you cannot cite.
- GoPlus, RugCheck and Token Sniffer scan one contract at the moment you ask.
  They tell you about that contract, not about the team, the history or the
  earlier incidents.

Nothing gives an ordinary holder a public, cited history of what went wrong,
in their pocket, that they do not have to take on trust.
(Comparison source: [`docs/POSITIONING.md`](docs/POSITIONING.md).)

## What the app does

Seven jobs. The spec calls them J1 to J7
([`docs/MOBILE_APP_SPEC.md`](docs/MOBILE_APP_SPEC.md) section 2.2).

| Job | What you can do | Screen |
|---|---|---|
| **J1 Look something up** | Search by name, address or domain. Open a case file: trust score and band, written sections with sources, a timeline, and the audit trail of every decision made about the page. With nothing typed, the first screen shows what the record has been doing lately. | Search tab, `app/entity/[slug].tsx` |
| **J2 Scan your wallet** | Connect your wallet (the address comes from the wallet, no typing). See which of your holdings have a risk page, and an overall score weighted by how much you hold in each. | Scan tab |
| **J3 Follow and get pushed** | Follow a page. When its score, evidence or fact-check status changes, the phone is notified. The Watch tab lists what you follow. The Alerts tab lists what was sent. | Watch and Alerts tabs |
| **J4 Ask for a missing page** | Search something with no page and request an investigation. The request screen shows queued, investigating, published. The phone is notified when it publishes. | `app/request/[id].tsx` |
| **J5 Submit evidence and vouch for it on-chain** | Submit a source (five kinds; file upload is not offered). Then optionally countersign it: your own wallet signs a small Solana transaction that vouches for that exact evidence. It appears in the page's audit trail. Cost is about 5,000 lamports (0.000005 SOL). | `app/entity/[slug]/submit.tsx` |
| **J6 Verify a decision on the phone** | On any audit-trail row that was anchored on Solana, tap Verify. The phone fetches the transaction from Solana itself and checks that the hash in it matches the page. | Audit trail on the case file |
| **J7 Seeker and SKR** | A Seeker Genesis Token holder gets a `[SEEKER VERIFIED]` label. Holding at least 69 SKR raises your limits (see below). | Profile tab |

Where the numbers come from: the 5,000 lamport figure is from spec D5. The tier
limits are in
[`web/src/app/api/v1/watchlist/_shared.ts`](https://github.com/Chadjective/avoid-intel/blob/main/web/src/app/api/v1/watchlist/_shared.ts)
(10 follows, 50 for SKR holders) and
[`web/src/lib/wallet-scan.ts`](https://github.com/Chadjective/avoid-intel/blob/main/web/src/lib/wallet-scan.ts) (2 scans a day
anonymous, 10 signed in, times 3 for SKR holders).

Two design choices worth knowing about:

- **The caveat is shown, not hidden.** Many trust scores are written by a
  language model rather than a fixed formula. When a page's score comes from
  that path, the gauge says `[PROVISIONAL]`. As of 2026-09-16 about 98% of
  pages were in that state (spec D8). Scoring v2 went live on 10 Oct 2026
  and removes the label from each page it re-scores.
- **No dark patterns.** No streaks, no fake urgency. If nothing changed since
  you last looked, the app says nothing changed
  ([`docs/RETENTION_LOOPS_SPEC.md`](docs/RETENTION_LOOPS_SPEC.md) section 9a).

### Retention features (shipped in 0.2.2)

[PR #212](https://github.com/Chadjective/avoid-intel/pull/212) and
[PR #187](https://github.com/Chadjective/avoid-intel/pull/187) are merged and
are in `main` (mobile 0.2.2 and later). These are the "why come back tomorrow"
features. Follow works on a device; the others are built but not each
confirmed one by one on a phone.

- **Since your last visit.** A card on the Search tab: how many decisions and
  score moves happened since you were last here, and which pages you read have
  moved. A bar on the case file: "score 61 to 49, 1 accepted evidence", with
  the new audit rows marked NEW. Last-seen markers stay on the phone; the
  server never learns what you read.
- **Follow toggle and "what moved"** on the Watch tab.
- **Request progress** with the real queue schedule.
- **"Your impact"** on Profile: progress toward Trusted contributor, pages you
  helped publish.
- **Re-scan diff** ("since your last scan") and **Watch this wallet**.
- **Two bug fixes** so that Follow and push registration no longer show an
  error.

## How it works

The record is built by AI agents, checked by other AI agents, and the
decisions are written to a public ledger.

```
  scout / requests  ->  investigator  ->  reviewer  ->  judge
  (find or ask)         (researches,      (fact-checks    (approve, deny or
                         writes the page)  every claim     revise, with a
                                           against the     score change)
                                           evidence)
                                                |
                                                v
                     each decision -> Solana mainnet, SPL Memo -> the phone can
                                      fetch the transaction and re-check the hash
```

1. **Agents write.** An investigator agent researches an entity and drafts a
   page with a trust score, sections, a timeline and sources.
2. **Other agents fact-check.** A reviewer agent checks the published page
   against its accepted evidence. A judge agent rules on the reviewer's
   findings: approve, deny or revise, with a score change.
3. **Decisions are anchored on Solana.** Each decision is written to Solana as
   an SPL Memo carrying a hash of the decision, in the form
   `AVOID.NET|v1|h:<hash>|d:dec:<event_id>|t:<iso>`. Anchors are being written
   to mainnet-beta. 5,279 decisions were anchored as of 2026-10-11 (from
   `https://avoid.net/api/v1/stats`; live figures at https://avoid.net/data).
4. **The phone checks for itself.** Verify (J6) fetches the transaction from a
   Solana RPC and compares the memo's hash with the one the page shows. No
   AVOID.NET server is in the loop for that check.
5. **The community can vouch.** When you countersign evidence (J5), your own
   wallet writes a memo `AVOID.NET|v1|att:<content_hash>|s:<slug>|t:<iso>`.
   The server accepts it only if the memo starts with the exact expected text.

The agents run as Claude Code subagents, never through direct API calls (see
[`CLAUDE.md`](https://github.com/Chadjective/avoid-intel/blob/main/CLAUDE.md)). Requests made in the app enter the same queue. The
queue is drained by a cloud routine every four hours (00, 04, 08, 12, 16 and
20 UTC), up to 10 requests per run.

**Limits of the on-device check, stated plainly.** Verify confirms that a
Solana transaction carries this hash. It does **not** yet check which key signed
the memo, and it does not verify the Merkle proof, because the Merkle root
worker has never been deployed (`latest_root` is null in every audit response).
The code says the same in
[`src/solana/verify-anchor.ts`](src/solana/verify-anchor.ts).

## Solana Mobile: what is built

Only what exists in code. "Built" does not mean device-tested (see Status).

- **Mobile Wallet Adapter (MWA).** `@solana-mobile/mobile-wallet-adapter-protocol`
  and its web3.js wrapper. Used to connect, to sign in, to sign the SIWS
  message, and to sign the countersign transaction.
  See `src/solana/use-mobile-wallet.ts`.
- **Sign in with Solana (SIWS).** The wallet signs a standard sign-in message
  and the app exchanges it for an ordinary Supabase session
  (`signInWithWeb3`). Two paths: one wallet prompt using a sign-in payload, and
  an automatic fallback of two prompts (authorize, then sign the message).
  The server re-verifies the signature in `web/src/lib/siws.ts`. Email magic
  link is the second sign-in method. **Works on a device:** wallet sign-in
  first succeeded on a Seeker on 6 Oct (0.2.3), after two earlier failures
  that were our bugs (see [`CHANGELOG.md`](CHANGELOG.md)).
- **Seeker Genesis Token check.** Done on the server after sign-in, not on the
  phone, because Solana Mobile's own docs say the client-side check can be
  spoofed (spec D6). Result: `[SEEKER VERIFIED]` on Profile. Code:
  `web/src/lib/seeker.ts`.
- **SKR tiers.** The server reads the wallet's SKR balance at sign-in and once
  a day. At least **69 SKR** (a placeholder the founder set on 2026-09-16,
  changeable by an environment variable) makes you a holder. Holders get 50
  follows instead of 10, three times the daily scans, and priority in the
  investigation queue (15 requests a day instead of 10). The gate is access,
  not payment: the app does not take SKR.
- **User-signed on-chain action.** The countersign in J5, on mainnet-beta by
  default (`src/solana/cluster.ts`), no custom program.
- **Push.** Expo push notifications (which use Firebase on Android since
  0.2.4) fed from a database outbox. The sending services run on Railway, and
  alerts have been received on the Seeker; tapping one opens the page it is
  about.

Not built in the app and not claimed: paying SKR for priority ("Boost"), a
Blink inside the app (a web Blink route, "check before you sign", exists on
`main`, #270), a Solana dApp Store listing, iOS (Mobile Wallet Adapter has no
iOS implementation).
See [spec section 2.3](docs/MOBILE_APP_SPEC.md).

## Tech stack

| Layer | What |
|---|---|
| App | Expo 57, React Native 0.86, React 19, TypeScript, expo-router. Android only. (`mobile/package.json`) |
| Solana | `@solana-mobile/mobile-wallet-adapter-protocol` and `-web3js`, `@solana/web3.js` 1.x |
| Identity | Supabase Auth (Solana Web3 sign-in plus email link), tokens in `expo-secure-store` |
| Data | The public AVOID.NET JSON API (`/api/v1`, CDN-cached five minutes) and Supabase Realtime for request progress |
| Push | `expo-notifications`, Expo push service |
| Build | EAS Build, started by hand (`.github/workflows/mobile-build.yml`); JavaScript-only fixes ship over the air with EAS Update (`mobile-update.yml`) |
| Server (existing platform) | Next.js, Supabase Postgres, Python workers on Railway, Solana SPL Memo v2 |
| Design | Dashed 1px borders, Geist Mono for data, no gradients. Ported from [`web/DESIGN.md`](docs/DESIGN.md) |

## Install the APK

**APK download:** the latest release on
[github.com/Chadjective/avoid-mobile/releases](https://github.com/Chadjective/avoid-mobile/releases/latest),
file `avoid-net-0.2.7.apk`. It is the `release-apk` build of version 0.2.7
(production settings, APK output), built on 8 Oct 2026. The release notes give
its SHA-256 fingerprint, so you can check the file is the one submitted.

1. On the phone, open the link above in a browser and download the file.
2. When Android asks, allow your browser to install apps from unknown sources.
3. Open the downloaded file and tap Install.
4. Have a Solana wallet app on the phone (on a Seeker, the built-in Seed Vault
   wallet; otherwise for example Phantom). Without one, Connect wallet and
   Sign in with Solana cannot work, because MWA hands the request to a wallet
   app.
5. Open AVOID.NET. Searching and scanning need no account. Following, alerts,
   requests and countersigning need you to sign in.

The `preview` profile produces a test APK. The `production` profile produces an
AAB (the Play Store format). **The submitted file is the `release-apk` build**:
production settings, APK output. It is run by hand from the GitHub Actions
"mobile" workflow; see
[How to build the submission APK](#how-to-build-the-submission-apk).

To build it yourself, see [Developer notes](#developer-notes).

## Status: what has and has not been tested

As of 2026-10-11. Sources: [`CHANGELOG.md`](CHANGELOG.md) and the owner's
device-test sessions on a Solana Seeker (18 Sep to 8 Oct). **Works on a
device** means the owner ran it on the Seeker and saw it work. **Implemented**
means the code exists, compiles and passes its logic tests, but it is not
claimed as device-proven.

The submitted build is **0.2.7** (8 Oct). No over-the-air update has been
published to it, so what you install is exactly 0.2.7. Two small JavaScript
changes merged after it (unnamed tokens in a scan can be requested; the
Profile shows 15 requests a day for SKR holders, which the server already
applies) are not in the APK.

| Area | State |
|---|---|
| Install and open on a Seeker | **Works on a device.** |
| Connect wallet and Sign in with Solana | **Works on a device.** First succeeded on 6 Oct (0.2.3); it failed on 18 Sep and 3 Oct because of our own bugs, both fixed. Seeker wallet and Phantom. |
| Email magic link | Implemented (PKCE flow, 0.2.3). |
| Search, case file, audit trail | **Works on a device.** |
| Wallet scan | **Works on a device.** Falls back to a backup data route when the paid providers are down (0.2.6). |
| Follow, Watch | **Works on a device.** |
| Push alerts | **Works on a device.** Firebase push since 0.2.4; tapping an alert opens its page (0.2.6). The senders (notify-dispatch-worker, watch-dispatch-bot, fulfilment-bot) run on Railway. Alerts fire only when a followed page actually changes. |
| Request an investigation | **Works on a device.** The queue drains every four hours. |
| Verify an anchor on the phone | **Works on a device.** Known limits are stated in [How it works](#how-it-works). |
| Submit evidence and countersign | **Implemented.** The countersign memo is ported from the server's rules; not claimed as checked against a real transaction from the phone. |
| Seeker badge and SKR tier | **Implemented** on the server and shown on Profile once a wallet is linked; not claimed as device-proven. |
| Live investigation progress timeline | Screen built, but nothing writes progress events for user requests today, so it is usually empty. The status poll is what actually answers. |
| Automated checks | `tsc --noEmit` and logic tests (`npm run test:logic`, 129 tests, all passing on 11 Oct). There are no UI or on-device automated tests. |

Not built and not claimed: paying SKR for priority ("Boost"), a Solana dApp
Store listing, iOS.

## What was built when

Short version. Full detail in
[`docs/HACKATHON_SUBMISSION_2026-10.md`](https://github.com/Chadjective/avoid-intel/blob/main/docs/HACKATHON_SUBMISSION_2026-10.md).

- **Before the windows.** The avoid.net website, the research, review and judge
  agents, the database, the public API and MCP server, and the Solana anchoring
  of decisions. The first commit in the repository is 2026-04-19. The platform
  was submitted to Colosseum Frontier on 11 May 2026 (10:50 PM PDT) as
  AVOID.NET, by the founder alone, as a team of one.
- **During the windows.** Everything in `mobile/` (started 16 Sep, first commit
  on main 17 Sep), migrations 050
  to 055 (wallet identity, watchlist, push devices, notification outbox,
  evidence attestations, request notification auth) plus 057 (agent requests)
  and 066 (Request update), the Bearer-token sign-in
  path, the new `/api/v1` routes, the Seeker and SKR checks, and the bots. Every
  app change is dated in [`CHANGELOG.md`](CHANGELOG.md).

## Links

- Live platform: https://avoid.net (www redirects to it)
- Live numbers (corpus size, anchors, API use): https://avoid.net/data
- Spec: [`docs/MOBILE_APP_SPEC.md`](docs/MOBILE_APP_SPEC.md)
- Status audit: [`docs/MOBILE_HACKATHON_READINESS.md`](docs/MOBILE_HACKATHON_READINESS.md)
- Demo script: [`docs/MOBILE_DEMO_SCRIPT.md`](docs/MOBILE_DEMO_SCRIPT.md)
- Why people come back: [`docs/RETENTION_LOOPS_SPEC.md`](docs/RETENTION_LOOPS_SPEC.md)
- How it differs from Chainalysis and contract scanners: [`docs/POSITIONING.md`](docs/POSITIONING.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- Submission disclosure and form drafts: [`docs/HACKATHON_SUBMISSION_2026-10.md`](https://github.com/Chadjective/avoid-intel/blob/main/docs/HACKATHON_SUBMISSION_2026-10.md)
- Public repository (this app, Apache-2.0): https://github.com/Chadjective/avoid-mobile
- APK download: https://github.com/Chadjective/avoid-mobile/releases/latest

---

## Developer notes

Everything below is for people building or reviewing the code. It was written as the app was built and is blunt about what is unfinished.

### Run it

```bash
cd mobile
npm install
cp .env.example .env          # fill in the Supabase values
npx expo run:android          # builds a dev client and installs it
```

`npx expo start` alone is not enough: this app has native modules (MWA,
secure store, notifications) that Expo Go does not contain. Use a development
build (`expo run:android`, or a `development`-profile EAS build) on a device or
emulator with a wallet app installed. Without a wallet app on the device, the
"Connect wallet" and "Sign in with Solana" paths will not resolve — MWA
dispatches an Android intent to a wallet.

### Environment

All of these are `EXPO_PUBLIC_*`, which means Expo inlines them into the
JavaScript bundle at build time. Nothing secret belongs here. See
[`.env.example`](.env.example).

| Variable | Default | What it does |
|---|---|---|
| `EXPO_PUBLIC_API_BASE` | `https://avoid.net` | Base URL for every API call |
| `EXPO_PUBLIC_SUPABASE_URL` | — | Supabase project; sign-in is disabled without it |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | — | The same public anon key the website ships |
| `EXPO_PUBLIC_SOLANA_CLUSTER` | `mainnet-beta` | Cluster for wallet authorization and countersigns (D5) |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | public endpoint | A private Helius RPC for the app (a separate key from the website's; it ships inside the APK). If it fails, the same call is retried once on the public endpoint |

Browsing and scanning work with no Supabase keys at all; signing in,
following and alerts do not. When the two Supabase values are missing the
Profile tab says so in plain words, and it says nothing at all when they are
present.

## Build an APK

```bash
npx eas login
npx eas build --platform android --profile preview
```

### Where the build gets its keys

`.env` is a LOCAL file. It is not uploaded, so an EAS build never sees it —
that is why the first Seeker build (2026-09-18) shipped with no Supabase keys
and sign-in could not run at all. `eas.json` and the EAS project's environment
variables are the only two things an EAS build reads.

Two of the three are checked in, on the `preview` and `production` profiles in
[`eas.json`](eas.json), because they are not secret and they should not differ
between machines:

| Set in `eas.json` | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://xmwhhvqdonnkdsnheyoq.supabase.co` |
| `EXPO_PUBLIC_API_BASE` | `https://avoid.net` |

The anon key is deliberately **not** in this repo. Set it once on expo.dev:

> **Project → Environment variables → Create variable**
> - Name: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
> - Value: the same public anon key the website ships in
>   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (it is public — the service key never goes
>   near a client)
> - Visibility: **Plain text** (it has to be readable at build time to be
>   inlined into the bundle; "Sensitive" and "Secret" are for values the build
>   should not print, which an `EXPO_PUBLIC_*` value is not)
> - Environments: tick **preview** and **production**

Each build profile names its environment (`"environment": "preview"` /
`"production"`), which is what tells EAS which set of project variables to
inject. Nothing else has to be passed on the command line.

A value in `eas.json`'s `env` block WINS over a project environment variable of
the same name. So if the lead would rather keep the anon key in the repo, add
it to the `env` block of both profiles and the expo.dev variable is ignored —
no code changes either way.

To check what a build will actually see before spending a build:

```bash
npx eas env:list --environment preview
```

`preview` produces an **APK** (`android.buildType: "apk"`,
`distribution: "internal"`), for test installs. `production` produces an
**AAB** for the dApp Store. CI can run either by hand: see
[`.github/workflows/mobile-build.yml`](https://github.com/Chadjective/avoid-intel/blob/main/.github/workflows/mobile-build.yml),
which needs an `EXPO_TOKEN` repository secret and queues the build with
`--no-wait` so no CI minutes are spent waiting. Pushes to `mobile/` run the
typecheck only.

The EAS project id is pinned in `app.json` (`extra.eas.projectId`, since
0.2.3), so push registration does not depend on running `eas init`.

### How to build the submission APK

The hackathons take an **APK**, not an AAB. `production` builds an AAB (the
Play Store format), so it cannot be submitted as is. The `release-apk` profile in [`eas.json`](eas.json) is
`production` (same production environment and Supabase/API values, same
`production` update channel, same auto-incrementing version code) with the
output switched to `android.buildType: "apk"` and `distribution: "internal"`.
Use `release-apk` for the file you submit; `preview` is for test installs.

**Cloud route** (needs an Expo login; nothing to install locally):

```bash
cd mobile
npx eas login
npx eas build --platform android --profile release-apk
```

Or, with no laptop: GitHub -> Actions -> **mobile** -> **Run workflow** ->
choose profile `release-apk`. It needs the `EXPO_TOKEN` repository secret and
queues the build without waiting; the download link appears in the EAS
dashboard when it finishes.

**Local route** (`--local` builds on your own machine, uses no Expo build
quota):

```bash
cd mobile
npx eas build --platform android --profile release-apk --local
```

It needs the Android toolchain installed (a JDK and the Android SDK, per the EAS local-build docs) on Linux
or macOS, and still needs `eas login`. The finished `.apk` is written to the
current folder. Use this if the cloud quota is spent.

**Quota warning.** Expo's free plan limits cloud Android builds per month; the
October allowance ran out on 9 October. `--local` is the fallback.

**Over-the-air updates.** From 0.2.7, JavaScript-only fixes reach installed
phones without a new APK: GitHub -> Actions -> **mobile-update** -> channel
`production` for `release-apk` installs. An update reaches only builds with the
same app version, so keep `version` in `app.json` unchanged for an update.

Because `release-apk` inherits `autoIncrement`, every cloud build raises the
remote version code by one; that is expected.

### One oddity in `package.json`

`overrides: { "react-dom": "19.2.3" }` is load-bearing. `expo` declares an
optional peer on `react-dom`; npm resolves that to the latest 19.3.x, which
peer-depends on `react@^19.3.0` while SDK 57 pins `react@19.2.3`, and every
`npm install` then fails ERESOLVE. This app is Android-only and never renders
to the DOM, so the override just holds that optional peer at the version the
rest of the tree already has. Removing it breaks `npm install` and `npm ci`.

## Layout

```
mobile/
  app/                     expo-router screens (file-based routing)
    (tabs)/                Search · Scan · Watch · Alerts · Profile
    entity/[slug].tsx      the case file
    entity/[slug]/submit.tsx   submit evidence, then countersign it
    request/[id].tsx       live status of a requested investigation
  src/api/                 typed client for avoid.net, one zod schema per route
  src/solana/              MWA session, SIWS sign-in, countersign memo + flow,
                           pending-attestation retry store, anchor verify
  src/design/              tokens and components ported from web/DESIGN.md
  src/notifications/       Expo push token registration
  src/session/             who the user is (Supabase session + connected wallet)
  polyfills.ts             Buffer + getRandomValues, loaded from index.ts first
  eas.json                 preview = APK, production = AAB, release-apk = APK with production settings
```

`src/session/` is not in the spec's §4.2 tree; it exists because the Supabase
session and the wallet authorization are two different things and exactly one
module should reconcile them.

## What this talks to

Public reads, CDN-cached five minutes, no auth — the app's primary data
source, and free per request when the cache serves it:

- `GET /api/v1/investigations`, `GET /api/v1/investigations/:slug`
- `GET /api/v1/lookup?address=|entity=`, `GET /api/search?q=`
- `GET /api/v1/investigations/:slug/proof?event_id=`
- `GET /api/v1/investigations/:slug/audit` (s-maxage=300)
- `GET /api/v1/activity?limit=` (s-maxage=300) — the corpus-wide decision
  feed the Search tab's empty state renders; the cross-page cut of the audit
  trail, with the same public field policy
- `GET /api/v1/attestations?submission_id=` (s-maxage=60)
- `GET /api/requests/:id` — public despite the table's owner-only RLS, which
  is what lets an anonymous requester keep the status screen open

Session routes, which accept `Authorization: Bearer <Supabase JWT>` through
`getCurrentAccountFromRequest()`:

- `GET|PATCH /api/me`, `POST|GET /api/requests`, `POST|GET /api/submissions`,
  `POST /api/scan`, `POST /api/v1/attestations`

One Supabase read goes direct rather than over HTTP: the live progress screen
looks up the run for a request and subscribes to `investigation_run_events`.
Both tables carry `FOR SELECT USING (true)`, so the shipped anon key is
enough, and a websocket costs no Vercel invocations. Everything else obeys
`src/api/supabase.ts`: auth only, never `.from(...)`.

## What is stubbed

Verified against `web/src/app/api` on 2026-09-16. The §8 routes the first
commit was written blind against now exist; what remains is listed as what it
actually is, not as what it was.

| Area | State |
|---|---|
| `GET/POST /api/v1/watchlist`, `DELETE/PATCH /api/v1/watchlist/:id` | Route exists. The Watch tab has not been re-read against it since. |
| `POST /api/v1/devices`, `DELETE /api/v1/devices/:token` | Route exists. There is **no `GET`**, so the app cannot ask the server whether this phone is registered; it remembers its own accepted token (`getRegisteredPushToken()`), which is what the request screen's "notify me" panel reads. The EAS project id is pinned in `app.json` since 0.2.3. |
| `GET /api/v1/feed` | Route exists. The Alerts tab has not been re-read against it since. |
| `POST /api/v1/attestations` | Route exists and is **wired** (the countersign step on the submit screen). Two contract details the spec did not state: the 201 and the 200-duplicate both wrap the row as `{attestation}`, and `cluster` is `mainnet-beta \| devnet` only — a testnet build cannot countersign. |
| `PATCH /api/me` with `{wallet_pubkey, siws_message, siws_signature}` | **Wired.** The session provider sends it the moment a wallet sign-in succeeds, which is the only way `accounts.wallet_verified_at` is ever written. A wallet-first user with no `accounts` row gets a 400 `handle required`; the proof is held and Profile asks for a handle inline. Exercised by wallet sign-in on the Seeker since 6 Oct. |
| Audit trail | `GET /api/v1/investigations/:slug/audit` exists and the Entity screen reads it: decision, reason, actor/decided-by, score delta, the anchor with an explorer link that follows the row's cluster, and a per-row **Verify** that runs `verifyAnchor()` on device. `latest_root` is null until the Merkle worker runs. |
| `buildCountersignMemo()` | Ported line-for-line from `web/src/lib/attestations.ts` and named the same, because the server accepts a memo only if it `startsWith(countersignMemoPrefix(content_hash, slug))`. Still unverified against a real transaction — nothing has been run on a device. |
| `verifyAnchor()` | Fetches the transaction and compares the memo hash. Does **not** check the memo instruction's signer, and does not verify the Merkle proof (`merkle_roots` is empty until that worker is deployed). |
| `[SEEKER VERIFIED]` / SKR tier | Rendered from `/api/me` — `account.seeker_verified` and `account.skr_tier`, plus `wallet_watch` as a sentence. The placeholders and their caveat are gone. Both are only shown once a wallet is linked, because until then the server has nothing to check. |
| Live investigation progress | Screen exists (`app/request/[id].tsx`). Supabase Realtime on `investigation_run_events` is wired and the RLS allows it (`FOR SELECT USING (true)`, table in the `supabase_realtime` publication) — but in production **nothing writes those rows for a user request**: the only writer of `investigation_runs` is the paid `/api/queue/drain` path, and the free `/drain-queue` skill publishes without emitting events. So the timeline is usually empty and the bounded status poll is the real answer. |
| Evidence submission UI | Built (`app/entity/[slug]/submit.tsx`), five kinds; the route's sixth kind `file` is not offered because there is no upload path. |
| App icon and splash | Shipped (`assets/`), rebuilt at 1024 from the avatar mark — see the 0.2.1 changelog entry for why it is a rebuild and not an upscale. Checked by `expo-doctor` and seen on the Seeker. |
| Fonts | Geist / Geist Mono load from `@expo-google-fonts/*`. If the load fails the app falls back to the platform mono/sans, which is a degraded state, not the design. The packages ship every weight, so a Metro export bundles ~3MB of TTFs the app never asks for; trimming that is a size pass for week 3, not a correctness problem. |
| Device testing | Runs on a real Solana Seeker from 2026-09-18 to 2026-10-08, one session per build from 0.2.3 to 0.2.7. What each found, and the fix, is in [CHANGELOG.md](CHANGELOG.md). See [Status](#status-what-has-and-has-not-been-tested). |

## Signing in

**Signed in means a Supabase session exists.** Nothing else does — a connected
wallet is an MWA authorization and is shown as exactly that ("Wallet connected
— not signed in"). Screens gate on `useSession().signedIn` and no other test;
when it is true, no sign-in control renders anywhere in the app.

Sign in with Solana tries two paths, in order
(`src/solana/sign-in-with-solana.ts`):

1. **`authorize` with a `sign_in_payload`.** One wallet prompt for consent and
   proof. The wallet builds the SIWS text and returns it signed.
2. **`authorize` with no payload, then `signMessages`.** Used automatically
   when (1) throws or comes back without a `sign_in_result`. The app builds the
   SIWS text itself (`src/solana/siws-message.ts`) and asks the wallet only to
   sign those bytes. Two prompts. A cancel in the wallet stops here and does
   not fall through to the other path.

Either way the same triple — message text, base64 signature, base58 address —
goes first to Supabase (`signInWithWeb3({chain:'solana', …})`) for the session
and then to `PATCH /api/me` for the wallet link. The server re-verifies it in
[`web/src/lib/siws.ts`](https://github.com/Chadjective/avoid-intel/blob/main/web/src/lib/siws.ts), which is the authority on the
message grammar; `siws-message.ts` is a port of its `buildSiwsMessage()` and
the two have to move together. The domain (`avoid.net` or `www.avoid.net`) is in that
module's `DEFAULT_SIWS_DOMAINS`, so no server env var is needed. The chain id
in the message is `solana:mainnet`, the form Supabase Auth accepts.

Which path won is a `console.log`. Failures are sentences on the Profile tab —
"Your wallet declined the sign-in message", "Sign-in service not configured in
this build", "Server rejected the signature: …" — never a protocol code like
`-1/authorization request failed`, which is what the first device test showed
the owner.

## Conventions

- **Never poll unbounded.** Every request is a billed Vercel invocation. The
  scan poller (`src/api/scan.ts`) is capped at 20 tries with 1.5× backoff to an
  8s ceiling; search debounces at 350ms. Push replaces polling everywhere else.
- **Never invent an API field.** Every schema in `src/api/types.ts` names the
  route handler it was read from. If a response does not match, the client
  throws a `schema_mismatch` rather than rendering blanks.
- **The address goes in the body.** `POST /api/scan` takes the wallet address
  in the request body so it never reaches `api_logs`.
- **Two band scales, no third.** `src/design/bands.ts` ports both verbatim from
  `web/src/lib/trust-bands.ts`.
- **Show the caveat.** A page whose `severity_base` is null renders
  `[PROVISIONAL]` on the gauge. ~98% of rows are in that state.
- **No gradients, no shadows, no blue, dashed 1px borders, mono for data.**

## Checks

```bash
npm run typecheck     # tsc --noEmit
npm run doctor        # expo-doctor
npm run test:logic    # logic tests (node --test)
npx expo export --platform android --output-dir /tmp/avoid-export   # Metro resolves everything
```

Logic tests run with `npm run test:logic` (7 files under `tests/`, 57 tests);
there are no UI or on-device tests. `expo export` is the closest thing to a build
check available without an Android toolchain: it proves Metro can resolve and
bundle every dependency (web3.js, MWA, supabase-js, the fonts), which is where
a React Native app with Node-shaped dependencies usually breaks first. It does
not prove the app runs — only a device or emulator does that.
