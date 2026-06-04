-- OMZET REALTIME per cabang (sementara/berjalan) → Owner Dashboard live. TERPISAH
-- dari sales_daily (MASTER LAPORAN tetap sumber kebenaran; final saat Closing).
-- Satu baris ringkas per cabang: total + jumlah trx + rincian (jsonb) metode & sumber.
create table if not exists public.branch_live (
  branch_id  text primary key references public.branches(id) on delete cascade,
  biz_date   date,
  omzet      bigint not null default 0,
  trx        int    not null default 0,
  breakdown  jsonb  not null default '{}',  -- { byMethod:{...}, bySource:{walkin,online_ambil,online_maxim} }
  updated_at timestamptz not null default now()
);
alter table public.branch_live enable row level security;

-- Baca: HANYA owner & auditor (data bisnis internal; anon/customer TIDAK).
drop policy if exists bl_read on public.branch_live;
create policy bl_read on public.branch_live for select
  using (private.app_role() in ('owner', 'auditor'));

-- Owner kelola penuh (reset jaga-jaga).
drop policy if exists bl_owner on public.branch_live;
create policy bl_owner on public.branch_live for all
  using (private.app_role() = 'owner') with check (private.app_role() = 'owner');

-- Kasir set omzet berjalan cabang SENDIRI (tak bisa cabang lain / kolom config).
create or replace function public.kasir_set_live(p_omzet bigint, p_trx int, p_biz_date date, p_breakdown jsonb)
  returns void language plpgsql security definer set search_path = public as $$
declare b text;
begin
  if private.app_role() <> 'kasir' then
    raise exception 'Hanya kasir yang boleh set omzet berjalan';
  end if;
  b := private.app_branch();
  if b is null then return; end if;
  insert into public.branch_live(branch_id, biz_date, omzet, trx, breakdown, updated_at)
    values (b, p_biz_date, coalesce(p_omzet, 0), coalesce(p_trx, 0), coalesce(p_breakdown, '{}'::jsonb), now())
  on conflict (branch_id) do update
    set biz_date = excluded.biz_date, omzet = excluded.omzet, trx = excluded.trx,
        breakdown = excluded.breakdown, updated_at = now();
end $$;
revoke all on function public.kasir_set_live(bigint, int, date, jsonb) from public;
grant execute on function public.kasir_set_live(bigint, int, date, jsonb) to authenticated;

-- Realtime → Owner dashboard update otomatis.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'branch_live'
  ) then
    alter publication supabase_realtime add table public.branch_live;
  end if;
end $$;
