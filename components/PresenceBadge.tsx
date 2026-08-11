import type { PresenceStatus } from '@/lib/types';
import { presenceLabel } from '@/lib/presence';

export function PresenceBadge({
  status,
  lastVerifiedAt,
}: {
  status: PresenceStatus;
  lastVerifiedAt: string;
}) {
  const label = presenceLabel(status, lastVerifiedAt);
  const isLive = status === 'verified_now';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono tracking-wide text-bone-dim">
      <span className="relative flex h-2 w-2">
        {isLive && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-signal-live animate-pulse_ring" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            isLive ? 'bg-signal-live' : 'bg-signal-fading'
          }`}
        />
      </span>
      {label}
    </span>
  );
}
