-- Ketersediaan menu per cabang (untuk customer lintas perangkat): {off:[menuId],
-- sold:[parentId habis]}. Di-set kasir saat matikan menu / stok induk jadi 0.
alter table public.branch_status add column if not exists availability jsonb not null default '{}'::jsonb;

create or replace function public.kasir_set_availability(p_avail jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare b text;
begin
  if private.app_role() <> 'kasir' then
    raise exception 'Hanya kasir yang boleh set ketersediaan';
  end if;
  b := private.app_branch();
  if b is null then return; end if;
  insert into public.branch_status(branch_id, availability, updated_at)
    values (b, coalesce(p_avail, '{}'::jsonb), now())
  on conflict (branch_id) do update
    set availability = excluded.availability, updated_at = now();
end $$;
revoke all on function public.kasir_set_availability(jsonb) from public;
grant execute on function public.kasir_set_availability(jsonb) to authenticated;
