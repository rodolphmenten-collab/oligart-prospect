import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage({ searchParams }: { searchParams: { next?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login${searchParams.next ? `?next=${encodeURIComponent(`/onboarding?next=${searchParams.next}`)}` : ''}`);

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  const isEdit = Boolean(profile);

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">
        {isEdit ? 'Edit profile' : 'Welcome'}
      </p>
      <h1 className="mt-4 font-display text-3xl italic text-bone">
        {isEdit ? 'Update your details.' : 'A few things about you.'}
      </h1>
      {!isEdit && (
        <p className="mt-2 text-sm text-bone-dim">
          Under 30 seconds. Nothing here is public until you join a room.
        </p>
      )}
      <OnboardingForm userId={user.id} existingProfile={profile ?? undefined} next={searchParams.next} />
    </main>
  );
}
