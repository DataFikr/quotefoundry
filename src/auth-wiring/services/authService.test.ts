// ============================================================================
// authService.test.ts — Stage 3 functional gate. Runs the REAL authService
// against the injected in-memory mock client: sign-up sequencing, the shopless
// recovery path, and cross-shop isolation of resolveSession.
// ============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
// @ts-expect-error — .mjs mock has no types
import { createMockClient } from '../../mock-supabase/mockSupabase.mjs';
import { setSupabaseClient } from '../../data-access-layer/lib/supabase';
import { authService } from './authService';

let client: any;
beforeEach(() => {
  client = createMockClient();
  setSupabaseClient(client);
});

describe('sign-up provisions an isolated shop in the right order', () => {
  it('returns a ready session context with a resolved shop name', async () => {
    const res = await authService.signUp({
      email: 'mike@ironside.com', password: 'pw',
      shopName: 'Ironside Fabrication', fullName: 'Mike Torres',
    });
    expect(res.error).toBeNull();
    expect(res.data!.shopId).toBeTruthy();
    expect(res.data!.needsBootstrap).toBe(false);
    expect(res.data!.shopName).toBe('Ironside Fabrication');
    expect(res.data!.fullName).toBe('Mike Torres');
  });
});

describe('the shopless edge case — authenticated but bootstrap never ran', () => {
  it('detects needsBootstrap, then recovers via bootstrap', async () => {
    // session without a shop link (bootstrap skipped)
    await client.auth.signUp({ email: 'orphan@nowhere.com', password: 'pw' });
    const orphan = await authService.resolveSession();
    expect(orphan.data!.needsBootstrap).toBe(true);
    expect(orphan.data!.shopId).toBe('');

    const recovered = await authService.bootstrap('Orphan Welding', 'Sam Orphan');
    expect(recovered.data!.needsBootstrap).toBe(false);
    expect(recovered.data!.shopId).toBeTruthy();
    expect(recovered.data!.shopName).toBe('Orphan Welding');
  });
});

describe('cross-shop isolation', () => {
  it('a shop A owner resolves ONLY shop A, never shop B', async () => {
    const a = await authService.signUp({
      email: 'mike@ironside.com', password: 'pw',
      shopName: 'Ironside Fabrication', fullName: 'Mike',
    });
    const b = await authService.signUp({
      email: 'pat@apex.com', password: 'pw',
      shopName: 'Apex Steel', fullName: 'Pat',
    });
    expect(b.data!.shopId).not.toBe(a.data!.shopId);
    expect(b.data!.shopName).toBe('Apex Steel');

    await authService.logOut();
    await authService.logIn('mike@ironside.com', 'pw');
    const back = await authService.resolveSession();
    expect(back.data!.shopId).toBe(a.data!.shopId);
    expect(back.data!.shopName).toBe('Ironside Fabrication');
  });
});
