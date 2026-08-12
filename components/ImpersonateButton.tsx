'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function ImpersonateButton({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleImpersonate() {
    setLoading(true);
    setError('');
    const supabase = createClient();

    // Back up the admin's own session so "Stop impersonating" can restore it exactly.
    const {
      data: { session: adminSession },
    } = await supabase.auth.getSession();

    if (!adminSession) {
      setError('Aucune session admin active trouvée.');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Une erreur est survenue.');
      setLoading(false);
      return;
    }

    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: data.hashedToken,
      type: 'magiclink',
    });

    if (verifyErr) {
      setError(verifyErr.message);
      setLoading(false);
      return;
    }

    window.localStorage.setItem(
      'lucky_admin_backup_session',
      JSON.stringify({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token })
    );
    window.localStorage.setItem('lucky_impersonating_venue', data.venueName);

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        onClick={handleImpersonate}
        disabled={loading}
        className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-bone-dim hover:border-brass hover:text-brass"
      >
        {loading ? '…' : 'Se connecter à leur place'}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
