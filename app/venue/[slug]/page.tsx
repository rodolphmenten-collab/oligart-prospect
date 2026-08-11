import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { JoinRoom } from './JoinRoom';
import { PeopleHere } from './PeopleHere';

export default async function VenuePage({ params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: venue } = await supabase
    .from('venues')
    .select('id, slug, name, city, type, checkin_duration_minutes, cover_photo_url')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!venue) notFound();

  const { data: counts } = (await supabase
    .rpc('get_venue_live_counts', { p_venue_slug: params.slug })
    .maybeSingle()) as { data: { people_here: number; open_to_meeting: number } | null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A profile is required before anyone can join a room — without this check, a
  // brand-new user could check in and appear to others with no name, no photo,
  // nothing to go on.
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (!profile) redirect(`/onboarding?next=${encodeURIComponent(`/venue/${params.slug}`)}`);
  }

  let hasActiveCheckIn = false;
  if (user) {
    const { data: activeCheckIn } = await supabase
      .from('check_ins')
      .select('id')
      .eq('user_id', user.id)
      .eq('venue_id', venue.id)
      .in('presence_status', ['verified_now', 'recently_verified'])
      .maybeSingle();
    hasActiveCheckIn = Boolean(activeCheckIn);
  }

  return (
    <main className="min-h-screen">
      <header className="relative flex h-64 items-end overflow-hidden border-b hairline">
        {venue.cover_photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.cover_photo_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/60 to-transparent" />
        <div className="relative w-full px-6 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">{venue.city}</p>
          <h1 className="mt-2 font-display text-4xl italic text-bone">{venue.name}</h1>
          <p className="mt-2 font-mono text-xs text-bone-dim">
            {counts?.people_here ?? 0} people here · {counts?.open_to_meeting ?? 0} open to meeting
          </p>
        </div>
      </header>

      <div className="px-6 py-10">
        {!user ? (
          <JoinRoom venueId={venue.id} venueSlug={venue.slug} venueName={venue.name} needsAuth />
        ) : !hasActiveCheckIn ? (
          <JoinRoom venueId={venue.id} venueSlug={venue.slug} venueName={venue.name} needsAuth={false} />
        ) : (
          <PeopleHere venueSlug={venue.slug} venueId={venue.id} durationMinutes={venue.checkin_duration_minutes} />
        )}
      </div>
    </main>
  );
}
