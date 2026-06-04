-- FIX 2 bug kritis (terbukti via uji RLS impersonasi): auditor tak bisa simpan
-- verifikasi setoran (deposits) & supplier tak bisa simpan update checklist
-- (supplier_requests) karena RLS hanya beri SELECT. Daripada membuka tabel lebar,
-- pakai RPC security-definer ber-gate role (pola sama kasir_set_open dll).

-- Auditor: tulis HANYA field verifikasi (meta jsonb di-merge), tak bisa ubah amount/branch.
create or replace function public.auditor_verify_deposit(p_id uuid, p_meta jsonb)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if private.app_role() <> 'auditor' then
    raise exception 'Hanya auditor yang boleh verifikasi setoran';
  end if;
  update public.deposits
    set meta = coalesce(meta, '{}'::jsonb) || coalesce(p_meta, '{}'::jsonb)
    where id = p_id;
end $$;
revoke all on function public.auditor_verify_deposit(uuid, jsonb) from public;
grant execute on function public.auditor_verify_deposit(uuid, jsonb) to authenticated;

-- Supplier: ubah items (centang/qty) & status request yg dibuat Operasional.
-- Tak bisa buat/hapus request, tak bisa ubah cabang/tanggal.
create or replace function public.supplier_set_request(p_id uuid, p_items jsonb, p_status text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if private.app_role() <> 'supplier' then
    raise exception 'Hanya supplier yang boleh ubah request';
  end if;
  update public.supplier_requests
    set items = coalesce(p_items, items), status = coalesce(p_status, status)
    where id = p_id;
end $$;
revoke all on function public.supplier_set_request(uuid, jsonb, text) from public;
grant execute on function public.supplier_set_request(uuid, jsonb, text) to authenticated;
