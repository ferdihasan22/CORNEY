-- Override saus PER CABANG (Owner): harga khusus & tawar/tidak per cabang.
-- Pola sama branch_overrides (menu). Resolusi efektif di app:
--   harga = override.price ?? harga global; tampil = global AND NOT override.off
--           AND NOT kasir-habis-hari-ini (branch_status.availability.sauceOff).
create table if not exists public.branch_sauce_overrides (
  branch_id text not null references public.branches(id),
  sauce_id  text not null references public.sauces(id) on delete cascade,
  price     int,                              -- null = pakai harga global
  off       boolean not null default false,   -- true = tak ditawarkan di cabang ini
  primary key (branch_id, sauce_id)
);

alter table public.branch_sauce_overrides enable row level security;

-- Owner tulis penuh; semua boleh baca (Customer & Kasir butuh resolusi harga/tawar).
create policy bso_owner_all on public.branch_sauce_overrides
  for all using (private.app_role() = 'owner') with check (private.app_role() = 'owner');
create policy bso_read_all on public.branch_sauce_overrides
  for select using (true);

-- Realtime → perubahan Owner langsung terasa di Customer/Kasir yang terbuka.
alter publication supabase_realtime add table public.branch_sauce_overrides;
