create table venue_orders (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues (id) on delete cascade,
  ordered_by uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  product_name text not null,
  quantity int not null check (quantity > 0),
  custom_text text,
  logo_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table venue_orders enable row level security;

create policy "venue admins manage their own orders"
  on venue_orders for all
  to authenticated
  using (exists (select 1 from venue_admins va where va.venue_id = venue_orders.venue_id and va.user_id = auth.uid()))
  with check (exists (select 1 from venue_admins va where va.venue_id = venue_orders.venue_id and va.user_id = auth.uid()));
