-- FASE 1 — TABEL KONFIGURASI (read-mostly; tulis = Owner)

-- ============ DDL ============
create table parents (
  id   text primary key,
  name text not null,
  sort int default 0
);

create table menus (
  id        text primary key,
  parent_id text references parents(id),
  name      text not null,
  category  text,                 -- 'savory' | 'sweet'
  price     int  not null,
  label     text,
  img       text,                 -- URL Cloudinary
  active    boolean default true
);

create table sauces (
  id    text primary key,
  name  text,
  price int default 0
);

create table promos (
  id     text primary key,
  data   jsonb,
  active boolean default false
);

create table banners (
  id     text primary key,
  data   jsonb,
  sort   int,
  active boolean default true
);

create table branch_overrides (
  branch_id text references branches(id),
  menu_id   text references menus(id),
  patch     jsonb,
  primary key (branch_id, menu_id)
);

create table par_stock (
  branch_id text references branches(id),
  parent_id text references parents(id),
  qty       int default 0,
  primary key (branch_id, parent_id)
);

create table investor_config (
  branch_id text primary key references branches(id),
  sewa  int default 0,
  gaji  int default 0,
  value int default 0,
  pct   int default 0
);

create table analisa (
  ingredient_id text primary key,
  name     text,
  per_unit numeric,
  unit     text
);

create table shopping_items (
  id       text primary key,
  name     text,
  kategori text,
  active   boolean default true
);

-- ============ RLS: enable ============
alter table parents          enable row level security;
alter table menus            enable row level security;
alter table sauces           enable row level security;
alter table promos           enable row level security;
alter table banners          enable row level security;
alter table branch_overrides enable row level security;
alter table par_stock        enable row level security;
alter table investor_config  enable row level security;
alter table analisa          enable row level security;
alter table shopping_items   enable row level security;

-- ============ RLS: Owner full di SEMUA tabel ============
create policy parents_owner_all          on parents          for all using (app_role()='owner') with check (app_role()='owner');
create policy menus_owner_all            on menus            for all using (app_role()='owner') with check (app_role()='owner');
create policy sauces_owner_all           on sauces           for all using (app_role()='owner') with check (app_role()='owner');
create policy promos_owner_all           on promos           for all using (app_role()='owner') with check (app_role()='owner');
create policy banners_owner_all          on banners          for all using (app_role()='owner') with check (app_role()='owner');
create policy branch_overrides_owner_all on branch_overrides for all using (app_role()='owner') with check (app_role()='owner');
create policy par_stock_owner_all        on par_stock        for all using (app_role()='owner') with check (app_role()='owner');
create policy investor_config_owner_all  on investor_config  for all using (app_role()='owner') with check (app_role()='owner');
create policy analisa_owner_all          on analisa          for all using (app_role()='owner') with check (app_role()='owner');
create policy shopping_items_owner_all   on shopping_items   for all using (app_role()='owner') with check (app_role()='owner');

-- ============ RLS: katalog baca publik (anon/customer) ============
create policy parents_read_all          on parents          for select using (true);
create policy menus_read_all            on menus            for select using (true);
create policy sauces_read_all           on sauces           for select using (true);
create policy promos_read_all           on promos           for select using (true);
create policy banners_read_all          on banners          for select using (true);
create policy branch_overrides_read_all on branch_overrides for select using (true);

-- ============ RLS: par_stock = staf saja (bukan customer/supplier) ============
create policy par_stock_staff_read on par_stock for select
  using (app_role() in ('operasional','produksi','auditor','kasir'));

-- ============ RLS: investor_config & analisa = auditor baca (owner via owner_all) ============
create policy investor_config_auditor_read on investor_config for select
  using (app_role() = 'auditor');
create policy analisa_auditor_read on analisa for select
  using (app_role() = 'auditor');

-- ============ RLS: shopping_items = kasir/supplier baca; operasional R/W ============
create policy shopping_items_read on shopping_items for select
  using (app_role() in ('operasional','kasir','supplier'));
create policy shopping_items_ops_write on shopping_items for all
  using (app_role() = 'operasional') with check (app_role() = 'operasional');
