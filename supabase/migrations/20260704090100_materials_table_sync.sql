-- Bahan baku / stok bahan mentah (global, bukan per-cabang). Dikelola Produksi
-- (Reorder Bahan Mentah); dibaca Owner utk notifikasi/anomali. id = ingredient id.
-- Sebelumnya materials LOKAL-SAJA (localStorage) → tak konsisten antar-perangkat.
create table if not exists public.materials (
  id text primary key,
  sisa integer not null default 0,
  threshold integer not null default 0,
  reordered_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.materials enable row level security;

-- Owner: penuh. Produksi: penuh (mereka yang mengelola bahan). Lainnya: baca saja.
drop policy if exists materials_owner_all on public.materials;
create policy materials_owner_all on public.materials for all
  using (private.app_role() = 'owner') with check (private.app_role() = 'owner');

drop policy if exists materials_prod_all on public.materials;
create policy materials_prod_all on public.materials for all
  using (private.app_role() = 'produksi') with check (private.app_role() = 'produksi');

drop policy if exists materials_read on public.materials;
create policy materials_read on public.materials for select
  using (private.app_role() = any (array['operasional','auditor','kasir']));
