import { redirect, notFound } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isPlatformAdminEmail } from '@/lib/admin';

async function updateVenue(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const service = createServiceClient();
  const id = formData.get('id') as string;

  await service
    .from('venues')
    .update({
      name: formData.get('name') as string,
      city: formData.get('city') as string,
      latitude: Number(formData.get('latitude')),
      longitude: Number(formData.get('longitude')),
      verification_radius_m: Number(formData.get('radius')),
      checkin_duration_minutes: Number(formData.get('duration')),
      plan: formData.get('plan') as string,
      contact_name: formData.get('contactName') as string,
      contact_email: formData.get('contactEmail') as string,
    })
    .eq('id', id);

  redirect('/admin');
}

async function deleteVenue(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const service = createServiceClient();
  await service.from('venues').delete().eq('id', formData.get('id') as string);

  redirect('/admin');
}

export default async function EditVenuePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');
  if (!(await isPlatformAdminEmail(user.email))) redirect('/admin');

  const service = createServiceClient();
  const { data: venue } = await service.from('venues').select('*').eq('id', params.id).maybeSingle();
  if (!venue) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">Admin</p>
      <h1 className="mt-2 font-display text-3xl italic text-bone">{venue.name}</h1>
      <p className="mt-1 font-mono text-xs text-bone-faint">/venue/{venue.slug}</p>

      <form action={updateVenue} className="mt-8 space-y-4">
        <input type="hidden" name="id" value={venue.id} />
        <div>
          <label className="mb-1 block text-xs text-bone-faint">Nom</label>
          <input
            name="name"
            defaultValue={venue.name}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-bone-faint">Ville</label>
          <input
            name="city"
            defaultValue={venue.city}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-bone-faint">Latitude</label>
            <input
              name="latitude"
              type="number"
              step="any"
              defaultValue={venue.latitude}
              className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-bone-faint">Longitude</label>
            <input
              name="longitude"
              type="number"
              step="any"
              defaultValue={venue.longitude}
              className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-bone-faint">Rayon de vérification (m)</label>
            <input
              name="radius"
              type="number"
              defaultValue={venue.verification_radius_m}
              className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-bone-faint">Déconnexion automatique (min)</label>
            <input
              name="duration"
              type="number"
              defaultValue={venue.checkin_duration_minutes}
              className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-bone-faint">Plan</label>
          <select
            name="plan"
            defaultValue={venue.plan}
            className="w-full rounded-full border hairline bg-ink-900 px-5 py-3 text-sm text-bone"
          >
            <option value="basique">Basique — 99€</option>
            <option value="essentiel">Essentiel — 149€</option>
            <option value="premium">Premium — 299€</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-bone-faint">Nom du contact</label>
          <input
            name="contactName"
            defaultValue={venue.contact_name ?? ''}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-bone-faint">Email du contact</label>
          <input
            name="contactEmail"
            type="email"
            defaultValue={venue.contact_email ?? ''}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-full bg-bone px-6 py-3 text-sm font-medium text-ink hover:bg-brass-bright"
        >
          Enregistrer
        </button>
      </form>

      <form action={deleteVenue} className="mt-4">
        <input type="hidden" name="id" value={venue.id} />
        <button type="submit" className="w-full rounded-full border border-red-400/30 py-3 text-xs text-red-400">
          Supprimer l’établissement
        </button>
      </form>
    </main>
  );
}
