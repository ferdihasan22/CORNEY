-- (1) Gambar CARD di landing Customer — TERPISAH dari banner katalog. Owner kelola.
--     Pola sama tabel banners: data jsonb {title,img}, sort, active.
create table if not exists public.landing_cards (
  id     text primary key,
  data   jsonb,
  sort   int,
  active boolean not null default true
);
alter table public.landing_cards enable row level security;
create policy landing_cards_owner_all on public.landing_cards
  for all using (private.app_role() = 'owner') with check (private.app_role() = 'owner');
create policy landing_cards_read_all on public.landing_cards
  for select using (true);

-- (2) Realtime untuk daftar item belanja → perubahan Owner langsung terasa di
--     Operasional & Supplier (selain hidrasi saat login).
alter publication supabase_realtime add table public.landing_cards;
alter publication supabase_realtime add table public.shopping_items;
