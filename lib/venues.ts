import type { VenueType } from '@/lib/types';
import { DEFAULT_CHECKIN_DURATION_MINUTES } from '@/lib/presence';

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export const VENUE_TYPE_MAP: Record<string, VenueType> = {
  hotel: 'hotel',
  restaurant: 'restaurant',
  bar: 'bar',
  rooftop: 'rooftop',
  'beach club': 'beach_club',
  beach_club: 'beach_club',
  coworking: 'coworking',
  event: 'event',
};

/**
 * Creates a venue with a guaranteed-unique slug, using placeholder coordinates
 * (0, 0) that the owner or an admin must correct from the venue's own edit page
 * before real check-ins will work.
 */
export async function createVenueRecord(
  service: any,
  params: { name: string; city: string; type: string; plan: string; contactName?: string; contactEmail?: string }
) {
  const venueType: VenueType = VENUE_TYPE_MAP[(params.type ?? '').toLowerCase()] ?? 'bar';
  const baseSlug = slugify(params.name) || 'venue';
  let slug = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: existing } = await service.from('venues').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${++suffix}`;
  }

  return service
    .from('venues')
    .insert({
      slug,
      name: params.name,
      city: params.city || 'Unknown',
      type: venueType,
      latitude: 0,
      longitude: 0,
      verification_radius_m: 75,
      checkin_duration_minutes: DEFAULT_CHECKIN_DURATION_MINUTES[venueType],
      plan: (params.plan as any) || 'basique',
      contact_name: params.contactName || null,
      contact_email: params.contactEmail || null,
    })
    .select('id, slug')
    .single();
}
