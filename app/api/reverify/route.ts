import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { checkInId, lat, lng } = await request.json();
  if (!checkInId) return NextResponse.json({ error: 'Missing checkInId' }, { status: 400 });

  const { data, error } = await supabase.rpc('reverify_presence', {
    p_check_in_id: checkInId,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ status: data });
}
