-- Saklar manual Owner: buka/tutup "Toko Online" cabang TERTENTU (override kasir).
-- Mirror kasir_set_open tapi owner pilih cabang. RLS branch_status sudah izinkan
-- owner penuh; RPC ini menjaga open_date konsisten (current_date saat buka).
create or replace function public.owner_set_open(p_branch text, p_open boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if private.app_role() <> 'owner' then
    raise exception 'Hanya owner yang boleh set status buka cabang';
  end if;
  if p_branch is null then return; end if;
  insert into public.branch_status(branch_id, online_open, open_date, updated_at)
    values (p_branch, p_open, case when p_open then current_date else null end, now())
  on conflict (branch_id) do update
    set online_open = excluded.online_open, open_date = excluded.open_date, updated_at = now();
end $$;
revoke all on function public.owner_set_open(text, boolean) from public;
grant execute on function public.owner_set_open(text, boolean) to authenticated;
