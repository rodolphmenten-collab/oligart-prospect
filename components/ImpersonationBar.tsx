'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function ImpersonationBar() {
  const router = useRouter();
  const [venueName, setVenueName] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setVenueName(window.localStorage.getItem('lucky_impersonating_venue'));
  }, []);

  async function stopImpersonating() {
    setRestoring(true);
    const backup = window.localStorage.getItem('lucky_admin_backup_session');
    if (!backup) {
      setRestoring(false);
      return;
    }

    const { access_token, refresh_token } = JSON.parse(backup);
    const supabase = createClient();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });

    window.localStorage.removeItem('lucky_admin_backup_session');
    window.localStorage.removeItem('lucky_impersonating_venue');

    if (error) {
      router.push('/admin-login');
      router.refresh();
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  if (!venueName) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-brass px-4 py-2 text-xs font-medium text-ink">
      <span>Vous gérez le compte de {venueName} en leur nom.</span>
      <button
        onClick={stopImpersonating}
        disabled={restoring}
        className="rounded-full bg-ink px-3 py-1 text-[11px] text-bone hover:bg-ink-800"
      >
        {restoring ? '…' : 'Arrêter et revenir en admin'}
      </button>
    </div>
  );
}
