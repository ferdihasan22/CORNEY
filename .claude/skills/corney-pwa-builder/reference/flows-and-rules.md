# CORNEY Flows, Chains, Edge Cases & Open Questions

## Customer order flow E2E (PRD §4)
1. Click CORNEY link → landing page.
2. Landing shows 3 buttons: **Order Sekarang**, Pesan di GoFood, Pesan di GrabFood.
3. GoFood/Grab → leave to that app (outside CORNEY).
4. Order Sekarang → **choose branch first** (branch stays visible whole session).
5. Storefront: menu/price/stock for that branch, categories, promo banner, order tracking; add to cart.
6. Checkout: method = diantar (customer orders Maxim) or ambil nanti (pick pickup time, **≥15 min** from now).
7. Order as guest: active WA number + address (if delivery).
8. **OTP WA** on first order; verified number remembered (no OTP next time, same device).
9. Pay via **QRIS dinamis Midtrans** (product price only; Maxim fee paid separately to driver). Timeout = Midtrans default.
10. On verified → "Pembayaran Berhasil" + pickup **PIN**.
11. **Order auto-enters kasir dashboard** of chosen branch (does NOT wait for customer action) = **Jalur 1**.
12. Success page has "Hubungi Kasir via WhatsApp" w/ pre-typed message + PIN; customer sends first = **Jalur 2**.
13. Kasir "Konfirmasi Terima" → WA "sedang dibuat" + status **Diproses**.
14. Kasir "Pesanan Siap" → WA + status **Siap** (Maxim: order Maxim + put PIN in driver note; ambil: come + PIN).
15. Handover: Maxim driver states PIN (kasir matches, backup PIN on dashboard); ambil: customer states PIN.
16. Kasir "Selesai" on handover → status **Selesai**.

**Two paths after payment (critical):** Jalur 1 (server auto-places order) = customer-independent, MUST NOT FAIL. Jalur 2 (WA) = customer-dependent, may fail, comms only. Order recording NEVER depends on WA.

**WA staged buttons:** Konfirmasi Terima→Diproses · Pesanan Siap (Maxim/Ambil)→Siap · Selesai (no WA)→Selesai. Each opens `wa.me` pre-typed + updates status on same press. WA "menunggu pelanggan menghubungi" marked manually (yellow + clock).

**Order statuses:** Baru → Diproses → Siap → Selesai (kasir-driven, real-time in customer tracking).

## Kasir day cycle
**Login (account = branch, e.g. `corney-sepinggan`)** → account decides menu/price/stock/WA/where txns record → **Opening Day** (OPN-01 stock + OPN-02 cash; blocks selling until done) → **Jualan** (Walk-in tab + Online tab + cooking queue) → **Closing Day** (CLS-00…06). Remainder → tomorrow's opening. Reset = new day display only; all data accumulates.

## Money chain (separation of duties — PRD §7.5)
| Point | Who | Action |
|---|---|---|
| 1 | Kasir | count closing cash → branch report |
| 2 | Operasional | collect & carry deposit (2-sided confirm vs report) |
| 3 | Auditor | recount physical vs branch report → mark cocok/selisih |
| 4 | Owner | review verification |
Every handoff = 2-sided confirm so a discrepancy is traceable to a specific point.

## Stock chain (upstream→downstream — PRD §7.2)
Supplier → **Produksi** (cut, freeze, fill freezer per branch min-maks) → [Operasional self-inputs take; gap closed by periodic freezer opname] → **Operasional** (compute standar − sisa, distribute) → [2-sided confirm at Opening Day] → **Kasir** → sell. Freezer point uses periodic opname; branch point uses 2-sided confirm.

## Payment channels (5)
Tunai (Lunas, into drawer) · QRIS Midtrans (Terverifikasi, auto) · QRIS GoPay static photo (Terklaim, marked, manual, check mutation at closing) · GoFood · GrabFood (recorded, no booth pay). Hierarchy: Midtrans primary, GoPay backup on failure, cash always available.

## Multi-branch (PRD §3)
Each branch = independent unit: own menu/price/stock/WA-Business number/account. Master + override (Owner changes master once → all branches; branch can override local price / disable menu). Selected branch ALWAYS visible to customer; changing branch revalidates cart. 2-layer access: kasir sees only its branch; Owner sees all + cross-branch aggregate.

## Edge cases (PRD §4.6, §6.9, §11) — handle all
- Pay then close page w/o WA → order still in via Jalur 1.
- WA typo/inactive → prevented by first-order OTP.
- Payment pending/fail/timeout → order NOT in dashboard; clear status + retry.
- Double pay (double click) → webhook idempotency: one order per payment ref; excess flagged for refund.
- Driver no/forgot PIN → kasir uses dashboard backup PIN + name/WA match.
- Wrong branch → branch always shown; change before pay; cart revalidated.
- Pickup time too soon → reject < 15 min.
- Stock out after pay → checked at checkout; if still happens, kasir WA for swap/refund.
- Internet drop during QRIS → hold "pending"; verify when online; never mark paid twice.
- Refund after stock deducted → return ingredient stock per recipe; log in audit.
- Master price change during live txn → price locked when item entered cart; change applies to new txns.
- Two kasir one outlet → separate shift & drawer; txn number no collision (device prefix).
- Shared BOM ingredient across products → accumulate deduction across products.
- Stock minus (sold > recorded) → allow + hard warning + force opname; don't block selling. (NB: WLK-01 hard-locks sale at 0; minus only from internal records.)
- Device clock wrong → server timestamp on sync; detect backward clock.
- Staff resign → deactivate (not delete); txn trail intact.
- Loyalty points used offline → validate online; if fail, cancel redemption + notify.

## Privacy (PRD §10, UU PDP)
Explicit opt-in before collecting customer data (not pre-checked). Collect minimum (phone enough for loyalty). Customer can request delete. No third-party share without consent. Role-limited internal access (kasir doesn't see whole customer DB).

## Open questions — need Owner (Ferdi) decision (PRD §14)
Locked already: Midtrans QRIS dinamis, full online ordering, guest + one-time WA OTP, pickup ≥15 min, Midtrans default timeout, multi-branch per-branch menu/price/stock.
Still to decide:
17. First outlet = static booth or mobile cart? (affects offline/hardware)
18. How many initial SKUs/menus? (affects catalog & recipe) — *PRD body assumes 11 menus / 4 fillings.*
19. Any local tax/PB1 on receipt?
20. OTP via SMS or WhatsApp? (WA cheaper + proves active WA)
21. Who builds — owner or developer? (affects tech depth)
22. Separate staff per role from day one, or 1–2 people multitask? (affects role build order)

**Until answered:** build with the assumptions above (11 menus/4 fillings, WA OTP, single branch first but multi-branch-ready schema). Flag any screen that depends on an unanswered question.
