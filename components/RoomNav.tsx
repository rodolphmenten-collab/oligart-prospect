'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function RoomNav() {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function checkUnread() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: matches } = await supabase
        .from('matches')
        .select('id, user_a, user_b')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

      if (!matches || matches.length === 0) return;

      const { data: messages } = await supabase
        .from('messages')
        .select('match_id, sender_id, created_at')
        .in(
          'match_id',
          matches.map((m) => m.id)
        )
        .order('created_at', { ascending: false });

      if (!messages) return;

      // For each match, look at only the most recent message. A badge shows if the
      // latest word in any conversation wasn't yours — a lightweight "unread" proxy
      // without a full read-receipts system.
      const latestByMatch = new Map<string, { sender_id: string }>();
      for (const m of messages) {
        if (!latestByMatch.has(m.match_id)) latestByMatch.set(m.match_id, m);
      }
      const unread = Array.from(latestByMatch.values()).some((m) => m.sender_id !== user.id);
      if (!cancelled) setHasUnread(unread);
    }

    checkUnread();
    const interval = setInterval(checkUnread, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mb-6 flex items-center gap-3 border-b hairline pb-5">
      <Link
        href="/matches"
        className="relative flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-ink-800 py-3 text-sm font-medium tracking-wide text-bone shadow-sm transition-colors hover:border-brass hover:text-brass"
      >
        Messages
        {hasUnread && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brass">
            <span className="h-2 w-2 rounded-full bg-ink-900" />
          </span>
        )}
      </Link>
      <Link
        href="/profile"
        className="flex flex-1 items-center justify-center rounded-full border border-white/20 bg-ink-800 py-3 text-sm font-medium tracking-wide text-bone shadow-sm transition-colors hover:border-brass hover:text-brass"
      >
        Your profile
      </Link>
    </div>
  );
}
