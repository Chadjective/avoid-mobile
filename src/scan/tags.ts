/**
 * Plain-words labels for a scan holding's flags. Pure (no React Native), so
 * tests/scan-tags.test.mjs runs it under node.
 *
 * The server's flags (web/src/lib/wallet-scan.ts HoldingFlag) are machine tags
 * (NO_PAGE, DUST, ...). The Scan screen shows words instead, joined by " · ".
 * `dust` is dropped on purpose: the UI has no dust rule, and a "dust" label
 * invited the reading that small tokens do not matter.
 */

const WORDS: Record<string, string | null> = {
  no_page: "No page yet",
  well_known: "Well-known token",
  possible_match: "may match an existing page",
  unpriced: "no price found",
  dust: null,
  baseline_pending: "check pending",
  goplus_high: "contract scan: high risk",
  goplus_medium: "contract scan: some risk",
  request_created: "request sent",
  request_bumped: "already requested",
};

/** Flags in, display words out; unknown flags are skipped, never shown raw. */
export function holdingTagWords(flags: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  for (const flag of flags) {
    const word = WORDS[flag.toLowerCase()];
    if (word && !out.includes(word)) out.push(word);
  }
  return out;
}

export function holdingTagLine(flags: ReadonlyArray<string>): string {
  return holdingTagWords(flags).join(" · ");
}

type RequestableHolding = {
  symbol: string | null;
  name: string | null;
  slug: string | null;
  flags: ReadonlyArray<string>;
};

/**
 * Any token with no page can be asked for, whatever its value, named or not:
 * an unnamed mint is filed as "Token <first 8 of the mint>" with the full mint
 * in the context (lib/wallet-scan.ts entityNameFor names automatic rows the same).
 */
export function canRequestHolding(h: RequestableHolding): boolean {
  return !h.slug && h.flags.includes("no_page");
}
