# AVOID.NET Mobile — Demo Script (draft 4, for Android 0.2.6)

**Status:** DRAFT 4, written Thu 8 Oct 2026 (draft 3 earlier the same day) · **Build:** mobile 0.2.6 · **Install:** 8 Oct · **Record:** Fri 9 Oct · **Submit:** Sat 10 Oct (CLOCK IN deadline extended to 10 Oct; check the exact cut-off time on the CLOCK IN page)
**Length:** 2:50 target, 3:00 hard cap (Colosseum's demo limit; CLOCK IN asks for a demo video) · **Colosseum window:** 14 Sep – 12 Oct
**Pairs with:** [MOBILE_APP_SPEC.md](MOBILE_APP_SPEC.md) §1–2 · [MOBILE_DEVICE_TEST_0.2.6.md](MOBILE_DEVICE_TEST_0.2.6.md) (the device test grouped by these beats; rehearse with it) · [POSITIONING.md](POSITIONING.md) · [COLOSSEUM_PITCH_2026-10.md](COLOSSEUM_PITCH_2026-10.md)

> **One demo, two framings.** CLOCK IN weighs AI 20%, SKR 20%, UX 15%, UI 15%,
> Innovation 15% and Ecosystem 15%, so this cut leans on the phone, the wallet
> and SKR. Colosseum judges the business and only work done 14 Sep – 12 Oct; its
> 2–3 minute presentation video is a separate script. The demo file is shared.

**Do not say "35 agents" or "truth escrow" (CLAUDE.md): neither is real.**

**Changed since draft 3 (8 Oct):** wallet scans now fall back to a backup route when the paid data providers are out, so the voice-over names no vendor. Rugcheck is a second opinion only and never sets a token's rating (`web/src/lib/wallet-scan-run.ts`), so a scan never shows SKR as high risk because of Rugcheck: do not say a scan "rated SKR high" and do not point at Rugcheck on screen. Read SKR's row on the day and say only what it shows. Wallet Guardian also has an RPC polling backup (`src/bots/wallet_poller.py`); say nothing new about it. Voice-over is unchanged.

---

## 0. Before you press record

| # | Pre-condition | Check |
|---|---|---|
| P1 | Settings → Apps → AVOID.NET → Version reads **0.2.6** on the recording Seeker. | On the phone |
| P2 | Signed out, wallet app open once by hand, so beat 2 starts from the teal **Sign in with Solana** button. The wallet holds at least 69 SKR (shows **SKR HOLDER**) and was first linked more than 6 hours ago (Wallet Guardian row reads "Wallet Guardian is on"). | Profile |
| P3 | The account follows 2–3 pages and opened them a day or more ago, so Watch "What moved" and Search "Since you were here" have real content. Do not fake a change. | Watch and Search tabs |
| P4 | The demo wallet holds a few tokens, at least one with a page and one small token with a name but no page (for "Request investigation"), plus about 0.001 SOL. | Scan tab |
| P5 | The entity for beat 4 is reviewed (pill "✓ fact-checked"), not CRITICAL, with an audit row whose VERIFY returns "Matches the on-chain record." Rehearse it the day before. | Entity page |
| P6 | Push is on (Alerts → "Push notifications" switch) and one alert for a followed page is waiting to be sent while recording. A real alert is best; otherwise `node scripts/send-test-push.mjs --handle <handle> --yes` from `web/` (title reads "Test notification from AVOID.NET"; do not call it a score change). | Alerts tab |
| P7 | Screen recording 1080p, Do Not Disturb off, clock visible, battery above 50%, notification shade clear. | — |

---

## 1. The script

Times are cumulative. **Bold** = on screen. `VO:` = voice-over (about 150 words a
minute; the track is about 314 words, so about 40 s of the 170 s is silence for
taps and load time). Time it on the phone: a slow screen eats silence, not words.

### 0:00–0:20 · Hook

*Rehearsed by: T1 (device test 0.2.6).*

**Tap the AVOID.NET icon. Search tab: placeholder "Search ⟨N⟩ investigations", the feed ("Recently updated", "Recent decisions").**

VO: "Before you sign a transaction on your phone, you have about three seconds to decide whether it is a scam. AVOID.NET is a public, sourced record of what has gone wrong in crypto: more than ⟨N⟩ investigations, drafted by AI agents, fact-checked by others, and anchored on Solana."

### 0:20–0:48 · Sign in with Solana, SKR and perks (SKR 20%, UX)

*Rehearsed by: T3, T4 (device test 0.2.6).*

**Profile tab: tap the teal "Sign in with Solana" button pinned above the tab bar. The wallet sheet opens once. Back in the app: @handle at the top, the SEEKER and SKR HOLDER badges, the SKR line ("182 SKR · Holder", "50 follows · 30 scans a day · queue priority +1", "Stake 420 SKR to become a Staker"). "your perks": three batteries drain in (Scans today, Requests today, Follows, e.g. "7 of 10 left · resets in 5h"), "Queue priority +1". Tap the card: Member / Holder / Staker table. Last, the Wallet Guardian row ("Wallet Guardian is on").**

VO: "On a Seeker, sign in with one tap: the wallet connects and signs in a single step. Our server checks your Seeker Genesis Token and your SKR balance. Holders get more: fifty follows instead of ten, thirty scans a day instead of ten, and priority in the investigation queue. The meters show what you have left today."

### 0:48–1:06 · Scan this wallet (UX, ecosystem)

*Rehearsed by: T7 (device test 0.2.6).*

**Scan tab: "Scan this wallet". Result: "N tokens · N with a page · N unknown", "Wallet trust" band chip, holdings each with a band chip. Point at the small named token with no page: "Request investigation" (tap it in beat 6).**

VO: "Scan your wallet. Every token you hold is checked against the record, and the trust score is weighted by how much of your money each page covers. A token with no page yet? Ask for one."

### 1:06–1:36 · The case file, verified on the phone (UX, UI, innovation)

*Rehearsed by: T9, T11, T12 (device test 0.2.6).*

**Open a held token's page. Gauge, band chip, pill "✓ fact-checked". The 2×2 actions: Follow, Submit evidence, Update this page. "Contents · N sources · N events": tap a section to jump. Sources are collapsed ("Sources (N) [+]"). Scroll to Audit trail: "Recorded on Solana · N decisions", `#N REVIEW REVISE -7`, the chain icon and "Recorded on Solana ✓", then tap VERIFY: "Matches the on-chain record."**

VO: "Every page is a case file: a score, a fact-check status, sections you can jump to, and sources behind a tap. The audit trail records each decision on Solana. Tap verify, and the phone fetches the transaction from the chain itself and compares the hash. No AVOID.NET server in the loop."

### 1:36–1:54 · Follow, and what moved (UX)

*Rehearsed by: T13 (T14 for the Search shot) (device test 0.2.6).*

**Tap Follow: "✓ Following". Watch tab: the "What moved since …" card (score, decisions, tap through to the page). Search tab: the "Since you were here …" card, tap to expand [+], the pages behind its counts.**

VO: "Follow a page, and the Watch tab leads with what moved since you last looked. Search tells you what changed since you were here, and opens the pages behind the numbers."

### 1:54–2:18 · Ask for what is not there, and get told (AI 20%)

*Rehearsed by: T15, T17 (device test 0.2.6).*

**Scan tab: tap "Request investigation" under the unknown token. Request screen: the cyan countdown arc with m:ss, "You're #N in line", the Queued / Researching / Published bar, "Runs every 4 hours, up to 10 requests each, signed-in first." Cut to the lock screen: the alert, tap it, the page opens.**

VO: "Not there? Ask. The request joins a queue that AI agents drain every four hours, and the screen shows the real countdown and your place in line. When something you follow changes, the phone alerts you. Tap it, and the page opens."

### 2:18–2:40 · Submit evidence and countersign (innovation, ecosystem)

*Rehearsed by: T18 (device test 0.2.6).*

**Entity page → Submit evidence (a URL) → "Submitted" with Submitted / Under review / Decided. "Countersign (optional)" → "Countersign on-chain" → the wallet approval sheet → "countersigned", "Recorded in the audit trail."**

VO: "Evidence comes from the community too. Submit a source, then countersign it from your own wallet: a small memo transaction that vouches for that exact evidence and lands in the public audit trail. Distinct signers are countable on-chain."

### 2:40–2:50 · Close

*Rehearsed by: none gate it; T19 is a fix check (device test 0.2.6).*

**Profile → "Your activity" (requests, evidence, scans), then the tab bar and the logo.**

VO: "AVOID.NET. Check before you sign, on the phone you sign with."

**VO word count: 314 (target about 320, hard ceiling 410).**

---

## 2. Talking points per judging criterion (form and Q&A)

| Criterion | Weight | What to point at |
|---|---|---|
| **AI** | 20% | The corpus is agent-built end to end: scout → investigator → reviewer → judge. App requests enter the queue that agents drain every four hours; fact-check verdicts carry score deltas and are anchored. The MCP server (`/api/v1/mcp`) lets other agents query the record. Be candid that the score is LLM-written on most pages today (POSITIONING "where it is weak"). |
| **SKR integration** | 20% | Server-side Seeker Genesis Token check (Token-2022 mint authority, metadata and group) and SKR balance read at sign-in. Holder (69 SKR or more, liquid plus staked) gets 50 follows instead of 10, 30 scans a day instead of 10, queue priority +1; the Profile SKR line and "your perks" meters show it. Staker perks (420 staked) run only once the server sets `SKR_STAKER_WINDOW_START`; until then a staker gets holder perks. |
| **UX** | 15% | One-tap SIWS (connect and sign together); wallet scan with no typing; "Since you were here" and "What moved" on arrival; every change links to its reason; tap a notification and the page opens; tab bar on every page. |
| **UI** | 15% | The dossier-in-a-terminal design system ported from the web: dashed borders, mono data, band colours, tab icons, teal wallet buttons styled after the Seeker's own sheet. |
| **Innovation** | 15% | User-signed countersign memos: a public, on-chain count of distinct wallets vouching for one piece of evidence (a count, not proof of independent people). On-device anchor verification (compares the memo's hash; it does not check which key signed). |
| **Ecosystem impact** | 15% | A free, public, citable record; a free JSON API and MCP server; a wallet scan any Seeker owner can run before signing. |

---

## 3. Prior-work disclosure (MOBILE_APP_SPEC D9)

Paste the same paragraph into CLOCK IN's "New mobile development" field and Colosseum's prior-work field.

> **Prior work.** AVOID.NET's web platform — the avoid.net site, the
> investigation pipeline (scout, investigator, reviewer and judge agents), the
> Supabase database, and the Solana SPL Memo anchoring of page decisions —
> predates both hackathons and was submitted to Colosseum Frontier on 11 May
> 2026 (10:50 PM PDT) by the founder alone, as a team of one. **Built during this
> hackathon (14 Sep – 12 Oct 2026):** the entire Android app in `mobile/`
> (started 16 Sep, first commit on main 17 Sep; every change dated in
> `mobile/CHANGELOG.md`, versions 0.2.0 to 0.2.6), including Sign in with Solana
> over Mobile Wallet Adapter, the wallet scan screen, follow and push alerts,
> on-device anchor verification, user-signed evidence countersigns, the "since
> you were here" and "what moved" views, the live request screen, and the SKR
> line and "your perks" meters; database migrations 050–055, 066 and 071
> (wallet identity, watchlist, push devices, notification outbox, evidence
> attestations, request notifications, Request update, SKR amounts); the
> Bearer-token auth path and the `/api/v1` watchlist, devices, feed,
> attestations, activity and stats routes; the Seeker Genesis Token and SKR
> checks; and the notification dispatcher plus the watchlist-alert and
> fulfilment bots on Railway. The Telegram answer bot is written, not deployed.

---

## 4. Recording day checklist

**The day before (Thu 8 Oct)**

- [ ] All [Demo] tests in MOBILE_DEVICE_TEST_0.2.6.md passed, or their beats swapped/cut.
- [ ] 0.2.6 installed on the recording Seeker (P1); version noted: ______
- [ ] Sign-in rehearsed from signed out; SEEKER and SKR HOLDER badges, SKR line, batteries and Wallet Guardian row all show (P2).
- [ ] 2–3 pages followed, opened a day ago; Watch and Search cards have content (P3).
- [ ] Entity chosen: ______ (reviewed, not CRITICAL, VERIFY matches) (P5). Unknown-token holding present in the wallet (P4).
- [ ] Evidence URL drafted for beat 7; about 0.001 SOL in the wallet.
- [ ] Push on; the alert for the lock-screen clip lined up (P6).

**Morning of (Fri 9 Oct)**

- [ ] Read ⟨N⟩ from the Search tab placeholder "Search N investigations"; write the round number to say ("more than ..."): ______
- [ ] Charge above 50%, 1080p, Do Not Disturb off, shade clear, on Wi-Fi with a hotspot ready.
- [ ] Script open on a second screen; timer running.

**Takes**

- [ ] Record each beat twice, separately, so any beat can be swapped.
- [ ] Full run at 2:50 or under; actual: ______ · Lock-screen push and countersign recorded on their own too.

**Before you stop**

- [ ] Total at most 3:00 with captions; no number spoken that is not in §5; no "35 agents", no "truth escrow".
- [ ] No API key, email address, private balance or other app's notification visible.
- [ ] Watch it once on a phone screen; save a copy off the phone. Submit by Sat 10 Oct, well before the cut-off on the CLOCK IN page.

---

## 5. Facts checked (against code on this branch, 8 Oct)

| Claim | Source |
|---|---|
| Version 0.2.6 | `mobile/package.json`, `mobile/app.json`; `mobile/CHANGELOG.md` 0.2.6 |
| "Search ⟨N⟩ investigations" placeholder (published total) | `mobile/app/(tabs)/index.tsx` (`feed.total`) |
| Since you were here card, expandable [+]/[−] | `mobile/src/retention/components.tsx` `SinceLastVisitCard` |
| "What moved since …" card | same file `WhatMovedCard`; used in `mobile/app/(tabs)/watchlist.tsx` |
| Teal one-trip sign-in, @handle, SEEKER and "SKR holder" pills (rendered uppercase) | `mobile/app/(tabs)/profile.tsx`, `mobile/src/design/components/WalletButton.tsx`, `StatusPill.tsx` |
| Holder 69 SKR, staker 420 | `DEFAULT_SKR_HOLDER_MIN`, `DEFAULT_SKR_STAKER_MIN` in `web/src/lib/seeker.ts` |
| Member 10 scans / 10 requests / 10 follows; holder 30 / 15 / 50, queue +1; staker 50 / 25 / 200, +2; staker window 99 days | `TIER_TABLE`, `STAKER_WINDOW_DAYS`, `SKR_STAKER_WINDOW_START` in `web/src/lib/entitlements.ts`; mirror `SKR_PERKS` in `mobile/src/session/skr.ts` |
| Batteries (Scans today, Requests today, Follows), amber at 30% or less, tap-to-compare | `mobile/src/perks/PerksCard.tsx`, `mobile/src/session/perks.ts` (`LOW_FRACTION`) |
| "Wallet Guardian is on" / "starts within 6 hours" | `mobile/src/session/wallet-watch.ts` |
| "Scan this wallet", "Wallet trust" chip, "N tokens · N with a page · N unknown", exposure-weighted score, "Request investigation" on unknown tokens | `mobile/app/(tabs)/scan.tsx` `ScanResult`, `HoldingCard`; `web/src/lib/wallet-scan.ts` ("Exposure-weighted mean trust score") |
| Pill "✓ fact-checked"; 2×2 actions; "✓ Following"; Contents heading | `mobile/app/(tabs)/entity/[slug].tsx` `lifecycleLabel`; `mobile/src/page/format.ts` `contentsHeading` |
| Bands CRITICAL / WARNING / CAUTIONARY / LOW RISK | `mobile/src/design/bands.ts` |
| "Recorded on Solana ✓", "Recorded on Solana · N decisions", VERIFY → "Matches the on-chain record." (hash only; phone fetches the tx itself) | `mobile/src/page/format.ts`, `[slug].tsx` `verdictText`, `mobile/src/solana/verify-anchor.ts` |
| Request screen: arc, "You're #N in line", Queued / Researching / Published; "Runs every 4 hours, up to 10 requests each, signed-in first"; drains at 00/04/08/12/16/20 UTC | `mobile/app/(tabs)/request/[id].tsx`; `mobile/src/retention/request-progress.ts` (`REQUEST_STAGES`); `queue-schedule.ts` (`DRAIN_HOURS_UTC`, `DRAIN_BATCH`); `docs/CRON_RUNBOOK.md` |
| Tapped notification opens the page (cold start and running); digest opens Alerts | `mobile/src/notifications/tap.ts`, `route.ts` |
| Submit evidence, "Countersign (optional)", "Countersign on-chain", "countersigned", "Recorded in the audit trail." (about 0.000005 SOL) | `mobile/app/(tabs)/entity/[slug]/submit.tsx`; `mobile/src/solana/countersign.ts` (`signAndSendTransactions`, then `POST /api/v1/attestations`) |
| "Your activity" on Profile; "Follow @0xavoid on X" | `mobile/src/retention/ImpactLedger.tsx` |
| MCP server | `web/src/app/api/v1/mcp` |
| Not verifiable in code (carried from draft 2 / founder): first commit on main 17 Sep (this checkout is shallow; earliest visible is 3 Oct); Telegram bot not deployed | `git log`; founder, 5 Oct |

**VO word count:** 314, counted with `grep '^VO:' docs/MOBILE_DEMO_SCRIPT.md | sed 's/^VO://' | wc -w`; re-run after any edit.

---

## 6. If a beat misbehaves on the day

| Beat | Swap-in |
|---|---|
| 2 sign-in (T3, T4) | Retry once; else Profile → "Or use email" (loses SEEKER and SKR badges; say only what the server grants) |
| 3 scan (T7) | Paste an address into the field and tap "Scan"; say "Paste any address" |
| 4 case file and verify (T9, T11, T12) | Pick another page with a mainnet anchored row; never show an error |
| 5 what moved (T13, T14) | Show Follow → "✓ Following" and the plain Watch list; say nothing moved |
| 6 request / push (T15, T17) | Request a made-up name from Search ("No page for … yet"); use the pre-recorded push clip |
| 7 countersign (T18) | Reuse the separate countersign take; never simulate the wallet sheet |
| 1 hook (T1) | Open on the Search tab and say "a public record of what has gone wrong in crypto" without the number |
| Overall | Cut the Wallet Guardian and tier-table shots first; then the Search "Since you were here" shot |
