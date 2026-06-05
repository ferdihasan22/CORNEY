-- PUSH NOTIFICATION (FCM) — tabel token device + RPC daftar/hapus.
--
-- Dipakai Edge Function `notify-order` untuk mengirim push "order online masuk"
-- ke tablet kasir cabang terkait, walau app di-background/ditutup. Notif "angkat
-- gorengan" TIDAK lewat sini (itu notifikasi lokal di tablet).
--
-- Keamanan: token didaftarkan lewat RPC SECURITY DEFINER yang mengambil
-- role+branch OTORITATIF dari `profiles` (client tak bisa memalsukan cabang).
-- Edge Function membaca token pakai service_role (bypass RLS).

create table if not exists public.device_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null,
  branch_id  text references public.branches(id),
  platform   text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_branch_role_idx
  on public.device_tokens(branch_id, role);

alter table public.device_tokens enable row level security;

-- Pemilik boleh lihat & hapus token miliknya sendiri. Penulisan via RPC di bawah.
create policy device_tokens_self_read on public.device_tokens
  for select using (user_id = auth.uid());
create policy device_tokens_self_delete on public.device_tokens
  for delete using (user_id = auth.uid());

-- Daftar/refresh token milik user yang login. role+branch diambil dari profiles
-- (anti-spoof). Idempoten via PK token (re-login di device sama → token dipindah).
create or replace function public.register_device_token(p_token text, p_platform text default 'android')
  returns void language plpgsql security definer set search_path = public as $$
declare v_role text; v_branch text;
begin
  if p_token is null or length(p_token) < 10 then return; end if;
  select role, branch_id into v_role, v_branch from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'Tak ada profil untuk user ini';
  end if;
  insert into public.device_tokens(token, user_id, role, branch_id, platform, updated_at)
    values (p_token, auth.uid(), v_role, v_branch, coalesce(p_platform, 'android'), now())
  on conflict (token) do update
    set user_id = excluded.user_id, role = excluded.role, branch_id = excluded.branch_id,
        platform = excluded.platform, updated_at = now();
end $$;
revoke all on function public.register_device_token(text, text) from public;
grant execute on function public.register_device_token(text, text) to authenticated;

-- Hapus token (mis. saat logout di tablet itu).
create or replace function public.unregister_device_token(p_token text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.device_tokens where token = p_token and user_id = auth.uid();
end $$;
revoke all on function public.unregister_device_token(text) from public;
grant execute on function public.unregister_device_token(text) to authenticated;
