create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  added_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

-- No policies granted here on purpose: this table is only ever read/written via the
-- service-role client on the server (see lib/admin.ts and /admin's team management
-- actions), never directly from the browser.

insert into platform_admins (email) values ('rodolphmenten@gmail.com')
on conflict (email) do nothing;
