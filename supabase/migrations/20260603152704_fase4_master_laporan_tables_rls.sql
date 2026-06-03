-- FASE 4 — MASTER LAPORAN (sumber kebenaran harian)

create table sales_daily (
  id uuid primary key default gen_random_uuid(),
  tgl date not null, branch_id text not null references branches(id),
  variants jsonb default '{}', channels jsonb default '{}', source jsonb default '{}',
  potongan jsonb default '{}', sauces jsonb default '{}', belanja jsonb default '{}',
  kas_aktual int default 0, trx int default 0, peak_hour text,
  created_at timestamptz default now(),
  unique (tgl, branch_id)
);
create table stock_daily (
  id uuid primary key default gen_random_uuid(),
  tgl date not null, branch_id text not null references branches(id),
  v jsonb not null default '{}',
  created_at timestamptz default now(),
  unique (tgl, branch_id)
);
create table expense (
  tgl date not null, branch_id text references branches(id),
  amount int default 0,
  primary key (tgl, branch_id)
);
create table usage (
  id uuid primary key default gen_random_uuid(),
  tgl date not null, branch_id text references branches(id),
  jenis text check (jenis in ('cash','transfer')), amount int, note text,
  ts timestamptz default now()
);
create table deposits (
  id uuid primary key default gen_random_uuid(),
  tgl date, branch_id text references branches(id),
  amount int, status text default 'menunggu', meta jsonb,
  created_at timestamptz default now()
);
create table month_close (
  month_key text primary key, snapshot jsonb, locked_at timestamptz default now()
);

-- ── RLS ──
alter table sales_daily enable row level security;
alter table stock_daily enable row level security;
alter table expense     enable row level security;
alter table usage       enable row level security;
alter table deposits    enable row level security;
alter table month_close enable row level security;

-- sales_daily & stock_daily: kasir R/W cabang sendiri; ops/auditor baca; owner penuh
create policy sales_owner_all on sales_daily for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy sales_kasir_rw_own on sales_daily for all using (private.app_role()='kasir' and branch_id=private.app_branch()) with check (private.app_role()='kasir' and branch_id=private.app_branch());
create policy sales_staff_read on sales_daily for select using (private.app_role() in ('operasional','auditor'));

create policy stock_owner_all on stock_daily for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy stock_kasir_rw_own on stock_daily for all using (private.app_role()='kasir' and branch_id=private.app_branch()) with check (private.app_role()='kasir' and branch_id=private.app_branch());
create policy stock_staff_read on stock_daily for select using (private.app_role() in ('operasional','auditor'));

-- expense & usage: owner R/W; ops/auditor baca
create policy expense_owner_all on expense for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy expense_staff_read on expense for select using (private.app_role() in ('operasional','auditor','kasir'));
create policy usage_owner_all on usage for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy usage_staff_read on usage for select using (private.app_role() in ('operasional','auditor'));

-- deposits: kasir buat (cabang sendiri); ops konfirmasi; auditor baca; owner penuh
create policy deposits_owner_all on deposits for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy deposits_kasir_rw_own on deposits for all using (private.app_role()='kasir' and branch_id=private.app_branch()) with check (private.app_role()='kasir' and branch_id=private.app_branch());
create policy deposits_ops_rw on deposits for all using (private.app_role()='operasional') with check (private.app_role()='operasional');
create policy deposits_auditor_read on deposits for select using (private.app_role()='auditor');

-- month_close: owner R/W; auditor baca
create policy monthclose_owner_all on month_close for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy monthclose_auditor_read on month_close for select using (private.app_role()='auditor');

-- Realtime (staf): sales_daily, stock_daily, deposits
alter publication supabase_realtime add table sales_daily;
alter publication supabase_realtime add table stock_daily;
alter publication supabase_realtime add table deposits;
