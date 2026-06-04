-- KEAMANAN: hapus backdoor customer_mark_paid. Status LUNAS HANYA boleh di-set oleh
-- webhook Midtrans (signature-verified, service_role) — BUKAN frontend. Customer tahu
-- id+pin order-nya sendiri → tanpa ini bisa tandai lunas tanpa bayar (fraud).
-- (cancel/contacted tetap; itu bukan soal uang.)
drop function if exists public.customer_mark_paid(uuid, text);
