-- get_people_here() needs its return columns changed, which Postgres doesn't allow
-- via CREATE OR REPLACE alone — drop and recreate.
drop function if exists get_people_here(text);

create or replace function get_people_here(p_venue_slug text)
returns table (
  user_id uuid,
  first_name text,
  age int,
  city text,
  job text,
  company text,
  photo_url text,
  linkedin_url text,
  intentions intention[],
  presence_status presence_status,
  last_verified_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id, p.first_name, p.age, p.city, p.job, p.company, p.photo_url, p.linkedin_url, p.intentions,
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
