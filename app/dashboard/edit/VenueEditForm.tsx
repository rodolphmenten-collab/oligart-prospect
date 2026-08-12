'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import type { Venue } from '@/lib/types';

export function VenueEditForm({ venue }: { venue: Venue }) {
  const supabase = createClient();
  const router = useRouter();

  const [name, setName] = useState(venue.name);
  const [city, setCity] = useState(venue.city);
  const [radius, setRadius] = useState(String(venue.verification_radius_m));
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(venue.cover_photo_url);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    venue.latitude && venue.longitude && (venue.latitude !== 0 || venue.longitude !== 0)
      ? { lat: venue.latitude, lng: venue.longitude }
      : null
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function captureLocation() {
    if (!('geolocation' in navigator)) {
      setLocationError('Your browser doesn\u2019t support location.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError('Couldn\u2019t get your location. Check permissions and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let coverUrl = venue.cover_photo_url;
    if (coverFile) {
      const path = `${venue.id}/${Date.now()}-${coverFile.name}`;
      const { error: uploadErr } = await supabase.storage.from('venue-photos').upload(path, coverFile, {
        upsert: true,
      });
      if (uploadErr) {
        setSaving(false);
        setError(`Photo upload failed: ${uploadErr.message}`);
        return;
      }
      coverUrl = supabase.storage.from('venue-photos').getPublicUrl(path).data.publicUrl;
    }

    const { error: updateErr } = await supabase
      .from('venues')
      .update({
        name,
        city,
        cover_photo_url: coverUrl,
        verification_radius_m: Number(radius) || venue.verification_radius_m,
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
      })
      .eq('id', venue.id);

    setSaving(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  const locationNeedsSetup = !coords;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-16">
      <Link href="/dashboard" className="text-xs text-bone-faint hover:text-bone-dim">
        &larr; Back to dashboard
      </Link>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.3em] text-brass">Edit venue</p>
      <h1 className="mt-2 font-display text-3xl italic text-bone">{venue.name}</h1>

      {locationNeedsSetup && (
        <div className="mt-6 rounded-2xl border border-brass/40 bg-brass/5 p-4">
          <p className="text-sm text-bone">Location not set yet</p>
          <p className="mt-1 text-xs text-bone-dim">
            Guests can&rsquo;t check in until your venue&rsquo;s real position is set. Stand
            inside the venue and tap the button below.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label className="mb-2 block text-xs text-bone-faint">Cover photo</label>
          <label className="relative flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border hairline bg-ink-800 text-xs text-bone-faint">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              'Upload a photo of your venue'
            )}
            <input type="file" accept="image/*" onChange={onCoverChange} className="hidden" />
          </label>
        </div>

        <div>
          <label className="mb-1 block text-xs text-bone-faint">Venue name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone focus:border-brass"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-bone-faint">City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone focus:border-brass"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-bone-faint">Check-in radius (meters)</label>
          <input
            type="number"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone focus:border-brass"
          />
          <p className="mt-1 text-[11px] text-bone-faint">
            How close a guest must be to your venue to check in. 75m works for most
            single-building venues; go higher for large properties.
          </p>
        </div>

        <div className="rounded-2xl border hairline p-4">
          <p className="text-sm text-bone">Venue location</p>
          {coords ? (
            <p className="mt-1 font-mono text-xs text-bone-dim">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — captured
            </p>
          ) : (
            <p className="mt-1 text-xs text-bone-faint">Not set yet.</p>
          )}
          <button
            type="button"
            onClick={captureLocation}
            disabled={locating}
            className="mt-3 rounded-full border hairline px-4 py-2 text-xs tracking-wide text-bone-dim hover:border-brass"
          >
            {locating ? 'Locating\u2026' : coords ? 'Update to my current location' : 'Set to my current location'}
          </button>
          {locationError && <p className="mt-2 text-xs text-red-400">{locationError}</p>}
          <p className="mt-2 text-[11px] text-bone-faint">
            Stand inside the venue when you tap this — it uses your device&rsquo;s GPS,
            the same way a guest&rsquo;s check-in is verified.
          </p>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {saved && <p className="text-xs text-signal-live">Saved.</p>}

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Saving\u2026' : 'Save changes'}
        </Button>
      </form>
    </main>
  );
}
