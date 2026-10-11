import { apiRequest } from "./client";
import { searchResponseSchema, type SearchSuggestion } from "./types";

/**
 * GET /api/search?q= — the same endpoint the website's search box uses, which
 * falls back to the `entities` table so a wallet address or a domain finds the
 * page it is mentioned on. Returns [] for an empty query without a round trip.
 */
export async function search(q: string, signal?: AbortSignal): Promise<SearchSuggestion[]> {
  const query = q.trim();
  if (query.length === 0) return [];
  const res = await apiRequest("/api/search", {
    schema: searchResponseSchema,
    auth: "none",
    query: { q: query },
    signal,
  });
  return res.results;
}
