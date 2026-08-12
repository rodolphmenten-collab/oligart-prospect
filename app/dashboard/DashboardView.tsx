'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';

interface Stats {
  people_here_now: number;
  verified_now: number;
  checkins_today: number;
  unique_visitors_today: number;
  waves_today: number;
  matches_today: number;
}

interface VenueLite {
  id: string;
  slug: string;
  name: string;
  city: string;
  plan: string;
}

export function DashboardView({
  venue,
  stats,
  venues,
}: {
  venue: VenueLite;
  stats: Stats | null;
  venues: VenueLite[];
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const venueUrl = `${siteUrl}/venue/${venue.slug}`;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  const connectionRate =
    stats && stats.checkins_today > 0
      ? Math.round((stats.matches_today / stats.checkins_today) * 100)
      : 0;

  function downloadQr() {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${venue.slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: 'People here now', value: stats?.people_here_now ?? 0 },
    { label: 'Verified now', value: stats?.verified_now ?? 0 },
    { label: 'Check-ins today', value: stats?.checkins_today ?? 0 },
    { label: 'Unique visitors today', value: stats?.unique_visitors_today ?? 0 },
    { label: 'Waves today', value: stats?.waves_today ?? 0 },
    { label: 'Matches today', value: stats?.matches_today ?? 0 },
  ];

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">Dashboard</p>
            <h1 className="mt-2 font-display text-3xl italic text-bone">{venue.name}</h1>
            <p className="mt-1 text-xs text-bone-faint">
              {venue.city} · {venue.plan} plan
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href={`/dashboard/edit?venue=${venue.id}`}
                className="rounded-full border hairline px-4 py-2 text-xs tracking-wide text-bone-dim hover:border-brass hover:text-brass"
              >
                Edit venue profile
              </Link>
              <Link
                href={`/dashboard/shop?venue=${venue.id}`}
                className="rounded-full border hairline px-4 py-2 text-xs tracking-wide text-bone-dim hover:border-brass hover:text-brass"
              >
                Shop
              </Link>
              <Link
                href="/dashboard/account"
                className="rounded-full border hairline px-4 py-2 text-xs tracking-wide text-bone-dim hover:border-brass hover:text-brass"
              >
                Account
              </Link>
            </div>
          </div>
          {venues.length > 1 && (
            <p className="text-xs text-bone-faint">{venues.length} venues linked to this account</p>
          )}
          <button
            onClick={handleSignOut}
            className="ml-4 shrink-0 rounded-full border border-red-400/40 px-4 py-2 text-xs tracking-wide text-red-400 hover:bg-red-400/10"
          >
            Sign out
          </button>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border hairline p-5">
              <p className="font-display text-3xl text-bone">{c.value}</p>
              <p className="mt-1 text-xs text-bone-faint">{c.label}</p>
            </div>
          ))}
          <div className="rounded-2xl border hairline p-5">
            <p className="font-display text-3xl text-brass">{connectionRate}%</p>
            <p className="mt-1 text-xs text-bone-faint">Connection rate today</p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border hairline p-6">
            <p className="text-sm text-bone">Venue QR</p>
            <p className="mt-1 text-xs text-bone-faint">
              Print this at reception, the bar, tables, or rooms. Points to {venueUrl || `/venue/${venue.slug}`}.
            </p>
            <div ref={qrRef} className="mt-5 inline-block rounded-xl bg-bone p-4">
              <QRCodeSVG value={venueUrl || `https://example.com/venue/${venue.slug}`} size={160} />
            </div>
            <button
              onClick={downloadQr}
              className="mt-4 block rounded-full border hairline px-5 py-2.5 text-xs tracking-wide text-bone-dim hover:border-white/30"
            >
              Download venue QR
            </button>
          </div>

          <div className="rounded-2xl border hairline p-6">
            <p className="text-sm text-bone">Privacy</p>
            <p className="mt-3 text-xs leading-relaxed text-bone-dim">
              This dashboard only ever shows aggregated numbers. {venue.name} cannot see
              individual coordinates, message content, or who blocked whom — those
              are excluded from every table this dashboard reads from at the database
              level, not just hidden in the UI.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
