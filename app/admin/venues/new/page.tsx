import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isPlatformAdminEmail } from '@/lib/admin';
import { DEFAULT_CHECKIN_DURATION_MINUTES } from '@/lib/presence';
import type { VenueType } from '@/lib/types';

const VENUE_TYPES: VenueType[] = ['hotel', 'restaurant', 'bar', 'rooftop', 'beach_club', 'coworking', 'event'];

async function createVenue(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const service = createServiceClient();
  const type = formData.get('type') as VenueType;

  const { data: venue, error } = await service
    .from('venues')
    .insert({
      slug: (formData.get('slug') as string).trim().toLowerCase().replace(/\s+/g, '-'),
      name: formData.get('name') as string,
      city: formData.get('city') as string,
      type,
      latitude: Number(formData.get('latitude')),
      longitude: Number(formData.get('longitude')),
      verification_radius_m: Number(formData.get('radius')) || 75,
      checkin_duration_minutes:
        Number(formData.get('duration')) || DEFAULT_CHECKIN_DURATION_MINUTES[type] || 180,
      plan: formData.get('plan') as string,
    })
    .select('id')
    .single();

  if (!error && venue) {
    await service.from('venue_admins').insert({
      venue_id: venue.id,
      user_id: user.id,
      role: 'owner',
    });
  }

  redirect('/admin');
}

export default async function NewVenuePage() {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">Admin</p>
      <h1 className="mt-2 font-display text-3xl italic text-bone">New venue</h1>

      <form action={createVenue} className="mt-8 space-y-4">
        <Field name="name" label="Name" required />
        <Field name="slug" label="Slug (used in /venue/[slug])" required placeholder="hotel-de-russie" />
        <Field name="city" label="City" required />
        <div>
          <label className="mb-1 block text-xs text-bone-faint">Type</label>
          <select
            name="type"
            required
            className="w-full rounded-full border hairline bg-ink-900 px-5 py-3 text-sm text-bone"
          >
            {VENUE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field name="latitude" label="Latitude" type="number" step="any" required />
          <Field name="longitude" label="Longitude" type="number" step="any" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field name="radius" label="Verification radius (m)" type="number" placeholder="75" />
          <Field name="duration" label="Auto-checkout (minutes)" type="number" placeholder="180" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-bone-faint">Plan</label>
          <select
            name="plan"
            defaultValue="basique"
            className="w-full rounded-full border hairline bg-ink-900 px-5 py-3 text-sm text-bone"
          >
            <option value="basique">Basique — 99€</option>
            <option value="essentiel">Essentiel — 149€</option>
            <option value="premium">Premium — 299€</option>
          </select>
        </div>
        <button
          type="submit"
          className="mt-4 w-full rounded-full bg-bone px-6 py-3 text-sm font-medium text-ink hover:bg-brass-bright"
        >
          Create venue
        </button>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-bone-faint">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={step}
        className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
      />
    </div>
  );
}
