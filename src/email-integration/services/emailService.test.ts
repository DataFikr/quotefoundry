// ============================================================================
// emailService.test.ts — Stage 6 functional gate (client side). Runs the REAL
// emailService against the injected mock client: send advances the quote to
// 'sent', and the default builder pre-fills from the quote.
// ============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
// @ts-expect-error — .mjs mock has no types
import { createMockClient } from '../../mock-supabase/mockSupabase.mjs';
import { setSupabaseClient } from '../../data-access-layer/lib/supabase';
import { quoteService } from '../../data-access-layer/services/quoteService';
import { authService } from '../../auth-wiring/services/authService';
import { emailService } from './emailService';
import type { QuoteInputs } from '../../data-access-layer/lib/types';

const job: QuoteInputs = {
  job_name: 'Stair stringers', material_weight: 240, quantity: 1, burn_minutes: 35,
  hrs_cutting: 1.5, hrs_fitting: 3, hrs_welding: 4, hrs_finishing: 1.5, outside_services: 85,
};

beforeEach(async () => {
  const client = createMockClient();
  setSupabaseClient(client);
  await authService.signUp({ email: 'mike@ironside.com', password: 'pw', shopName: 'Ironside', fullName: 'Mike' });
});

describe('emailService.sendQuote', () => {
  it('sends and advances the quote to sent', async () => {
    const q = (await quoteService.create(job, { name: 'Apex', email: 'p@apex.com' })).data!;
    const res = await emailService.sendQuote({ quoteId: q.id, recipient: 'p@apex.com', subject: 's', message: 'm', pdfBase64: '' });
    expect(res.error).toBeNull();
    expect(res.data!.emailId).toBeTruthy();
    expect((await quoteService.get(q.id)).data!.status).toBe('sent');
  });
});

describe('emailService.buildDefaults', () => {
  it('pre-fills recipient, subject and a price-bearing message', () => {
    const d = emailService.buildDefaults({
      quote_number: 'Q-2026-051', job_name: 'Stair stringers',
      customer_email: 'p@apex.com', quoted_price: 1913.82, lead_time: '2-3 weeks',
    });
    expect(d.recipient).toBe('p@apex.com');
    expect(d.subject).toBe('Quote Q-2026-051 — Stair stringers');
    expect(d.message).toContain('$1,913.82');
    expect(d.message).toContain('2-3 weeks');
  });
});
