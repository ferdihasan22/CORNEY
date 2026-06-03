-- FASE 0 — FONDASI: branches (root FK) + profiles + helper RLS + RLS dasar

-- 1) branches: master cabang (slug). Target FK profiles & tabel config lain.
create table branches (
  id          text primary key,            -- slug: 'sepinggan', 'gunungsari'
  name        text not null,
  address     text,
  wa          text,
  maps        text,
  maxim_name  text,
  kembalian   int  default 200000,
  stop_online text default '21:30',
  close_booth text default '22:00',
  active      boolean default true
);

-- 2) profiles: 1 baris per akun staf (role + cabang). id = auth.users.id
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','operasional','produksi','auditor','supplier','kasir')),
  branch_id  text references branches(id),
  name       text,
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- 3) Helper RLS: ambil role/branch user yang login.
create or replace function app_role() returns text
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function app_branch() returns text
  language sql stable security definer set search_path = public as $$
  select branch_id from profiles where id = auth.uid()
$$;

-- 4) Aktifkan RLS
alter table branches enable row level security;
alter table profiles enable row level security;

-- 5) Policy
create policy branches_owner_all on branches for all
  using (app_role() = 'owner') with check (app_role() = 'owner');
create policy profiles_owner_all on profiles for all
  using (app_role() = 'owner') with check (app_role() = 'owner');
create policy branches_read_all on branches for select using (true);
create policy profiles_self_read on profiles for select using (id = auth.uid());
