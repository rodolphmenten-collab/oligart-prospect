/**
 * Demo data seeder.
 *
 * Run venues first (supabase/seed_venues.sql, via SQL editor or `supabase db push`
 * if placed under migrations), then:
 *
 *   npm run seed
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local —
 * auth.users can only be created with the service role, never the anon key.
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const CITIES = ['Milan', 'Paris', 'London', 'New York', 'Rome', 'Los Angeles', 'Copenhagen'];
const JOBS = [
  'Fashion designer', 'Founder', 'Architect', 'Investor', 'Photographer',
  'Product designer', 'Chef', 'DJ', 'Art director', 'Doctor', 'Writer', 'Producer',
];
const INTENTION_SETS = [['dating'], ['business'], ['social'], ['looking'], ['dating', 'social'], ['business', 'social']];
const FIRST_NAMES = [
  'Giulia', 'Marco', 'Elena', 'Théo', 'Camille', 'Alex', 'Sofia', 'Lucas', 'Nina',
  'Omar', 'Isabella', 'Noah', 'Léa', 'Kenji', 'Mia', 'Diego', 'Ava', 'Yuki', 'Leo', 'Zara',
];

const VENUE_SLUGS = ['hotel-de-russie', 'soho-house-paris', 'the-edition-london', 'scorpios-mykonos'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const { data: venues, error: venueErr } = await supabase.from('venues').select('id, slug');
  if (venueErr || !venues?.length) {
    console.error('No venues found — run supabase/seed_venues.sql first.', venueErr);
    process.exit(1);
  }

  for (let i = 0; i < FIRST_NAMES.length; i++) {
    const firstName = FIRST_NAMES[i];
    const email = `demo.${firstName.toLowerCase()}.${i}@example.here.app`;

    const { data: userRes, error: userErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID(),
    });

    if (userErr || !userRes?.user) {
      console.warn(`Skipping ${email}: ${userErr?.message}`);
      continue;
    }

    const userId = userRes.user.id;

    const { error: profileErr } = await supabase.from('profiles').insert({
      id: userId,
      first_name: firstName,
      age: 24 + Math.floor(Math.random() * 15),
      city: pick(CITIES),
      job: pick(JOBS),
      company: null,
      bio: null,
      photo_url: `https://i.pravatar.cc/400?u=${userId}`,
      intentions: pick(INTENTION_SETS),
      visible: true,
    });

    if (profileErr) {
      console.warn(`Profile insert failed for ${firstName}:`, profileErr.message);
      continue;
    }

    // Distribute across venues; ~70% verified_now (fresh), ~30% recently_verified (older).
    const venue = pick(venues);
    const isFresh = Math.random() > 0.3;
    const minutesAgo = isFresh ? Math.floor(Math.random() * 10) : 20 + Math.floor(Math.random() * 60);
    const verifiedAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();

    const { data: checkin, error: checkinErr } = await supabase
      .from('check_ins')
      .insert({
        user_id: userId,
        venue_id: venue.id,
        checked_in_at: verifiedAt,
        last_active_at: verifiedAt,
        last_verified_at: verifiedAt,
        presence_status: 'verified_now',
        verification_method: 'gps',
      })
      .select('id')
      .single();

    if (!checkinErr && checkin) {
      await supabase.from('presence_verifications').insert({
        check_in_id: checkin.id,
        method: 'gps',
        success: true,
        confidence_score: 1,
        distance_meters: Math.floor(Math.random() * 40),
      });
    }

    console.log(`Seeded ${firstName} @ ${venue.slug}`);
  }

  console.log('\nDone. Demo accounts use random passwords (admin-created) — sign in as');
  console.log('yourself normally via magic link; the demo users only exist to populate');
  console.log('"People Here" for the four demo venues.');
}

main().then(() => process.exit(0));
