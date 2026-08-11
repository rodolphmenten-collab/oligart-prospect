'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RoomNav } from '@/components/RoomNav';
import { createClient } from '@/lib/supabase/client';
import { PersonCard, type PersonCardData } from '@/components/PersonCard';
import { Button } from '@/components/ui/Button';
import { HEARTBEAT_INTERVAL_SECONDS, shouldPromptReverification } from '@/lib/presence';
import type { Intention } from '@/lib/types';

const FILTERS: { label: string; value: Intention | 'all' }[] = [
  { label: 'Everyone', value: 'all' },
  { label: 'Dating', value: 'dating' },
  { label: 'Business', value: 'business' },
  { label: 'Social', value: 'social' },
];

export function PeopleHere({
  venueSlug,
  venueId,
}: {
  venueSlug: string;
  venueId: string;
  durationMinutes: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [people, setPeople] = useState<PersonCardData[]>([]);
  const [filter, setFilter] = useState<Intention | 'all'>('all');
  const [checkInId, setCheckInId] = useState<string | null>(null);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const [showReverify, setShowReverify] = useState(false);

  const loadPeople = useCallback(async () => {
    const { data } = await supabase.rpc('get_people_here', { p_venue_slug: venueSlug });
    if (data) setPeople(data as PersonCardData[]);
  }, [supabase, venueSlug]);

  useEffect(() => {
    loadPeople();
    const poll = setInterval(loadPeople, 30_000);
    return () => clearInterval(poll);
  }, [loadPeople]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('check_ins')
        .select('id, last_verified_at')
        .eq('user_id', user.id)
        .eq('venue_id', venueId)
        .in('presence_status', ['verified_now', 'recently_verified'])
        .maybeSingle();
      if (data) {
        setCheckInId(data.id);
        setLastVerifiedAt(data.last_verified_at);
      }
    })();
  }, [supabase, venueId]);

  // Heartbeat while the tab is active.
  useEffect(() => {
    if (!checkInId) return;
    const send = () => {
      if (document.visibilityState === 'visible') {
        fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkInId }),
        });
      }
    };
    send();
    const interval = setInterval(send, HEARTBEAT_INTERVAL_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [checkInId]);

  // "Still here?" re-verification prompt.
  useEffect(() => {
    if (!lastVerifiedAt) return;
    const check = () => setShowReverify(shouldPromptReverification(lastVerifiedAt));
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [lastVerifiedAt]);

  async function confirmStillHere() {
    if (!checkInId) return;
    await fetch('/api/reverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId }),
    });
    setLastVerifiedAt(new Date().toISOString());
    setShowReverify(false);
    loadPeople();
  }

  async function handleWave(toUserId: string) {
    const res = await fetch('/api/wave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId, venueId }),
    });
    const data = await res.json();
    if (data.matched) {
      router.push(`/chat/${data.matchId}?justMatched=1`);
    }
  }

  async function leaveVenue() {
    if (!checkInId) return;
    await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId }),
    });
    router.refresh();
  }

  const filtered = filter === 'all' ? people : people.filter((p) => p.intentions.includes(filter));

  return (
    <div>
      {showReverify && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-brass/40 bg-brass/5 px-5 py-4">
          <p className="text-sm text-bone">Still here?</p>
          <Button onClick={confirmStillHere} variant="outline" className="!px-4 !py-2 text-xs">
            Yes, I&rsquo;m still here
          </Button>
        </div>
      )}

      <RoomNav />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-4 py-2 text-xs tracking-wide transition-colors ${
                filter === f.value ? 'border-brass text-brass' : 'hairline text-bone-dim'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={leaveVenue} className="text-xs text-bone-faint hover:text-bone-dim">
          Leave venue
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-bone-faint">
          No one matching this filter is here right now. Check back soon.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <PersonCard key={p.user_id} person={p} onWave={handleWave} />
          ))}
        </div>
      )}
    </div>
  );
}
