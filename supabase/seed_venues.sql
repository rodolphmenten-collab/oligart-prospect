-- Demo venues. Safe to run multiple times (upsert on slug).
insert into venues (slug, name, city, type, latitude, longitude, verification_radius_m, checkin_duration_minutes, plan, cover_photo_url)
values
  ('hotel-de-russie', 'Hotel de Russie', 'Rome', 'hotel', 41.9086, 12.4796, 100, 180, 'enterprise', 'https://images.unsplash.com/photo-1566073771259-6a8506099945'),
  ('soho-house-paris', 'Soho House', 'Paris', 'coworking', 48.8688, 2.3453, 80, 720, 'premium', 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa'),
  ('the-edition-london', 'The Edition', 'London', 'hotel', 51.5152, -0.1382, 100, 180, 'premium', 'https://images.unsplash.com/photo-1551632811-561732d1e306'),
  ('scorpios-mykonos', 'Scorpios', 'Mykonos', 'beach_club', 37.3987, 25.3223, 150, 480, 'enterprise', 'https://images.unsplash.com/photo-1533105079780-92b9be482077')
on conflict (slug) do update set
  name = excluded.name, city = excluded.city, type = excluded.type,
  latitude = excluded.latitude, longitude = excluded.longitude,
  verification_radius_m = excluded.verification_radius_m,
  checkin_duration_minutes = excluded.checkin_duration_minutes,
  plan = excluded.plan, cover_photo_url = excluded.cover_photo_url;

insert into venue_zones (venue_id, name)
select v.id, z.name
from venues v
join (values
  ('hotel-de-russie', 'Lobby'), ('hotel-de-russie', 'Bar'), ('hotel-de-russie', 'Garden'),
  ('soho-house-paris', 'Rooftop'), ('soho-house-paris', 'Members Bar'),
  ('the-edition-london', 'Lobby'), ('the-edition-london', 'Punch Room'),
  ('scorpios-mykonos', 'Beach Deck'), ('scorpios-mykonos', 'Sunset Bar')
) as z(slug, name) on z.slug = v.slug
on conflict do nothing;
