import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VenueEditForm } from './VenueEditForm';

export default async function DashboardEditPage({
  searchParams,
}: {
  searchParams: { venue?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard/edit');

  const { data: adminRows } = await supabase
    .from('venue_admins')
    .select('venue_id, venues(*)')
    .eq('user_id', user.id);

  if (!adminRows || adminRows.length === 0) redirect('/dashboard');

  const venue = searchParams.venue
    ? (adminRows.find((r: any) => r.venues.id === searchParams.venue) as any)?.venues
    : (adminRows[0] as any).venues;

  if (!venue) notFound();

  return <VenueEditForm venue={venue} />;
}
