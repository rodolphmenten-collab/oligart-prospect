'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Supabase's password-recovery (and invite) emails can deliver an implicit-flow
 * session as a URL hash fragment (#access_token=...&type=recovery) rather than the
 * ?code= query param our /auth/callback route handles. Hash fragments never reach
 * the server, so nothing server-side can process them — only client-side JS can.
 *
 * We parse the hash ourselves and call setSession() directly rather than relying on
 * the SDK's automatic detectSessionInUrl behavior, which is subject to a race: by the
 * time our onAuthStateChange listener subscribes, a different Supabase client
 * instance elsewhere on the page may have already consumed and cleared the hash,
 * silently establishing a session without notifying us. Manual parsing removes that
 * race entirely.
 */
export function AuthRecoveryListener() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (!accessToken || !refreshToken) return;

    const supabase = createClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) return;

      // Clean the tokens out of the address bar regardless of where we send them.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      if (type === 'recovery' || type === 'invite') {
        router.push('/venue-set-password');
        router.refresh();
      }
    });
  }, [router]);

  return null;
}
