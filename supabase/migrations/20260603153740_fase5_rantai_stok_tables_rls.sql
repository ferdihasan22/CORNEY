-- FASE 5 — RANTAI FREEZER / STOK
create table freezer (
  branch_id text references branches(id), parent_id text references parents(id),
  sisa int default 0, min int default 0, target int default 0,
  primary key (branch_id, parent_id)
);
create table production (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), parent_id text references parents(id),
  jadi int default 0, susut int default 0, alasan text, created_at timestamptz default now()
);
create table shipments (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), parent_id text references parents(id),
  qty int, status text default 'menunggu', selisih int default 0,
  created_at timestamptz default now(), confirmed_at timestamptz
);
create table opname (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), mode text, rows jsonb, total_selisih int,
  created_at timestamptz default now()
);
create table freezer_corrections (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), parent_id text references parents(id),
  current int, proposed int, reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(), resolved_at timestamptz
);
create table audits (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), note text, all_cocok boolean, rows jsonb,
  created_at timestamptz default now()
);

alter table freezer enable row level security;
alter table production enable row level security;
alter table shipments enable row level security;
alter table opname enable row level security;
alter table freezer_corrections enable row level security;
alter table audits enable row level security;

-- freezer: kasir/auditor baca; ops/produksi R/W; owner penuh
create policy freezer_owner_all on freezer for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy freezer_read on freezer for select using (private.app_role() in ('kasir','auditor'));
create policy freezer_rw on freezer for all using (private.app_role() in ('operasional','produksi')) with check (private.app_role() in ('operasional','produksi'));

-- production: ops/auditor baca; produksi R/W; owner penuh
create policy production_owner_all on production for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy production_read on production for select using (private.app_role() in ('operasional','auditor'));
create policy production_rw on production for all using (private.app_role()='produksi') with check (private.app_role()='produksi');

-- shipments: kasir R/W cabang sendiri (terima); ops R/W (kirim); produksi/auditor baca; owner penuh
create policy shipments_owner_all on shipments for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy shipments_kasir_rw_own on shipments for all using (private.app_role()='kasir' and branch_id=private.app_branch()) with check (private.app_role()='kasir' and branch_id=private.app_branch());
create policy shipments_ops_rw on shipments for all using (private.app_role()='operasional') with check (private.app_role()='operasional');
create policy shipments_read on shipments for select using (private.app_role() in ('produksi','auditor'));

-- opname: ops/auditor baca; produksi R/W; owner penuh
create policy opname_owner_all on opname for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy opname_read on opname for select using (private.app_role() in ('operasional','auditor'));
create policy opname_rw on opname for all using (private.app_role()='produksi') with check (private.app_role()='produksi');

-- freezer_corrections: produksi ajukan (insert); ops/auditor/produksi baca; owner approve (penuh)
create policy fc_owner_all on freezer_corrections for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy fc_read on freezer_corrections for select using (private.app_role() in ('operasional','auditor','produksi'));
create policy fc_prod_insert on freezer_corrections for insert with check (private.app_role()='produksi' and status='pending');

-- audits: kasir baca cabang sendiri; ops R/W; auditor baca; owner penuh
create policy audits_owner_all on audits for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy audits_kasir_read_own on audits for select using (private.app_role()='kasir' and branch_id=private.app_branch());
create policy audits_ops_rw on audits for all using (private.app_role()='operasional') with check (private.app_role()='operasional');
create policy audits_auditor_read on audits for select using (private.app_role()='auditor');

-- realtime (live): freezer, shipments, freezer_corrections
alter publication supabase_realtime add table freezer;
alter publication supabase_realtime add table shipments;
alter publication supabase_realtime add table freezer_corrections;
