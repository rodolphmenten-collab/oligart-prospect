import type { PresenceStatus, VenueType } from '@/lib/types';

/**
 * PRESENCE ENGINE
 * ----------------
 * This is the trust layer of the product. A check-in is never treated as proof of
 * presence for its full lifetime — it decays through explicit states, and every
 * state transition is driven by real signals (GPS re-verification, heartbeat,
 * explicit "still here?" confirmation), never by the mere existence of a row.
 *
 * States:
 *   verified_now       — verified very recently AND the client is actively sending
 *                         heartbeats. Shown as "Here now" (live).
 *   recently_verified   — verification is ageing but still inside the venue's
 *                         checkin_duration_minutes window. Shown as "Recently here".
 *   expired             — outside the window with no re-verification. Hidden from
 *                         People Here and auto-checked-out on the next sweep.
 *   checked_out         — user left explicitly, or was auto-checked-out.
 */

// A verification is only "live" (green dot, "Here now") for this long.
export const VERIFIED_WINDOW_MINUTES = 15;

// Heartbeats older than this mean the client isn't actively using the app right now,
// which downgrades the badge even if the last GPS verification is still fresh.
export const ACTIVE_WINDOW_MINUTES = 10;

// Prompt "Still here?" this long after the last successful verification.
export const REVERIFY_PROMPT_MINUTES = 45;

// How often the client should send a heartbeat while the app is open and foregrounded.
export const HEARTBEAT_INTERVAL_SECONDS = 90;

// Default auto-checkout windows by venue type (minutes). Configurable per-venue in
// venues.checkin_duration_minutes — these are only the seed/default values.
export const DEFAULT_CHECKIN_DURATION_MINUTES: Record<VenueType, number> = {
  restaurant: 180,
  bar: 240,
  rooftop: 240,
  beach_club: 480,
  coworking: 720,
  hotel: 180, // "here_now" mode only — see CheckInMode.staying for multi-day guests
  event: 360,
};

interface DerivePresenceInput {
  lastVerifiedAt: string | Date;
  lastActiveAt: string | Date;
  checkedOutAt: string | Date | null;
  checkinDurationMinutes: number;
  now?: Date;
}

export function derivePresenceStatus({
  lastVerifiedAt,
  lastActiveAt,
  checkedOutAt,
  checkinDurationMinutes,
  now = new Date(),
}: DerivePresenceInput): PresenceStatus {
  if (checkedOutAt) return 'checked_out';

  const verifiedMinutesAgo = minutesBetween(new Date(lastVerifiedAt), now);
  const activeMinutesAgo = minutesBetween(new Date(lastActiveAt), now);

  if (verifiedMinutesAgo > checkinDurationMinutes) return 'expired';

  if (verifiedMinutesAgo <= VERIFIED_WINDOW_MINUTES && activeMinutesAgo <= ACTIVE_WINDOW_MINUTES) {
    return 'verified_now';
  }

  return 'recently_verified';
}

export function shouldPromptReverification(lastVerifiedAt: string | Date, now = new Date()): boolean {
  return minutesBetween(new Date(lastVerifiedAt), now) >= REVERIFY_PROMPT_MINUTES;
}

export function presenceLabel(status: PresenceStatus, lastVerifiedAt: string | Date, now = new Date()): string {
  switch (status) {
    case 'verified_now':
      return 'Here now';
    case 'recently_verified': {
      const mins = minutesBetween(new Date(lastVerifiedAt), now);
      if (mins < 60) return `Verified here ${mins} min ago`;
      return 'Recently here';
    }
    case 'expired':
      return 'No longer here';
    case 'checked_out':
      return 'Checked out';
  }
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}
