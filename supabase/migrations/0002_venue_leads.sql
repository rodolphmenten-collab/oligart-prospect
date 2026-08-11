-- Lightweight lead capture for the B2B landing page, ahead of full self-serve venue
-- signup (that flow will replace/consume this table later). Public (anon) can insert
-- their own lead; only platform admins can read them via the service role client.

create table venue_leads (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  contact_email text not null,
  venue_name text not null,
  venue_city text,
  venue_type text,
  plan_interest text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table venue_leads enable row level security;

create policy "anyone can submit a lead"
  on venue_leads for insert
  to anon, authenticated
  with check (true);

-- No select policy for anon/authenticated on purpose — leads are only readable via
-- the service role client (used in /admin), keeping submitted contact details private.
