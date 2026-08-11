'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function JoinRoom({
  venueId,
  venueSlug,
  venueName,
  needsAuth,
}: {
  venueId: string;
  venueSlug: string;
  venueName: string;
  needsAuth: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'locating' | 'error' | 'out_of_range'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleJoin() {
    if (needsAuth) {
      router.push(`/login?next=/venue/${venueSlug}`);
      return;
    }

    if (!('geolocation' in navigator)) {
      setState('error');
      setErrorMsg('Your browser doesn’t support location — try a different device.');
      return;
    }

    setState('locating');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              venueId,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }),
          });
          const data = await res.json();

          if (!res.ok) {
            setState('error');
            setErrorMsg(data.error ?? 'Something went wrong.');
            return;
          }

          if (!data.withinRadius) {
            setState('out_of_range');
            return;
          }

          router.refresh();
        } catch {
          setState('error');
          setErrorMsg('Something went wrong. Try again.');
        }
      },
      () => {
        setState('error');
        setErrorMsg('We need your location to confirm you’re actually here.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="mx-auto max-w-sm text-center">
      <p className="font-display text-2xl italic text-bone">Join the room</p>
      <p className="mt-3 text-sm text-bone-dim">
        We’ll confirm you’re at {venueName} using your location — just once, just to verify.
        We never share your exact position with anyone.
      </p>

      <Button onClick={handleJoin} disabled={state === 'locating'} className="mt-8 w-full">
        {state === 'locating' ? 'Confirming…' : 'Join the room'}
      </Button>

      {state === 'out_of_range' && (
        <p className="mt-4 text-xs text-brass">
          You don’t look close enough to {venueName} yet. Move inside the venue and try again.
        </p>
      )}
      {state === 'error' && <p className="mt-4 text-xs text-red-400">{errorMsg}</p>}
    </div>
  );
}
