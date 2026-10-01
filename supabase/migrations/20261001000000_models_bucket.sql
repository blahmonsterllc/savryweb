-- Public, read-only storage for Savry's own on-device models (Core AI, iOS 27).
-- The app downloads models/savry-chef/manifest.json and the files it lists.
-- Only the service role (the publish script) may write here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('models', 'models', true, 52428800, null)
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = null;

drop policy if exists "models public read" on storage.objects;
create policy "models public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'models');

-- No insert/update/delete policies for anon or authenticated: writes are service-role only.
