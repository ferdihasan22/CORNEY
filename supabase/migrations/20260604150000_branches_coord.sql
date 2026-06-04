-- Koordinat GPS cabang ("lat,lng") untuk fitur "cabang terdekat" di app customer.
-- Disimpan apa adanya (string hasil copy dari Google Maps), customer yang parse.
alter table public.branches add column if not exists coord text;
