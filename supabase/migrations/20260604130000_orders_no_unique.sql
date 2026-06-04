-- Sabuk pengaman: nomor antrian online unik per cabang per hari. Trigger set_order_no
-- (advisory lock) sudah mencegah balapan; index ini menjaminnya di level DB (andai ada
-- upaya sisip 'no' manual). NULL diabaikan Postgres (boleh banyak) → tak ganggu insert.
create unique index if not exists orders_branch_date_no_uq
  on orders (branch_id, order_date, no);
