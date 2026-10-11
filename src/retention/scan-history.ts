/**
 * The signed-in account's scan history, once per app session.
 *
 * `GET /api/scan` is one billed invocation (CLAUDE.md), so the Scan tab reads
 * it at most once per app process, like src/retention/activity-cache.ts, and
 * again only after a sign-in change (resetScanHistory, called by the session
 * provider) so one account's wallets never show under another.
 *
 * The server keeps the address and the summary, NOT the holdings snapshot a
 * re-scan diff needs: that stays on the phone (src/retention/memory.ts). For a
 * wallet known only from the server, the first re-scan on this phone therefore
 * shows no diff; it is stored afterwards and the next one does.
 */
import { listMyScans } from "../api/scan";
import type { ScanHistoryRow } from "../api/types";

let cached: ScanHistoryRow[] | null = null;
let inFlight: Promise<ScanHistoryRow[]> | null = null;

export function getScanHistory(): Promise<ScanHistoryRow[]> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  inFlight = listMyScans()
    .then((rows) => {
      cached = rows;
      return rows;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function resetScanHistory(): void {
  cached = null;
}
