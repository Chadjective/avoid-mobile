/**
 * Pure merge of the wallets this phone has scanned with the ones the server
 * knows from the signed-in account (GET /api/scan). No React Native imports,
 * so Node can test it (tests/scan-history.test.mjs).
 */

/** What the "scan again" card needs about a wallet. */
export type ScanAgainEntry = {
  address: string;
  scannedAt: string;
  /** Positions in the last scan, when known. */
  positions: number | null;
  /** True when this phone holds the holdings snapshot, i.e. a re-scan can show a diff. */
  onDevice: boolean;
};

type DeviceScan = { address: string; scannedAt: string; holdings: unknown[] };
type ServerScan = {
  address: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  position_count?: number | null;
};

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/**
 * De-duplicated by address, newest first. A failed server scan says nothing
 * about the wallet's holdings and is skipped. When both sides know a wallet
 * the on-device entry wins (it has the snapshot a diff needs) but takes the
 * newer time, since another phone may have scanned it since.
 */
export function mergeScanLists(device: DeviceScan[], server: ServerScan[]): ScanAgainEntry[] {
  const byAddress = new Map<string, ScanAgainEntry>();
  for (const d of device) {
    byAddress.set(d.address, {
      address: d.address,
      scannedAt: d.scannedAt,
      positions: d.holdings.length,
      onDevice: true,
    });
  }
  for (const s of server) {
    if (s.status === "failed") continue;
    const at = s.completed_at ?? s.created_at;
    const have = byAddress.get(s.address);
    if (!have) {
      byAddress.set(s.address, {
        address: s.address,
        scannedAt: at,
        positions: s.position_count ?? null,
        onDevice: false,
      });
    } else if (time(at) > time(have.scannedAt)) {
      byAddress.set(s.address, { ...have, scannedAt: at });
    }
  }
  return [...byAddress.values()].sort((a, b) => time(b.scannedAt) - time(a.scannedAt));
}
