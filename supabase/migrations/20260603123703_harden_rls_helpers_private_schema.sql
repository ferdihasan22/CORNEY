-- HARDENING: pindahkan helper RLS ke schema 'private' (tidak diekspos PostgREST)
-- => menutup 4 WARN advisor, tapi policy RLS tetap bisa memakainya.

-- 1) schema privat + akses untuk evaluasi RLS
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- 2) helper versi privat (tetap SECURITY DEFINER => anti-rekursi saat baca profiles)
create or replace function private.app_role() returns text
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function private.app_branch() returns text
  language sql stable security definer set search_path = public as $$
  select branch_id from profiles where id = auth.uid()
$$;
grant execute on function private.app_role(), private.app_branch()
  to anon, authenticated, service_role;

-- 3) arahkan ulang semua policy ke private.app_role()
alter policy branches_owner_all           on branches           using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy profiles_owner_all           on profiles           using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy parents_owner_all            on parents            using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy menus_owner_all              on menus              using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy sauces_owner_all             on sauces             using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy promos_owner_all             on promos             using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy banners_owner_all            on banners            using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy branch_overrides_owner_all   on branch_overrides   using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy par_stock_owner_all          on par_stock          using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy investor_config_owner_all    on investor_config    using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy analisa_owner_all            on analisa            using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy shopping_items_owner_all     on shopping_items     using (private.app_role()='owner') with check (private.app_role()='owner');
alter policy par_stock_staff_read         on par_stock          using (private.app_role() in ('operasional','produksi','auditor','kasir'));
alter policy investor_config_auditor_read on investor_config    using (private.app_role()='auditor');
alter policy analisa_auditor_read         on analisa            using (private.app_role()='auditor');
alter policy shopping_items_read          on shopping_items     using (private.app_role() in ('operasional','kasir','supplier'));
alter policy shopping_items_ops_write     on shopping_items     using (private.app_role()='operasional') with check (private.app_role()='operasional');

-- 4) buang helper publik lama (sudah tidak ada policy yang memakainya)
drop function public.app_role();
drop function public.app_branch();
