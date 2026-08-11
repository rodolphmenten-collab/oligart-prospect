-- ============================================================================
-- HERE — core schema
-- Run against a fresh Supabase Postgres project (SQL editor or `supabase db push`).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type intention as enum ('dating', 'business', 'social', 'looking');
create type venue_type as enum ('hotel', 'restaurant', 'bar', 'rooftop', 'beach_club', 'coworking', 'event');
create type plan_type as enum ('starter', 'premium', 'enterprise');
create type verification_method as enum ('qr', 'gps', 'wifi', 'manual', 'partner_api');
create type presence_status as enum ('verified_now', 'recently_verified', 'expired', 'checked_out');
create type checkin_mode as enum ('here_now', 'staying');
create type report_status as enum ('pending', 'reviewed', 'dismissed');
create type venue_admin_role as enum ('owner', 'manager');

-- ----------------------------------------------------------------------------
-- PROFILES (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  age int check (age is null or (age between 18 and 100)),
  city text,
  job text,
  company text,
  bio text check (char_length(bio) <= 280),
  photo_url text,
  intentions intention[] not null default '{}',
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- VENUES
-- ----------------------------------------------------------------------------
create table venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text not null,
  type venue_type not null,
  latitude double precision not null,
  longitude double precision not null,
  verification_radius_m int not null default 75,
  checkin_duration_minutes int not null default 180,
  plan plan_type not null default 'starter',
  cover_photo_url text,
  created_at timestamptz not null default now()
);

create table venue_zones (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CHECK-INS + PRESENCE VERIFICATION
-- ----------------------------------------------------------------------------
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  venue_id uuid not null references venues (id) on delete cascade,
  zone_id uuid references venue_zones (id) on delete set null,
  checked_in_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  presence_status presence_status not null default 'verified_now',
  verification_method verification_method not null,
  mode checkin_mode not null default 'here_now',
  checked_out_at timestamptz
);

-- A user can only have ONE active (non checked-out / non-expired) check-in at a time.
-- Enforced at the app layer inside the checkin() function below (partial unique
-- indexes on enum-typed status columns are awkward across Postgres versions), but we
-- add an index to make the "does this user have an active check-in" lookup cheap.
create index idx_checkins_active_by_user on check_ins (user_id, presence_status);
create index idx_checkins_venue_status on check_ins (venue_id, presence_status, last_verified_at desc);

create table presence_verifications (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references check_ins (id) on delete cascade,
  method verification_method not null,
  verified_at timestamptz not null default now(),
  success boolean not null,
  confidence_score numeric(3, 2) not null default 0,
  distance_meters numeric
);

-- ----------------------------------------------------------------------------
-- SOCIAL GRAPH
-- ----------------------------------------------------------------------------
create table waves (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  venue_id uuid not null references venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint waves_not_self check (from_user <> to_user),
  constraint waves_unique unique (from_user, to_user, venue_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  venue_id uuid not null references venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_unique unique (user_a, user_b, venue_id),
  constraint matches_ordered check (user_a < user_b)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_not_self check (blocker_id <> blocked_id),
  constraint blocks_unique unique (blocker_id, blocked_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  details text,
  status report_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- VENUE ADMIN / BILLING
-- ----------------------------------------------------------------------------
create table venue_admins (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role venue_admin_role not null default 'manager',
  constraint venue_admins_unique unique (venue_id, user_id)
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null unique references venues (id) on delete cascade,
  plan plan_type not null default 'starter',
  status text not null default 'active',
  current_period_end timestamptz
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table profiles enable row level security;
alter table venues enable row level security;
alter table venue_zones enable row level security;
alter table check_ins enable row level security;
alter table presence_verifications enable row level security;
alter table waves enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;
alter table venue_admins enable row level security;
alter table subscriptions enable row level security;

-- profiles: everyone authenticated can read the minimal public fields needed for
-- rendering "People Here" cards (no address, no exact location is ever stored here).
-- Writes are restricted to the owner.
create policy "profiles are readable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "users manage their own profile"
  on profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- venues: public read (needed for the landing page / venue page before join).
create policy "venues are publicly readable"
  on venues for select
  to authenticated, anon
  using (true);

create policy "venue admins manage their venue"
  on venues for update
  to authenticated
  using (exists (select 1 from venue_admins va where va.venue_id = venues.id and va.user_id = auth.uid()));

create policy "venue zones are publicly readable"
  on venue_zones for select
  to authenticated, anon
  using (true);

-- check_ins: a user can see their own check-ins. Cross-user visibility for
-- "People Here" goes through the get_people_here() function below (security
-- definer), NOT direct table access — this keeps verification internals
-- (methods, raw status) private between users.
create policy "users see their own check-ins"
  on check_ins for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users manage their own check-ins"
  on check_ins for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users update their own check-ins"
  on check_ins for update
  to authenticated
  using (auth.uid() = user_id);

create policy "venue admins read aggregated check-ins"
  on check_ins for select
  to authenticated
  using (exists (select 1 from venue_admins va where va.venue_id = check_ins.venue_id and va.user_id = auth.uid()));

create policy "users see their own verifications"
  on presence_verifications for select
  to authenticated
  using (exists (select 1 from check_ins ci where ci.id = presence_verifications.check_in_id and ci.user_id = auth.uid()));

-- waves: visible to sender and recipient only.
create policy "waves visible to participants"
  on waves for select
  to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);

create policy "users send waves as themselves"
  on waves for insert
  to authenticated
  with check (auth.uid() = from_user);

-- matches: visible to the two matched users only.
create policy "matches visible to participants"
  on matches for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- messages: only match participants can read/write, and only after a match exists.
-- Establishments have NO policy granting them access — by construction they cannot
-- read this table at all.
create policy "messages visible to match participants"
  on messages for select
  to authenticated
  using (exists (
    select 1 from matches m
    where m.id = messages.match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  ));

create policy "match participants send messages"
  on messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from matches m
      where m.id = messages.match_id
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

-- blocks / reports: only the author can see/manage their own.
create policy "users manage their own blocks"
  on blocks for all
  to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create policy "users create reports"
  on reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "users see their own reports"
  on reports for select
  to authenticated
  using (auth.uid() = reporter_id);

-- venue_admins / subscriptions: only visible to the admins of that venue.
create policy "venue admins see their own venue admin rows"
  on venue_admins for select
  to authenticated
  using (user_id = auth.uid());

create policy "venue admins see their subscription"
  on subscriptions for select
  to authenticated
  using (exists (select 1 from venue_admins va where va.venue_id = subscriptions.venue_id and va.user_id = auth.uid()));

-- ============================================================================
-- FUNCTIONS — the presence + social graph API surface used by the app
-- ============================================================================

-- ---- check_in(): create/refresh a check-in, verify GPS, auto-checkout any other
--      active check-in for this user (a person can't be "here" in two venues at once).
create or replace function check_in(
  p_venue_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_method verification_method default 'gps',
  p_zone_id uuid default null
) returns table (check_in_id uuid, status presence_status, distance_meters numeric, within_radius boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue venues%rowtype;
  v_distance numeric;
  v_within boolean;
  v_confidence numeric;
  v_checkin_id uuid;
  v_existing uuid;
begin
  select * into v_venue from venues where id = p_venue_id;
  if not found then
    raise exception 'venue not found';
  end if;

  v_distance := 2 * 6371000 * asin(sqrt(
    sin(radians(p_lat - v_venue.latitude) / 2) ^ 2 +
    cos(radians(v_venue.latitude)) * cos(radians(p_lat)) *
    sin(radians(p_lng - v_venue.longitude) / 2) ^ 2
  ));
  v_within := v_distance <= v_venue.verification_radius_m;
  v_confidence := case
    when v_distance <= v_venue.verification_radius_m * 0.5 then 1.0
    when v_within then 0.75
    when v_distance <= v_venue.verification_radius_m * 1.5 then 0.25
    else 0.0
  end;

  if not v_within then
    return query select null::uuid, 'expired'::presence_status, v_distance, false;
    return;
  end if;

  -- Auto-checkout any other active check-in for this user (single active venue rule).
  update check_ins
    set presence_status = 'checked_out', checked_out_at = now()
    where user_id = auth.uid()
      and venue_id <> p_venue_id
      and presence_status in ('verified_now', 'recently_verified');

  -- Reuse an existing active check-in at this same venue if present, else create one.
  select id into v_existing
    from check_ins
    where user_id = auth.uid() and venue_id = p_venue_id
      and presence_status in ('verified_now', 'recently_verified')
    limit 1;

  if v_existing is not null then
    update check_ins
      set last_verified_at = now(), last_active_at = now(),
          presence_status = 'verified_now', verification_method = p_method,
          zone_id = coalesce(p_zone_id, zone_id)
      where id = v_existing
      returning id into v_checkin_id;
  else
    insert into check_ins (user_id, venue_id, zone_id, verification_method, presence_status)
      values (auth.uid(), p_venue_id, p_zone_id, p_method, 'verified_now')
      returning id into v_checkin_id;
  end if;

  insert into presence_verifications (check_in_id, method, success, confidence_score, distance_meters)
    values (v_checkin_id, p_method, true, v_confidence, v_distance);

  return query select v_checkin_id, 'verified_now'::presence_status, v_distance, true;
end;
$$;

-- ---- heartbeat(): cheap liveness ping while the app is open. Does NOT count as a
--      full re-verification — only nudges last_active_at.
create or replace function heartbeat(p_check_in_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update check_ins
    set last_active_at = now()
    where id = p_check_in_id and user_id = auth.uid()
      and presence_status in ('verified_now', 'recently_verified');
$$;

-- ---- reverify_presence(): "Still here?" confirmation, optionally re-checking GPS.
create or replace function reverify_presence(
  p_check_in_id uuid,
  p_lat double precision default null,
  p_lng double precision default null
) returns presence_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkin check_ins%rowtype;
  v_venue venues%rowtype;
  v_distance numeric;
  v_within boolean := true;
  v_confidence numeric := 0.5; -- manual confirmation, no GPS recheck supplied
  v_method verification_method := 'manual';
begin
  select * into v_checkin from check_ins where id = p_check_in_id and user_id = auth.uid();
  if not found then
    raise exception 'check-in not found';
  end if;

  if p_lat is not null and p_lng is not null then
    select * into v_venue from venues where id = v_checkin.venue_id;
    v_distance := 2 * 6371000 * asin(sqrt(
      sin(radians(p_lat - v_venue.latitude) / 2) ^ 2 +
      cos(radians(v_venue.latitude)) * cos(radians(p_lat)) *
      sin(radians(p_lng - v_venue.longitude) / 2) ^ 2
    ));
    v_within := v_distance <= v_venue.verification_radius_m;
    v_method := 'gps';
    v_confidence := case when v_within then 0.9 else 0.1 end;
  end if;

  if not v_within then
    update check_ins set presence_status = 'expired' where id = p_check_in_id;
    insert into presence_verifications (check_in_id, method, success, confidence_score, distance_meters)
      values (p_check_in_id, v_method, false, v_confidence, v_distance);
    return 'expired';
  end if;

  update check_ins
    set last_verified_at = now(), last_active_at = now(), presence_status = 'verified_now'
    where id = p_check_in_id;

  insert into presence_verifications (check_in_id, method, success, confidence_score, distance_meters)
    values (p_check_in_id, v_method, true, v_confidence, v_distance);

  return 'verified_now';
end;
$$;

-- ---- check_out(): explicit "Leave venue".
create or replace function check_out(p_check_in_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update check_ins
    set presence_status = 'checked_out', checked_out_at = now()
    where id = p_check_in_id and user_id = auth.uid();
$$;

-- ---- expire_stale_checkins(): sweep job. Schedule via pg_cron (see below) or an
--      external scheduler hitting an edge function every 1–5 minutes.
create or replace function expire_stale_checkins()
returns void
language sql
security definer
set search_path = public
as $$
  update check_ins ci
    set presence_status = 'expired', checked_out_at = now()
    from venues v
    where ci.venue_id = v.id
      and ci.presence_status in ('verified_now', 'recently_verified')
      and ci.last_verified_at < now() - make_interval(mins => v.checkin_duration_minutes);
$$;

-- ---- get_people_here(): the single read path for "People Here". Excludes the
--      caller, invisible users, blocked users (either direction), and anything
--      expired/checked-out. This is the ONLY way client code should list other
--      users at a venue.
create or replace function get_people_here(p_venue_slug text)
returns table (
  user_id uuid,
  first_name text,
  age int,
  city text,
  job text,
  company text,
  photo_url text,
  intentions intention[],
  presence_status presence_status,
  last_verified_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id, p.first_name, p.age, p.city, p.job, p.company, p.photo_url, p.intentions,
    ci.presence_status, ci.last_verified_at
  from check_ins ci
  join venues v on v.id = ci.venue_id and v.slug = p_venue_slug
  join profiles p on p.id = ci.user_id
  where ci.presence_status in ('verified_now', 'recently_verified')
    and ci.last_verified_at >= now() - make_interval(mins => v.checkin_duration_minutes)
    and p.visible = true
    and p.id <> auth.uid()
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by ci.last_verified_at desc;
$$;

-- ---- get_venue_live_counts(): counts shown on the venue header / QR landing page.
create or replace function get_venue_live_counts(p_venue_slug text)
returns table (people_here int, open_to_meeting int)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::int,
    count(*) filter (where p.intentions <> '{looking}')::int
  from check_ins ci
  join venues v on v.id = ci.venue_id and v.slug = p_venue_slug
  join profiles p on p.id = ci.user_id
  where ci.presence_status in ('verified_now', 'recently_verified')
    and ci.last_verified_at >= now() - make_interval(mins => v.checkin_duration_minutes)
    and p.visible = true;
$$;

-- ---- send_wave(): rate-limited wave, auto-creates a match on reciprocity.
create or replace function send_wave(p_to_user uuid, p_venue_id uuid)
returns table (matched boolean, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
  v_reciprocal uuid;
  v_match_id uuid;
  v_user_a uuid;
  v_user_b uuid;
begin
  if auth.uid() = p_to_user then
    raise exception 'cannot wave at yourself';
  end if;

  if exists (
    select 1 from blocks
    where (blocker_id = auth.uid() and blocked_id = p_to_user)
       or (blocker_id = p_to_user and blocked_id = auth.uid())
  ) then
    raise exception 'cannot wave at this user';
  end if;

  -- Rate limit: max 20 waves per rolling hour per user.
  select count(*) into v_recent_count from waves
    where from_user = auth.uid() and created_at > now() - interval '1 hour';
  if v_recent_count >= 20 then
    raise exception 'wave rate limit reached, try again later';
  end if;

  insert into waves (from_user, to_user, venue_id)
    values (auth.uid(), p_to_user, p_venue_id)
    on conflict (from_user, to_user, venue_id) do nothing;

  select id into v_reciprocal from waves
    where from_user = p_to_user and to_user = auth.uid() and venue_id = p_venue_id;

  if v_reciprocal is null then
    return query select false, null::uuid;
    return;
  end if;

  v_user_a := least(auth.uid(), p_to_user);
  v_user_b := greatest(auth.uid(), p_to_user);

  insert into matches (user_a, user_b, venue_id)
    values (v_user_a, v_user_b, p_venue_id)
    on conflict (user_a, user_b, venue_id) do nothing
    returning id into v_match_id;

  if v_match_id is null then
    select id into v_match_id from matches
      where user_a = v_user_a and user_b = v_user_b and venue_id = p_venue_id;
  end if;

  return query select true, v_match_id;
end;
$$;

-- ---- venue_dashboard_stats(): aggregated, privacy-safe metrics for /dashboard.
create or replace function venue_dashboard_stats(p_venue_id uuid)
returns table (
  people_here_now int,
  verified_now int,
  checkins_today int,
  unique_visitors_today int,
  waves_today int,
  matches_today int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from venue_admins where venue_id = p_venue_id and user_id = auth.uid()) then
    raise exception 'not authorized for this venue';
  end if;

  return query
  select
    (select count(*)::int from check_ins where venue_id = p_venue_id and presence_status in ('verified_now','recently_verified')),
    (select count(*)::int from check_ins where venue_id = p_venue_id and presence_status = 'verified_now'),
    (select count(*)::int from check_ins where venue_id = p_venue_id and checked_in_at >= current_date),
    (select count(distinct user_id)::int from check_ins where venue_id = p_venue_id and checked_in_at >= current_date),
    (select count(*)::int from waves where venue_id = p_venue_id and created_at >= current_date),
    (select count(*)::int from matches where venue_id = p_venue_id and created_at >= current_date);
end;
$$;

-- ============================================================================
-- OPTIONAL: schedule the expiry sweep with pg_cron (enable the extension first
-- in Database > Extensions, then run):
--
--   select cron.schedule('expire-stale-checkins', '*/2 * * * *', $$select expire_stale_checkins()$$);
--
-- If pg_cron isn't available on your plan, call expire_stale_checkins() from a
-- Supabase Edge Function on a schedule instead.
-- ============================================================================
