-- FASE 3 — ORDERS (realtime, inti). Customer insert; kasir kelola; owner/ops/auditor baca.

create table orders (
  id uuid primary key default gen_random_uuid(),
  no int,
  order_date date not null default current_date,   -- nomor antrian reset harian
  branch_id text not null references branches(id),
  lines jsonb not null,
  subtotal int, discount int default 0, total int,
  method text check (method in ('ambil','maxim')),
  schedule text, name text, wa text, pin text,
  status text default 'baru' check (status in ('baru','diproses','siap','selesai')),
  paid boolean default false, pay_method text, contacted boolean default false,
  cooking jsonb default '{}',
  promo_code text,
  created_at timestamptz default now()
);
create index orders_branch_date_idx on orders (branch_id, order_date);
create index orders_branch_status_idx on orders (branch_id, status);

-- Nomor antrian per cabang per hari, ANTI-BALAPAN (advisory lock men-serialize
-- per branch+tanggal; aman saat banyak order online masuk bersamaan).
create or replace function set_order_no() returns trigger language plpgsql as $$
begin
  if new.no is null then
    perform pg_advisory_xact_lock(hashtext(new.branch_id || ':' || new.order_date::text));
    select coalesce(max(no), 0) + 1 into new.no
      from orders where branch_id = new.branch_id and order_date = new.order_date;
  end if;
  return new;
end $$;
create trigger trg_order_no before insert on orders for each row execute function set_order_no();

-- Lacak order oleh customer TANPA login: RPC ber-PIN (anon tak boleh select orders).
create or replace function get_my_order(p_id uuid, p_pin text)
returns setof orders language sql security definer set search_path = public as $$
  select * from orders where id = p_id and pin = p_pin
$$;
revoke all on function get_my_order(uuid, text) from public;
grant execute on function get_my_order(uuid, text) to anon, authenticated;

-- ── RLS ──
alter table orders enable row level security;

-- Owner penuh
create policy orders_owner_all on orders for all
  using (private.app_role() = 'owner') with check (private.app_role() = 'owner');

-- Customer (anon) HANYA boleh insert order baru & belum bayar (tak boleh select)
create policy orders_customer_insert on orders for insert to anon
  with check (status = 'baru' and paid = false and coalesce(total, 0) >= 0);

-- Kasir: baca/tulis order cabangnya sendiri
create policy orders_kasir_rw_own on orders for all
  using (private.app_role() = 'kasir' and branch_id = private.app_branch())
  with check (private.app_role() = 'kasir' and branch_id = private.app_branch());

-- Ops/Auditor: baca semua (owner sudah lewat owner_all)
create policy orders_staff_read on orders for select
  using (private.app_role() in ('operasional', 'auditor'));

-- ── Realtime: hanya staf yang subscribe (customer pakai RPC, JANGAN buka channel) ──
alter publication supabase_realtime add table orders;
