-- Tanda share links. Run ONCE in Supabase -> SQL Editor.
-- Stores only the confirmed clear version (text + the user's medicine photos). Never the prescription photo.

create table if not exists public.shares (
  id          text primary key,                 -- random, unguessable (22 url-safe chars)
  data        jsonb not null,                   -- the confirmed clear version (display fields only)
  photo_paths text[] not null default '{}',     -- files in the private "med-photos" bucket
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null              -- created_at + 30 days (Data Privacy Act: keep the minimum)
);

create index if not exists shares_expires_at_idx on public.shares (expires_at);

-- Row Level Security ON and NO policies: the public/anon key can read and write nothing.
-- Only the server (service/secret key, never sent to browsers) can touch this table.
alter table public.shares enable row level security;

-- Private bucket for the user's medicine photos (the app serves them through short-lived signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('med-photos', 'med-photos', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- OPTIONAL nightly purge of expired rows (enable the pg_cron extension first: Database -> Extensions).
-- The app also purges expired shares (rows and photos) whenever a new link is created, and refuses to show
-- an expired link, so this is only extra tidiness.
-- select cron.schedule('tanda-purge-expired', '17 3 * * *', $$ delete from public.shares where expires_at < now() $$);
