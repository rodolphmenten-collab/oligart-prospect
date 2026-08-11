'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

const VENUE_TYPES = ['Hotel', 'Restaurant', 'Bar', 'Rooftop', 'Beach Club', 'Coworking', 'Event'];

export function VenueLeadForm({ defaultPlan }: { defaultPlan?: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [form, setForm] = useState({
    contactName: '',
    contactEmail: '',
    venueName: '',
    venueCity: '',
    venueType: 'Hotel',
    planInterest: defaultPlan ?? 'essentiel',
    message: '',
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/venue-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl border hairline bg-ink-800 p-6 text-center">
        <p className="font-display text-xl italic text-bone">Request received.</p>
        <p className="mt-2 text-sm text-bone-dim">
          We&rsquo;ll reach out to {form.contactEmail} to set up {form.venueName}&rsquo;s account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          required
          placeholder="Your name"
          value={form.contactName}
          onChange={(e) => update('contactName', e.target.value)}
          className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
        />
        <input
          required
          type="email"
          placeholder="Work email"
          value={form.contactEmail}
          onChange={(e) => update('contactEmail', e.target.value)}
          className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          required
          placeholder="Venue name"
          value={form.venueName}
          onChange={(e) => update('venueName', e.target.value)}
          className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
        />
        <input
          placeholder="City"
          value={form.venueCity}
          onChange={(e) => update('venueCity', e.target.value)}
          className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <select
          value={form.venueType}
          onChange={(e) => update('venueType', e.target.value)}
          className="w-full rounded-full border hairline bg-ink-900 px-5 py-3 text-sm text-bone"
        >
          {VENUE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={form.planInterest}
          onChange={(e) => update('planInterest', e.target.value)}
          className="w-full rounded-full border hairline bg-ink-900 px-5 py-3 text-sm text-bone"
        >
          <option value="basique">Basique — 99€/mo</option>
          <option value="essentiel">Essentiel — 149€/mo</option>
          <option value="premium">Premium — 299€/mo</option>
        </select>
      </div>
      <textarea
        placeholder="Anything else we should know? (optional)"
        rows={2}
        value={form.message}
        onChange={(e) => update('message', e.target.value)}
        className="w-full rounded-2xl border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
      />
      <Button type="submit" disabled={status === 'sending'} className="w-full sm:w-auto">
        {status === 'sending' ? 'Sending…' : 'Request access'}
      </Button>
      {status === 'error' && (
        <p className="text-xs text-red-400">Something went wrong — try again.</p>
      )}
    </form>
  );
}
