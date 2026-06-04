-- Aktifkan REALTIME untuk branch_status (status buka + ketersediaan menu) supaya
-- customer dapat update HABIS/buka-tutup seketika tanpa refresh. Idempoten.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'branch_status'
  ) then
    alter publication supabase_realtime add table public.branch_status;
  end if;
end $$;
