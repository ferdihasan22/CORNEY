# CORNEY — TAHAP 4: Migrasi ke Supabase (Peta Migrasi · Skema Tabel · RLS)

> Dokumen perencanaan. Belum dieksekusi. Setelah disetujui & MCP Supabase aktif,
> tabel dibuat lewat `apply_migration`. **Aturan wajib:** RLS aktif di SEMUA tabel;
> kunci rahasia (service_role, Midtrans Server Key) hanya di server/Edge Function;
> anon key boleh di browser hanya karena RLS aktif.

Stack final: **Hostinger (domain) · Cloudflare Pages (web) · Supabase (DB+Auth) · Cloudinary (gambar) · Midtrans (bayar) · Cloudflare Access (gerbang subdomain staff)**.

---

## 0. Prinsip yang dipertahankan dari Fase 2

1. **MASTER LAPORAN = satu sumber kebenaran.** `sales_daily` + `stock_daily` tetap jadi sumber; semua angka Owner (laba, agregat, anomali, pelacakan stok) **diturunkan** dari sana — via `aggregate.js`/`stocktrace.js` di klien (Tahap A) atau SQL **VIEW** (Tahap B, opsional).
2. **Pemisahan tugas (separation of duties).** Yang pegang barang tidak bisa ubah angka sendiri (mis. koreksi sisa freezer & opname → lewat approval Owner). Ini diperkuat oleh RLS, bukan cuma UI.
3. **Sinkron realtime.** Listener `window 'storage'` (cross-tab) **diganti Supabase Realtime** (lintas perangkat & subdomain). Pola observable store (`subscribers` + `commit`) dipertahankan; yang berubah hanya sumber datanya.
4. **Mulai dari nol saat go-live.** Tidak impor riwayat. DB kosong → Owner isi lewat app (lihat "Mulai Bersih"). Stok awal: freezer di layar Stok Awal; booth dihitung kasir hari pertama.

---

## 1. Model Identitas & Peran (Auth)

Supabase Auth (email + password). Tiap akun staf = 1 user auth + 1 baris `profiles`.

| Peran | Akun | branch_id | Catatan |
|---|---|---|---|
| `owner` | 1 | — | akses penuh |
| `operasional` | 1 | — | semua cabang |
| `produksi` | 1 | — | freezer/produksi |
| `auditor` | 1 | — | read + telusur, setoran |
| `supplier` | 1 | — | hanya belanja |
| `kasir` | 1 **per cabang** | wajib | login = cabang itu |
| `customer` | — (anon) | — | tanpa login; pakai anon key + RLS |

**Username → email.** Supabase butuh email. Pakai email sintetis stabil, mis.
`owner@corney.app`, `ops@corney.app`, `kasir.sepinggan@corney.app`, dst. (atau email asli).
"Username/password" di **Manajemen User** & **Kelola Cabang** memetakan ke akun auth ini —
pembuatan/ubah user auth butuh **service_role**, jadi lewat **Edge Function `admin-users`** (bukan dari browser).

### Tabel `profiles`
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','operasional','produksi','auditor','supplier','kasir')),
  branch_id text references branches(id),
  name text,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
```

### Helper RLS (dipakai semua policy)
```sql
create or replace function app_role() returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function app_branch() returns text language sql stable security definer set search_path = public as $$
  select branch_id from profiles where id = auth.uid()
$$;
```
> `app_role()='owner'` → akses penuh. Pola umum: Owner boleh segalanya; peran lain dibatasi.

---

## 2. Skema Tabel (kelompok)

> Konvensi: `branch_id text` memakai slug yang sama dengan app (`sepinggan`,`gunungsari`) →
> migrasi minim refactor. Map bersarang (variants/channels/v) disimpan **jsonb** agar
> cocok 1:1 dengan store sekarang. `tgl` disimpan `date` (bukan string DD/MM/YYYY).

### A. Konfigurasi (read-mostly; tulis = Owner)
```sql
create table branches (
  id text primary key,                 -- slug: sepinggan, gunungsari
  name text not null,
  address text, wa text, maps text, maxim_name text,
  kembalian int default 200000,
  stop_online text default '21:30',
  close_booth text default '22:00',
  active boolean default true
);

create table parents (                 -- isian induk: mozza, sosis, jumbo, mix
  id text primary key, name text not null, sort int default 0
);

create table menus (                   -- 11 varian
  id text primary key,
  parent_id text references parents(id),
  name text not null, category text,   -- savory/sweet
  price int not null, label text, img text, active boolean default true
);

create table sauces ( id text primary key, name text, price int default 0 );

create table recipes (                 -- takaran bahan per varian (jika dipakai)
  menu_id text references menus(id), ingredient text, qty numeric, unit text
);

create table promos ( id text primary key, data jsonb, active boolean default false );
create table banners ( id text primary key, data jsonb, sort int, active boolean default true );

create table branch_overrides (        -- harga/ketersediaan menu per cabang
  branch_id text references branches(id), menu_id text references menus(id),
  patch jsonb, primary key (branch_id, menu_id)
);

create table par_stock (               -- stok standar per cabang × isian
  branch_id text references branches(id), parent_id text references parents(id),
  qty int default 0, primary key (branch_id, parent_id)
);

create table investor_config (         -- bagi hasil per cabang
  branch_id text primary key references branches(id),
  sewa int default 0, gaji int default 0, value int default 0, pct int default 0
);

create table analisa (                 -- takaran porsi bahan (deteksi boros)
  ingredient_id text primary key, name text, per_unit numeric, unit text
);
```

### B. MASTER LAPORAN (sumber kebenaran harian)
```sql
create table sales_daily (
  id uuid primary key default gen_random_uuid(),
  tgl date not null, branch_id text not null references branches(id),
  variants jsonb default '{}',          -- {menuId: qty}
  channels jsonb default '{}',          -- {tunai,qris_midtrans,qris_gopay,gofood,grabfood}
  source jsonb default '{}',            -- {walkin, online}
  potongan jsonb default '{}',          -- {urgent, refund, gaji}
  sauces jsonb default '{}',
  belanja jsonb default '{}',           -- checklist {item: jumlah}
  kas_aktual int default 0,
  trx int default 0, peak_hour text,
  created_at timestamptz default now(),
  unique (tgl, branch_id)
);

create table stock_daily (
  id uuid primary key default gen_random_uuid(),
  tgl date not null, branch_id text not null references branches(id),
  v jsonb not null default '{}',        -- {parent:{datang,kemarin,terjual,patah,garansi,free,aktual}}
  created_at timestamptz default now(),
  unique (tgl, branch_id)
);

create table expense (                  -- uang belanjaan (manual by design)
  tgl date not null, branch_id text references branches(id),
  amount int default 0, primary key (tgl, branch_id)
);

create table usage (                    -- pemakaian uang
  id uuid primary key default gen_random_uuid(),
  tgl date not null, branch_id text references branches(id),
  jenis text check (jenis in ('cash','transfer')), amount int, note text,
  ts timestamptz default now()
);

create table deposits (                 -- setoran kasir→ops→auditor
  id uuid primary key default gen_random_uuid(),
  tgl date, branch_id text references branches(id),
  amount int, status text default 'menunggu', meta jsonb, created_at timestamptz default now()
);

create table month_close (              -- tutup bulan + snapshot beku
  month_key text primary key,           -- 'YYYY-MM'
  snapshot jsonb,                       -- {branches:{branchId:{omzet,laba,biaya,sewa,gaji,value,pct}}}
  locked_at timestamptz default now()
);
```

### C. Orders (realtime — paling sering berubah)
```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  no int, order_date date not null default current_date,  -- nomor antrian reset harian
  branch_id text not null references branches(id),
  lines jsonb not null, subtotal int, discount int default 0, total int,
  method text check (method in ('ambil','maxim')),
  schedule text, name text, wa text, pin text,
  status text default 'baru' check (status in ('baru','diproses','siap','selesai')),
  paid boolean default false, pay_method text, contacted boolean default false,
  cooking jsonb default '{}',           -- status masak (queued/frying) bila ada
  promo_code text, created_at timestamptz default now()
);
create index on orders (branch_id, order_date);
create index on orders (branch_id, status);
-- penomoran harian via trigger/RPC (lihat §6) supaya tahan balapan.
```

### D. Rantai Freezer / Stok
```sql
create table freezer (
  branch_id text references branches(id), parent_id text references parents(id),
  sisa int default 0, min int default 0, target int default 0,
  primary key (branch_id, parent_id)
);

create table production (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), parent_id text references parents(id),
  jadi int default 0, susut int default 0, alasan text, created_at timestamptz default now()
);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), parent_id text references parents(id),
  qty int, status text default 'menunggu', selisih int default 0,
  created_at timestamptz default now(), confirmed_at timestamptz
);

create table opname (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), mode text,
  rows jsonb, total_selisih int, created_at timestamptz default now()
);

create table freezer_corrections (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), parent_id text references parents(id),
  current int, proposed int, reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(), resolved_at timestamptz
);

create table audits (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), note text, all_cocok boolean,
  rows jsonb, created_at timestamptz default now()
);
```

### E. Belanja / Supplier
```sql
create table shopping_items ( id text primary key, name text, kategori text, active boolean default true );

create table ops_belanja (
  branch_id text references branches(id), item_id text,
  name text, qty int default 0, remember boolean default false,
  primary key (branch_id, item_id)
);

create table supplier_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), tgl date,
  status text default 'menunggu', items jsonb,   -- [{uid,id,name,reqQty,qty,src,ready}]
  created_at timestamptz default now()
);

create table supplier_fulfilled (
  id uuid primary key default gen_random_uuid(),
  branch_id text references branches(id), tgl date,
  items jsonb,                                    -- [{id,name,src,reqQty,qty,ready,price,luar}]
  at timestamptz default now()
);

create table supplier_prices (
  item_id text primary key, price int, prev int, at timestamptz default now()
);
```

### F. Jejak Audit (append-only)
```sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  type text, who text, branch_id text, old_val text, new_val text, note text,
  ts timestamptz default now()
);
```

### G. Gambar
- **Cloudinary** (rekomendasi): upload dari perangkat → URL disimpan di kolom `img`
  (`menus.img`, `banners.data->>img`, landing). Tidak makan kuota Supabase.
- Alternatif: **Supabase Storage** bucket `public-images` (1GB) — cukup untuk awal.

---

## 3. Matriks RLS (siapa boleh apa)

`R`=baca `W`=tulis · `own`=cabang sendiri · `—`=tidak · `pub`=termasuk anon (customer).

| Tabel | customer | kasir | operasional | produksi | auditor | supplier | owner |
|---|---|---|---|---|---|---|---|
| branches, menus, parents, sauces, promos, banners, branch_overrides | R(pub) | R | R | R | R | R | R/W |
| par_stock | — | R | R | R | R | — | R/W |
| investor_config, analisa, month_close | — | — | — | — | R | — | R/W |
| orders | **insert(pub)** + baca-via-RPC | R/W own | R | — | R | — | R/W |
| sales_daily, stock_daily | — | R/W own | R | — | R | — | R/W |
| expense, usage | — | — | R | — | R | — | R/W |
| deposits | — | R/W own (buat) | R/W (konfirmasi) | — | R | — | R/W |
| freezer | — | R | R/W (ambil −) | R/W (produksi +) | R | — | R/W |
| production | — | — | R | R/W | R | — | R |
| shipments | — | R/W own (terima) | R/W (kirim) | R | R | — | R |
| opname | — | — | R | R/W | R | — | R |
| freezer_corrections | — | — | R | W(ajukan) | R | — | R/W(approve) |
| audits | — | R own | R/W (audit) | — | R | — | R |
| ops_belanja, supplier_requests | — | R | R/W | — | R | R(req) | R |
| supplier_fulfilled, supplier_prices | — | R | R | — | R | R/W | R/W(harga acuan) |
| shopping_items | — | R | R/W | — | — | R | R/W |
| audit_log | — | insert | insert | insert | R | — | R |
| profiles | — | R(self) | R(self) | R(self) | R(self) | R(self) | R/W |

### Contoh policy (pola yang diulang)
```sql
-- Owner full access (template untuk semua tabel)
create policy owner_all on <tabel> for all
  using (app_role() = 'owner') with check (app_role() = 'owner');

-- branches/menus: publik boleh baca (customer butuh), owner tulis
alter table branches enable row level security;
create policy read_all on branches for select using (true);          -- termasuk anon
create policy owner_write on branches for all using (app_role()='owner') with check (app_role()='owner');

-- sales_daily: kasir hanya cabangnya; ops/auditor baca semua; owner penuh
alter table sales_daily enable row level security;
create policy kasir_rw_own on sales_daily for all
  using (app_role()='kasir' and branch_id = app_branch())
  with check (app_role()='kasir' and branch_id = app_branch());
create policy staff_read on sales_daily for select
  using (app_role() in ('owner','operasional','auditor'));
create policy owner_all on sales_daily for all
  using (app_role()='owner') with check (app_role()='owner');

-- orders: customer (anon) HANYA boleh insert order baru & belum bayar
alter table orders enable row level security;
create policy customer_insert on orders for insert to anon
  with check (status='baru' and paid=false and total >= 0);
create policy kasir_rw_own on orders for all
  using (app_role()='kasir' and branch_id=app_branch())
  with check (app_role()='kasir' and branch_id=app_branch());
create policy staff_read on orders for select
  using (app_role() in ('owner','operasional','auditor'));

-- freezer_corrections: produksi ajukan, owner approve
create policy produksi_propose on freezer_corrections for insert
  with check (app_role()='produksi' and status='pending');
create policy owner_resolve on freezer_corrections for all
  using (app_role()='owner') with check (app_role()='owner');
```

### Pelacakan order oleh customer (tanpa login)
Anon **tidak boleh `select *` orders** (bocor data). Sediakan RPC `security definer`:
```sql
create or replace function get_my_order(p_id uuid, p_pin text)
returns setof orders language sql security definer set search_path=public as $$
  select * from orders where id = p_id and pin = p_pin
$$;
```
Customer track/struk panggil RPC ini (punya id+pin dari checkout) → hanya lihat ordernya sendiri.

---

## 4. Realtime (ganti listener `storage`)

Aktifkan realtime untuk tabel "hidup": `orders`, `sales_daily`, `stock_daily`, `freezer`,
`shipments`, `freezer_corrections`, `supplier_requests`, `supplier_fulfilled`, `deposits`.

Pola adapter store (tetap sama untuk komponen):
```js
// supabaseStore(table) → { get, subscribe, ...mutators }
let cache = []
const subs = new Set()
async function refresh(){ const {data}=await supabase.from(table).select('*'); cache=data||[]; subs.forEach(f=>f()) }
supabase.channel(table).on('postgres_changes',{event:'*',schema:'public',table}, refresh).subscribe()
export const get = () => cache
export const subscribe = (fn)=>{ subs.add(fn); return ()=>subs.delete(fn) }
```
> `useSyncExternalStore(subscribe, get)` di komponen **tidak berubah**. Sinkron kini lintas
> perangkat & subdomain (bukan cuma antar-tab origin yang sama).

---

## 5. Strategi Migrasi Bertahap (aman, tidak merusak yang jalan)

**Pola adaptor + feature flag.** Tambah `VITE_BACKEND = local | supabase`. Tiap store punya
2 implementasi di balik antarmuka yang sama (`get/subscribe/commit`). Migrasi **per kelompok**,
bisa rollback dengan ganti flag.

| Fase | Isi | Risiko | Catatan |
|---|---|---|---|
| **0 — Fondasi** | Project Supabase, Auth, `profiles`, helper RLS, `@supabase/supabase-js`, env (URL+anon), Cloudflare Access di subdomain staff | rendah | belum ubah store |
| **1 — Konfigurasi** | branches, menus, parents, sauces, promos, banners, branch_overrides, par_stock, investor_config, analisa, shopping_items | rendah (read-mostly) | pindah baca dulu; Owner mulai isi via app |
| **2 — Auth nyata** | Edge Function `admin-users` (buat akun staf + kasir per cabang), ganti `roleAuth`/Kelola Cabang ke Supabase Auth | sedang | login jadi nyata; pertahankan kunci 3×→10mnt di sisi UI/atau Auth rate-limit |
| **3 — Orders (realtime)** | tabel orders + RPC nomor antrian + `get_my_order` + realtime; customer checkout → insert; kasir online live | **tinggi** (inti) | uji menyeluruh; ganti listener storage |
| **4 — MASTER LAPORAN** | sales_daily, stock_daily, expense, usage, deposits, month_close; alur closing kasir tulis ke DB | tinggi | aggregate.js baca dari DB; angka Owner ikut |
| **5 — Rantai stok** | freezer, production, shipments, opname, freezer_corrections, audits | sedang | approval lewat RLS |
| **6 — Supplier/belanja** | ops_belanja, supplier_requests, supplier_fulfilled, supplier_prices | sedang | |
| **7 — Gambar & bayar** | Cloudinary upload (ganti input URL → unggah file); Edge Function Midtrans (charge+webhook, **server key di server**) | sedang | webhook tandai `paid` |
| **8 — Cutover** | matikan flag local; localStorage cuma cache offline; "Mulai Bersih" → fungsi DB (truncate tabel transaksi, simpan config) | — | go-live |

**Backfill:** tidak ada (mulai bersih). Opsional: skrip ekspor localStorage→insert bila mau bawa data uji.

---

## 6. Edge Functions (kunci rahasia di server)

| Function | Guna | Kunci |
|---|---|---|
| `admin-users` | buat/ubah/hapus akun staf & kasir-per-cabang | **service_role** |
| `midtrans-charge` | buat transaksi QRIS | **Midtrans Server Key** |
| `midtrans-webhook` | terima notifikasi bayar → set `orders.paid=true` | Server Key (verifikasi signature) |
| `order-number` (atau trigger SQL) | nomor antrian per cabang per hari, anti-balapan | — |

Penomoran antrian anti-balapan (SQL):
```sql
create or replace function next_order_no(p_branch text) returns int language plpgsql as $$
declare n int; begin
  select coalesce(max(no),0)+1 into n from orders where branch_id=p_branch and order_date=current_date;
  return n; end $$;
```
(Atau hitung di Edge Function dalam transaksi.)

---

## 7. Derivasi MASTER LAPORAN

- **Tahap A (cepat, rendah risiko):** pertahankan `aggregate.js`/`stocktrace.js` di klien,
  hanya ganti sumber (baca dari Supabase, bukan localStorage). Logika tak berubah.
- **Tahap B (opsional, lebih kuat):** buat **VIEW** SQL (`v_laba_harian`, `v_anomali`,
  `v_pelacakan_stok`) agar perhitungan konsisten lintas klien & bisa dipakai laporan/ekspor.

---

## 8. Keputusan — SUDAH DIFINALKAN ✅

1. **Email staf: SINTETIS (bukan email asli).** Pola tetap:
   `owner@corney.app`, `ops@corney.app`, `produksi@corney.app`, `auditor@corney.app`,
   `supplier@corney.app`, dan kasir per cabang `kasir.<branchId>@corney.app`
   (mis. `kasir.sepinggan@corney.app`). Reset password lewat Owner (Edge `admin-users`),
   bukan email — karena email tidak nyata. Domain `@corney.app` hanya label internal,
   tidak perlu domain email beneran.
2. **Customer order:** anon `insert` + RPC `get_my_order` (id+pin). ✅
3. **Agregat:** Tahap A (klien, `aggregate.js`/`stocktrace.js` baca dari Supabase) dulu; VIEW menyusul. ✅
4. **Gambar:** **Cloudinary** (upload dari perangkat → URL di kolom `img`). ✅
5. **Supplier items:** `jsonb` di `supplier_requests`/`supplier_fulfilled` (cepat, minim refactor). ✅
6. **branch_id:** slug teks (`sepinggan`,`gunungsari`). ✅
7. **Kunci 3×→10 menit:** tetap di sisi app (sudah jadi) + didukung rate-limit Supabase Auth & Cloudflare Access. ✅

> Catatan: karena email sintetis, **konfirmasi email di Supabase Auth harus DIMATIKAN**
> (Auth → Providers → Email → "Confirm email" off), kalau tidak akun tak bisa login.

---

## 9. Checklist eksekusi (saat MCP aktif)

- [ ] Fase 0: project + Auth + profiles + helper + RLS template
- [ ] Fase 1: tabel konfigurasi + RLS + pindah baca
- [ ] Fase 2: Edge `admin-users` + auth nyata
- [ ] Fase 3: orders + RPC + realtime + checkout/kasir
- [ ] Fase 4: master laporan + closing
- [ ] Fase 5: rantai stok
- [ ] Fase 6: supplier/belanja
- [ ] Fase 7: Cloudinary + Midtrans Edge
- [ ] Fase 8: cutover + Mulai Bersih versi DB
- [ ] RLS diuji per peran (owner/kasir/ops/produksi/auditor/supplier/anon)
- [ ] Tidak ada service_role / Server Key di bundle browser
- [ ] `day_state` (lokal/tabel) diputuskan + offline POS diuji
- [ ] Tabel `ledger` & `members` dibuat (atau loyalty ditunda)
- [ ] Upload Cloudinary: preset unsigned terbatas / signature Edge
- [ ] Jadwal ekspor/backup berkala disiapkan

---

## 10. Hasil Review — yang TADINYA terlewat (penting)

Audit ulang seluruh store. Berikut yang belum tercakup di §1–9 + keputusannya.

### 10.1 `day_state` — keadaan hari jualan LIVE (paling krusial, tadi belum ada)
`day.js` memegang sesi jualan berjalan: `phase`, `startedAt`, `openingStock`, **`stock` (sisa hidup, berkurang tiap penjualan)**, `cash {opening}`, `menuOff`, `breakageLog`, `corrections`. Ini **bukan** Master Laporan (itu hasil akhir saat closing).

**Keputusan (rekomendasi): tetap LOKAL di tablet kasir per booth** + hasil akhir didorong ke `sales_daily`/`stock_daily` saat closing. Alasannya:
- **POS wajib tahan offline** — kalau internet putus, kasir harus tetap bisa jualan. State lokal = aman.
- 1 booth = 1 tablet → tak perlu sinkron lintas perangkat untuk state ini.
- Pesanan **online** tetap masuk via tabel `orders` (realtime) — terpisah dari day_state.

Opsional (kalau mau buka di >1 perangkat per booth / tahan tablet rusak): tabel
```sql
create table day_state (
  branch_id text primary key references branches(id),
  phase text, started_at timestamptz, opening_stock jsonb, stock jsonb,
  cash jsonb, menu_off jsonb, breakage_log jsonb, corrections jsonb,
  updated_at timestamptz default now()
);
```
> Catatan: stok hidup untuk **hard-lock di 0** tetap dihitung lokal; saat order online dibayar, kurangi stok lokal saat kasir memprosesnya (atau derive dari `orders`).

### 10.2 Offline-first untuk POS (belum dibahas)
localStorage sekarang otomatis offline. Supabase = online. Strategi minimal:
- Buka Toko/jualan/closing **berfungsi dari state lokal**; tulis ke Supabase saat ada koneksi (queue + retry).
- Indikator jaringan (sudah ada `NetworkIndicator`) → tampilkan status "tersimpan/menunggu sinkron".
- Closing menulis `sales_daily`/`stock_daily`; jika offline, antre & kirim saat online.

### 10.3 Tabel yang terlewat
```sql
-- Buku Besar pembelian (Owner /bukubesar)
create table ledger (
  id text primary key, item text, unit text,
  latest_price int, prev_price int, ordered int, received int, last_date date
);

-- Loyalty member (CUS-05). PRD: real per-akun + OTP di TAHAP 4.
create table members (
  wa text primary key, points int default 0, joined_at timestamptz default now(),
  txns jsonb default '[]'
);
```
> **Loyalty bisa DITUNDA** ke fase akhir (butuh OTP/verifikasi WA customer). RLS member rumit karena customer tak login — kemungkinan lewat RPC ber-PIN/OTP, bukan akses tabel langsung.

### 10.4 Store yang sengaja TIDAK dimigrasi
- **`cart.js`** — keranjang customer: **tetap lokal** (sementara, per perangkat). Tak perlu DB.
- **`materials.js`** — bahan baku: **di-drop** (kamu konfirmasi tidak dipakai; cek kewajaran belanja ambil dari `supplier_fulfilled`).
- **`supplier.js` (katalog lama)** — **legacy**, digantikan `shopping_items` + `supplier_prices`. Tidak dimigrasi.

### 10.5 Upload gambar Cloudinary — keamanan (belum dirinci)
Jangan taruh API Secret Cloudinary di browser. Dua cara aman:
- **Unsigned upload preset** (dibatasi: folder tetap, ukuran/format dibatasi) → paling simpel dari perangkat. ✅ rekomendasi awal.
- **Signed upload**: tanda tangan dibuat Edge Function (pakai API Secret di server), browser hanya kirim file. Lebih ketat.

### 10.6 Manajemen User ↔ Edge `admin-users`
Editor "Akun & Password PWA" (Owner) & username/password kasir (Kelola Cabang) **tidak** menulis password ke tabel biasa lagi — memanggil **Edge `admin-users`** (service_role) untuk buat/ubah user Supabase Auth. Tabel `profiles` hanya simpan role+branch+nama, **bukan** password.

### 10.7 Backup
Free tier tanpa point-in-time recovery. Siapkan **ekspor berkala** (mis. unduh CSV/SQL mingguan) — penting untuk data keuangan.

### 10.8 Penyimpanan device-local — TETAP di perangkat (jangan dimigrasi)
Hasil scan **semua** key `corney_*`. Empat ini bukan data server — **biarkan lokal**:
- **`corney_bt_printer_id`** — pairing printer Bluetooth. **Wajib lokal** (hardware per tablet).
- **`corney_gaji_template`** — template "ingat" daftar upah harian saat closing (biar tak ketik ulang). Angka gaji yang nyata tetap masuk `sales_daily.potongan.gaji` (sudah di rencana); template ini cuma kenyamanan → lokal (atau opsi: simpan per cabang nanti).
- **`corney_contact`** — penanda order yang sudah dihubungi (sisi customer). Lokal / bisa diturunkan dari `orders.contacted`.
- **`corney_opname_mode`** — preferensi mode opname (isi/mingguan). Lokal / config kecil.
- Plus sesi & kunci yang memang device-local: `corney_kasir_branch`, `corney_supplier_session`, `corney_sess_*`, `corney_lock_*`, `corney_role_creds_v1` (digantikan Supabase Auth).

> Verifikasi: 37 key `corney_*` ditemukan → semua sudah terpetakan (tabel / derived / device-local / di-drop). **Tidak ada penyimpanan yang lolos.**

### 10.9 Catatan teknis wajib (mudah terlupa)
1. **Zona waktu (WIB vs UTC) — RISIKO NYATA.** App pakai tanggal lokal (WIB). Postgres `now()`/`timestamptz` = UTC → bisa **salah hari** saat closing dekat tengah malam (omzet masuk tanggal yang salah). **Solusi:** tentukan "tanggal usaha" pakai WIB di sisi app saat closing (kirim `tgl` eksplisit), dan/atau set `timezone='Asia/Makassar'`/`Asia/Jakarta` + fungsi `business_date()`. Konsistenkan di semua `tgl date`.
2. **Env vars** (di Cloudflare Pages, bukan di kode): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD`, `VITE_CLOUDINARY_PRESET`, `VITE_BACKEND`. Server Key Midtrans & service_role **hanya** env Edge Function.
3. **Batas Realtime free tier (~200 koneksi).** Pakai realtime **hanya untuk staf** (kasir/owner). **Customer JANGAN** buka channel realtime — mereka cukup `insert` order + lacak via RPC. Cegah ledakan koneksi.
4. **"Mulai Bersih" versi DB** = RPC/Edge **owner-only** yang `truncate` tabel transaksi (orders, sales_daily, stock_daily, expense, usage, deposits, production, shipments, opname, freezer_corrections, audits, supplier_*) tapi **menyisakan** config (branches, menus, par_stock, investor_config, profiles). Bukan hapus localStorage lagi.
5. **`audit_log` append-only** — policy hanya izinkan `insert` + `select`; **tanpa** `update`/`delete` (jejak audit tak bisa diubah).
6. **Service worker / PWA cache** (precache 125 entri) untuk ASET (offline buka app). Data offline ditangani terpisah (§10.2). Pastikan SW tidak meng-cache respons API Supabase yang dinamis.
7. **Arsip multi-tahun** — DB 500MB cukup bertahun-tahun untuk 8000 order/bln, tapi siapkan strategi arsip/hapus baris >12 bulan bila perlu.
```
