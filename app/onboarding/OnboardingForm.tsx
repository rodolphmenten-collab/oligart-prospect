'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { INTENTION_META } from '@/lib/intentions';
import type { Intention, Profile } from '@/lib/types';

const ALL_INTENTIONS: Intention[] = ['dating', 'business', 'social', 'looking'];

export function OnboardingForm({
  userId,
  existingProfile,
  next,
}: {
  userId: string;
  existingProfile?: Profile;
  next?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = Boolean(existingProfile);

  const [firstName, setFirstName] = useState(existingProfile?.first_name ?? '');
  const [age, setAge] = useState(existingProfile?.age ? String(existingProfile.age) : '');
  const [city, setCity] = useState(existingProfile?.city ?? '');
  const [job, setJob] = useState(existingProfile?.job ?? '');
  const [bio, setBio] = useState(existingProfile?.bio ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(existingProfile?.linkedin_url ?? '');
  const [intentions, setIntentions] = useState<Intention[]>(existingProfile?.intentions ?? []);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(existingProfile?.photo_url ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleIntention(i: Intention) {
    setIntentions((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName || intentions.length === 0) {
      setError('Add your name and at least one reason you’re here.');
      return;
    }
    setSubmitting(true);
    setError(null);

    let photoUrl: string | null = existingProfile?.photo_url ?? null;
    if (photoFile) {
      const path = `${userId}/${Date.now()}-${photoFile.name}`;
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, photoFile, {
        upsert: true,
      });
      if (uploadErr) {
        setSubmitting(false);
        setError(`Photo upload failed: ${uploadErr.message}`);
        return;
      }
      photoUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      id: userId,
      first_name: firstName,
      age: age ? Number(age) : null,
      city: city || null,
      job: job || null,
      bio: bio || null,
      photo_url: photoUrl,
      linkedin_url: linkedinUrl || null,
      intentions,
      visible: existingProfile?.visible ?? true,
    };

    const { error: upsertErr } = await supabase.from('profiles').upsert(payload);

    setSubmitting(false);

    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }

    router.push(next || '/profile');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-6">
      <div className="flex items-center gap-4">
        <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border hairline bg-ink-800 text-xs text-bone-faint">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            'Photo'
          )}
          <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
        </label>
        <p className="text-xs text-bone-faint">A real, recent photo of your face.</p>
      </div>

      <input
        placeholder="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <input
          placeholder="Age"
          type="number"
          min={18}
          max={100}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
        />
        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
        />
      </div>

      <input
        placeholder="Job / company"
        value={job}
        onChange={(e) => setJob(e.target.value)}
        className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
      />

      <textarea
        placeholder="Short bio (optional)"
        value={bio}
        maxLength={280}
        onChange={(e) => setBio(e.target.value)}
        rows={2}
        className="w-full rounded-2xl border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
      />

      <input
        type="url"
        placeholder="LinkedIn profile (optional)"
        value={linkedinUrl}
        onChange={(e) => setLinkedinUrl(e.target.value)}
        className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
      />

      <div>
        <p className="mb-3 text-sm text-bone">What are you here for?</p>
        <div className="flex flex-wrap gap-2">
          {ALL_INTENTIONS.map((i) => (
            <button
              type="button"
              key={i}
              onClick={() => toggleIntention(i)}
              className={`rounded-full border px-4 py-2 text-xs tracking-wide transition-colors ${
                intentions.includes(i)
                  ? 'border-brass bg-brass/10 text-brass'
                  : 'hairline text-bone-dim hover:border-white/30'
              }`}
            >
              {INTENTION_META[i].symbol} {INTENTION_META[i].label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Continue'}
      </Button>
    </form>
  );
}
