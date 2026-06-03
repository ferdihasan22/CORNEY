---
name: corney-pwa-builder
description: Authoritative build guide for the CORNEY corndog PWA ecosystem (CORNEY App + CORNEY Ops 5-role + CORNEY Supplier), derived verbatim from CORNEY PRD v1.0. Use this skill whenever building, scaffolding, extending, or reviewing any CORNEY app screen, feature, data model, or business rule so nothing in the PRD is missed and the implementation matches the spec exactly.
---

# CORNEY PWA Builder

This skill is the **single source of truth** for building the CORNEY ecosystem. It distills the 44-page CORNEY PRD v1.0 so every screen, rule, and entity is implemented faithfully. **When a detail is ambiguous, this skill + the PRD win over assumptions.** The 70-screen Stitch project "CORNEY POS Login Screen" (`projects/4747735536330481940`) is the **visual UI reference**.

## When to use
Invoke for ANY CORNEY work: scaffolding, building a screen, adding a feature, designing the DB, writing RLS, reviewing code, or checking spec compliance. Always cross-check the relevant feature code (e.g. `WLK-01`, `CLS-02b`) and priority (P0/P1/P2) before coding.

## Golden rules (never violate)
1. **Build heart-first.** Core problem = "transaksi & laporan penjualan berantakan." Heart = **Kasir** (recording) + **Owner** (reporting). Build P0 before P1 before P2. Do NOT build all 3 apps / 6 surfaces at once (PRD §13 risk #1).
2. **Separation of duties.** The person holding goods/cash must not hold the tool to hide their own tracks. Stock correction: **Kasir proposes, Owner executes** (`BHN-06`). Cash: **2-sided confirmation** at every handoff (Kasir→Operasional→Auditor→Owner).
3. **Order intake must never depend on the customer pressing WhatsApp.** Online orders enter via **Jalur 1** (server auto-places on kasir dashboard after Midtrans verifies) — must always work. WA (**Jalur 2**) is communication only, may fail.
4. **Reset = new period, not delete.** Daily Closing→Opening and monthly close never erase data; all history accumulates and is immutable once finalized.
5. **Nonaktif ≠ hapus.** Deactivate, never hard-delete master data. History stays for audit.
6. **Audit log is immutable** — not editable/deletable by anyone, including Owner (`AUD-04`).
7. **Stock may go minus as an alarm**, never from a sale. Sales are hard-locked at 0; minus only from internal records (correction/breakage).
8. **Never store card/payment credentials.** All via gateway (Midtrans). No sensitive financial data in CORNEY DB.
9. **WA has no API** (WA Business app). All WA = `wa.me` click-to-chat with pre-typed text; user presses send; statuses marked manually.
10. **Honest gaps.** Some leak paths (siluman sales, garansi self-input, loose urgent cash) cannot be 100% closed by software — document, don't fake-solve.

## Architecture (PRD §2, §9.5)
Three apps, one shared brain + one isolated outsider:

| App | Nature | Users | Access |
|---|---|---|---|
| **CORNEY App** | Public, light PWA | Customer | Scan QR / link, install optional |
| **CORNEY Ops** | Internal, role-based | Kasir, Produksi, Operasional, Owner, Auditor | Credential login |
| **CORNEY Supplier** | Standalone, one-way to Owner | Supplier (outsider) | Separate login; no internal data |

- **CORNEY App + Ops share ONE database** (real-time). **Supplier is a SEPARATE DB**, flows ONE-WAY to Owner via exactly 2 bridges: price-change notif (`SUP-04`) + order data for Purchase Ledger (`OWN-08`). No internal data ever flows back to Supplier.
- **Stack:** Vite + React + Tailwind (PWA, service worker, offline-first for kasir) · **Supabase** (Postgres + Auth + Realtime + Storage) · **Cloudflare Pages** · **RLS MANDATORY** (per-role access, supplier isolation, separation of duties enforced in DB — not just UI).
- **Non-functional (PRD §8):** kasir tap <200ms, txn save <1s, customer load <3s on 4G. Kasir fully works offline for cash txns, syncs on reconnect, no data loss on crash. Unique txn number per branch (device prefix) to avoid collision. HTTPS, hashed passwords, idle session timeout.
- **Hardware (PRD §9):** Day-1 = digital receipt (QR) + QRIS. Thermal printer/cash drawer only if needed (Web Bluetooth / WiFi printer). Camera as QR scanner.
- **Devices:** Kasir = Android tablet/phone primary. Owner/Auditor = phone + desktop.

## Product model — MEMORIZE EXACTLY (PRD §6.3, §7.1.1)
**4 isian induk (the ONLY stock units, counted per-piece):** `Keju Mozza`, `Sosis Reguler`, `Sosis Jumbo`, `Mix`. Mix has its own stock (does NOT deduct mozza/sosis).

**11 menus → parent → category:**
| Menu | Parent filling | Category |
|---|---|---|
| Sweet Coklat, Sweet Tiramisu, Sweet Greentea | Keju Mozza | **Sweet** (glaze, NO sauce) |
| Mozza Ori, Mozza Kentang | Keju Mozza | **Savory** (sauce, NO glaze) |
| Sosis Ori, Sosis Kentang | Sosis Reguler | Savory |
| Jumbo Ori, Jumbo Kentang | Sosis Jumbo | Savory |
| Mix Ori, Mix Kentang | Mix | Savory |

- **1:1 rule:** 1 menu sold → its parent filling −1. (e.g. Sweet Coklat sold → Keju Mozza −1.)
- **Two conditions to sell:** `parent stock > 0` **AND** `menu toggle = on`. Category enforces topping rule: Sweet may glaze + may NOT sauce; Savory may sauce + may NOT glaze.
- **Liquid/bulk materials** (glaze choc/tiramisu/greentea, sauces, potato) are NOT counted per-piece; monitored via Shopping-Request frequency (`BHN-01`) + material-vs-sales analysis (`OWN-08.1`).

## Key formulas (implement exactly)
- **Stok hari ini** = sisa fisik + barang datang (locked as opening stock).
- **Selisih hilang** = stok awal − terjual − sisa bagus (kulkas) − patah.
- **Potong gaji** = (jumlah patah + jumlah hilang) × harga jual varian **TERENDAH** dari isian itu; no tolerance; **capped at 100% of that day's wage** (can hit Rp 0, never negative/debt). Excess = business loss, not accumulated. Garansi/komplain claims ALSO cut wages (per menu price); promo free items do NOT.
- **Kas seharusnya** = modal awal + penjualan tunai − total uang urgent − refund tunai.
- **Laba Bersih Cabang** (`OWN-11`, monthly, from finalized month) = Omzet − Sewa − Gaji − Value(simpanan) − Belanja Supplier. **Dividen Investor** = 30% × Laba Bersih (configurable per investor/branch); rest is Owner's. Investors have NO app access.

## Build order (PRD §12 roadmap — follow strictly)
**Fase 1 — Fondasi (P0):**
- CORNEY Ops **Kasir**: full POS, payments, open/close cash, offline.
- CORNEY Ops **Owner**: real-time dashboard, master data (products & recipes), basic reports.
- CORNEY App: digital menu catalog + digital receipt.
- *Result: core problem solved, business can run cleanly.*

**Fase 2 — Pertumbuhan (P1):** full e-commerce (online order, QRIS Midtrans, WA OTP, pickup time, order tracking) · kasir online-order dashboard (order card, 2-step WA, status, PIN) · multi-branch (master+override, per-branch WA, 2-layer access) · Operasional · Produksi · Owner notifications/users/loyalty.

**Fase 3 — Skala (P2):** Supplier portal · Auditor (audit log + anomaly dashboard) · production planning · waste/expiry/transfer · deeper cross-branch aggregates.

## Detailed references (read before building each area)
- **[reference/data-model.md](reference/data-model.md)** — all 30+ entities (PRD §2.4), fields, which roles use them, plus the data-flow map (§2.5).
- **[reference/features.md](reference/features.md)** — every feature code (CUS / OPN / BHN / WLK / MSK / STR / CLS / OWN / PRD / OPS / SUP / AUD) with priority and acceptance behavior.
- **[reference/screens.md](reference/screens.md)** — the 70 Stitch reference screens mapped to apps/roles/features.
- **[reference/flows-and-rules.md](reference/flows-and-rules.md)** — customer E2E flow, kasir day cycle, money chain, stock chain, payment channels, edge cases (§4, §6, §11), open questions 17–22.

## Compliance checklist (run before calling any area "done")
- [ ] Every feature for the area implemented at its priority (no P0 skipped).
- [ ] Separation-of-duties enforced in **RLS**, not just UI.
- [ ] Audit log writes for: refund, stock correction, void, cash handoff.
- [ ] Stock never goes minus from a sale; correction flow is propose→approve.
- [ ] Offline path works for cash sales; sync is idempotent (no double-charge / double-stock).
- [ ] Prices locked at transaction time; master price changes don't alter past txns.
- [ ] Deactivate (not delete) for master data; history preserved.
- [ ] WA actions are `wa.me` pre-typed; statuses update on the same button press.
- [ ] Brand: CORNEY red (`#C8102E`-family / dark-red swirl), tagline `#CeritanyaBersamaCorney`.
