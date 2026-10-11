/**
 * Headline platform numbers — the same five the website's /data page leads
 * with. `GET /api/v1/stats` (web/src/app/api/v1/stats/route.ts): public, no
 * auth, `s-maxage=3600`, read from the snapshot /data already renders from.
 *
 * Nothing here is computed on the phone and nothing is hardcoded; the source
 * figures are null when the server could not scan the corpus, and the card
 * shows a dash rather than a made-up 0%.
 */
import { z } from "zod";
import { apiRequest } from "./client";

export const platformStatsSchema = z.object({
  investigations: z.number(),
  reviewed: z.number(),
  anchors: z.number(),
  sources_archived: z.number().nullable(),
  sources_total: z.number().nullable(),
  sources_coverage: z.enum(["exact", "sample", "unavailable"]),
  requests: z.number(),
});
export type PlatformStats = z.infer<typeof platformStatsSchema>;

export function getPlatformStats(signal?: AbortSignal): Promise<PlatformStats> {
  return apiRequest("/api/v1/stats", {
    schema: platformStatsSchema,
    auth: "none",
    signal,
  });
}

/** "78.3%" — one decimal, as the website's fmtPct — or null when unknown. */
export function archivedPercent(stats: PlatformStats): string | null {
  const { sources_archived: archived, sources_total: total } = stats;
  if (archived === null || total === null || total === 0) return null;
  return `${((archived / total) * 100).toFixed(1)}%`;
}
