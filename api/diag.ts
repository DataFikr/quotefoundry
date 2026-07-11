// Diagnostic — dynamically imports each suspect module in isolation and reports
// which one fails to load in the serverless runtime (and the error). Static
// imports can't be caught per-module (a bad one crashes the whole file at load),
// so we probe them dynamically here. Temporary; remove after diagnosis.
import type { VercelRequest, VercelResponse } from '@vercel/node';

const suspects: Record<string, () => Promise<unknown>> = {
  'supabase-js': () => import('@supabase/supabase-js'),
  'pdfkit': () => import('pdfkit'),
  'node:crypto': () => import('node:crypto'),
  'quoteEngine': () => import('../src/data-access-layer/lib/quoteEngine'),
  'sendQuoteEmail': () => import('../src/email-integration/server/sendQuoteEmail'),
  // @ts-expect-error — plain .mjs module, no type declarations
  'generateQuotePdf': () => import('../src/pdf-generation/src/generateQuotePdf.mjs'),
  '_lib': () => import('./_lib'),
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const results: Record<string, string> = {};
  for (const [name, load] of Object.entries(suspects)) {
    try {
      await load();
      results[name] = 'OK';
    } catch (e) {
      results[name] = 'FAIL: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e));
    }
  }
  return res.status(200).json({ node: process.version, results });
}
