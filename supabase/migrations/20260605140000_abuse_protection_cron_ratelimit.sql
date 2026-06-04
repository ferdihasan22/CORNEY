-- Proteksi penyalahgunaan Customer PWA (anon) — TANPA mengubah alur (fail-safe).
-- (A) pg_cron: hapus order BELUM-BAYAR yang basi (>60 mnt) → cegah bloat DB & inflasi
--     nomor antrian dari spam. HANYA paid=false; order LUNAS tak pernah disentuh.
create extension if not exists pg_cron;
do $$ begin perform cron.unschedule('purge-stale-unpaid-orders'); exception when others then null; end $$;
select cron.schedule('purge-stale-unpaid-orders', '*/20 * * * *',
  $$delete from public.orders where paid = false and created_at < now() - interval '60 minutes'$$);

-- (B) Rate-limit per-kunci (dipakai Edge midtrans-charge per-IP) → cegah abuse biaya
--     Midtrans. Tabel internal; RLS tanpa policy = anon/authenticated TAK bisa akses;
--     fungsi security-definer (owner) tetap bisa. Edge memanggil via service_role.
create table if not exists public.rate_limit (
  k            text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);
alter table public.rate_limit enable row level security;

create or replace function public.rl_hit(p_key text, p_max int, p_window int) returns boolean
  language plpgsql security definer set search_path = public as $$
declare w timestamptz; c int;
begin
  select window_start, count into w, c from public.rate_limit where k = p_key for update;
  if not found then
    insert into public.rate_limit(k, window_start, count) values (p_key, now(), 1);
    return true;
  end if;
  if w < now() - make_interval(secs => p_window) then
    update public.rate_limit set window_start = now(), count = 1 where k = p_key;
    return true;
  end if;
  update public.rate_limit set count = count + 1 where k = p_key;
  return (c + 1) <= p_max;  -- true = masih dalam batas; false = lewat batas
end $$;
revoke all on function public.rl_hit(text, int, int) from public;
grant execute on function public.rl_hit(text, int, int) to service_role;
