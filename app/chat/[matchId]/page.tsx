import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChatThread } from './ChatThread';

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: { matchId: string };
  searchParams: { justMatched?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: match } = await supabase
    .from('matches')
    .select('id, user_a, user_b, venues(name, slug)')
    .eq('id', params.matchId)
    .maybeSingle();

  if (!match || (match.user_a !== user.id && match.user_b !== user.id)) notFound();

  const otherId = match.user_a === user.id ? match.user_b : match.user_a;
  const { data: other } = await supabase
    .from('profiles')
    .select('id, first_name, photo_url')
    .eq('id', otherId)
    .single();

  const { data: messages } = await supabase
    .from('messages')
    .select('id, match_id, sender_id, content, created_at')
    .eq('match_id', match.id)
    .order('created_at', { ascending: true });

  return (
    <ChatThread
      matchId={match.id}
      currentUserId={user.id}
      other={other}
      venueName={(match as any).venues?.name}
      venueSlug={(match as any).venues?.slug}
      initialMessages={messages ?? []}
      justMatched={searchParams.justMatched === '1'}
    />
  );
}
