// ============================================================================
// leadTime.ts — normalize the overloaded lead_time / "Due date" field for
// customer-facing display.
// ----------------------------------------------------------------------------
// The editor's "Due date" field accepts EITHER a duration ("2 weeks") OR a due
// date ("2026-08-01"), and spreadsheet imports have historically leaked raw
// Excel date serials (e.g. 46232.79…) into it. Any of those must never reach a
// customer verbatim. This turns them into a clean string; unusable input yields
// kind:'none' so callers can omit the line entirely.
//
// NOTE: generateQuotePdf.mjs (server-side, standalone .mjs in the Vercel API
// bundle) intentionally mirrors this logic inline rather than importing it, to
// avoid adding a new dependency into that bundle. Keep the two in sync.
// ============================================================================

export type LeadTimeKind = 'date' | 'duration' | 'none';

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30); // Excel serial day 0 = 1899-12-30
const DAY_MS = 86_400_000;

function fmtDate(d: Date): string {
  // UTC to match how the serial/ISO value is constructed (avoids off-by-one-day
  // drift in negative-offset timezones).
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export function normalizeLeadTime(raw: unknown): { text: string; kind: LeadTimeKind } {
  if (raw == null) return { text: '', kind: 'none' };
  const s = String(raw).trim();
  if (!s) return { text: '', kind: 'none' };

  // Pure number → treat as an Excel date serial, but only within a sane range
  // (~1954–2146) so a stray small number isn't misread as a 1900-era date.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n >= 20_000 && n <= 90_000) {
      const d = new Date(EXCEL_EPOCH_MS + Math.round(n) * DAY_MS);
      if (!isNaN(d.getTime())) return { text: fmtDate(d), kind: 'date' };
    }
    return { text: '', kind: 'none' }; // a bare number we can't trust — drop it
  }

  // ISO date (YYYY-MM-DD…) → formatted date.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return { text: fmtDate(d), kind: 'date' };
  }

  // Anything else ("2 weeks", "10 business days") is a duration string as-is.
  return { text: s, kind: 'duration' };
}

// Convenience: just the display string ('' when there's nothing usable).
export function formatLeadTime(raw: unknown): string {
  return normalizeLeadTime(raw).text;
}
