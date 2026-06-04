-- Supplier hapus request dari daftar/riwayat. RLS tak izinkan supplier delete tabel
-- langsung → RPC ber-gate supplier (cegah "Hapus" gagal diam-diam lalu muncul lagi
-- saat realtime hydrate).
create or replace function public.supplier_remove_request(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if private.app_role() <> 'supplier' then
    raise exception 'Hanya supplier yang boleh menghapus request';
  end if;
  delete from public.supplier_requests where id = p_id;
end $$;
revoke all on function public.supplier_remove_request(uuid) from public;
grant execute on function public.supplier_remove_request(uuid) to authenticated;
