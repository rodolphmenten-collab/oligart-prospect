import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { contactName, contactEmail, venueName, venueCity, venueType, planInterest, message } = body;

  if (!contactName || !contactEmail || !venueName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase.from('venue_leads').insert({
    contact_name: contactName,
    contact_email: contactEmail,
    venue_name: venueName,
    venue_city: venueCity ?? null,
    venue_type: venueType ?? null,
    plan_interest: planInterest ?? null,
    message: message ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
