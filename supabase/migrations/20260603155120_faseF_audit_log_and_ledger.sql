-- §2.F audit_log (APPEND-ONLY) + §10.3 ledger (buku besar pembelian)
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  type text, who text, branch_id text, old_val text, new_val text, note text,
  ts timestamptz default now()
);
create table ledger (
  id text primary key, item text, unit text,
  latest_price int, prev_price int, ordered int, received int, last_date date
);

alter table audit_log enable row level security;
alter table ledger enable row level security;

-- audit_log: APPEND-ONLY → hanya insert (semua staf login) + select (auditor/owner).
-- TIDAK ada policy update/delete (termasuk owner) → jejak tak bisa diubah.
create policy auditlog_insert on audit_log for insert to authenticated with check (private.app_role() is not null);
create policy auditlog_read on audit_log for select using (private.app_role() in ('owner','auditor'));

-- ledger: owner R/W (buku besar); auditor baca
create policy ledger_owner_all on ledger for all using (private.app_role()='owner') with check (private.app_role()='owner');
create policy ledger_auditor_read on ledger for select using (private.app_role()='auditor');
