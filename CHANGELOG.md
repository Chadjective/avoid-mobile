# Changelog — AVOID.NET mobile

Every entry is dated. This file exists from the first commit because both
hackathon submissions ask what was built inside the competition window
(docs/MOBILE_APP_SPEC.md D9): the platform — avoid.net, the ingestion
pipeline, the Solana anchoring — predates both windows and was submitted to
Colosseum Frontier in May 2026. Everything in `mobile/` was built on or after
2026-09-16.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are ISO-8601.

## [Unreleased]

### Changed
- **SKR holders get 15 investigation requests a day (was 10).** Server limit is
  `TIER_TABLE.holder` in `web/src/lib/entitlements.ts`; `src/session/skr.ts`
  mirrors it for display. Ships over the air (JS only).

## [0.2.7] — 2026-10-08 — fixes and redesign from the 0.2.6 device test

### Added
- **Over-the-air updates (expo-updates).** Builds from this version on check
  for a new JavaScript bundle at launch and switch to it on the next launch,
  so fixes that need no new native code ship without a paid build
  (`.github/workflows/mobile-update.yml`, Run workflow). Updates reach only
  builds with the same app version: keep `version` at 0.2.7 to update 0.2.7.
- **Requests-first Profile.** One @handle with badges, then big tiles for
  published requests and requests in the queue (with the next run time), the
  queued and published lists (score and band, "#N in line", NEW until opened),
  and a Following · New alerts · Wallet scans · Evidence strip. The Profile
  list refreshes each time you open it and right after you make a request.
- **"Create an account to boost your rank"** on the request screen when signed
  out; signed-in members, holders and stakers see their queue bonus.
- **Watch: [+] add** opens a search: Follow a page that exists, or request one
  that doesn't. Rows are compact with score, band, type, top risk and event
  count; [+] opens Open page, Mute alerts and Unfollow.
- **Page buttons show their dates** ("last updated…", "since…"). After a recent
  update or fact-check, Submit evidence moves to the top and the waiting
  button shows when it opens again.

### Changed
- Wallet buttons are a silver pill (optionally on a teal glow panel), in the
  style of the Seeker's own sign-in sheet.
- Search: one line "Search 1,843 investigations", aligned with the box;
  placeholder "Token, site or wallet"; plain border.
- One band scale everywhere: Critical, Warning, Cautionary, Low risk.
- Scan: every named token without a page can be requested, whatever its value;
  tags in plain words.
- "Request fact-check" (was "Fact-check this page"); the request screen drops
  "waiting less than a minute" and links to the whole queue.
- Contents list: wrapped titles line up under the title, not the number.

### Removed
- Wallet Guardian UI (Profile row, Scan's "Watch this wallet"); the service keeps
  running in the background.
- "Request investigation" box on Profile (it stays on Search, Scan and the
  request screen).

### Fixed
- The wallet button drew its colour over only part of the button.
- "Last updated" no longer changes when nothing on the page changed.

## [0.2.6] — 2026-10-08 — fixes from the 0.2.5 device test

### Added
- **Tab bar on every page.** Investigation, submit-evidence and request
  screens keep the Search / Scan / Watch / Alerts / Profile bar; back returns
  to where you came from.
- **Tapping a notification opens it.** A page alert opens that page; a digest
  or anything else opens Alerts. Works from a cold start and while running.
- **"Since you were here" opens up** to list the decisions and updated pages
  behind its counts, each row opening its page.
- **Search shows how many investigations exist** ("Search N investigations").
- **Your @handle at the top of Profile** when signed in.
- **Teal wallet buttons** (Sign in with Solana, Sign in with this wallet,
  Connect wallet), styled after the Seeker's own sign-in sheet.

### Changed
- Page actions are one size and style; with three, the last spans the row.
- Fact-check status shows inside the greyed button; the queue link is gone
  (fact-checks are not in the investigation queue).
- Section sources are collapsed under each section; Contents counts sources.
- Audit trail: chain icon on "Recorded on Solana"; VERIFY looks like a button.
- Scan: paste field and Scan come before "Scan again"; honest copy when the
  scan provider is down vs. no connection.
- Profile: wallet scans list each wallet once; "Investigation already
  published" links to the page; "Sign in" in the intro is a link; the email
  button stays above the keyboard; X and submissions links have a 44dp target.

### Fixed
- The tab bar sat under Android's gesture bar (WATCH label covered).
- Cancelling in Phantom showed "Sign-in cancelled." with Copy details; it now
  says "You cancelled in the wallet app…" with no details button.
- Requesting a name whose page is still a draft opened "Page not found".

## [0.2.5] — 2026-10-07 — tab icons, a push switch and fact-check requests (fixes from the 0.2.4 device test)

### Added
- **"Your perks" battery meters on Profile.** Under the SKR line, three
  horizontal batteries (Scans today, Requests today, Follows) drain from full to
  what you have left when the card appears (600ms; instant with "remove
  animations" on). Cyan above 30% left, amber at 30% or less, red at 0, with
  "7 of 10 left · resets in 5h"; below them "Queue priority +1". Tap the card to
  compare Member, Holder and Staker. Numbers come from a new opt-in `usage`
  object on `/api/me?usage=1` (only Profile asks; counted with the same functions the server enforces
  with); an older server without it shows just the tier perks text. Maths and
  wording in `src/session/perks.ts` with logic tests; the same meters are on
  avoid.net/me.
- **An SKR line on Profile.** With a wallet linked, the wallet card shows your
  SKR and tier ("182 SKR · Holder"), what the tier gets ("50 follows · 30 scans
  a day · queue priority +1") and the next step ("Stake 420 SKR to become a
  Staker"; a Staker sees its full perks). Amounts are whole SKR with thousands
  separators; an older server that sends no amounts shows the tier alone. The
  wording and the perk numbers (a copy of `TIER_TABLE` in
  `web/src/lib/entitlements.ts`, which stays the source of truth) are in
  `src/session/skr.ts` with logic tests. `/api/me` now returns `skr_liquid` and
  `skr_staked` (migration 071); sign-in still works on a database without it.
- **A live request screen.** While queued, a cyan countdown arc fills toward the
  next queue run with the time left (m:ss) in the middle, ticking every second
  from a local timer (no extra requests); "You're #3 in line" with a dot for
  each person ahead. A three-step bar (Queued, Researching,
  Published) lights up in the same cyan as the status advances, the current step
  pulsing gently (still when the phone's "remove animations" is on). Published
  completes the arc with a check and "Published!" and an "Open the page"
  button; Failed says "This one didn't finish and nothing was published. Try requesting
  it again.", with a Back to Search button. Status polling is unchanged (bounded, backing off). Reusable
  `ProgressArc` and `StageProgress` in `src/design/components/`; the maths
  (stage from status, arc fraction, countdown text, dots) is in
  `src/retention/request-progress.ts` with logic tests.
- **"See the queue →" and "Track progress →" after every request.** Request investigation (Search,
  Profile, Scan) already opened the request screen when an id came back; when
  only a message does, the message now carries a "See the queue →" link to avoid.net/queue.
  Update this page and Fact-check this page show "Track progress →" (the update
  opens its request screen when the server sends an id) or "See the queue →".
  The Submit evidence success panel shows Submitted, Under review, Decided,
  says it is "Under review" in your activity on Profile, and links to it and, as
  "See pending evidence →", to avoid.net/submit/pending.
- **"Your activity" on a signed-in Profile**, like avoid.net/me: a counter row
  (requests · how many published, evidence accepted, evidence rejected, wallet
  scans); **Your requests** each with a pill (Published, In queue, Researching,
  Failed, Rejected) and when you made it, Published opening the page; **Your
  evidence** with a pill (Accepted, Rejected, Under review) and "score 58 → 46"
  when it moved the page; **Your wallet scans** with short address, token count,
  score band and date, tapping one opens Scan with that address filled in (not
  scanned). Hidden when there are no scans. No new requests: the request list
  and evidence were already loaded, accepted/rejected come from `/api/me`, and
  scans reuse the once-per-session `GET /api/scan`. No server change.
- **"Follow @0xavoid on X ↗"** at the end of "Your activity" and near the bottom
  of the signed-out Profile, above the pinned sign-in. Opens x.com/0xavoid (the
  X app if installed, otherwise the browser).
- **Icons on the bottom tab bar.** A thin outline icon above each label
  (magnifying glass, wallet, eye, bell, person), drawn with the existing
  `react-native-svg` in `src/design/tab-icons.tsx`. The bar is 64px tall to fit
  icon and label.
- **Fact-check this page** on a page that has not been fact-checked yet, under
  "Update this page". It posts to `/api/review-requests`, the same call as the
  website button, and says what happened ("Fact-check requested…", "Already
  requested today.", "Not available right now."). Nothing is sent on load.
- **Contents list on a page**, under the summary: "Contents · 17 sources · 16
  events", then the section titles numbered, then "Timeline (N events)". Tapping
  one scrolls to it (`Screen` takes an optional `scrollRef`).
- **Scan: "Request investigation"** on tokens with no page that are not dust and have a
  symbol or name. Same call as Search's "Request investigation", with the
  token's name and mint as context; signed out opens Profile; shows the same
  result text and opens the request screen when an id comes back.
- `accentAnchor` colour token (cyan, as on the website) for on-chain links.
- **Wallet Guardian row on Profile.** The wallet card ends with a shield icon and
  a plain status instead of a bare sentence: "Wallet Guardian is on" (green, with
  "You get an alert if this wallet trades with a token or address we've flagged as
  risky."), or "Wallet Guardian starts within 6 hours" (muted). Tapping it
  opens the Alerts tab, where those alerts appear. Unknown status stays muted
  and not tappable. `ShieldIcon` sits with the tab icons; wording is a pure
  helper, `src/session/wallet-watch.ts`.

### Changed
- **The request stage bar has three steps, not four.** The server only reports
  queued, running and published, so "Fact-checking" is gone: Queued,
  Researching, Published. avoid.net/queue drops its "Saving" step the same way.
- **Sign-in is one trip, at the bottom.** Signed-out Profile pins a single
  "Sign in with Solana" button above the tab bar, where the thumb is and where
  the wallet's sheet opens. It connects and signs in in one wallet session
  (the old "Wallet connected, not signed in" card and second button are gone;
  with a wallet already connected it reads "Sign in with this wallet"). "Or use
  email" sits just above it, and "Request investigation" stays above both.
- **Scan:** with no wallet, "Connect wallet" is pinned at the bottom too; the
  paste field and Scan button stay where they were.
- `Screen` takes an optional `footer`, pinned above the tab bar and hidden while
  the keyboard is open so it never covers a field.
- **Page actions together.** Follow, Submit evidence, Update this page and (on
  unchecked pages) Fact-check this page sit in one 2×2 block under the title and
  score, before the summary, with "last updated…" and the follow note under it.
  Button text is now centred so labels can wrap in a half-width button.
- **Sources are collapsed** behind "Sources (N) [+]" until you tap.
- **Audit trail looks like the website's decision log:** `#3 REVIEW REVISE -7`
  (score change red or green), a cyan "Recorded on Solana ✓" link with the
  VERIFY action unchanged, the date and a small muted `slot … · hash 6WzQ…` line, and the long
  review summary cut to three lines with "more". A line above the rows reads
  "Recorded on Solana · 3 decisions".
- **Alerts:** "Turn on push" and the "Push is on." note are replaced by a
  "Push notifications" row with a switch on the right. Off removes this phone
  from push (`DELETE /api/v1/devices/:token`). The switch shows the phone's real
  state when the tab opens.
- **Profile:** "Your impact" and its "x of 3 toward Trusted" block are gone;
  the list of pages you asked for is headed "Your requests · N".
- **Watch:** when you follow things and nothing moved, "What moved" says
  "Nothing has changed since you last looked." The old sentence stays for an
  empty watchlist.

### Fixed
- **Profile → Request an investigation** no longer sends an empty request (the
  stray tap that showed "Couldn't send the request"). The button is disabled
  until you type something, and a 400 from the server now shows its own plain
  sentence.

## [0.2.4] — 2026-10-06 — push notifications (Firebase) and fixes from the 0.2.3 device test

**0.2.3 on a Seeker (6 Oct): wallet sign-in succeeded for the first time**
(after adding `https://www.avoid.net` and `https://www.avoid.net/**` to the
Supabase Redirect URLs; Supabase rejects a SIWS message whose URI host is not
the Site URL's or on that list). Follow and Request worked. Push failed:
"Unable to get Firebase Messaging instance… googleServicesFile".

### Added
- **Firebase for Android push.** New `app.config.js` (extends app.json) sets
  `android.googleServicesFile` from the EAS file environment variable
  `GOOGLE_SERVICES_JSON` (expo.dev, preview + production). Expo's push service
  also needs the FCM V1 service-account key uploaded under the project's
  Android credentials. Without the variable the app still builds.

### Changed
- **Copy and UX pass** (docs/MOBILE_COPY_REVIEW_2026-10-06.md, tiers 1–2):
  plain one-line errors instead of raw error text; jargon removed; repeated
  explanations said once; disclosures kept, shorter.
- **Search** keeps the search box, the tagline and what's new; the stats,
  dashboards and "how this works" cards are gone.
- **Pages** no longer show a follower count.
- **Profile** drops "Connect wallet only", the cluster line and negative
  Seeker/SKR pills; a new wallet reads "Not monitored for alerts yet. Wallets
  are added every 6 hours."
- **Alerts** hides "Turn on push" once this phone is registered.

### Fixed
- **The first 0.2.4 builds failed** in Gradle ("Missing project_info object"):
  the file uploaded as the EAS variable `GOOGLE_SERVICES_JSON` was not a
  google-services.json. `app.config.js` now uses the checked-in
  `google-services.json` (not a secret; its contents ship in every APK),
  checks it at config time, and no longer reads the variable.
- Push registration without Firebase now says "Push notifications are not set
  up in this version of the app yet…" instead of the library's developer text.
- The wallet-cancel message names the real button ("Sign in with Solana").
- `.env.example` uses the apex avoid.net.


## [0.2.3] — 2026-10-03 — the build for the first device test since 18 Sep

Everything below in this section, plus the fixes here. **Not run on a
device**; `tsc --noEmit`, the logic tests and an Android export pass.

### Fixed (2026-10-04) — from the third device test and an independent review

- **Search tab showed the same pages twice.** "Latest decisions" was mostly
  publishes (38 of the last 50), which are already the top of "recently
  updated". The section is now **fact-checks & evidence**: decisions on pages
  that already existed (reviews, accepted or rejected evidence, score moves).
  "Since you were here" still counts everything.
- **Cancelling in the wallet opened it a second time.** "Local association
  cancelled by user" on the first path fell through to the fallback path,
  which asked again. A cancel now stops at once: "You cancelled in the wallet
  app. Tap Sign in with Solana again when you are ready."
- **Scan sat on "starting" with no explanation.** `POST /api/scan` answers
  only when the whole scan is done (up to a minute); the screen now says so.
- **Email link (review):** the router's params win over `Linking.useURL()`,
  which can still hold the older link that launched the process; a link
  already spent on an earlier visit says "That sign-in link was already
  used…" instead of spinning; Send link's one-minute rest applies only when
  the link actually went out, so a typo or no network can be retried at once.

### Changed (2026-10-04) — a private Solana RPC, with the public one as fallback

- **Verify and Countersign read Solana through `EXPO_PUBLIC_SOLANA_RPC_URL`
  (a Helius key for the app alone) when it is set on expo.dev**, instead of the
  public endpoint that rate-limits phones. Every RPC call (the anchor lookup,
  the blockhash, the confirmation poll) now goes through `withRpc`
  (`src/solana/cluster.ts`): if the custom endpoint throws (rate limit,
  revoked or used-up key, network), the same call is retried once on the
  public endpoint. The key ships inside the APK and can be extracted, so it
  must be a separate free key, never the website's. web3.js's own 429 retry
  loop is off, so a rate-limited endpoint hands over at once. No custom URL
  set means the public endpoint only, exactly as before.
- **The EAS project id is pinned in `app.json`** (`extra.eas.projectId`), so
  push registration never depends on CI's `eas init` step.

### Fixed (2026-10-03) — what the second device test found (Seeker, 0.2.2)

- **Email sign-in: no way to pick a handle.** A user who signed in by email link
  and had no `accounts` row saw "Signed in, no handle yet." and Follow, Watch
  wallet and the rest answered 403 "Create a handle first" — the Profile name
  field only appeared after a wallet proof. Profile now shows the same
  "pick a name" card and **Create account** button once `me` has loaded with no
  handle; it calls `PATCH /api/me {handle}` (`updateMe`, which had no caller),
  refreshes `me`, and turns 409 taken, 400 invalid and offline into plain
  sentences (`src/session/handle.ts`, tested). The wallet path is unchanged.
- **Wallet sign-in: "siws: Chain ID is not valid".** Every wallet sign-in failed
  at Supabase, on both paths. The message said `Chain ID: mainnet`; Supabase
  Auth only accepts `solana:(main|dev|test|local)net`
  (`validSolanaNetworksPattern` in supabase/auth). `SIWS_CHAIN_ID` is now
  `solana:mainnet`, with a test that pins it to Supabase's pattern. The web
  verifier (`web/src/lib/siws.ts`) accepts any chain id, so linking a wallet is
  unaffected.
- **Email link: "No sign-in link was received".** The link opened the app,
  but with the app already open the `url` event fired before `app/auth.tsx`
  subscribed, so `Linking.useURL()` stayed null and the screen gave up after
  4 s. The Supabase client now uses the PKCE flow, so the link comes back as
  `avoid://auth?code=...`, and the screen also reads the code from the
  router's params, which arrive on a warm start too. The link must be opened
  on the phone that asked for it (the PKCE verifier is stored there).
- **Wallet sign-in: "Unable to resolve host … supabase.co"** (Phantom, on
  Wi-Fi). The phone briefly could not reach the network after the hand-back
  from the wallet. A network failure at the server step is now retried once
  after 2 s; a second one says "No internet connection reached the sign-in
  server…" instead of the Java exception.
- **"email rate limit exceeded"** after a double tap on Send link. The button
  now rests for a minute after each send ("Send again in a minute"). The
  project-wide limit itself is a Supabase setting (custom SMTP).
- **Copy details** now includes the exact text the wallet signed, and no
  longer says "wallet never answered authorize" when the wallet did answer
  but did not report its URI base.

### Fixed (2026-10-03) — signed-in calls went to www and lost their token

- **The app now talks to `https://avoid.net`, not `https://www.avoid.net`**
  (`eas.json` preview and production, and the default in `src/api/config.ts`).
  `web/vercel.json` 308-redirects every www request to the apex, and Android's
  HTTP stack drops the `Authorization` header when a redirect changes host, so
  every signed-in call (follow, watchlist, request update, `/api/me`) would
  have reached the server as "Not signed in". Public reads were unaffected.
  The Sign in with Solana message still names `www.avoid.net`; the server
  accepts both domains, so that is unchanged.
- **"Send link" no longer says "Check that inbox" when sending failed.** The
  note now shows only when the send succeeded; a failure shows only the
  "Could not send that link: …" card.

### Added (2026-10-02) — follower count, your evidence, scan history across phones

Not run on a device: type-checked, logic-tested and exported only.

- **Follower count** on the entity screen, under Follow: "N followers". Hidden
  when the server returns null (fewer than 3 followers, or an older server).
  Rides the page read the screen already makes; no new request.
- **Your evidence** in the Profile impact ledger: your last 20 submissions,
  each with the page, the verdict in words (accepted / rejected / under
  review), relative time, the reason when there is one and "score 58 → 46"
  when the decision moved the score. Tap to open the page. Comes from
  `/api/me` (no new request); an older server falls back to the link to
  avoid.net/me.
- **Scan history across phones**: when signed in, the "scan again" card merges
  the account's last scans (one `GET /api/scan` per app session) with this
  phone's, de-duplicated by address, newest first. The holdings snapshot a
  diff needs stays on the phone, so the first re-scan of a wallet known only
  from the server shows no "what changed" comparison.

### Added (2026-09-29) — Request update on the entity page

A signed-in user can ask for an existing page to be re-researched. **Not run
on a device**; `tsc --noEmit` and the logic tests pass.

- **"Request update" under the gauge** on `entity/[slug]`, with "last updated
  3 days ago" beside it (from `updated_at`, already loaded). One `POST
  /api/requests { kind: "update", slug }` on press, nothing on load. Signed
  out, the button reads "Sign in to request an update" and opens Profile.
  After a press it says "Update queued", or "Update already requested" when
  someone already has one open for that page (which costs no budget); at the
  daily limit it says so (same 10/day as new investigation requests).
  Concept pages do not show it. **Needs web migration 066 applied first**;
  until then the server answers 503 and the app says updates are unavailable.

### Added (2026-10-02) — Request update: 7-day cooldown per page

A page can be re-researched at most once every 7 days. **Not run on a device**;
`tsc --noEmit`, the logic tests and an Android export pass.

- **New button state.** When the server answers 409 `recently_updated`, the
  button reads "Updated recently · again on Oct 9" (the date the server gives
  in `next_allowed_at`) and stops offering the request. It costs no daily
  budget. The score on the page is unchanged by an update until the
  fact-checker has run on the new text.

### Added (2026-10-02) — place in line on the request screen

- While a request is queued the screen shows "you're #N in line" and the run
  it is expected in, using the server's `queue_position` and
  `estimated_run_at` from `GET /api/requests/:id`. Without them (older server,
  or an estimate already in the past) it falls back to the local schedule, so
  the countdown never goes negative. Needs a new app build to appear.

## [0.2.2] — 2026-10-02 — bundle of #187, #212, #233, #234, #238, #239, #240, #241, #243

### Changed (2026-10-02) — the queue runs every four hours

- The request screen's "next queue run" now follows the new schedule: every
  four hours at 00, 04, 08, 12, 16 and 20 UTC (was 12, 17 and 23 UTC, which
  left a 13-hour gap overnight). Still up to ten requests per run.

### Fixed (2026-09-29) — email magic link opens the app, not the website

- The sign-in email link now lands in the app. Before, `avoid://auth` had no
  screen or handler behind it, so nothing completed the sign-in; and Supabase
  ignores a redirect that is not in its allow-list and sends the user to the
  website instead. New route `app/auth.tsx` reads the raw link (cold start or
  app already open), handles the code form (`?code=`, PKCE), the token form
  (`#access_token=&refresh_token=`, implicit; this is what the mobile client's
  default flow produces) and `?token_hash=`, shows signing in / signed in /
  error, then goes to Profile. Parser: `src/session/auth-link.ts`, tested in
  `tests/auth-link.test.mjs`. **Not run on a device.**
- **OWNER step:** Supabase dashboard, Authentication, URL Configuration,
  Redirect URLs: add `avoid://auth` (or `avoid://**`). Without it the link
  still opens the website.

### Fixed (2026-09-29) — API contract audit against the live web routes

Every call in `src/api/*.ts` was compared with its route in
`web/src/app/api/**` (method, path, auth, request body, response shape,
status codes, enums). The web was not changed. Found and fixed:

- **A failed wallet scan showed the raw text `scan_failed`.** The route
  answers a scan that failed upstream with HTTP 502 and a body, and the app
  treated any non-2xx as a crash, so its friendly "failed upstream, not
  charged against your limit" message could never appear. `startScan` now
  hands that answer back to the screen.
- **A rate limit showed the raw text `rate_limited`** on Profile's "request an
  investigation" box, and on any screen without its own wording. The routes
  send a code, not a sentence. Error text now comes from one place
  (`describeErrorBody`): route-written messages win, `rate_limited` and
  `validation_failed` (with the field name) become sentences.
- **Profile's request list showed "Sign in to view your requests" to someone
  who was signed in but had not picked a handle.** The route uses 401 for
  that; the app now shows an empty list.
- **Unfollow of something already gone (404)** and **sign-out unregistering a
  push token the server no longer holds (404)** are now treated as done, not
  as errors.
- **Push registration** sends `platform` as `android` or `ios` only, the
  route's two accepted values.
- The feed's `data` field is accepted as null (the column is never null
  today; this only removes a way for one odd row to blank the Alerts tab).

Added `tests/contracts.test.mjs` (in `npm run test:logic`): the app's
parsers run against JSON copied from each route's response construction,
including the old bare-row shape that must now be rejected. Response schemas
that were spread across `src/api/*.ts` now live in the dependency-free
`src/api/contracts.ts` (re-exported, so no screen import changed) so Node can
load them. When a route changes, update its fixture in the same commit.

### Fixed + Added (2026-09-29) — wallet sign-in: the wrong chain name, and a failure report you can copy

Wallet sign-in has never succeeded on the Seeker. **Nothing below has been run
on a device**; `tsc --noEmit` and `npm run test:logic` pass.

- **Fixed: `authorize` sent an invalid chain name.** Every wallet call sent
  `chain: "solana:mainnet-beta"`. The Mobile Wallet Adapter spec's names are
  `solana:mainnet`, `solana:devnet`, `solana:testnet`; `mainnet-beta` is only
  the old bare `cluster` spelling. The protocol library rewrites the bare
  `mainnet-beta` but passes `solana:mainnet-beta` through untouched, so a wallet
  was handed a chain it does not know (or, on an older wallet, no cluster at
  all) and can answer `-1 / authorization request failed`, the first Seeker
  failure. All four `authorize` calls now use `mwaChain()` (src/solana/mwa-chain.ts).
  This is the most likely cause; it is not proven until a device run.
- **Fixed: a crashed wallet app was tried twice.** If the first attempt ended
  in a closed or timed-out wallet session, the app immediately opened the
  wallet a second time for the fallback. It now stops and says so. The
  fallback still runs when the wallet ran and refused (`-1`, or no
  `sign_in_result`).
- **Added: "Copy details" on a failed sign-in** (Profile, "what went wrong").
  Shows and copies: the step that failed (connect/authorize, sign message,
  server verification), the raw error code and message of each attempt, the
  wallet's `wallet_uri_base` and account label (MWA gives no wallet name or
  version), whether the wallet returned a `sign_in_result`, the chain and
  domain sent, and the app version. Signatures, tokens and long encoded values
  are stripped; the address is shortened.
- **Added: friendly message for a dead wallet app.** "Your wallet app didn't
  respond. Restart the phone, open the wallet once, then try again."
- Checked and found correct: message layout matches the server parser
  (web/src/lib/siws.ts), domain `www.avoid.net` is in `DEFAULT_SIWS_DOMAINS`,
  `signMessages` runs in the same wallet session as `authorize` (no separate
  session, no auth token needed), addresses are base64 toward the wallet and
  base58 toward the server, the signature is base64 (server accepts both).

### Added (2026-09-29) — platform stats card on Search

- **Platform stats** card in the Search tab's feed: entities investigated,
  reviewed & published, on-chain anchors, sources archived %, investigation
  requests — the same figures the website's /data page leads with, with a
  "Full dashboards →" link to https://www.avoid.net/data. Numbers come from a
  new public read-only route, `GET /api/v1/stats` (`s-maxage=3600`), which
  reads the snapshot /data already renders from, so it adds no new queries.
  One request per app session, no polling; loading and error (with retry)
  states. Not run on a device.

### Fixed (2026-09-29) — search: request an investigation even when near-matches appear

Founder device test: searching "Shadow" returned three unrelated pages and the
"Request investigation" option never showed, because it only rendered on zero
results. Search now shows a "Not here? Request "<query>" →" chip above the
results whenever the query is 2+ characters and no result's name or slug is an
exact (case-insensitive) match. It reuses the existing `onRequest` /
`createRequest` flow, so limits and routing are unchanged; the zero-result card
stays. The rule is `src/search/request-offer.ts` (unit-tested via
`npm run test:logic`). **Not yet run on a device.**

### Added (2026-09-26) — retention loops: reasons to come back

Built from docs/RETENTION_LOOPS_SPEC.md §9a (the app-screen map of the six
loops). Every "last seen" marker lives **on the phone** (AsyncStorage,
`src/retention/memory.ts`); the server never learns what anyone read, and no
new route, table or migration was needed. **Nothing below has been run on a
device.** `tsc --noEmit`, `expo export --platform android` and the new logic
tests pass, and those three prove nothing about how it feels in the hand.

- **Since your last visit, on Search** (Loop 3). A card above the feed:
  "since you were here 2 days ago: 14 decisions on 9 pages · 3 score moves ·
  2 pages updated", then up to five pages *you have opened* whose record moved
  since you read them, each tappable. A first visit shows no card rather than
  calling everything new, and the marker is captured once per app launch, so a
  pull-to-refresh does not reset it to "0 seconds ago".
- **Since you last read this, on the entity page** (Loop 3). A bar under the
  gauge: "score 61 → 49 · CAUTIONARY → WARNING · 1 accepted evidence · 1
  fact-check verdict", and every audit-trail row newer than your last visit
  is marked **NEW**, because that row is the reason. Computed from the audit
  trail the screen already loads.
- **One Follow toggle** (Loop 2). The button knows whether you already follow
  the page (Follow ↔ ✓ Following, tap again to unfollow), says what a follow
  alerts on, and turns the 409 cap into "you are following the most pages
  your account allows (10) … hold 69 SKR for a limit of 50". No follower
  count: no route exposes one, so none is shown (proposal in the spec).
- **"What moved" leads the Watch tab** (Loop 2). Each followed page whose
  score changed, or that had a decision since your last Watch visit, with the
  decisions listed and a "see why →" into the page. It compares the
  watchlist's scores against the snapshot this phone kept last time, plus the
  shared activity window. First visit: one line saying comparisons start next
  time. Pull to refresh; rows show "page" or "wallet · solana" and "since
  3 days ago".
- **Request progress** (anticipation). A rail, ● queued ── ◉ investigating
  ── ○ published (✕ where a failed or rejected request stopped), how long it
  has waited, and the **real** queue schedule: "next queue run in about 3
  hours (8:00 AM)". The queue is drained by a cloud Routine at 12:00, 17:00
  and 23:00 UTC, up to 10 requests per run (docs/CRON_RUNBOOK.md; the job was
  checked enabled, and its last run succeeded, on 2026-09-26). The copy is a
  schedule, not a promise, and says when a request has waited through more
  than one run. `GET /api/requests/:id` has no queue position or ETA, so
  none is invented. A signed-in user without push now gets "Turn on push for
  this phone" before the email fallback.
- **Your impact, on Profile** (Loop 4). Reputation as a goal: "2.1 of 3
  toward Trusted" with a progress bar, what Trusted actually does (a
  [TRUSTED] mark on your evidence; some of it skips the moderator queue, per
  `web/src/app/api/submissions/route.ts`), accepted and rejected counts,
  **pages you helped publish** (your fulfilled requests, linked), and requests
  still waiting. Signed-out visitors see the requests *this phone* made. The
  per-submission verdict list is not in `/api/me`, so the ledger links to
  avoid.net/me for it rather than inventing one.
- **Re-scan and watch a wallet** (Loop 6). The Scan tab keeps each wallet's
  last scan on the phone (up to 10 wallets, with "forget"), offers "scan
  again", and after a re-scan leads with "since your last scan (4 days ago):
  exposure-weighted trust 62 → 55 · BONK: score 40 → 20 · WIF: now has a page
  · 2 new positions". **Watch this wallet** adds the address to the watchlist
  (`target_kind: 'address'`), which is what the Wallet Guardian reads, and
  says plainly that live monitoring slots are limited.
- **NEW markers on Alerts**, relative times ("3 hours ago") and
  pull-to-refresh. The registration note no longer shows a push-token prefix.
- `src/retention/` — `diff.ts` (pure comparisons), `memory.ts` (on-device
  markers, capped and failure-silent), `time.ts` (one relative-time helper for
  the whole app), `activity-cache.ts`, `watchlist-store.ts`,
  `queue-schedule.ts`, `components.tsx`, `ImpactLedger.tsx`.
- `tests/retention.test.mjs` + `npm run test:logic` — 12 tests of the pure
  logic under plain Node (type stripping), so no test runner was added to the
  app's dependencies.

### Fixed (2026-09-26)

- **Follow and Mute always showed an error.** `POST /api/v1/watchlist` and
  `PATCH /api/v1/watchlist/:id` wrap the row as `{item}`; the client parsed a
  bare row, so every *successful* follow surfaced as "Unexpected response
  shape". Found while building Loop 2.
- **Push registration always "failed".** `POST /api/v1/devices` answers
  `{id}` only; the client demanded the whole device row, so the server stored
  the token while the app reported an error and never recorded that the phone
  gets pushes. As a result the request screen always offered email instead.
  Both were invisible until a device got as far as signing in.

### Changed (2026-09-26)

- **One shared activity read.** The Search feed, its "since your last visit"
  card and the Watch tab's "what moved" share one `GET
  /api/v1/activity?limit=50` per app session (public, `s-maxage=300`), where
  the feed used to fetch `limit=10` by itself. The net request count is
  unchanged for someone who only uses Search, and lower for anyone who also
  opens Watch.
- **One watchlist read per session.** `GET /api/v1/watchlist` (`no-store`, so
  always a billed invocation) is fetched once, then kept in step by the
  follow, unfollow and mute responses. It is shared by Watch, the entity
  screen and Scan, and dropped when a different account signs in.
- Every timestamp a person reads is relative ("yesterday", "3 hours ago"):
  Search, the audit trail, Alerts, Watch, the request screen (which keeps the
  exact time next to it).
- `Button` takes an `accessibilityHint` and reports its disabled state to
  TalkBack. The app has no animations, so there is nothing for reduced
  motion to turn off; any future one must check
  `AccessibilityInfo.isReduceMotionEnabled()` first.
- The entity page's lifecycle pill says **[✓ FACT-CHECKED]** for a reviewed
  page and "AI-drafted · awaiting fact-check" otherwise, where it said
  VERIFIED / "awaiting verification". This matches the owner's decision on
  #187 (no pill says "verified" any more). #187 renamed the band and the
  watchlist pill but did not touch this screen.
- Profile's identity card no longer repeats "rep 2.1 · 3 accepted"; it lives
  in the impact ledger as progress.

### Notes

- **Expected merge conflict with PR #187** (the LOW RISK rename), in two
  places, both trivial: the import line at the top of
  `app/(tabs)/watchlist.tsx` (#187 adds a `bands` import next to the line this
  change edits; keep both), and this `[Unreleased]` heading (keep both
  entries). `src/api/watchlist.ts` merges cleanly. This change reads band
  names only through `bandForPageScore(score).label`, which exists on both
  sides of the rename.
- **Reviewed before push**, and the guards it asked for are in: the shared
  watchlist and the impact ledger are dropped when the signed-in person
  changes, and a request still in flight from the previous account cannot
  write into the store. Watch never says "nothing changed" when the decision
  feed failed or its 50-row window does not reach back to the last visit. The
  home card never shows a score move from before you read the page. A re-scan
  does not call a re-linked mint a score move, and does not list added or
  removed positions for a wallet at the scan's 300-position cap. Page markers
  use the newest decision shown when the phone's clock runs slow. Two more
  logic tests cover these (12 in all).
- The queue schedule is hard-coded in `src/retention/queue-schedule.ts`. If
  the drain Routine's cron changes, that file must change with it.

### Changed (2026-09-26)

- The top trust-score band (76–100) is **LOW RISK**, no longer VERIFIED, to
  match the website. The watchlist API now returns `band: "LOW_RISK"`; this
  build shows it as `[LOW RISK]` and still accepts the old `"VERIFIED"` value
  from a server that has not been updated. Builds 0.2.1 and earlier only know
  `"VERIFIED"`, so their Watchlist tab fails to load once the server sends
  `LOW_RISK` for a followed page — install a new build after the web deploy.

## [0.2.1] — 2026-09-18

The first run on a real Solana Seeker, and the three things it broke. Plus a
feed on the Search tab: with nothing typed, the first screen of the app now
shows what the corpus has been doing instead of an empty box.

**What the device test found** (2026-09-18, Solana Seeker, mainnet-beta):

1. The EAS build carried no `EXPO_PUBLIC_SUPABASE_URL` or
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`, so neither sign-in path could complete and
   "Send link" was dead. `.env` is local and an EAS build never reads it.
2. "Connect wallet only" worked; **Sign in with Solana** failed with
   `-1/authorization request failed`. So the wallet does `authorize`, and
   refuses `authorize` with a `sign_in_payload` attached.
3. A connected wallet and a signed-in account were rendered as one state. The
   owner read the address on Profile as being signed in, then met sign-in
   prompts on every other tab.

Fixes for all three are below. **None of them has been run on a device** —
`tsc --noEmit` and `expo export --platform android` remain the only checks
that pass here, and neither proves a wallet round-trip.

### Added

- **A fallback sign-in path** (`src/solana/sign-in-with-solana.ts`). The
  original path — `authorize` with a `sign_in_payload`, one prompt for consent
  and proof — is still tried first. When the wallet throws, or authorizes
  without a `sign_in_result`, the app now falls back automatically to:
  `authorize` with no payload → build the SIWS text on the phone → MWA
  `signMessages` with the wallet's own base64 address → base64 signature →
  `supabase.auth.signInWithWeb3({chain:'solana', message, signature})`. Two
  prompts instead of one, and it is the path that matches what the Seeker
  actually did. Which path won is a `console.log`, never UI.
- `src/solana/siws-message.ts` — the SIWS message text, built here for the
  fallback. A line-for-line port of `buildSiwsMessage()` in
  `web/src/lib/siws.ts`, which is the server's own inverse of the regex it
  parses with; the two have to move together. Domain `www.avoid.net` (in the
  server's `DEFAULT_SIWS_DOMAINS`, so no env var is needed), `URI:
  https://www.avoid.net`, `Version: 1`, `Chain ID: mainnet` (not
  `mainnet-beta` — SIWS and Supabase spell it the short way, and the server
  does not check it at all), a 32-hex-character `Nonce`, and `Issued At` minted
  at the moment of signing because the server's window is ten minutes.
- `authorizeAndSignMessage()` in `src/solana/use-mobile-wallet.ts` — authorize
  without a payload, then `signMessages`. MWA returns the SIGNED PAYLOAD for an
  off-chain message, which is the message bytes with the 64-byte signature
  appended, so the signature is the tail and not the whole answer; a bare
  64-byte reply is accepted too. `ConnectedWallet` now carries
  `addressBase64`, because `signMessages({addresses})` takes base64 and
  nothing else.
- `PATCH /api/me {wallet_pubkey, siws_message, siws_signature}` is now
  actually called, immediately after a wallet sign-in succeeds. It is the only
  writer of `accounts.wallet_verified_at` and the thing that runs the Seeker
  Genesis Token and SKR reads, so without it the app had a session the server
  could not connect to a wallet — no Seeker pill, no SKR tier, no
  countersigning. A wallet-first user has no `accounts` row and the route
  answers 400 `handle required`: the proof is parked in the session provider
  and Profile asks for a handle inline, then spends it.
- **Link a wallet** for an account that signed in by email — same proof, same
  PATCH, no Supabase exchange (`proveWalletOwnership()`).
- `SignInLink` (`src/session/sign-in-link.tsx`) — the words "sign in", tappable
  and underlined, routing to the Profile tab. Rendered inline inside a
  sentence as a nested `<Text onPress>`, so it sits in the prose rather than
  under it.
- `missingSupabaseKeys()` — which `EXPO_PUBLIC_*` values this build was
  compiled without, so the Profile panel can name them.
- **Search empty state** (`app/(tabs)/index.tsx`) — three sections, rendered
  only while the query is empty and replaced by results on the first keystroke:
  - **RECENTLY UPDATED** — `GET /api/v1/investigations?sort=updated&order=desc&limit=8`,
    each row the entity, how long ago it changed and its band chip; tapping
    opens the entity screen.
  - **LATEST DECISIONS** — `GET /api/v1/activity?limit=10`, each row the
    entity, the decision in words, the score move as `58→46` when there was
    one, and a time-ago; tapping opens the entity screen. Rows whose decision
    moved no score (most rejections) show the verb alone rather than a fake
    `0→0`.
  - **DASHBOARDS** — `/data`, `/data/activity`, `/data/audit` and
    `/data/growth` on avoid.net, opened in the system browser through
    `expo-linking`. Verified to exist under `web/src/app/data` on 2026-09-18;
    they are wide cross-filtered pages and are deliberately not re-implemented
    on a phone.
- `src/api/activity.ts` — the client for the new public route, with
  `decisionLabel()` for the database's decision verbs.
- Pull-to-refresh on the Search tab, via a new optional `refreshControl` prop
  on `Screen`.
- **App icon, adaptive icon and splash** (`assets/`) — the eclipse mark from
  the X/Twitter avatar, rebuilt programmatically at 1024 rather than upscaled:
  the supplied `assets/brand/avatar-source.jpg` is 378px, its corona is clipped
  by the avatar frame (which leaves a hard rectangular edge once the background
  goes transparent) and its sky is navy, not `#0a0a0a`. Geometry and palette
  were sampled off the source — disc at 53% of width, `Ø` at 40% of disc
  height in Geist Mono 400, warm-white corona cooling outward. Ships
  `icon.png`, `adaptive-icon.png` (mark at 61.8% of the canvas, inside
  Android's 66% safe circle), `splash-icon.png` and `favicon.png`, wired
  through `expo.icon`, `expo.android.adaptiveIcon` and the `expo-splash-screen`
  plugin (`imageWidth: 200`, `resizeMode: contain`, `backgroundColor:
  #0a0a0a`). `expo-splash-screen` is a new dependency: SDK 57 dropped the
  native `expo.splash` key, leaving the config plugin as the only route.
  256px previews are in `assets/brand/preview-*.png`. Not yet seen on a
  device — `expo-doctor` (21/21) validates the sizes, not the look.

### Changed

- **`eas.json` carries the build's environment.** `preview` and `production`
  both set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_API_BASE` in an `env`
  block and name their EAS environment (`"environment": "preview"` /
  `"production"`) so the project's environment variables are injected. The
  anon key is **not** in the repo: it comes from an EAS project environment
  variable named `EXPO_PUBLIC_SUPABASE_ANON_KEY`, set on expo.dev with
  visibility "Plain text" for the preview and production environments. README
  says where to click. Adding the key to the `env` block later overrides that,
  with no code change.
- **The "not configured" panel is written for the owner**, not for an
  engineer: what is off, that browsing and scanning still work, and that the
  fix is another build (the values are inlined at bundle time, so nothing on
  the phone can switch it on). It still names the missing variables in a
  micro line, and it cannot appear when the keys are present.
- **One session model.** `useSession().signedIn` is `session !== null` and is
  the only thing any screen may gate on. A connected wallet with no session is
  shown as "Wallet connected — not signed in" with the primary button "Sign in
  with this wallet". When a session exists, every sign-in control is gone:
  Profile renders identity (handle, email, wallet, rep), the Seeker and SKR
  pills, the wallet-watch sentence and Sign out, and nothing else.
- **The Seeker and SKR pills are real.** They render `account.seeker_verified`
  and `account.skr_tier` from `/api/me`, with `wallet_watch` as a sentence
  underneath; the two placeholders and the "server-side checks land with
  migration 050" caveat are deleted. They appear only once a wallet is linked,
  because before that the server has nothing to check.
- **"Connect wallet only" is a text link** below the primary button (`tier`
  `tertiary`), kept at the owner's request but no longer competing with the
  way in.
- **No protocol code reaches the UI.** Everything the sign-in path throws is a
  `SignInFailure` carrying a sentence — "Your wallet declined the sign-in
  message", "Sign-in service not configured in this build", "Server rejected
  the signature: …", "No Solana wallet app was found on this phone" — with the
  raw code kept in `detail` and in the console. The server's six SIWS refusal
  reasons (`bad_signature`, `address_mismatch`, `domain_mismatch`, `expired`,
  `not_yet_valid`, `malformed`) are each expanded into a remedy rather than
  shown as an identifier.
- **Every "sign in" prompt audited.** Watchlist, Alerts, Search, Scan, the
  entity screen, the evidence submission gate and the request status screen now
  gate on `signedIn`, render the prompt as a `SignInLink`, and none of them
  shows one while a session exists. Two rate-limit messages that told everyone
  to sign in for a higher limit now say that only to callers who do not
  already have it (Search's daily requests, Scan's daily scans), and the
  request screen's 403 no longer tells a signed-in user to sign in.
- `refreshMe()` no longer closes over the `session` state, so the wallet path
  can read `/api/me` the instant Supabase issues a token rather than a render
  later. A call with no token still costs no Vercel invocation — `apiRequest`
  throws before the fetch.
- `APP_IDENTITY` is documented and checked: `uri` must be an absolute https
  URL and the SIWS `domain` must be its bare host. A wallet that cannot
  reconcile the two refuses the authorization and reports only
  `-1/authorization request failed`, which is a plausible second cause of what
  the Seeker showed. Both values were already correct; the check keeps them so.
- The "how this works" card moved below the new sections; it is the footer of
  the empty state now, not the whole of it.

### Notes

- **Nothing here has been run on a device.** The fallback path, the wallet
  link and the new Profile are all unexercised; `expo export` proves Metro
  bundles them and nothing more.
- **The fallback is not tried when Supabase rejects a wallet-built message.**
  Falling back there would mean a second wallet prompt for a server-side
  problem, so a Supabase refusal on path 1 is reported rather than retried. If
  the Seeker's wallet turns out to build a message Supabase dislikes, that is
  the line to change.
- **The ten-minute window is real.** `web/src/lib/siws.ts` rejects a proof
  whose `Issued At` is older than ten minutes (two minutes of clock skew
  allowed either way), which is why the message is built at the moment of
  signing and `PATCH /api/me` follows immediately. A phone with a badly wrong
  clock gets "this phone's clock is ahead of the server's" rather than
  `not_yet_valid`.
- **Two requests per app session, no polling.** Both reads are public and
  `s-maxage=300`, so the CDN serves most of them, and the result is held in a
  module-level cache for the life of the process — switching tabs and coming
  back costs nothing. A pull is the only way to refetch.
- A failed half degrades to a one-line message inside its own section (offline
  says so, and says to pull down); the other half still renders. The tab is
  never blank.
- The route this depends on is new on the web side:
  `GET /api/v1/activity` (`web/src/app/api/v1/activity/route.ts`) — the
  corpus-wide decision feed, with the same public field policy as the per-page
  audit route: no moderator keys, no submission ids, no canonical bytes.

### Fixed

- **The keyboard no longer hides the button you are typing towards** (Android,
  reported from a Solana Seeker). Under edge-to-edge — forced by Expo SDK 54+
  and by Android 15 — `adjustResize` does not resize the window any more, so
  the IME simply covered the bottom of the page: on Profile the email field
  took focus and "Send link" was behind the keys, with no way to scroll to it.
  `Screen` (`src/design/components/Screen.tsx`) now does the resize itself from
  the `keyboardDidShow` inset, and scrolls the focused field far enough that
  the control which submits it stays on screen with it; `Field` asks for that
  on focus, so moving between fields with the keyboard already open works too.
  Every screen with an input is covered by the wrapper — Search, Scan, Profile,
  submit evidence, and the notify-me field on a request — and none of them
  needed a change of their own. Also: `keyboardDismissMode="on-drag"`, a
  bottom gutter that clears the tab bar, `tabBarHideOnKeyboard` so the tab bar
  goes under the keyboard instead of floating over it (standard Android
  behaviour), and `android.softwareKeyboardLayoutMode: "resize"` written down
  in `app.json` rather than left to the Expo default. Typechecks and exports;
  like everything else here, not yet run on a device.

## [0.2.0] — 2026-09-16

Evidence submission with an on-chain countersign, the live investigation
progress screen, and the audit trail wired to the route that now exists. Still
no APK, and still nothing has been run on a device or an emulator — `tsc
--noEmit` and `expo export --platform android` are the only checks that pass.

### Added

- **Submit evidence** — `app/entity/[slug]/submit.tsx`, reached from a
  "Submit evidence" button on the Entity screen (signed-out users are sent to
  the Profile tab rather than being allowed to fail at the POST). Five kinds
  with the exact per-kind payload shape
  `web/src/app/api/submissions/route.ts` validates — `url`, `tx`,
  `address`, `account`, `claim` — plus valence, an optional note and a
  show-handle toggle defaulting to the account's `anon_by_default`. Handles
  201, the 200 duplicate (which returns the existing row and can still be
  countersigned), 429 with the wait spelled out from `retry_after_seconds`,
  and 401.
- **Countersign step** (J5 / D5) — opt-in, after a successful submission, in
  one sentence: sign a tiny Solana transaction from your wallet that vouches
  for this evidence and appears in the public audit trail with your address.
  Requires `account.wallet_verified_at` and the MWA-authorized key to be the
  same address; otherwise it explains which half is missing and offers to link
  a wallet. Builds an SPL Memo v2 instruction
  (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) with the signer as a
  read-only signer key, sends it through MWA `signAndSendTransactions`, waits
  for the cluster to confirm, then posts `POST /api/v1/attestations`.
- `src/solana/countersign.ts` — the five-step flow, and the reason the order
  matters: the signature is written to SecureStore *before* the first POST.
- `src/solana/pending-attestations.ts` — SecureStore-backed pending
  attestations keyed by `submission_id`, so a 502 (the server could not reach
  an RPC — explicitly not a verdict) or a killed app leaves a "retry
  verification" that re-posts and never sends a second transaction. Each of
  the five 422 reasons is shown in plain words, and only `tx_not_found` is
  treated as retryable.
- **Live investigation progress** — `app/request/[id].tsx`, reached from
  Search when nothing matches (and from Profile's request box). Status comes
  from a bounded poll of the public `GET /api/requests/:id` — 5s, 10s, 20s,
  stopping at five minutes with a "check again" state, ~24 requests for a full
  run — because `investigation_requests` is RLS'd to its owner and is not in
  the Realtime publication. The step-by-step timeline comes from Supabase
  Realtime on `investigation_run_events`, which the anon key *can* read
  (`FOR SELECT USING (true)`, and the table is in `supabase_realtime`).
  "Notify me when it publishes" says nothing more is needed when this phone
  has a registered push token, and otherwise collects an address for
  `PATCH /api/requests/:id {notify_email}`.
- `src/api/run-events.ts` — the run lookup, the event schema and one-line
  descriptions per `kind`, with the RLS evidence written down.
- `getRequest()`, `isRequestTerminal()` and `setNotifyEmail()` in
  `src/api/requests.ts`.
- `getRegisteredPushToken()` / `hasRegisteredPushDevice()` — the app remembers
  the token the server accepted, because `/api/v1/devices` has no `GET`.
- `withWallet` on the session context, so one MWA auth token serves every
  screen rather than one per `useMobileWallet()` call site.

### Changed

- **Audit trail on the Entity screen** now reads `getAuditPage` against
  `GET /api/v1/investigations/:slug/audit` (the route landed on 2026-09-16)
  and renders the decision, its reason, `actor_label` / `decided_by`, the
  score delta, and the anchor with an explorer link that follows
  `anchor_cluster` **on the row** — not the app's selected cluster, because
  the server's anchor worker has written to devnet while the app defaults to
  mainnet-beta. Each anchored row has a **Verify** affordance that runs
  `verifyAnchor()` on device and says whether the memo on-chain carries the
  hash the row claims.
- `src/solana/memo.ts` — `buildCountersignMemo(contentHash, slug, isoNow)` and
  `countersignMemoPrefix()` are now a line-for-line port of
  `web/src/lib/attestations.ts`, named identically and pointed at it as the
  source of truth, because the server accepts a memo only when some memo in
  the transaction starts with that exact prefix. The previous
  `buildCountersignMemoText()` lowercased the content hash, which the server's
  prefix builder does not; the transaction builder is now
  `buildCountersignTransaction()` and returns the memo text alongside it.
- `src/api/attestations.ts` — corrected to the route as written: both the 201
  and the 200 duplicate wrap the row as `{attestation}` (the client previously
  expected a bare row and would have thrown `schema_mismatch` on every
  success), `cluster` is narrowed to `mainnet-beta | devnet`, and 403 is
  documented as "not your verified wallet" rather than folded into 401.
- Search offers "Request investigation" inline when a query matches nothing,
  instead of pointing at the Profile tab.
- README's stubbed-features table rewritten against what is actually deployed.

### Known gaps

- Nothing here has been exercised on a device: no wallet round-trip, no
  Realtime socket, no push. `expo export` proves Metro resolves the bundle and
  nothing more.
- The live timeline will usually be empty. The only writer of
  `investigation_runs` / `investigation_run_events` is
  `web/src/app/api/queue/drain/route.ts`, the paid Anthropic-API path the repo
  forbids calling; the free `/drain-queue` skill publishes the finished page
  without emitting run events.
- `verifyAnchor()` still does not check the memo instruction's signer, so a
  green Verify means "this transaction carries this hash", not "this wallet
  attested to it".

## [0.1.0] — 2026-09-16

First commit. Scaffold only: it compiles, it typechecks, and no APK has been
built from it yet.

### Added

- Expo SDK 57 / React Native 0.86 / TypeScript strict app under `mobile/`,
  expo-router with a five-tab layout, Android only
  (`android.package` = `net.avoid.mobile`, dark `userInterfaceStyle`,
  `avoid://` scheme and intent filter for auth deep links).
- `src/api/` — typed client for `www.avoid.net`, base URL from
  `EXPO_PUBLIC_API_BASE`, `Authorization: Bearer <Supabase access token>`
  attached whenever a session exists. One zod schema per route, each mirrored
  from the web route handler it came from: `/api/v1/investigations`,
  `/api/v1/investigations/:slug`, `/api/v1/lookup`, `/api/search`,
  `/api/scan` + `/api/scan/:id`, `/api/me`, `/api/submissions`,
  `/api/requests`.
- Clients written against the not-yet-built §8 contract and marked as such:
  `/api/v1/watchlist`, `/api/v1/devices`, `/api/v1/feed`,
  `/api/v1/attestations`, and `PATCH /api/me` wallet linking.
- `src/solana/` — `useMobileWallet()` (MWA authorize / reauthorize /
  deauthorize with a remembered auth token), `signInWithSolana()` (MWA
  `authorize` with a SIWS `sign_in_payload`, exchanged for a Supabase session
  via the pre-signed `signInWithWeb3({chain:'solana', message, signature})`
  variant), email magic link as the fallback, `buildCountersignMemo()` and
  `verifyAnchor()` with their TODOs, and explorer links that follow the
  cluster on the row rather than the app's.
- `src/design/` — colour, spacing, radius and type tokens ported from
  `web/DESIGN.md`; both trust-score band scales ported verbatim from
  `web/src/lib/trust-bands.ts`; Geist / Geist Mono via
  `@expo-google-fonts/*` with a documented system fallback; Card with the
  severity edge bar, bracket StatusPill, dashed Buttons, the ring TrustGauge
  with the provisional caveat, BandChip, dot-grid Screen.
- `src/notifications/` — Expo push token registration posting to
  `/api/v1/devices`, Android channel with private lock-screen visibility.
- `src/session/` — one provider reconciling the Supabase session with the
  connected wallet.
- Screens: Search, Entity `[slug]` (gauge with the provisional caveat when
  `severity_base` is null, lifecycle pill, summary, sections with severity
  edge bars, timeline, sources, audit trail linking to the explorer, Follow),
  Scan (connected wallet or pasted address; `POST /api/scan` then a bounded
  backing-off poll of `GET /api/scan/:id`, max 20 tries), Watchlist, Alerts,
  Profile (wallet connect, Sign in with Solana, email link, sign out, handle
  and rep, `[SEEKER VERIFIED]` and SKR placeholders, request an
  investigation).
- `eas.json` with a `preview` profile that builds an APK and a `production`
  profile that builds an AAB.
- `.github/workflows/mobile-build.yml` — a `typecheck` job needing no secrets,
  and an EAS Build job queueing `--profile preview --non-interactive
  --no-wait`.

### Known gaps

See the "What is stubbed" table in [README.md](README.md). The largest are:
no public audit-trail route exists (§8 does not specify one), the four new
`/api/v1` routes are not deployed, `GET /api/scan/:id` still reads the cookie
session rather than the Bearer token, and no APK has been produced.
