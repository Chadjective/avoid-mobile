/**
 * When to offer "request an investigation" beside search results. Mirrors
 * web/src/lib/request-offer.ts (separate package, so a copy): offer it for any
 * query of 2+ characters unless a result's name or slug IS the query, so fuzzy
 * near-misses no longer hide it.
 */

export const MIN_REQUEST_QUERY = 2;

const norm = (s: string) => s.trim().toLowerCase();
const slugify = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type Named = { slug: string; entity_name: string };

export function hasExactMatch(query: string, results: ReadonlyArray<Named>): boolean {
  const q = norm(query);
  if (!q) return false;
  const qSlug = slugify(query);
  return results.some(
    (r) => norm(r.entity_name) === q || norm(r.slug) === q || (qSlug !== "" && norm(r.slug) === qSlug),
  );
}

export function shouldOfferRequest(query: string, results: ReadonlyArray<Named>): boolean {
  return query.trim().length >= MIN_REQUEST_QUERY && !hasExactMatch(query, results);
}

type ScanHolding = {
  symbol: string | null;
  name: string | null;
  mint: string;
  slug: string | null;
  flags: ReadonlyArray<string>;
};

/**
 * Scan: a token with no page (NO_PAGE) can be asked for, unless it is dust or
 * has neither a symbol nor a name to ask about (a bare mint is not a request).
 */
export function canRequestHoldingPage(h: ScanHolding): boolean {
  if (h.slug || !h.flags.includes("no_page") || h.flags.includes("dust")) return false;
  return !!(h.symbol?.trim() || h.name?.trim());
}

/** What the request is about, and the context that pins it to one token. */
export function holdingRequest(h: ScanHolding): { entity: string; context: string } {
  const symbol = h.symbol?.trim() || "";
  const name = h.name?.trim() || "";
  const entity = symbol || name || `Token ${h.mint.slice(0, 8)}`;
  const label = symbol && name && symbol !== name ? `${name} (${symbol})` : entity;
  return { entity, context: `Solana token ${label}, mint ${h.mint}. Found in a wallet scan.` };
}
