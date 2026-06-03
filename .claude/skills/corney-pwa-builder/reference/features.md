# CORNEY Feature Catalog (every code + priority + behavior)

P0 = must ship first (business can't run without it). P1 = soon after P0. P2 = at scale.

## CORNEY App — Customer (PRD §5)
- **CUS-01 Katalog Menu Digital + Stok Real-Time per Cabang [P0]** — products w/ photo, name, price, labels (Best Seller/Pedas). Exact remaining stock per branch ("sisa 3"). Stock 0 → cannot checkout. Sauce topping: multiple sauces per corndog, each free/paid per Owner setting; free sauces capped; total = corndog + paid sauces. Sauces for ALL variants EXCEPT glaze (sweet).
- **CUS-02 Pemesanan Mandiri (Self-Order) [P1]** — cart → pickup/queue → order number. Goes to kasir queue for confirm & pay. Self-order does NOT auto-deduct stock or mark paid (only "intent" until kasir confirms).
- **CUS-03 Pembayaran QRIS/Digital [P1]** — Midtrans/Xendit QRIS/e-wallet/card. Real-time status; digital receipt on paid. Stock deducted ONLY on payment success (anti-rebutan: first paid wins, late payment refunded). Never store card data. Cancel-due-to-out-of-stock is rare (Owner refunds via transfer); no kasir self-refund; complaints solved by replacement (garansi), not refund.
- **CUS-04 Struk Digital & Riwayat [P1]** — concise digital receipt (items, total, order no.); online shows pickup PIN. Aligns with thermal (STR-01).
- **CUS-05 Loyalty & Poin [P1]** — light register via phone + OTP. Points per purchase; reward/discount validated kasir-side. Mandatory data consent before register (§10).
- **CUS-06 Banner & Promo [P2]** — carousel banners on home; Owner-managed (OWN-09), same all branches, manual on/off.

## CORNEY Ops — Kasir (PRD §6) — P0 heart
**Opening Day (blocks selling until done):**
- **OPN-01 Konfirmasi Stok Isian [P0]** — per parent filling: system shows yesterday's remainder; kasir counts physical & confirms (diff = susut for Owner). Goods arrival 2 ways: (1) confirm Operasional-input shipment (record send-vs-receive diff); (2) manual entry flagged "input manual". Stok hari ini = sisa fisik + barang datang (locked).
- **OPN-02 Buka Kas [P0]** — input opening cash float.

**Product/stock model & liquid tracking:**
- **BHN-01 Pantau Frekuensi Request Belanja [P2]** — show per-branch request frequency history for liquids; Owner interprets (no auto-alarm).
- **BHN-03 Reorder Point Bahan Tahan Lama [P1]** — non-daily items (e.g. kotak): base stock + warning threshold; auto "restok" alert into shopping checklist.
- **BHN-04 Deteksi Penjualan Siluman [P1]** — support-material ratio vs recorded sales; if support usage >> recorded, alert Owner. (Honest: cannot fully close gap; needs CCTV/SOP.)
- **BHN-05 Audit Fisik Kotak (saat datang) [P1]** — match physical kotak vs system at arrival; diff recorded.
- **BHN-06 Koreksi Stok (Stock Adjustment) [P0]** — **Kasir PROPOSES (physical + reason) from PWA Kasir; Owner EXECUTES from PWA Owner.** Always logged (who proposed/approved, from→to, reason, time). WA "tinggal kirim" optional notif. Stock may go minus as alarm. NEVER let kasir execute corrections.

**Walk-in tab:**
- **WLK-01 Grid Menu per Induk [P0]** — 11 menus grouped by parent, parent stock visible. Out-of-stock → dim + "HABIS". Hard-locked at 0 (no force-sell). Physical-but-system-0 → propose correction. Early warning when parent ≤ threshold (Owner-set).
- **WLK-02 Keranjang Menetap [P0]** — persistent right-side cart; each item shows parent stock it will reduce. Add sauces per item (except sweet/glaze). Apply Owner promos (kasir can't create discounts).
- **WLK-03 Bayar Sekarang / Buat Dulu [P0]** — Pay Now → payment methods; Make First → into production queue unpaid, pay on handover.

**Online tab & cooking:**
- **(6.5) Tab Order Online [P0 display]** — 2 tabs Walk-in/Online; Online badge + sound on new order. Detail follows §4.
- **MSK-01 Satu Layar Antrean Masak [P0]** — merge walk-in "Buat Dulu" + online + GoFood/Grab into one cook list.
- **MSK-02 Urutan FIFO+ [P0]** — by entry time; "ambil nanti" online appears near pickup time, not at creation.
- **MSK-03 Kapasitas Penggorengan [P1]** — fryer capacity (Owner-set per branch); show current batch vs next.
- **MSK-04 Timer Goreng per Orderan [P0]** — one timer per order; choose 6 min (thin) / 8 min (thick); parallel timers; lift alarm (sound + big text); oil-temp reminder "max 170°C".

**Payment & receipt:**
- **(6.7) Lima Channel Pembayaran [P0]** — Tunai (Lunas), QRIS Midtrans (Terverifikasi auto), QRIS GoPay static photo (Terklaim, marked diff color, checked at closing), GoFood, GrabFood (recorded, no booth pay).
- **STR-01 Struk Thermal Ringkas [P1]** — always printed; concise (CORNEY+branch, date/time+order no., items, total, method, change, footer + #CeritanyaBersamaCorney). PIN only on online receipts. Reprint marked "COPY/CETAK ULANG". Footer "Komplain? DM IG @corney.idn".

**Closing Day (mirror of Opening):**
- **CLS-00 Request Belanja Besok [P1, optional]** — checklist (Kentang, Glaze ×3, Saus ×3, Tepung panir, Tisu, Sarung tangan, Plastik 15/24, Minyak, Mayonaise) + Kotak (number) + free notes. Copy-ready text, pasted manually to WA group. Owner manages item list.
- **CLS-01 Tutup Penjualan [P0]** — hanging paid orders MUST be completed/refunded; hanging unpaid auto-cancelable.
- **CLS-02 Rekonsiliasi Stok (Urutan WAJIB) [P0] (v56)** — record everything explained FIRST so "hilang" is accurate. Mandatory input order per parent filling: **(1) Patah** (physical evidence, kasir's fault → cuts wage) → **(2) Garansi/claim free** (complaint replacement; reduces stock; STILL cuts wage, prevents fake claims) → **(3) Promo** (Owner promo free items; reduces stock; does NOT cut wage) → **(4) Sisa bagus** (count good remaining) → **(5) Hilang** auto-computed. Sisa bagus → tomorrow's "sisa kemarin".
- **CLS-02b Selisih Hilang & Potong Gaji [P0] (v56)** — **hilang = stok awal − terjual − patah − garansi − promo − sisa bagus.** Payroll deduction = **(patah + garansi + hilang) × LOWEST variant sale price** of that filling (lowest even if that variant toggled off), **NO tolerance**. Only PROMO does not cut wage. Walk-in "Buat Dulu" abandoned = "hilang" (cuts wage), flagged separately. Cap = 100% daily wage (Rp 0 floor, never debt/negative; excess = business loss).
- **CLS-03 Cocokkan Tunai & Channel [P0]** — channels w/ txns checked; zero-txn skipped. Tunai physical count; GoPay mutation vs claimed; Midtrans/GoFood/Grab vs auto records.
- **CLS-04 Uang Urgent [P0]** — sudden cash-out (e.g. gas) recorded at event (nominal+reason); at closing show list + add-missed option. Kas = modal + tunai − urgent. Photo optional.
- **CLS-04b Refund Uang [P1]** — always from cash drawer regardless of original channel; mandatory reason; Kas = modal + tunai − urgent − refund. Stock NOT returned.
- **CLS-05 Selisih Kas (Harus PAS, TANPA Toleransi) [P0] (v56)** — cash must match to the last rupiah; NO "selisih wajar" threshold. Any difference (over/under), however small, MUST be given a reason and auto-notifies Owner.
- **CLS-06 Laporan Tutup Hari [P0]** — summary (omzet per channel, txn count, cash diff, urgent, susut) → Owner.
- **(6.8.4) Promo vs Garansi free items (v56)** — both reduce stock; **garansi/komplain CUTS wages** (prevents fake claims), **promo does NOT** (business strategy). Recorded inside CLS-02 order (steps 2 & 3).

## CORNEY Ops — Owner (PRD §7.1) — P0 reporting
- **OWN-01 Dashboard (Kokpit) [P0]** — period filter (today/week/month/custom). Cards: 1 Omzet (all channels + trend), 2 Anomali (red), 3 Menunggu tindakan (corrections/deposits), 4 Per cabang, 5 Stok menipis. Insights: top/slow menu, gross profit estimate (omzet−HPP, flagged "perkiraan"), peak hours (15:00–23:00).
- **OWN-02 Kelola Master Data [P0]** — order: (1) create parent fillings, (2) create 11 menus (name, price, photo, desc, label), photo per variant (11 separate), (3) link menu→parent 1:1, (4) set category Sweet/Savory (enforces topping rule), recipe/BOM, master+per-branch override, liquid reorder settings, sauce settings (price + free max).
- **OWN-03 Laporan Keuangan Ringkas [P0]** — sales, kasir close reports, per-channel recap, cash diff, urgent. Export CSV/XLSX/PDF.
- **(7.1.3) Periode & Tutup Bulan** — auto monthly report per calendar; "Tutup & Finalisasi Bulan" locks immutable + PDF.
- **OWN-04 Manajemen Pengguna [P1]** — add/deactivate staff, roles, reset; approvals for sensitive actions.
- **OWN-05 Notifikasi [P1]** — low stock, abnormal cash diff, targets, suspicious txns; correction-pattern watch.
- **OWN-06 Kelola Cabang & Jam Tutup [P1]** — CRUD branch; 2 close times (stop-online earlier + close-booth later); tabbed view; manage shopping-request items; execute stock corrections.
- **OWN-07 Laporan Anomali Terpusat [P0]** — ALL anomalies in one view (stok minus, cash diff, freezer opname diff, closing patah/hilang, liquid diff, frequent corrections, late/missed opname, deposit diff). Daily recap; each shows branch/who/value/severity; top summary; neutral suggested clarifying question per type (suggestion only, no auto-send).
- **OWN-08 Buku Besar Pembelian [P1]** — auto-collect supplier purchases; ordered+received two-stage; order-vs-receive diff visible; period recap; price trend; one row per item type; current price + history marker. + **§7.1.1 Analisa Bahan vs Penjualan** (glaze↔sweet, kentang↔menu kentang, saus↔bersaus).
- **OWN-09 Kelola Banner [P2]** — upload/replace carousel banners; global; manual on/off.
- **OWN-10 Sistem Promo [P1]** — Owner-only. Types: diskon (%/nominal, targetable), beli-dapat (free item reduces stock, no wage cut), happy hour (time window), voucher code (quota+expiry, tracked). Combine guard: max-discount cap + "tidak bisa digabung" flag. Promo reports per promo + impact on omzet.
- **OWN-11 Bagi Hasil Investor [P1]** — monthly from finalized month. Laba Bersih = Omzet − Sewa − Gaji − Value − Belanja Supplier. Dividen = 30% × Laba (configurable). Owner inputs costs; export PDF/CSV. Investors have NO app access.

## CORNEY Ops — Produksi (PRD §7.2) — P1 (upstream P0-critical)
- **PRD-01 Catat Hasil Produksi [P0]** — record yield per session (frozen stock +) + production susut + reason.
- **PRD-02 Stok Freezer per Cabang (Min-Maks) [P0]** — standar + minimum per branch (Owner-set); auto-decrease on Operasional take; min alarm; may exceed standar; Produksi sees standar/min only (not branch remainder).
- **PRD-03 Reorder Bahan Mentah [P0]** — order ~3 days before run-out; threshold-based; separate buy-path from branch shopping requests.
- **PRD-04 Pengambilan & Opname Freezer [P0]** — Operasional self-inputs "ambil X" (no per-take confirm); safety net = periodic freezer opname by Produksi (2 modes: each refill / weekly); system flags late/missed opname.

## CORNEY Ops — Operasional (PRD §7.3) — P1 (P0-support)
Access: all branches + full omzet + input shipment + audit + collect deposits. CANNOT execute stock corrections (propose only).
- **OPS-01 Isi Stok ke Par Level [P0]** — par per branch (Owner-set, fillings only). Send = standar − sisa (system); fix at branch if physical differs. Shipment → appears in branch Opening Day → kasir confirms → send-vs-receive diff recorded.
- **OPS-02 Audit Lapangan [P0]** — check diff/patah/hilang via system + physical; report to Owner (second oversight layer).
- **OPS-03 Jembatan Supplier [P1]** — system merges all-branch shopping requests into recap; Operasional uses it to enter orders into PWA Supplier (not auto-sync).
- **OPS-04 Ambil Setoran Tunai [P0]** — collect cash near close; 2-sided confirm (kasir "serahkan Rp X" / ops "terima Rp X"); deposit to Auditor/Owner.

## CORNEY Supplier (PRD §7.4) — P1, standalone, isolated
MUST NOT access internal sales/omzet/cash/customer/stock. One-way to Owner via 2 bridges only.
- **SUP-01 Kategori 1 — Pesanan Harian [P1]** — manual items (name, price, unit); checklist, qty per branch; catalog saved, shared all branches.
- **SUP-02 Kategori 2 — Bahan Harian (Adonan) [P1]** — same; per-branch; checklist saved for next day.
- **SUP-03 Keranjang Multi-Cabang & Total Otomatis [P1]** — choose branch → tick K1+K2+qty → save → repeat; per-branch subtotal + grand total; one WA message grouped per branch.
- **SUP-04 Riwayat Harga & Notifikasi [P1]** — price change saved (old→new+date); every change notifies Owner (bridge 1 of 2).
- **SUP-05 Tandai Item Kosong [P1]** — mark out-of-stock; Owner & Operasional notified; not auto-carried to next order.

## CORNEY Ops — Auditor (PRD §7.5) — P0-support
Money chain: Kasir → Operasional → Auditor → Owner (2-sided confirm each).
- **AUD-01 Terima & Verifikasi Setoran [P0]** — receive (2-sided), recount physical, match vs branch report; mark cocok/selisih+jumlah → Owner.
- **AUD-02 Telusur Titik Selisih [P0]** — pinpoint which handoff (kasir/ops/auditor) via 2-sided confirms.
- **AUD-03 Cakupan & Jejak [P1]** — sees all branches; deposits routed to Auditor or Owner.
- **AUD-04 Jejak Audit (Audit Log) [P1]** — immutable: who/what/when/old→new; covers refund, correction, void, cash handoff. Cannot be edited/deleted by anyone incl Owner. Auditor verifies money but does NOT execute stock corrections.
