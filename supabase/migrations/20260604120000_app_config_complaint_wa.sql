-- app_config — konfigurasi GLOBAL aplikasi (key-value sederhana). Saat ini dipakai
-- untuk nomor WhatsApp tujuan komplain customer (SATU nomor untuk SEMUA cabang).
-- RLS: owner tulis; SEMUA orang baca (customer anon perlu nomor komplain TANPA login)
-- → mengikuti pola menus/banners (read_all using(true)).
create table if not exists app_config (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

alter table app_config enable row level security;

create policy app_config_owner_all on app_config for all
  using (private.app_role() = 'owner') with check (private.app_role() = 'owner');
create policy app_config_read_all on app_config for select using (true);

-- Seed default nomor komplain (idempoten — tidak menimpa kalau owner sudah ubah).
insert into app_config (key, value) values ('complaint_wa', '6285174200152')
  on conflict (key) do nothing;

-- Realtime: perubahan nomor langsung sampai ke customer yang sedang membuka app.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_config'
  ) then
    alter publication supabase_realtime add table public.app_config;
  end if;
end $$;
