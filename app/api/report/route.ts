import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { reportedId, reason, details } = await request.json();
  if (!reportedId || !reason) {
    return NextResponse.json({ error: 'Missing reportedId/reason' }, { status: 400 });
  }

  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: user.id, reported_id: reportedId, reason, details: details ?? null });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
