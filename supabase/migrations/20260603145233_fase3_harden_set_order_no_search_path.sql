-- Hardening: kunci search_path fungsi trigger (tutup WARN advisor).
create or replace function set_order_no() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.no is null then
    perform pg_advisory_xact_lock(hashtext(new.branch_id || ':' || new.order_date::text));
    select coalesce(max(no), 0) + 1 into new.no
      from orders where branch_id = new.branch_id and order_date = new.order_date;
  end if;
  return new;
end $$;
