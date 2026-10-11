/**
 * Wallet risk scan. docs/WALLET_SCAN_SPEC.md §3, §7, §9.
 *
 * The address travels in the request BODY, never the URL — `withApiLogging`
 * records the query string, so a URL parameter would land in `api_logs`. Keep
 * it that way.
 */
import { apiRequest, ApiError } from "./client";
import {
  scanCreateResponseSchema,
  scanReportSchema,
  scanHistoryResponseSchema,
  type ScanHistoryRow,
  type ScanCreateResponse,
  type ScanReport,
} from "./types";

/** POST /api/scan — 201 for a fresh scan, 200 with duplicate:true otherwise. */
export async function startScan(address: string): Promise<ScanCreateResponse> {
  try {
    return await apiRequest("/api/scan", {
      method: "POST",
      body: { address: address.trim() },
      schema: scanCreateResponseSchema,
      auth: "optional",
      // The route runs Vybe plus up to 25 GoPlus calls; maxDuration is 60s.
      timeoutMs: 70_000,
    });
  } catch (err) {
    // A scan that failed upstream is a 502 `{id, status:"failed", error:
    // "scan_failed"}`, not a 2xx. It is an answer, not a transport error:
    // hand it back so the screen's "failed" branch (unreachable while this
    // threw) gives the friendly message instead of the raw code.
    if (err instanceof ApiError && err.status === 502) {
      const body = scanCreateResponseSchema.safeParse(err.body);
      if (body.success && body.data.status === "failed") return body.data;
    }
    throw err;
  }
}

/**
 * GET /api/scan — the signed-in account's last 10 scans (401 when signed out).
 * The address comes back in the body; the request carries none.
 */
export async function listMyScans(): Promise<ScanHistoryRow[]> {
  const res = await apiRequest("/api/scan", { schema: scanHistoryResponseSchema, auth: "required" });
  return res.scans;
}

/**
 * GET /api/scan/:id — 404 when it is not yours, 410 once an anonymous scan
 * has expired.
 *
 * Reads the session with `getCurrentAccountFromRequest()` (Bearer or cookie),
 * so an account-bound scan is readable with the app's token.
 */
export async function getScan(id: string): Promise<ScanReport> {
  return apiRequest(`/api/scan/${encodeURIComponent(id)}`, {
    schema: scanReportSchema,
    auth: "optional",
  });
}

const TERMINAL: ReadonlySet<string> = new Set(["complete", "partial", "failed"]);

export function isScanTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

/**
 * Poll a scan to completion — bounded, with backoff.
 *
 * web/CLAUDE.md: every request is a billed Vercel invocation, and the web
 * app's own pollers must be bounded and back off (lib/use-poll.ts). This is the
 * app's equivalent: at most `maxTries` requests, delay growing 1.5× from 1s to
 * a 8s ceiling, and it gives up rather than polling forever.
 */
export async function pollScan(
  id: string,
  options?: {
    maxTries?: number;
    onUpdate?: (report: ScanReport, attempt: number) => void;
    signal?: AbortSignal;
  },
): Promise<ScanReport> {
  const maxTries = options?.maxTries ?? 20;
  let delay = 1000;

  let last: ScanReport | null = null;
  for (let attempt = 1; attempt <= maxTries; attempt += 1) {
    if (options?.signal?.aborted) throw new ApiError(0, "Cancelled", "aborted", null);

    const report = await getScan(id);
    last = report;
    options?.onUpdate?.(report, attempt);
    if (isScanTerminal(report.scan.status)) return report;

    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), 8000);
  }

  if (last) return last;
  throw new ApiError(504, `Scan ${id} did not finish in ${maxTries} tries.`, "poll_exhausted", null);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
