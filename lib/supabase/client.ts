import { createBrowserClient } from '@supabase/ssr';

// Note: intentionally untyped (no generated Database generic) — this MVP ships with
// hand-written domain types in lib/types.ts instead of `supabase gen types`. Once you
// have a live project, run `supabase gen types typescript` and wire the generic back
// in here for full query-level type safety.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
