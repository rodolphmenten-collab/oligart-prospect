import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { checkInId } = await request.json();
  if (!checkInId) return NextResponse.json({ error: 'Missing checkInId' }, { status: 400 });

  const { error } = await supabase.rpc('check_out', { p_check_in_id: checkInId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
