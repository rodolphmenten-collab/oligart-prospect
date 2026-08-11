import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountForm } from './AccountForm';

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/venue-login?next=/dashboard/account');

  return <AccountForm email={user.email ?? ''} />;
}
