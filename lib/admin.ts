import { createServiceClient } from '@/lib/supabase/server';

/**
 * Platform admin gate for the internal /admin back-office. Backed by the
 * platform_admins table (managed from /admin's Team section), not a static env var —
 * this lets the team add/remove colleagues without a redeploy.
 */
export async function isPlatformAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const service = createServiceClient();
  const { data } = await service
    .from('platform_admins')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  return Boolean(data);
}

