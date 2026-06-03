-- FASE 6 — SUPPLIER / BELANJA
create table ops_belanja (
  branch_id text references branches(id), item_id text,
  name text, qty int default 0, remember boolean default false,
  primary key (branch_id, item_id)
);
create table supplier_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), tgl date,
  status text default 'menunggu', items jsonb,
  created_at timestamptz default now()
);
create table supplier_fulfilled (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), tgl date, items jsonb,
  at timestamptz default now()
);
create table supplier_prices (
  item_id text primary key, price int, prev int, at timestamptz default now()
);

alter table ops_belanja enable row level security;
alter table supplier_requests enable row level security;
alter table supplier_fulfilled enable row level security;
alter table supplier_prices enable row level security;

-- ops_belanja: ops R/W; kasir/auditor/supplier baca; owner penuh
create policy opsbelanja_owner_all on ops_belanja for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy opsbelanja_ops_rw on ops_belanja for all using (private.app_role()='operasional') with check (private.app_role()='operasional');
create policy opsbelanja_read on ops_belanja for select using (private.app_role() in ('kasir','auditor','supplier'));

-- supplier_requests: ops R/W; supplier/kasir/auditor baca; owner penuh
create policy sreq_owner_all on supplier_requests for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy sreq_ops_rw on supplier_requests for all using (private.app_role()='operasional') with check (private.app_role()='operasional');
create policy sreq_read on supplier_requests for select using (private.app_role() in ('supplier','kasir','auditor'));

-- supplier_fulfilled: supplier R/W; kasir/ops/auditor baca; owner penuh
create policy sful_owner_all on supplier_fulfilled for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy sful_supplier_rw on supplier_fulfilled for all using (private.app_role()='supplier') with check (private.app_role()='supplier');
create policy sful_read on supplier_fulfilled for select using (private.app_role() in ('kasir','operasional','auditor'));

-- supplier_prices: supplier R/W + owner R/W (harga acuan); kasir/ops/auditor baca
create policy sprice_owner_all on supplier_prices for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy sprice_supplier_rw on supplier_prices for all using (private.app_role()='supplier') with check (private.app_role()='supplier');
create policy sprice_read on supplier_prices for select using (private.app_role() in ('kasir','operasional','auditor'));

-- realtime: supplier_requests, supplier_fulfilled (ops minta -> supplier penuhi)
alter publication supabase_realtime add table supplier_requests;
alter publication supabase_realtime add table supplier_fulfilled;
