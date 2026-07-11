// Diagnostic endpoint — zero imports beyond types. If this returns 200 but the
// other /api routes 500 with FUNCTION_INVOCATION_FAILED, the crash is in a
// shared import, not the runtime/build config. Safe to delete once diagnosed.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ ok: true, node: process.version, ts: Date.now() });
}
