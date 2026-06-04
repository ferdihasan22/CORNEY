-- Status "buka untuk online" per cabang. Di-set kasir saat Opening selesai (fase
-- jualan) & dibersihkan saat Closing → dibaca customer LINTAS PERANGKAT (ganti
-- pengecekan day.js lokal yang tak tersinkron).
create table if not exists public.branch_status (
  branch_id text primary key references public.branches(id) on delete cascade,
  online_open boolean not null default false,
  open_date date,
  updated_at timestamptz not null default now()
);
alter table public.branch_status enable row level security;

-- Baca: SEMUA (termasuk anon customer) supaya picker tahu cabang buka.
drop policy if exists bs_read on public.branch_status;
create policy bs_read on public.branch_status for select using (true);

-- Owner kelola penuh (jaga-jaga / reset).
drop policy if exists bs_owner on public.branch_status;
create policy bs_owner on public.branch_status for all
  using (private.app_role() = 'owner') with check (private.app_role() = 'owner');

-- Kasir set status cabang SENDIRI lewat RPC (aman: tak bisa sentuh cabang lain,
-- tak bisa ubah kolom config branches).
create or replace function public.kasir_set_open(p_open boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare b text;
begin
  if private.app_role() <> 'kasir' then
    raise exception 'Hanya kasir yang boleh set status buka';
  end if;
  b := private.app_branch();
  if b is null then return; end if;
  insert into public.branch_status(branch_id, online_open, open_date, updated_at)
    values (b, p_open, case when p_open then current_date else null end, now())
  on conflict (branch_id) do update
    set online_open = excluded.online_open, open_date = excluded.open_date, updated_at = now();
end $$;
revoke all on function public.kasir_set_open(boolean) from public;
grant execute on function public.kasir_set_open(boolean) to authenticated;
