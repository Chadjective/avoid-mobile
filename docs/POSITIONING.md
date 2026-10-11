# AVOID.NET — Positioning

**Status:** draft for founder edit · **Written:** 2026-09-23 · **Prompted by:** advisor call with Ezra (Mercator), 2026-09-22, where "how are you different from Chainalysis / TRM?" had no ready answer.

Every claim below is checked against the codebase as of this date. Do not add a
number or a feature here that is not verifiable in code or the database.

---

## The one-paragraph version

AVOID.NET is a public, cited record of what has gone wrong in crypto — exchanges,
tokens, protocols and people — written by agents, fact-checked by other agents,
and readable by anyone or any agent for free. Chainalysis, TRM and Elliptic sell
private forensics to compliance teams and governments: they follow the money
across wallets, and their output is a report you pay for and cannot cite. GoPlus,
RugCheck and Token Sniffer scan a contract at the moment you ask and tell you
about *that contract*. AVOID.NET sits between them: it is not wallet forensics and
not a contract scanner, it is the historical record — every finding tied to a
source, every page's history anchored on Solana so it cannot be quietly rewritten,
and every source snapshotted to the Wayback Machine so the evidence outlives the
page it came from. We don't ask you to trust our score. We show you what we found,
where, and when, and let you or your agent decide.

## The comparison, point by point

| | Chainalysis / TRM / Elliptic | GoPlus / RugCheck / Token Sniffer | AVOID.NET |
|---|---|---|---|
| **What it is** | Wallet-flow forensics and sanctions screening | Point-in-time contract scanner | Sourced historical record with a trust score |
| **Customer** | Compliance teams, exchanges, governments | Retail traders at the moment of buying | People and agents doing due diligence; compliance as a second reader |
| **Unit of analysis** | Wallets and flows | One token contract | An entity: exchange, token, protocol, person |
| **Output** | Private report / API, not citable | Red/green flags per contract | Public page with cited sections, timeline, addresses, score |
| **Provenance** | Proprietary | None | Page history anchored on Solana (SPL Memo); sources archived to Wayback |
| **Access** | Enterprise contract | Free tool | Free web, free JSON API, free MCP server (agents query it directly) |
| **Posture** | "Trust us" | "Trust the scanner" | "Here is the evidence; decide for yourself" |

## What we deliberately do not do

- **Sanctions and illicit-flow tracing.** That is Chainalysis/TRM territory, the most
  regulated corner, and the one where a false positive does real harm
  (`docs/SIGNALS_DETECTOR_FAMILY.md` §3, row 8).
- **New-token launch scanning.** Commoditised; three free tools already do it well
  (same doc, row 7).
- **Real-time trading signals.** The record can feed a daily watch, but an alert
  that says "sell" is a liability we are not taking on. See `docs/ROADMAP.md`,
  decision D1.

## What makes the record hard to copy

1. **Receipts, not opinions.** Every section on a page cites a source, and the
   credibility of each citation (court/regulator, press, blog, social) is recorded.
2. **Tamper evidence.** Page decisions are written to Solana via SPL Memo, so the
   history of a page is public and cannot be edited after the fact.
3. **Sources that survive.** Cited URLs are archived to the Wayback Machine, so a
   deleted blog post or scrubbed announcement stays in the record.
4. **Agent-native.** The MCP server and JSON API mean an agent can ask
   "what do you know about X" without scraping. (Check `/data/api` for the
   current agent-vs-browser split before quoting a share out loud.)
5. **Corpus.** 1,757 published investigations as of 2026-09-23 (1,935 including
   drafts), built by a queue of scout → investigator → reviewer → judge agents.

## Where the positioning is still weak (be honest about this in the room)

- **The score is subjective.** It is LLM-written on most pages today; the
  deterministic scorer covers a small minority. Scoring v2 (attribution of
  *perpetrated* vs *suffered*) is designed and not built. Until then, lead with
  the evidence, not the number.
- **Coverage is uneven.** A meaningful share of pages are thin. Say "record",
  not "complete record".
- **No source-quality layer yet.** Ezra's suggestion — rate the *coverage* (is
  the buzz from CoinDesk or from fifty week-old accounts?) — is the most
  differentiated thing on the roadmap and does not exist yet.

## Talking points, in one line each

- "We are the sober second opinion — the counterweight to the pitch deck."
- "Chainalysis follows the money. We keep the receipts."
- "Not a verdict, a record: here is what we found, where, and when."
- "Agents already read us more than people do. That's the customer we found, not the one we planned."
