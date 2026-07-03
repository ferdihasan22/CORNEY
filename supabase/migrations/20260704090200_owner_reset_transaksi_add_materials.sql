-- Sertakan materials di "Mulai Bersih" (go-live) agar stok bahan baku ikut nol di
-- SERVER — kalau tidak, ia akan hidrasi ulang & "balik lagi" (bug lokal-saja).
create or replace function owner_reset_transaksi() returns void
  language plpgsql security definer set search_path = public as $$
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'owner' then
    raise exception 'Hanya owner yang boleh Mulai Bersih';
  end if;
  truncate orders, sales_daily, stock_daily, expense, usage, deposits, production,
           shipments, opname, freezer_corrections, audits, supplier_requests,
           supplier_fulfilled, month_close, audit_log, materials;
  update freezer set sisa = 0;
end $$;
revoke all on function owner_reset_transaksi() from public;
grant execute on function owner_reset_transaksi() to authenticated;
