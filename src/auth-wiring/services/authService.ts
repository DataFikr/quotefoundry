// ============================================================================
// authService.ts — the bridge from "anonymous visitor" to "provisioned shop"
// ----------------------------------------------------------------------------
// The subtle part is SIGN-UP SEQUENCING. Three things must happen in order:
//   1. Supabase auth creates the user (auth.users)        — they can log in
//   2. bootstrap_shop() creates the shop + links the user — they have a tenant
//   3. only now can any shop-scoped query succeed          — RLS resolves a shop
//
// If step 2 is skipped or fails, the user is authenticated but SHOPLESS: they
// can log in but every data query returns nothing (RLS finds no shop). So we
// treat bootstrap as part of sign-up, detect the shopless state on every app
// load, and offer recovery rather than letting them sit in a broken account.
// ============================================================================

import { supabase, run, ok, fail, Result } from '../../data-access-layer/lib/supabase';

export interface SessionContext {
  authUserId: string;
  shopId: string;
  shopName: string;
  shopLogoUrl?: string;    // shop logo (data-URL/storage URL) for quote PDFs
  fullName: string | null;
  needsBootstrap: boolean; // true = authenticated but no shop yet
}

export const authService = {
  // -- SIGN UP -------------------------------------------------------------
  // Creates the auth user, then provisions the shop. Both must succeed for a
  // usable account. Returns the resolved session context on success.
  async signUp(opts: {
    email: string;
    password: string;
    shopName: string;
    fullName: string;
    logoDataUrl?: string; // required by the sign-up UI; optional here so existing flows/tests stay valid
  }): Promise<Result<SessionContext>> {
    // 1. create the auth user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: opts.email,
      password: opts.password,
    });
    if (signUpError) return fail(signUpError.message);
    if (!signUpData.user) return fail('Sign-up did not return a user.');

    // If email confirmation is ON, there is no session yet — the user must
    // confirm before we can run bootstrap (which needs auth.uid()). Handle both.
    if (!signUpData.session) {
      return ok({
        authUserId: signUpData.user.id,
        shopId: '',
        shopName: opts.shopName,
        fullName: opts.fullName,
        needsBootstrap: true, // bootstrap will run after first confirmed login
      });
    }

    // 2. session exists immediately (email confirmation off) — bootstrap now
    return this.bootstrap(opts.shopName, opts.fullName, opts.logoDataUrl);
  },

  // -- BOOTSTRAP -----------------------------------------------------------
  // Calls the SECURITY DEFINER Postgres function that creates the shop, links
  // the current auth user, and seeds default rates — all in one transaction.
  // Safe to call only when a session exists (it relies on auth.uid()).
  async bootstrap(shopName: string, fullName: string, logoDataUrl?: string): Promise<Result<SessionContext>> {
    const { data, error } = await supabase.rpc('bootstrap_shop', {
      p_shop_name: shopName,
      p_full_name: fullName,
      p_industry: 'metal_fab',
    });
    if (error) return fail(error.message);
    // Store the shop logo on the freshly provisioned shop. Non-fatal: a failed
    // logo write must not strand the user shopless (they can re-upload later).
    if (logoDataUrl && data) {
      await run(() =>
        supabase.from('shops').update({ logo_url: logoDataUrl }).eq('id', data).select().single()
      );
    }
    return this.resolveSession();
  },

  // -- LOG IN --------------------------------------------------------------
  async logIn(email: string, password: string): Promise<Result<SessionContext>> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return fail(error.message);
    return this.resolveSession();
  },

  async logInWithGoogle(): Promise<Result<void>> {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    return error ? fail(error.message) : ok(undefined);
  },

  // -- RESOLVE SESSION -----------------------------------------------------
  // The single source of truth for "who is this and what shop are they in".
  // Called after every login and on every app load. Crucially, it detects the
  // SHOPLESS state (authenticated but bootstrap never ran) so the app can
  // recover instead of showing empty screens forever.
  async resolveSession(): Promise<Result<SessionContext>> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) return fail(userError.message);
    if (!user) return fail('Not signed in.');

    // Look up the shop link. RLS lets a user read their own shop_users row.
    const linkRes = await run<any>(() =>
      supabase
        .from('shop_users')
        .select('shop_id, full_name, shops(name, logo_url)')
        .eq('auth_user_id', user.id)
        .maybeSingle()
    );

    // No link row = authenticated but not yet provisioned.
    if (linkRes.error || !linkRes.data) {
      return ok({
        authUserId: user.id,
        shopId: '',
        shopName: '',
        fullName: null,
        needsBootstrap: true,
      });
    }

    return ok({
      authUserId: user.id,
      shopId: linkRes.data.shop_id,
      shopName: linkRes.data.shops?.name ?? '',
      shopLogoUrl: linkRes.data.shops?.logo_url ?? undefined,
      fullName: linkRes.data.full_name,
      needsBootstrap: false,
    });
  },

  // -- PASSWORD RESET ------------------------------------------------------
  async requestPasswordReset(email: string): Promise<Result<void>> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? fail(error.message) : ok(undefined);
  },

  async setNewPassword(newPassword: string): Promise<Result<void>> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? fail(error.message) : ok(undefined);
  },

  // -- LOG OUT -------------------------------------------------------------
  async logOut(): Promise<Result<void>> {
    const { error } = await supabase.auth.signOut();
    return error ? fail(error.message) : ok(undefined);
  },
};
