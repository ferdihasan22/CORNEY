# CORNEY PWA — Rencana Pembangunan (PLAN)

> Acuan: PRD CORNEY v1.0 + skill `corney-pwa-builder` (`.claude/skills/`). Referensi visual: Stitch project "CORNEY POS Login Screen" (70 screens).
> Prinsip: **bangun dari jantung ke luar** (P0 dulu), data dummy → Supabase menyusul, semua aturan anti-bocor & pemisahan tugas ditegakkan sejak awal.
> Status legend: ⬜ belum · 🟧 sedang dikerjakan · ✅ selesai

---

## TAHAP 0 — Fondasi Teknis (setup) ✅
Tujuan: kerangka PWA jalan, bisa dibuka di browser, siap diisi layar.
> Selesai: Vite+React+Tailwind+PWA, brand CORNEY, routing 3 app, data dummy, store harian (`src/store/day.js`). `npm run build` hijau, `npm run dev` jalan.
> **Sistem desain = Stitch (Material-3).** `tailwind.config.js` mirror token Stitch (primary `#b50303`, secondary-container emas `#ffc72c`, surface, skala tipografi, spacing), font Plus Jakarta Sans + Material Symbols. Tiap layar Kasir diport dari **kode HTML Stitch** (disimpan di `.refs/stitch/`), bukan screenshot.

| # | Step | Deliverable | Acuan |
|---|---|---|---|
| 0.1 | Scaffold project | Vite + React + Tailwind, struktur folder `src/` | stack §9.5 |
| 0.2 | Setup PWA | `vite-plugin-pwa`, manifest, service worker (offline-ready) | §2.2, §8.2 |
| 0.3 | Branding CORNEY | warna merah `#C8102E`, dark-red swirl, font, tagline `#CeritanyaBersamaCorney`, logo | §1 |
| 0.4 | Routing & shell | React Router; 3 "app" terpisah: `/app` (Customer), `/ops` (role-based), `/supplier` | §2.1 |
| 0.5 | Data dummy & state | `src/data/` (4 isian induk, 11 menu, kategori, harga, cabang contoh, dummy order/txn), store ringan | §6.3 |
| 0.6 | Verifikasi | `npm run dev` jalan, ketiga shell terbuka | — |

**Exit criteria:** dev server jalan, brand tampil, navigasi 3 app berfungsi dengan data dummy.

---

## TAHAP 1 — FASE 1 / P0 (Jantung: Kasir + Owner + Katalog Customer) 🟧
Tujuan PRD: *"transaksi & laporan berantakan" terpecahkan; bisnis bisa beroperasi rapi.*

### 1A. CORNEY Ops — KASIR (P0, prioritas tertinggi)
| # | Step | Layar Stitch | Feature |
|---|---|---|---|
| 1A.1 ✅ | Login kasir (akun = cabang) | CORNEY POS Login - Landscape | §6.1 |
| 1A.2 ✅ | Opening Day — Konfirmasi Stok Isian | Stock Confirmation - Buka Toko | OPN-01 |
| 1A.3 ✅ | Opening Day — Buka Kas | Buka Kas - Buka Toko | OPN-02 |
| 1A.4 ✅ | Walk-in Sale (grid 11 menu per induk + keranjang menetap) | Walk-in Sale - CORNEY POS | WLK-01/02 |
| 1A.5 ✅ | Modal Tambah Saus (kecuali sweet/glaze) | Add Sauce Modal - CORNEY POS | WLK-02 |
| 1A.6 ✅ | Bayar Sekarang / Buat Dulu + 5 channel bayar | Payment Modal - CORNEY POS | WLK-03, §6.7 |
| 1A.7 ✅ | Antrean Masak + Timer goreng (6/8 mnt) | Cooking Queue - CORNEY KITCHEN | MSK-01..04 |
| 1A.8 ✅ | Ajukan Koreksi Stok (propose, bukan eksekusi) | Request Stock Correction | BHN-06 |
| 1A.8b ✅ | Closing **Langkah 1: Request Belanja Besok** (CLS-00) — **pilih TANGGAL laporan di atas** (peringatan "JANGAN SALAH TANGGAL"; hari ini/kemarin; tolak masa depan & dobel; disimpan `day.reportDate` → dipakai Langkah 5) + checklist item **2 kolom** (Owner-managed, daftar PRD) + Kotak + catatan → **teks siap-salin** grup WA; opsional; "Tutup Hari" → screen ini dulu | Tomorrow's Shopping Request | CLS-00 |
| 1A.9 ✅ | Closing **Langkah 2** — **Rekonsiliasi Stok (urutan wajib)**: patah→garansi→promo→sisa bagus→hilang + potong gaji | Match/Breakage/Free Items (digabung) | CLS-02/02b (v56) |
| 1A.10 ➡️ | _digabung ke 1A.9 (v56)_ | — | CLS-02b |
| 1A.11 ✅ | Closing — **Hitung Uang di Laci (langkah terakhir)** + Channel + **Kas harus pas tanpa toleransi**. Urutan diperbaiki: rekon→**urgent/refund**→**fisik laci**→laporan. Rumus **setoran = penjualan tunai − urgent − refund − gaji harian karyawan** (gaji harian = input opsional oleh karyawan di langkah urgent/refund) · **+ Penggunaan Modal/Kembalian (opsional)** = bila sebagian uang kembalian terpakai → mengurangi modal yang disisihkan (modal awal default = modal buka − terpakai), BUKAN setoran; **modal awal (uang kembalian) DIPISAH** (input sendiri, default modal buka toko), kas penjualan = fisik − modal awal | Reconcile Cash & Channels | CLS-03/05 (v56) |
| 1A.12 ✅ | Closing — Uang Urgent & Refund | Closing: Urgent Cash & Refunds | CLS-04/04b |
| 1A.13 ➡️ | _digabung ke 1A.9 (garansi/promo, v56)_ | — | §6.8.4 |
| 1A.14 ✅ | Laporan Tutup Hari (Langkah 5) — **tanggal dibaca dari Langkah 1** (`day.reportDate`), tampil konfirmasi ringkas (bisa balik ke Langkah 1 kalau salah); saat Kirim → **tulis ke Laporan Stok Owner** (`stockdaily`+`salesdaily`) sesuai tanggal terpilih (stok induk dari rekon, varian dari penjualan, omzet per channel) + finalize/tutup hari. Owner bisa **edit tanggal** di Laporan Stok → Variant Terjual ikut pindah tanggal. | Daily Closing Report | CLS-06 |
| 1A.15 ✅ | Struk thermal/digital ringkas (modal, print-isolated, CETAK ULANG) | (didesain) | STR-01 |
| 1A.17 ✅ | Riwayat Transaksi (daftar trx hari ini + reprint struk) | (didesain) | — |
| 1A.16 🟡 | Offline: persistence `localStorage` (crash/close-safe) ✅ · render-offline (lepas CDN) + sinkron → **TAHAP 4** | — | §8.2 |

### 1B. CORNEY Ops — OWNER (P0, pelaporan)
| # | Step | Layar Stitch | Feature |
|---|---|---|---|
| 1B.1 ✅ | Dashboard Kokpit (omzet, anomali, menunggu tindakan, per cabang, stok menipis) — responsif, data contoh (agregat nyata → TAHAP 4) | Owner Cockpit Mobile + Desktop | OWN-01 |
| 1B.2 ✅ | Master Data — Isian Induk (tabel desktop / kartu mobile, tambah/edit drawer, ambang per-induk, deactivate≠delete) | Manage Parent Fillings | OWN-02 (1) |
| 1B.3 ✅ | Master Data — Menu/Varian (tabel/kartu, drawer tambah/edit, foto, kategori Sweet/Savory, link 1:1 ke induk, harga/label, deactivate≠delete) | (didesain senada 1B.2) | OWN-02 (2-4) |
| 1B.4 ✅ | Master Data — Resep/BOM (pilih produk, tabel bahan editable, takaran+harga satuan→subtotal, Total Estimasi HPP, analisa margin/laba kotor; tab Setelan Saus & Bahan Cair = placeholder Fase 2) | Master Data - Resep/BOM | OWN-02 |
| 1B.5 ✅ | Eksekusi Koreksi Stok (approve pengajuan kasir → terapkan ke stok; audit immutable) | Stock Correction Approval | BHN-06 |
| 1B.6 ✅ | Laporan Keuangan Ringkas + export CSV (KPI omzet/trx/selisih kas/urgent, rekap per channel, **Potongan Gaji ke Owner**, tutup hari; "Hari"=data langsung, Minggu/Bulan=contoh; Tutup Bulan=Fase 2) | Financial Reports | OWN-03 |

### 1C. CORNEY App — CUSTOMER (P0 minimal)
| # | Step | Layar Stitch | Feature |
|---|---|---|---|
| 1C.1 ✅ | Landing page (hero + 3 tombol: Order Sekarang→cabang, GoFood, GrabFood; PWA hint) | CORNEY App Landing | §4 |
| 1C.2 ✅ | Pilih Cabang (kartu cabang nyata + status buka/online, chip lokasi, sticky note) | Choose Branch | §4.4 |
| 1C.3 ✅ | Katalog Menu + stok real-time per cabang (live dari sesi kasir bila cocok) + label + filter kategori + hard-lock HABIS; browse-only (Tambah→Lihat, cart=Fase 2) | Menu Storefront | CUS-01 |
| 1C.4 ✅ | Detail Produk (hero, kategori, deskripsi; Savory=pilih saus free-max-2+premium & estimasi total; Sweet=glaze tanpa saus; stok live) | Product Detail + Add Sauce | CUS-01 |
| 1C.5 ✅ | Struk Digital (kartu struk: outlet, item+saus, total, status bayar, PIN/no. order, share/print; baca sale lokal by id + fallback contoh) | Struk Digital | CUS-04 |

**Exit criteria Tahap 1:** ✅ TERCAPAI — kasir Login→Opening→Jualan→Closing (transaksi & laporan rapi); Owner dashboard + master data (isian/menu/resep) + koreksi + laporan keuangan (potong gaji); customer katalog stok real-time + detail + struk digital. Aturan P0 ditegakkan (hard-lock 0, koreksi propose→approve, potong gaji, kas tanpa toleransi, audit).

**Exit criteria Tahap 1 (asli):** kasir bisa Login→Opening→Jualan→Closing dengan transaksi & laporan tercatat rapi; Owner lihat dashboard + kelola master data; customer lihat katalog + struk digital. **Semua aturan P0 (hard-lock stok 0, koreksi propose→approve, potong gaji, rumus kas, audit) ditegakkan.**

---

## TAHAP 2 — FASE 2 / P1 (Pertumbuhan) ✅ (sisa minor: akses 2-lapis→RLS TAHAP 4)
| # | Area | Step utama | Feature |
|---|---|---|---|
| 2.1 | Customer e-commerce | ✅ **Order Online lengkap**: Keranjang (cart store per-cabang, **quick-add "+" di katalog**: savory→sheet saus / sweet→langsung, **toast konfirmasi + balik ke katalog (lanjut belanja, tdk lompat ke keranjang)**, **edit saus per baris di keranjang kecuali sweet**, stepper/hapus, kode promo voucher Owner, cart bar+badge) → Checkout (Maxim/ambil, jam ≥15mnt, **alamat antar utk Maxim**, validasi nama+WA, **peringatan WA aktif beranimasi**, **checklist ingat data → auto-fill order berikutnya**, **popup konfirmasi nomor WA + alasannya sebelum bayar** — OTP dihapus karena order berbayar) → **QRIS Midtrans SANDBOX asli** (Vite dev middleware `/api/midtrans/charge`+`/status`, Server Key di `.env.local` gitignored; QR asli + qr_string copyable + link simulator + auto-poll status → settlement→markPaid→sukses; fallback dummy saat preview/build) → Payment Success+PIN (**WA Hubungi Kasir WAJIB dulu, beranimasi glow+nudge; Lacak Pesanan & Kembali ke Menu baru muncul setelah WA ditekan**) → Lacak Pesanan (stepper status, WA pre-typed). **CUS-04 Riwayat Pesanan** (/app/riwayat): daftar order device ini (foto+no+cabang+PIN+tanggal+status+total), ketuk→Lacak; pintu masuk di **landing** ("Lacak / Riwayat Pesanan") + **ikon di header katalog**; empty-state. _TODO TAHAP 4: pindah charge ke backend Supabase Edge Function + webhook (bukan middleware dev), push status real-time._ | CUS-02/03/05, §4 |
| 2.2 | Kasir online | ✅ **KasirOnline** (/ops/kasir/online): tab Walk-in/Online di header + **badge new-order** (juga di WalkinSale) + **suara beep** saat order baru, kartu per-status (baru=amber glow+checklist "sudah dihubungi" / diproses=biru / siap=hijau), **WA bertahap** Konfirmasi Terima→Diproses · Pesanan Siap→Siap (buka wa.me pre-typed + maju status di klik sama; **untuk Maxim: tutorial pesan Maxim ramah ber-emoji — Pengiriman→penjemputan=nama Maxim cabang→pengantaran→PIN di catatan kurir**) · Selesai (tanpa WA), PIN+metode+alamat Maxim+WA terformat, FIFO, sub-tab Aktif/Selesai, **Jalur 1** (order paid auto-masuk per cabang, tdk tergantung WA). Adaptasi tablet portrait→grid responsif; sidebar dekoratif referensi di-strip. **MSK-01 ✅: order online (Diproses) ikut masuk Antrean Masak gabungan** (badge ONLINE·Maxim/Ambil, timer goreng 6/8mnt, ANGKAT→SELESAI; online lunas QRIS jadi tanpa modal bayar; SELESAI menandai cook selesai & keluar antrean — status tetap Diproses, notifikasi "Pesanan Siap"+WA tetap dari KasirOnline = pemisahan dapur vs counter). | §6.5, §4.2 |
| 2.3 | Multi-cabang | 🟧 **Kelola Cabang ✅** (CRUD cabang: nama/alamat/WA/**Nama Lokasi di Maxim**/jam stop-online+tutup-booth, aktif/nonaktif≠hapus, drawer tambah/edit — di store master, kartu dashboard; maximName dipakai tutorial Maxim di KasirOnline) · **Override harga/menu per cabang ✅** (`branchOverrides` di master; `OwnerBranchOverride`: harga lokal + sembunyikan menu per cabang; `menuForBranch()` diterapkan di katalog/detail/keranjang/checkout customer) · ⬜ akses 2 lapis (→RLS TAHAP 4) | §3 |
| 2.4 | Operasional | 🟧 **Role Operasional + OPS-04 Ambil Setoran Tunai ✅** (store `deposits.js` Kasir→Operasional 2-sisi: kasir DECLARE saat closing `total.tunai` → status menunggu; operasional COUNT fisik → konfirmasi cocok/selisih live; "Setoran Terkumpul" + Teruskan ke Auditor/Owner; landing operasional + badge pending; reachable dari Home) · **OPS-01 Isi Stok ke Par ✅** (`shipments.js`; kirim=par−sisa per induk, edit manual, pilih cabang, "Buat Kiriman→Opening Day", riwayat Kiriman Hari Ini status menunggu/diterima/selisih) · **OPS-02 Audit Lapangan ✅** (`audits.js`; data sistem kasir vs cek fisik per induk, status cocok/beda live, catatan, lapor ke Owner, riwayat Verified/Discrepancy) · **OPS-03 Jembatan Supplier ✅** (rekap request belanja agregat Per Item/Per Cabang, Salin Rekap→PWA Supplier) | OPS-01..04 |
| 2.5 | Produksi | 🟧 **Role Produksi + PRD-01 Catat Hasil Produksi ✅** (`production.js`; pilih induk, jumlah jadi+susut+alasan, ringkasan total jadi/susut, riwayat) · **PRD-02 Stok Freezer per Cabang Min-Maks ✅** (`freezer.js`; gauge sisa/min/target per cabang×induk, status aman/mendekati/di-bawah-min, alert strip beranimasi, edit level via modal) · **PRD-03 Reorder Bahan Mentah ✅** (`materials.js`; 9 bahan sisa vs ambang editable, status urgent/warn/aman + progress, alert beranimasi, "Tandai dipesan") · **PRD-04 Pengambilan & Opname Freezer ✅** (Operasional **Ambil Stok** `takeFreezer`→sisa turun tanpa konfirmasi; Produksi **Opname** `opname.js` sistem vs fisik→selisih live, simpan rekonsiliasi sisa, mode tiap-isi/mingguan, riwayat) — §2.5 TUNTAS | PRD-01..04 |
| 2.6 | Owner lanjutan | 🟧 **Sistem Promo ✅** (OWN-10: diskon %/nominal, voucher kode+quota, beli-dapat BxGy, happy hour; safeguard no-combine+cap; aktif/jeda; di store master) · **OWN-04 Notifikasi & Peringatan ✅** (`OwnerNotifications`; agregasi LIVE deposit-selisih/freezer-min/material-reorder/audit-opname-discrepancy + filter Semua/Stok/Kas/Mencurigakan/Target) · **OWN-11 Bagi Hasil Investor ✅** (`OwnerInvestor`; omzet−biaya=laba, dividen %×laba, per cabang, export) · **Manajemen User ✅** (`users.js`; CRUD staf per peran/cabang, nonaktif≠hapus) · **OWN-08 Buku Besar Pembelian ✅** (`ledger.js`; harga terkini + penanda naik/turun, dipesan vs diterima + tandai diterima, rekap nilai periode) · **Tutup Bulan ✅** (`monthclose.js`; rekap laba per cabang + kunci/buka bulan → final utk bagi hasil) — semua dari OwnerDashboard | OWN-04..11 |
| 2.7 | Loyalty | ✅ **CUS-05 Loyalty** (`loyalty.js`; Daftar Member `/app/join` — nomor WA + persetujuan data wajib, bonus gabung; Dashboard `/app/rewards` — total poin, progress ke reward, tukar reward (redeem→validasi kasir), riwayat poin; entri "CORNEY Rewards" di landing) | CUS-05 |
| 2.x | Banner (CUS-06/OWN-09) ✅ | Kelola Banner (live preview HP **mirip katalog asli** + auto-slide, rekomendasi ukuran 1280×512/5:2 + pratinjau crop, daftar banner global, aktif/nonaktif, reorder ↑↓, tambah/edit/hapus) + **carousel auto-slide tampil di katalog customer** (end-to-end). TODO TAHAP 4: upload file + cropper drag/zoom (sekarang via URL) | CUS-06 |

**Exit criteria:** pemesanan online end-to-end jalan; multi-cabang aktif; rantai stok & uang lengkap dengan jejak.

---

## TAHAP 3 — FASE 3 / P2 (Skala) ✅
| # | Area | Step utama | Feature |
|---|---|---|---|
| 3.1 | Supplier portal (standalone) | ✅ **Portal Supplier lengkap** (`supplier.js` DB terpisah + bottom-nav): **SUP-01** Login portal · **SUP-02** Katalog 2 kategori (K1 Kebutuhan Cabang/K2 Bahan Adonan, ubah harga) · **SUP-03** Susun Pesanan multi-cabang (chip cabang, qty/kategori, total per cabang + grand total, Kirim ke WA Owner) · **SUP-04** Riwayat Harga (tren naik/turun + banner notif Owner satu-arah) · **SUP-05** Status Ketersediaan (toggle kosong + filter, toast notif Owner/Operasional). Sinyal satu-arah (harga naik + item kosong) **muncul di Notifikasi Owner**. | SUP-01..05 |
| 3.2 | Auditor | ✅ **Role Auditor lengkap**: landing (AUD-03 cakupan semua cabang) · **AUD-01** Terima & Verifikasi Setoran (`deposits.auditorVerify`; money-chain indicator, hitung ulang fisik vs Operasional → cocok/selisih → lapor Owner) · **AUD-02** Telusur Titik Selisih (timeline 4-node Kasir→Ops→Auditor→Owner, deteksi junction selisih walau net 0) · **AUD-04** Jejak Audit (`auditlog.js` append-only, di-log dari handoff setoran ops+auditor; search+filter, banner immutable, tak bisa edit/hapus) | AUD-01..04 |
| 3.3 | Owner — Anomali Terpusat | ✅ **OWN-07** (`OwnerAnomali`; agregasi LIVE deposit-selisih ops+auditor/opname/audit/freezer-min/material → grup Perlu Tindakan/Diselidiki/Info, summary bento total+cabang+nilai, saran pertanyaan netral + Hubungi Cabang; dari OwnerDashboard) | OWN-07 |
| 3.4 | Lanjutan | ✅ **Laporan Stok Harian** (`OwnerStockReport`; tabel lebar per induk Mozza/Mix/Sosis/Sosis-J: Datang+Sisa Kemarin−Terjual−Patah−Garansi−Free=**Sisa Seharusnya**, vs Sisa Aktual=**Selisih/Hilang**; +kolom Garansi yg sebelumnya tak ada; filter cabang, total hilang; **1 sumber kebenaran `stockdaily.js`** dipakai bersama Laporan Stok + Anomali + Agregat; **Owner bisa koreksi** angka per induk (wajib alasan) → tercatat di **Jejak Audit** + Anomali/Agregat **ikut ter-update otomatis**; panel detail item hilang; **3 tab: Stok Isian · Variant Terjual · Omzet**) · **Variant Terjual** (`salesdaily.js` SUMBER level varian: qty per 11 varian/hari/cabang → **rollup OTOMATIS ke "terjual" stok induk** (`effectiveV`) + omzet; jadi Stok Isian & Variant **pasti sinkron**; "terjual" tak bisa diedit di Stok Isian — ikut varian; Total Qty + Omzet per baris) · **Omzet detail** (per metode bayar Tunai/Midtrans/GoPay/GoFood/Grab + Walk-in/Online + Total per cabang/hari) · data contoh→TAHAP 4) · ✅ Banner carousel (di §2.x) · **Analisa Bahan vs Penjualan ✅** (`OwnerAnalisaBahan`; glaze↔sweet/kentang↔kentang/saus↔bersaus, perkiraan-vs-aktual + flag "selidiki" indikasi penjualan tak tercatat — jujur: indikasi, bukan bukti) · **Agregat Lintas Cabang ✅** (`OwnerCrossBranch`; omzet/laba/trx contoh + anomali kas & alarm freezer LIVE, bar banding) — dari OwnerDashboard | OWN-08.1/09, BHN-01/04 |

---

## TAHAP 4 — Backend & Hardening ⬜
| # | Step | Catatan |
|---|---|---|
| 4.1 | Migrasi ke Supabase | Skema tabel dari data-model.md, Auth per role | §9.5 |
| 4.2 | **RLS wajib** | Isolasi supplier, hak akses per peran, pemisahan tugas di DB (bukan cuma UI) | §9.5 |
| 4.3 | Integrasi Midtrans | QRIS dinamis, webhook idempoten | §4 |
| 4.4 | Audit log immutable di DB | Tanpa grant UPDATE/DELETE, termasuk Owner | AUD-04 |
| 4.5 | Offline sync hardening | Idempotensi, nomor txn prefiks perangkat, anti double · **+ lepas Tailwind CDN → CSS offline-safe (compile/self-host) + cache shell & font via service worker** (dari 1A.16) | §8.2, §11 |
| 4.6 | Deploy Cloudflare Pages + ping cron anti-pause | — | §9.5 |
| 4.7 | Privasi UU PDP | Opt-in, hapus data, akses dibatasi peran | §10 |

---

## Keputusan terbuka (perlu Ferdi — PRD §14)
17 booth/gerobak · 18 jumlah SKU (asumsi 11 menu) · 19 pajak/PB1 di struk · 20 OTP SMS/WA · 21 siapa build · 22 staf terpisah/merangkap.
**Sementara:** pakai asumsi 11 menu/4 isian, OTP WA, mulai 1 cabang tapi skema multi-cabang-ready. Layar yang bergantung pertanyaan ini akan ditandai.

---

## Catatan eksekusi
- Setiap step: bangun layar → pakai data dummy → cek aturan dari skill → tandai status di PLAN ini.
- Jangan loncat prioritas: selesaikan P0 (Tahap 1) sebelum P1.
- Setiap layar mengacu desain Stitch (lihat `reference/screens.md` untuk ID).
- Jalankan **compliance checklist** (di SKILL.md) sebelum menyebut satu area "selesai".
