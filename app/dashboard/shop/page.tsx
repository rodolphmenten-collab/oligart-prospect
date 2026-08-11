import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShopView } from './ShopView';

export default async function ShopPage({ searchParams }: { searchParams: { venue?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/venue-login?next=/dashboard/shop');

  const { data: adminRows } = await supabase
    .from('venue_admins')
    .select('venue_id, venues(id, name, cover_photo_url)')
    .eq('user_id', user.id);

  if (!adminRows || adminRows.length === 0) redirect('/dashboard');

  const venue = searchParams.venue
    ? (adminRows.find((r: any) => r.venues.id === searchParams.venue) as any)?.venues
    : (adminRows[0] as any).venues;

  const { data: orders } = await supabase
    .from('venue_orders')
    .select('*')
    .eq('venue_id', venue.id)
    .order('created_at', { ascending: false });

  return <ShopView venue={venue} orders={orders ?? []} />;
}
