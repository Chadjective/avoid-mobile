/**
 * The live agent event log for an investigation request (J4).
 *
 * THE RLS FINDING, because it decides the whole design of this module.
 * `web/supabase/migrations/015_investigation_requests_and_runs.sql` ends with
 *
 *     ALTER TABLE investigation_run_events ENABLE ROW LEVEL SECURITY;
 *     CREATE POLICY "Public read run events" ON investigation_run_events
 *       FOR SELECT USING (true);
 *     ALTER PUBLICATION supabase_realtime ADD TABLE investigation_run_events;
 *
 * `USING (true)` — the anon key CAN select every row, and the table is in the
 * Realtime publication, so a `postgres_changes` subscription on it works with
 * the public key this app already ships. `investigation_runs` carries the same
 * `FOR SELECT USING (true)` policy.
 *
 * WHAT IS NOT COVERED, and why the screen still polls.
 *   1. Events are keyed by `run_id`, not by request id. The run has to be
 *      looked up first, and `investigation_runs` is NOT in the Realtime
 *      publication — so a run STARTING is not pushed to anyone.
 *   2. `investigation_requests` is RLS'd to the owning account
 *      ("Owners read own requests"), is not in the publication either, and is
 *      what carries the status the user actually asked about. Its status comes
 *      from `GET /api/requests/:id`, which is public.
 *   3. In production nothing writes these tables for a user request at all:
 *      the only writer of `investigation_runs` was the paid Anthropic-API
 *      route `/api/queue/drain`, deleted in T0.5, so the table receives no
 *      new rows. The free `/drain-queue` Claude Code path
 *      publishes the investigation without emitting run events. So the live
 *      timeline is a bonus when it is there and must never be the only thing
 *      the screen has to show.
 *
 * Hence: Realtime for the timeline, a bounded poll of the public status route
 * for the answer. This is also the one module that reads Supabase directly —
 * src/api/supabase.ts reserves that for "one Realtime channel", and the run
 * lookup below is the same channel's key, with no HTTP route to get it from.
 */
import { z } from "zod";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

/** The `kind` CHECK constraint in migration 015, verbatim. */
export const RUN_EVENT_KINDS = [
  "search_started",
  "search_result",
  "source_read",
  "section_drafted",
  "timeline_event",
  "anchor_emitted",
  "done",
  "error",
  "note",
] as const;

export const runEventSchema = z.object({
  run_id: z.string(),
  seq: z.number(),
  kind: z.string(),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string(),
});
export type RunEvent = z.infer<typeof runEventSchema>;

/** One human line per event kind. `data`'s shape per kind is in migration 015. */
export function describeRunEvent(event: RunEvent): string {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const str = (key: string): string | null =>
    typeof data[key] === "string" ? (data[key] as string) : null;

  switch (event.kind) {
    case "search_started":
      return `searching — ${str("query") ?? "…"}`;
    case "search_result": {
      const count = typeof data.result_count === "number" ? data.result_count : null;
      return `${count ?? "some"} results for ${str("query") ?? "that search"}`;
    }
    case "source_read":
      return `read ${str("title") ?? str("url") ?? "a source"}`;
    case "section_drafted":
      return `drafted “${str("heading") ?? "a section"}”`;
    case "timeline_event":
      return `timeline — ${str("date") ?? ""} ${str("event") ?? ""}`.trim();
    case "anchor_emitted":
      return `anchored decision ${typeof data.sequence_num === "number" ? `#${data.sequence_num}` : ""}`.trim();
    case "done":
      return `published ${str("slug") ?? "the page"}`;
    case "error":
      return `error — ${str("message") ?? "the run stopped"}`;
    case "note":
      return str("text") ?? "note";
    default:
      return event.kind;
  }
}

/** The most recent run for a request, or null. Public-read table. */
export async function getLatestRunId(requestId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase()
    .from("investigation_runs")
    .select("id")
    .eq("request_id", requestId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** Every event already written for a run, oldest first. */
export async function getRunEvents(runId: string): Promise<RunEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from("investigation_run_events")
    .select("run_id, seq, kind, data, created_at")
    .eq("run_id", runId)
    .order("seq", { ascending: true });
  if (error || !data) return [];
  const parsed = z.array(runEventSchema).safeParse(data);
  return parsed.success ? parsed.data : [];
}

/**
 * Subscribe to inserts on one run. Returns an unsubscribe function; calling it
 * twice is safe. No-op (and no channel) when Supabase is not configured.
 *
 * Realtime is a websocket, not an HTTP request per update, so it costs no
 * Vercel invocations at all — which is the reason the CLAUDE.md polling rule
 * points here first.
 */
export function subscribeToRunEvents(
  runId: string,
  onEvent: (event: RunEvent) => void,
): () => void {
  if (!isSupabaseConfigured()) return () => {};

  let channel: RealtimeChannel | null = null;
  try {
    channel = getSupabase()
      .channel(`run-events:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "investigation_run_events",
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const parsed = runEventSchema.safeParse(payload.new);
          if (parsed.success) onEvent(parsed.data);
        },
      )
      .subscribe();
  } catch {
    // A Realtime failure must never take the status screen down with it.
    return () => {};
  }

  const current = channel;
  return () => {
    if (!current) return;
    try {
      void getSupabase().removeChannel(current);
    } catch {
      // Already gone.
    }
  };
}
