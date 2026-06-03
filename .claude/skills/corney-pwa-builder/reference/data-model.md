# CORNEY Data Model (PRD §2.4) + Data Flow (§2.5)

Shared DB for CORNEY App + CORNEY Ops. Supplier DB is separate (one-way to Owner). All money/stock handoffs use confirmation/approval so discrepancies are traceable.

## Core entities

| Entity | Key fields | Used by |
|---|---|---|
| **Branch/Cabang** | nama, alamat, no WA Business, jam stop-online, jam tutup, akun, status | All |
| **Product** | nama, harga master, kategori (sweet/savory), gambar, status aktif | All |
| **BranchProduct** | per-branch override: harga lokal, aktif/nonaktif, stok | Owner, Kasir |
| **Recipe/BOM** | bahan & takaran per produk (Bill of Materials) | Owner, Produksi |
| **Ingredient** | bahan baku, satuan, stok, titik pesan ulang | Stok, Produksi, Supplier |
| **Order** | item, cabang, metode (Maxim/ambil), jam ambil, PIN, status (Baru/Diproses/Siap/Selesai) | Customer App, Kasir, Owner |
| **Transaction** | item, jumlah, total, metode bayar, kasir, waktu | Kasir, Owner, Auditor |
| **CashDrawer/Shift** | kas awal, kas akhir, selisih, shift, kasir | Kasir, Owner, Auditor |
| **CashMovement** | uang urgent keluar: nominal, alasan, foto opsional, waktu | Kasir, Owner, Auditor |
| **WasteLog** | stok patah/gagal: isian, jumlah (fisik), waktu closing | Kasir, Owner, Auditor |
| **PayrollDeduction** | potongan gaji kasir: patah + hilang + garansi, per closing | Owner, Auditor |
| **FreebieLog** | gratis: jenis (promo/garansi), menu, jumlah, alasan, foto opsional | Kasir, Owner, Auditor |
| **LiquidIngredient** | bahan cair/curah (glaze/saus/kentang): pantau via pola request | Kasir, Owner |
| **ShoppingRequest** | request belanja besok per cabang: item dicentang, jumlah kotak, catatan | Kasir, Owner |
| **StockAdjustment** | koreksi stok: item, dari→ke, alasan, diajukan kasir, dieksekusi Owner, waktu | Kasir, Owner, Auditor |
| **CashDeposit** | setoran tunai: cabang, jumlah, kasir→operasional→auditor (konfirmasi 2 sisi tiap titik), status cocok/selisih | Operasional, Auditor, Owner |
| **StockPar** | stok standar (par) isian per cabang, diatur Owner | Owner, Operasional |
| **ProductionLog** | hasil produksi: isian, jumlah jadi, susut + alasan, waktu | Produksi, Owner, Auditor |
| **SupplierCatalog** | katalog supplier (standalone) 2 kategori: item, harga, satuan | Supplier |
| **PriceHistory** | riwayat harga supplier lama→baru + tanggal; perubahan → notif Owner | Supplier, Owner |
| **SupplierOrder** | pesanan per label cabang, 2 kategori, keranjang multi-cabang; subtotal+grand total; ke WA | Owner (terima WA) |
| **PurchaseLedger** | buku besar pembelian: satu baris per JENIS item, harga terkini + penanda riwayat, dipesan vs diterima, rekap periode | Owner, Operasional |
| **MaterialSalesAnalysis** | bahan dipakai vs produk terjual (glaze↔sweet, kentang↔menu kentang, saus↔menu bersaus): deteksi boros/bocor | Owner |
| **Promo** | jenis (diskon/beli-dapat/happy hour/voucher), target, nilai, jam/kuota/expired, flag bisa-digabung, batas max potongan | Owner, Kasir, Customer App |
| **PromoUsage** | promo mana, transaksi, nilai potongan, waktu | Owner, Auditor |
| **MonthlyReport** | laporan bulanan otomatis per kalender; final/terkunci saat difinalisasi; export PDF/CSV/XLSX | Owner, Auditor |
| **InvestorPayout** | bagi hasil bulanan per cabang dari laba bersih FINAL; dividen % | Owner |
| **BranchExpense** | biaya cabang input Owner: sewa, gaji, value/simpanan, belanja supplier (per tanggal) | Owner |
| **FreezerStock** | stok beku per cabang di freezer pusat: standar, minimum, sisa; ambil (Operasional) + opname (Produksi) | Produksi, Operasional, Owner |
| **Customer** | no WA terverifikasi, poin, riwayat, persetujuan data | Customer App, Owner |
| **AuditLog** | siapa, apa, kapan, nilai lama→baru. **IMMUTABLE** | Auditor, Owner |

## Data flow map (§2.5)

| Flow | From → To | Nature |
|---|---|---|
| Pesanan & pembayaran | Customer App → Ops (Kasir) | Real-time; potong stok saat bayar sukses |
| Stok isian beku | Produksi (freezer pusat) → Operasional → Kasir | Distribusi per par |
| Pengajuan koreksi stok | Kasir → Owner (eksekusi) | Berjejak; propose→approve |
| Setoran tunai | Kasir → Operasional → Auditor → Owner | Konfirmasi 2 sisi tiap titik |
| Anomali (semua jenis) | Semua titik → Owner (OWN-07) | Rekap harian terpusat |
| Notifikasi harga | Supplier → Owner | Satu arah (standalone) |
| Data pesanan pembelian | Supplier → Owner (Buku Besar OWN-08) | Satu arah + konfirmasi terima oleh Operasional |
| Master data & promo | Owner → Customer App + Kasir | Owner atur, lainnya jalankan |

## Modeling notes
- **Product vs stock:** kasir taps `Product` (menu/varian); stock deducts from 4 parent fillings. Keep menu↔parent mapping 1:1.
- **Price lock:** Transaction stores its own price snapshot; never reference live master price for past txns.
- **Soft delete:** every master entity has `status` (active/inactive); never hard-delete.
- **Audit:** AuditLog rows are append-only; enforce via RLS + DB (no UPDATE/DELETE grant, even to Owner).
- **Supplier isolation:** SupplierCatalog/PriceHistory/SupplierOrder behave as a separate DB; only PriceHistory-notif and SupplierOrder data cross to Owner. No read path back.
