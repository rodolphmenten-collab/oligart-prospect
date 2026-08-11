import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { venueId, productId, productName, quantity, customText, logoUrl } = await request.json();

  if (!venueId || !productId || !productName || !quantity) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { error } = await supabase.from('venue_orders').insert({
    venue_id: venueId,
    ordered_by: user.id,
    product_id: productId,
    product_name: productName,
    quantity,
    custom_text: customText ?? null,
    logo_url: logoUrl ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
