/**
 * Public reads. CDN-cached for five minutes at the edge, so these cost the
 * project nothing per request when the cache serves them — the reason the app
 * reads through /api/v1 rather than Supabase directly.
 */
import { apiRequest } from "./client";
import {
  investigationDetailResponseSchema,
  investigationListResponseSchema,
  lookupResponseSchema,
  type InvestigationDetail,
  type InvestigationListItem,
  type LookupMatch,
} from "./types";

/** GET /api/v1/investigations */
export async function listInvestigations(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  sort?: "updated" | "name";
  order?: "asc" | "desc";
}): Promise<{ investigations: InvestigationListItem[]; total: number }> {
  const res = await apiRequest("/api/v1/investigations", {
    schema: investigationListResponseSchema,
    auth: "none",
    query: {
      limit: params?.limit,
      offset: params?.offset,
      search: params?.search,
      status: params?.status,
      sort: params?.sort,
      order: params?.order,
    },
  });
  return { investigations: res.investigations, total: res.total };
}

/** GET /api/v1/investigations/:slug — 404 when the slug has no page. */
export async function getInvestigation(
  slug: string,
): Promise<InvestigationDetail & { follower_count: number | null }> {
  const res = await apiRequest(`/api/v1/investigations/${encodeURIComponent(slug)}`, {
    schema: investigationDetailResponseSchema,
    auth: "none",
  });
  return { ...res.investigation, follower_count: res.follower_count ?? null };
}

/** GET /api/v1/lookup?address= or ?entity= */
export async function lookup(params: {
  address?: string;
  entity?: string;
}): Promise<LookupMatch[]> {
  const res = await apiRequest("/api/v1/lookup", {
    schema: lookupResponseSchema,
    auth: "none",
    query: { address: params.address, entity: params.entity },
  });
  return res.matches;
}
