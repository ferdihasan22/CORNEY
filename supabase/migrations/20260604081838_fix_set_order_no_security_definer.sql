-- FIX: nomor antrian (no) selalu 1 untuk pesanan customer. Trigger set_order_no
-- jalan sebagai INVOKER (anon saat customer pesan) → anon tak boleh SELECT orders
-- (RLS) → max(no) lihat 0 baris → no selalu 1. Jadikan SECURITY DEFINER supaya
-- query max(no) baca semua order (bypass RLS). Aman: hanya menghitung & set new.no.
create or replace function public.set_order_no() returns trigger
  language plpgsql security definer set search_path to 'public' as $$
begin
  if new.no is null then
    perform pg_advisory_xact_lock(hashtext(new.branch_id || ':' || new.order_date::text));
    select coalesce(max(no), 0) + 1 into new.no
      from orders where branch_id = new.branch_id and order_date = new.order_date;
  end if;
  return new;
end $$;
