-- Aksi-tulis CUSTOMER lewat RPC security-definer ber-PIN (anon tak boleh update
-- orders langsung). Pola sama get_my_order: customer hanya bisa mengubah order
-- miliknya (cocok id+pin). Sama seperti get_my_order, RPC ini SENGAJA anon-callable
-- (akan muncul di advisor sebagai WARN by-design).

-- Tandai LUNAS. Untuk FASE 3 dipanggil klien setelah QRIS Midtrans terkonfirmasi;
-- FASE 7 (webhook Edge service_role) akan jadi sumber kebenaran final.
create or replace function customer_mark_paid(p_id uuid, p_pin text)
returns setof orders language sql security definer set search_path = public as $$
  update orders set paid = true
   where id = p_id and pin = p_pin and paid = false
  returning *
$$;

-- Batalkan order yang BELUM dibayar.
create or replace function customer_cancel_order(p_id uuid, p_pin text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from orders where id = p_id and pin = p_pin and paid = false;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Tandai sudah menghubungi kasir via WA (cegah WA kasir kena banned chat duluan).
create or replace function customer_mark_contacted(p_id uuid, p_pin text)
returns setof orders language sql security definer set search_path = public as $$
  update orders set contacted = true
   where id = p_id and pin = p_pin
  returning *
$$;

revoke all on function customer_mark_paid(uuid, text)      from public;
revoke all on function customer_cancel_order(uuid, text)    from public;
revoke all on function customer_mark_contacted(uuid, text)  from public;
grant execute on function customer_mark_paid(uuid, text)     to anon, authenticated;
grant execute on function customer_cancel_order(uuid, text)  to anon, authenticated;
grant execute on function customer_mark_contacted(uuid, text) to anon, authenticated;
