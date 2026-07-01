// ============================================================================
// devBootstrap.ts — when there's no live Supabase env, inject the in-memory mock
// client, sign in a demo shop, and seed a few sample quotes so the app (and the
// Playwright visual/design gates) render deterministic data. Runs ONLY when env
// is absent; with live credentials this is a no-op and the real client is used.
// ============================================================================
import { setSupabaseClient } from '../data-access-layer/lib/supabase';
import { authService } from '../auth-wiring/services/authService';
import { quoteService } from '../data-access-layer/services/quoteService';
import { customerService } from '../data-access-layer/services/rateService';
// @ts-expect-error — .mjs mock has no types
import { createMockClient } from '../mock-supabase/mockSupabase.mjs';

export function isLiveEnv(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}

const base = {
  material_weight: 240, burn_minutes: 35,
  hrs_cutting: 1.5, hrs_fitting: 3, hrs_welding: 4, hrs_finishing: 1.5,
  outside_services: 85,
};

let booted: Promise<void> | null = null;

export function devBootstrap(): Promise<void> {
  // Idempotent: React StrictMode double-invokes effects in dev; seed exactly once.
  if (!booted) booted = seed();
  return booted;
}

async function seed(): Promise<void> {
  if (isLiveEnv()) return; // real client already created in supabase.ts
  setSupabaseClient(createMockClient());

  // Test hook: ?auth installs the mock but skips auto-login + seeding, so the
  // real AuthScreen → sign-up → app flow can be exercised on the mock.
  if (typeof window !== 'undefined' && window.location.search.includes('auth')) return;

  await authService.signUp({
    email: 'demo@ironside.com', password: 'demo',
    shopName: 'Ironside Fabrication', fullName: 'Mike Torres',
  });

  await customerService.create({ company_name: 'Apex Industrial', contact_name: 'Dana Reyes', email: 'purchasing@apex.com', default_terms: 'Net 30' });
  await customerService.create({ company_name: 'Bolt & Beam', contact_name: 'Sam Lee', email: 'sam@boltbeam.com', default_terms: 'Net 30' });
  await customerService.create({ company_name: 'Vulcan Mfg', contact_name: 'Rosa Pike', email: 'rosa@vulcan.com', default_terms: 'Net 15' });

  const q1 = await quoteService.create(
    { job_name: 'Stair stringers', material_spec: 'A36 steel', quantity: 1, lead_time: '2 weeks', notes: 'Galvanized finish.', ...base },
    { name: 'Apex Industrial', email: 'purchasing@apex.com' }
  );
  const q2 = await quoteService.create(
    { job_name: 'Mezzanine railing', material_spec: 'A500 tube', quantity: 4, ...base, material_weight: 180, hrs_welding: 6 },
    { name: 'Bolt & Beam', email: 'sam@boltbeam.com' }
  );
  const q3 = await quoteService.create(
    { job_name: 'Conveyor frame', material_spec: 'A36 channel', quantity: 2, ...base, material_weight: 320, hrs_fitting: 5 },
    { name: 'Vulcan Mfg', email: 'rosa@vulcan.com' }
  );

  // give them varied lifecycle so the pipeline shows real statuses
  if (q2.data) await quoteService.markOutcome(q2.data.id, 'won');
  if (q3.data) await quoteService.markSent(q3.data.id, 'rosa@vulcan.com');
  void q1;
}
