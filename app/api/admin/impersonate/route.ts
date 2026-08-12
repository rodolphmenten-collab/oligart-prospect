import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isPlatformAdminEmail } from '@/lib/admin';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isPlatformAdminEmail(user.email))) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { venueId } = await request.json();
  const service = createServiceClient();

  const { data: venue } = await service.from('venues').select('id, name, contact_email').eq('id', venueId).maybeSingle();
  if (!venue?.contact_email) {
    return NextResponse.json({ error: 'This venue has no linked account yet.' }, { status: 400 });
  }

  // Confirm an account actually exists for this venue before minting a session for it.
  const { data: adminLink } = await service
    .from('venue_admins')
    .select('user_id')
    .eq('venue_id', venueId)
    .limit(1)
    .maybeSingle();
  if (!adminLink) {
    return NextResponse.json({ error: 'No account linked to this venue yet — send the invitation first.' }, { status: 400 });
  }

  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: venue.contact_email,
  });

  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? 'Could not generate impersonation link' }, { status: 400 });
  }

  return NextResponse.json({
    hashedToken: data.properties.hashed_token,
    venueName: venue.name,
  });
}
