-- Gambar QRIS GoPay (statis) per cabang → muncul di metode pembayaran "QRIS GoPay"
-- di PWA kasir. URL Cloudinary (upload via Owner Kelola Cabang).
alter table public.branches add column if not exists qris_img text;
