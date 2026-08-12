import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isPlatformAdminEmail } from '@/lib/admin';
import { createVenueRecord } from '@/lib/venues';
import type { VenueType } from '@/lib/types';

const VENUE_TYPES: { value: VenueType; label: string }[] = [
  { value: 'hotel', label: 'Hôtel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bar', label: 'Bar' },
  { value: 'rooftop', label: 'Rooftop' },
  { value: 'beach_club', label: 'Beach club' },
  { value: 'coworking', label: 'Coworking' },
  { value: 'event', label: 'Événement' },
];

async function createVenue(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const service = createServiceClient();

  await createVenueRecord(service, {
    name: formData.get('name') as string,
    city: formData.get('city') as string,
    type: formData.get('type') as string,
    plan: formData.get('plan') as string,
    contactName: formData.get('contactName') as string,
    contactEmail: formData.get('contactEmail') as string,
  });

  redirect('/admin');
}

export default async function NewVenuePage() {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">Admin</p>
      <h1 className="mt-2 font-display text-3xl italic text-bone">Nouvel établissement</h1>
      <p className="mt-2 text-sm text-bone-dim">
        Crée uniquement l&rsquo;établissement. Une fois prêt, envoie l&rsquo;invitation depuis
        la liste des établissements.
      </p>

      <form action={createVenue} className="mt-8 space-y-4">
        <p className="pt-2 text-xs uppercase tracking-wide text-bone-faint">Établissement</p>
        <Field name="name" label="Nom de l'établissement" required />
        <Field name="city" label="Ville" required />
        <div>
          <label className="mb-1 block text-xs text-bone-faint">Type</label>
          <select
            name="type"
            required
            className="w-full rounded-full border hairline bg-ink-900 px-5 py-3 text-sm text-bone"
          >
            {VENUE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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

        <p className="pt-4 text-xs uppercase tracking-wide text-bone-faint">Contact</p>
        <Field name="contactName" label="Nom du contact" required />
        <Field name="contactEmail" label="Email du contact" type="email" required />

        <button
          type="submit"
          className="mt-4 w-full rounded-full bg-bone px-6 py-3 text-sm font-medium text-ink hover:bg-brass-bright"
        >
          Créer l&rsquo;établissement
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
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-bone-faint">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
      />
    </div>
  );
}
