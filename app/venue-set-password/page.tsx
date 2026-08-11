import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SetPasswordForm } from './SetPasswordForm';

export default async function VenueSetPasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No active session means the invite/reset link wasn't valid (expired, already
  // used, or opened in a different browser context) — send them to sign in fresh.
  if (!user) redirect('/venue-login');

  return <SetPasswordForm email={user.email ?? ''} />;
}
