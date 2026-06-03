-- "Mulai Bersih" versi DB: owner-only, truncate SEMUA tabel transaksi, sisakan
-- config (branches/menus/par_stock/investor_config/profiles/analisa/shopping_items/
-- supplier_prices/ledger). freezer: sisa di-nol-kan (stok awal via app), config min/target tetap.
create or replace function owner_reset_transaksi() returns void
  language plpgsql security definer set search_path = public as $$
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'owner' then
    raise exception 'Hanya owner yang boleh Mulai Bersih';
  end if;
  truncate orders, sales_daily, stock_daily, expense, usage, deposits, production,
           shipments, opname, freezer_corrections, audits, supplier_requests,
           supplier_fulfilled, month_close, audit_log;
  update freezer set sisa = 0;
end $$;
revoke all on function owner_reset_transaksi() from public;
grant execute on function owner_reset_transaksi() to authenticated;
