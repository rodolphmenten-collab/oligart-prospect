import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileEditor } from './ProfileEditor';

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/onboarding');

  const { data: activeCheckIn } = await supabase
    .from('check_ins')
    .select('id, venue_id, venues(name, slug)')
    .eq('user_id', user.id)
    .in('presence_status', ['verified_now', 'recently_verified'])
    .maybeSingle();

  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-16">
      <ProfileEditor
        profile={profile}
        currentVenue={(activeCheckIn as any)?.venues ?? null}
        currentCheckInId={activeCheckIn?.id ?? null}
        connectionCount={matches?.length ?? 0}
      />
    </main>
  );
}
