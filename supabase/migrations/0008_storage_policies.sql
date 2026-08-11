-- Making a Storage bucket "public" only controls read access. Uploading (INSERT)
-- always requires an explicit RLS policy on storage.objects, regardless of the
-- bucket's public/private flag. Without these, cover photo and avatar uploads
-- silently fail (the client gets an error we don't surface loudly enough, and the
-- old photo_url just never changes).

-- Avatars: path convention is `${userId}/...` — only that user may write there.
create policy "users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "anyone can view avatars"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'avatars');

-- Venue photos: path convention is `${venueId}/...` — only that venue's admins may
-- write there.
create policy "venue admins upload their venue photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'venue-photos'
    and exists (
      select 1 from venue_admins va
      where va.venue_id::text = (storage.foldername(name))[1]
        and va.user_id = auth.uid()
    )
  );

create policy "venue admins update their venue photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'venue-photos'
    and exists (
      select 1 from venue_admins va
      where va.venue_id::text = (storage.foldername(name))[1]
        and va.user_id = auth.uid()
    )
  );

create policy "anyone can view venue photos"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'venue-photos');
