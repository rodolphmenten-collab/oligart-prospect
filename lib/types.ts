// Hand-authored domain types mirroring supabase/migrations/0001_init.sql.
// Kept intentionally explicit (rather than codegen) so the MVP has zero build-time
// dependency on a live Supabase project. Swap for `supabase gen types` once you have
// a project running, and this file becomes redundant.

export type Intention = 'dating' | 'business' | 'social' | 'looking';

export type VenueType =
  | 'hotel'
  | 'restaurant'
  | 'bar'
  | 'rooftop'
  | 'beach_club'
  | 'coworking'
  | 'event';

export type Plan = 'starter' | 'premium' | 'enterprise';

export type VerificationMethod = 'qr' | 'gps' | 'wifi' | 'manual' | 'partner_api';

export type PresenceStatus = 'verified_now' | 'recently_verified' | 'expired' | 'checked_out';

export type CheckInMode = 'here_now' | 'staying';

export interface Profile {
  id: string;
  first_name: string;
  age: number | null;
  city: string | null;
  job: string | null;
  company: string | null;
  bio: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  intentions: Intention[];
  visible: boolean;
  created_at: string;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  city: string;
  type: VenueType;
  latitude: number;
  longitude: number;
  verification_radius_m: number;
  checkin_duration_minutes: number;
  plan: Plan;
  cover_photo_url: string | null;
  created_at: string;
}

export interface VenueZone {
  id: string;
  venue_id: string;
  name: string;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  venue_id: string;
  zone_id: string | null;
  checked_in_at: string;
  last_active_at: string;
  last_verified_at: string;
  presence_status: PresenceStatus;
  verification_method: VerificationMethod;
  mode: CheckInMode;
  checked_out_at: string | null;
}

export interface PresenceVerification {
  id: string;
  check_in_id: string;
  method: VerificationMethod;
  verified_at: string;
  success: boolean;
  confidence_score: number;
  distance_meters: number | null;
}

export interface Wave {
  id: string;
  from_user: string;
  to_user: string;
  venue_id: string;
  created_at: string;
}

export interface Match {
  id: string;
  user_a: string;
  user_b: string;
  venue_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
}

export interface VenueAdmin {
  id: string;
  venue_id: string;
  user_id: string;
  role: 'owner' | 'manager';
}

export interface Subscription {
  id: string;
  venue_id: string;
  plan: Plan;
  status: 'active' | 'trialing' | 'canceled';
  current_period_end: string | null;
}

// Minimal Database shape so @supabase/ssr generics resolve. Extend with `Row`/`Insert`/
// `Update` variants via `supabase gen types typescript` once the project is live.
export type Database = {
  public: {
    Tables: Record<string, { Row: any; Insert: any; Update: any }>;
  };
};
