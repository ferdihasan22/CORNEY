-- "Reset Bulan" versi DB: owner-only, kosongkan HANYA tabel LAPORAN keuangan+stok
-- (sales_daily, stock_daily, expense, usage, deposits) untuk mulai bulan baru.
-- Tidak menyentuh produksi/order/freezer/supplier (itu ranah "Mulai Bersih").
-- Perbaikan bug: sebelumnya tombol Reset Bulan hanya mengosongkan cache lokal
-- (clearSalesDaily=commit([])) → data hidrasi ulang dari server & "balik lagi".
create or replace function owner_reset_laporan() returns void
  language plpgsql security definer set search_path = public as $$
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'owner' then
    raise exception 'Hanya owner yang boleh Reset Bulan';
  end if;
  truncate sales_daily, stock_daily, expense, usage, deposits;
end $$;
revoke all on function owner_reset_laporan() from public;
grant execute on function owner_reset_laporan() to authenticated;
