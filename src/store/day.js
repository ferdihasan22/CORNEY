// CORNEY — Day session store (Fase 1, dummy/local).
// Shared "brain" for one kasir day: Opening → Selling → Closing. Persisted to
// localStorage so a refresh, crash, app-close, or offline reload never loses
// the open day (PRD §8.2 — no data loss). Replace with Supabase Realtime +
// offline sync queue in TAHAP 4.
//
// IMPORTANT: every mutation assigns a NEW `state` object (immutable update) so
// useSyncExternalStore re-renders. Never mutate `state` in place.
//
// PRD rules baked in:
//  - Opening Day BLOCKS selling until stock (OPN-01) + cash (OPN-02) confirmed.
//  - Stok hari ini = sisa fisik + barang datang, LOCKED as opening stock.
//  - Sales hard-locked at parent stock 0 (no force-sell, never minus from sale).
//  - 1:1 — one menu sold deducts its parent filling by one.

import { MENUS } from '../data/menu.js'
import { getOrders } from './orders.js'
import { setBranchOpen } from './branchStatus.js'

const KEY = 'corney_day'

const subscribers = new Set()
let state = load()

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (!s) return null
    // Migrate sessions created before newer fields existed, so older sales
    // never crash consumers (cook/no added in 1A.6/1A.7; corrections in 1A.8).
    if (Array.isArray(s.sales)) {
      s.sales = s.sales.map((sale, i) => {
        const out = { ...sale }
        if (out.no == null) out.no = i + 1
        if (!out.cook) out.cook = { status: 'queued', durationMin: null, startAt: null }
        return out
      })
    } else {
      s.sales = []
    }
    if (!Array.isArray(s.corrections)) s.corrections = []
    if (!Array.isArray(s.menuOff)) s.menuOff = []
    if (!Array.isArray(s.breakageLog)) s.breakageLog = []
    return s
  } catch {
    return null
  }
}

function commit(next) {
  state = next
  if (state) localStorage.setItem(KEY, JSON.stringify(state))
  else localStorage.removeItem(KEY)
  subscribers.forEach((fn) => fn())
}

// ── Phases ──────────────────────────────────────────────
export const PHASE = {
  OPENING: 'opening', // OPN-01 stock (blocks selling)
  CASH: 'cash', // OPN-02 cash float (blocks selling)
  BELANJA: 'belanja', // OPN-03 checklist belanjaan datang (dipesan kemarin)
  REMINDER: 'reminder', // OPN-04 reminder wajib baca (auto-lanjut 2 menit)
  SELLING: 'selling', // Walk-in / Online / cooking queue
  CLOSING: 'closing',
  CLOSED: 'closed',
}

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); subscribers.forEach((fn) => fn()) } })
}

export function getState() {
  return state
}

export function subscribe(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

// ── Batas hari (cegah "lupa closing lalu hari berganti") ──────────────────
const ddOf = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function todayDD() { return ddOf(new Date()) }
// Tanggal usaha sesi yang sedang berjalan (dari startedAt), 'DD/MM/YYYY' / ISO.
export function dayDateDD() { return state?.startedAt ? ddOf(new Date(state.startedAt)) : null }
export function dayDateISO() { return state?.startedAt ? isoOf(new Date(state.startedAt)) : null }
// Jumlah transaksi yang sudah masuk hari ini (untuk pesan & keputusan).
export function daySalesCount() { return (state?.sales || []).length }
// Hari BASI: sesi masih terbuka (belum CLOSED) tapi tanggalnya bukan hari ini.
// Artinya kasir lupa Closing dan hari sudah berganti.
export function isStaleDay() {
  if (!state || state.phase === PHASE.CLOSED) return false
  return dayDateDD() !== ddOf(new Date())
}

// Start (or resume) the day for a branch. Never wipe an in-progress day.
export function startDay(branchId) {
  if (state && state.branchId === branchId && state.phase !== PHASE.CLOSED) return
  commit({
    branchId,
    phase: PHASE.OPENING,
    startedAt: Date.now(),
    openingStock: null, // {parentId: qty} locked at OPN-01
    stockArrivalLog: null,
    susut: null,
    stock: null, // live remaining (decremented when a sale completes)
    cash: null, // { opening }
    cart: [], // walk-in cart (uncommitted lines)
    sales: [], // completed transactions (1A.6+)
    corrections: [], // stock-correction requests proposed by kasir (BHN-06)
    closing: null, // Closing Day working data (CLS-02..06)
    menuOff: [], // menu ids turned OFF (e.g. coating habis) — WLK-01 toggle
    breakageLog: [], // patah recorded during the day (reduces stock as it happens)
  })
}

// Record breakage (patah) as it happens: reduces live stock + logs it. Feeds
// the closing patah field (no double entry). Stock won't go below 0 here.
export function recordBreakage(parentId, qty, reason = '') {
  if (!state || qty <= 0) return null
  const entry = { id: 'PTH-' + Date.now(), parentId, qty, reason: reason.trim(), ts: new Date().toISOString() }
  const stock = { ...state.stock, [parentId]: Math.max(0, (state.stock?.[parentId] ?? 0) - qty) }
  commit({ ...state, stock, breakageLog: [entry, ...(state.breakageLog || [])] })
  return entry
}
export function breakageByParent() {
  const m = {}
  ;(state?.breakageLog || []).forEach((e) => { m[e.parentId] = (m[e.parentId] || 0) + e.qty })
  return m
}

// WLK-01 — toggle a menu's availability (e.g. coating habis). A menu sells only
// when its parent stock > 0 AND it is ON. Turning off → shows HABIS to customer.
export function toggleMenu(menuId) {
  if (!state) return
  const off = state.menuOff || []
  const menuOff = off.includes(menuId) ? off.filter((x) => x !== menuId) : [...off, menuId]
  commit({ ...state, menuOff })
}
export function isMenuOff(menuId) {
  return (state?.menuOff || []).includes(menuId)
}

// Quantity sold per parent filling across the day (1:1 from sale lines).
export function soldByParent() {
  const sold = {}
  ;(state?.sales || []).forEach((sale) => {
    sale.lines.forEach((l) => { sold[l.parent] = (sold[l.parent] || 0) + l.qty })
  })
  return sold
}

// OPN-01 — lock today's opening stock.
export function confirmOpeningStock(rows) {
  if (!state) return
  const openingStock = {}
  const stockArrivalLog = {}
  const susut = {}
  rows.forEach((r) => {
    openingStock[r.parentId] = r.today
    susut[r.parentId] = r.susut
    stockArrivalLog[r.parentId] = r.arrival
  })
  commit({
    ...state,
    openingStock,
    stock: { ...openingStock },
    susut,
    stockArrivalLog,
    phase: PHASE.CASH,
  })
}

// OPN-02 — set opening cash float, lalu lanjut ke checklist belanjaan datang.
export function setOpeningCash(amount) {
  if (!state) return
  commit({ ...state, cash: { opening: amount }, phase: PHASE.BELANJA })
}

// OPN-03 — checklist belanjaan datang (yang dipesan kemarin) → lanjut reminder.
// received = { itemId: { datang: bool, qty } }
export function setBelanjaDatang(received) {
  if (!state) return
  commit({ ...state, belanjaDatang: received || {}, phase: PHASE.REMINDER })
}

// OPN-04 — reminder wajib baca selesai → buka jualan.
export function finishReminder() {
  if (!state) return
  commit({ ...state, phase: PHASE.SELLING })
  setBranchOpen(true) // mode supabase: kabari customer cabang BUKA untuk online (lintas perangkat)
}

// ── Walk-in cart (WLK-01/02) ────────────────────────────
// Available parent stock = live remaining − qty already held in the cart.
// This is what enforces the hard-lock at 0 (no force-sell).
export function parentAvailable(parentId) {
  if (!state) return 0
  const inCart = (state.cart || []).reduce((sum, l) => {
    const m = MENUS.find((x) => x.id === l.menuId)
    return m && m.parent === parentId ? sum + l.qty : sum
  }, 0)
  return (state.stock?.[parentId] ?? 0) - inCart
}

// Identical menu + identical sauce set merge into one line (qty++).
function lineSig(menuId, sauces) {
  return menuId + ':' + sauces.map((s) => s.id).sort().join(',')
}

export function addToCart(menuId, sauces = []) {
  if (!state || state.phase !== PHASE.SELLING) return false
  const menu = MENUS.find((m) => m.id === menuId)
  if (!menu) return false
  if ((state.menuOff || []).includes(menuId)) return false // menu OFF (coating habis)
  if (parentAvailable(menu.parent) <= 0) return false // HARD-LOCK at 0
  const sig = lineSig(menuId, sauces)
  const cart = state.cart.map((l) => ({ ...l }))
  const existing = cart.find((l) => l.sig === sig)
  if (existing) existing.qty += 1
  else cart.push({ sig, menuId, parent: menu.parent, sauces, qty: 1 })
  commit({ ...state, cart })
  return true
}

export function incLine(sig) {
  if (!state) return false
  const line = state.cart.find((l) => l.sig === sig)
  if (!line) return false
  if (parentAvailable(line.parent) <= 0) return false // can't exceed stock
  const cart = state.cart.map((l) => (l.sig === sig ? { ...l, qty: l.qty + 1 } : l))
  commit({ ...state, cart })
  return true
}

export function decLine(sig) {
  if (!state) return
  const cart = state.cart
    .map((l) => (l.sig === sig ? { ...l, qty: l.qty - 1 } : l))
    .filter((l) => l.qty > 0)
  commit({ ...state, cart })
}

export function removeLine(sig) {
  if (!state) return
  commit({ ...state, cart: state.cart.filter((l) => l.sig !== sig) })
}

export function clearCart() {
  if (!state) return
  commit({ ...state, cart: [] })
}

// ── Checkout (WLK-03 + §6.7 channels) ───────────────────
// Cart line money: base price + paid sauces, × qty.
function cartTotals(cart) {
  let subtotal = 0
  let biaya = 0
  cart.forEach((l) => {
    const m = MENUS.find((x) => x.id === l.menuId)
    subtotal += (m?.price ?? 0) * l.qty
    biaya += l.sauces.reduce((s, x) => s + (x.price || 0), 0) * l.qty
  })
  return { subtotal, biaya, total: subtotal + biaya }
}

// 1:1 — each sold menu deducts its parent filling by qty. Clamp at 0 so a sale
// never drives stock negative (PRD golden rule #7).
function applyCartToStock(stock, cart) {
  const next = { ...stock }
  cart.forEach((l) => {
    next[l.parent] = Math.max(0, (next[l.parent] ?? 0) - l.qty)
  })
  return next
}

// Status per channel (§6.7).
const SALE_STATUS = {
  tunai: 'lunas',
  qris_midtrans: 'terverifikasi',
  qris_gopay: 'terklaim',
  gofood: 'gofood',
  grabfood: 'grabfood',
}

function buildSale(cart, sales, extra) {
  const { subtotal, biaya, total } = cartTotals(cart)
  return {
    id: 'TRX-' + Date.now() + '-' + sales.length,
    no: sales.length + 1, // FIFO order number for the day
    ts: new Date().toISOString(),
    lines: cart.map((l) => ({ ...l })),
    subtotal, biaya, total,
    cashReceived: null, change: null, method: null,
    // Cooking queue state (MSK). One timer per order.
    cook: { status: 'queued', durationMin: null, startAt: null },
    ...extra,
  }
}

// "Bayar Sekarang" — commit a paid sale, decrement stock, clear cart.
export function commitSale({ method, cashReceived = null }) {
  if (!state || state.phase !== PHASE.SELLING || state.cart.length === 0) return null
  const { total } = cartTotals(state.cart)
  const sale = buildSale(state.cart, state.sales, {
    method,
    status: SALE_STATUS[method] || 'lunas',
    paid: true,
    cashReceived: method === 'tunai' ? cashReceived : null,
    change: method === 'tunai' && cashReceived != null ? Math.max(0, cashReceived - total) : null,
  })
  commit({
    ...state,
    stock: applyCartToStock(state.stock, state.cart),
    cart: [],
    sales: [...state.sales, sale],
  })
  return sale
}

// Pay a previously-created "Buat Dulu" order (payment at handover). Does not
// touch stock (already consumed when created); just marks it paid.
export function payPending(saleId, { method, cashReceived = null }) {
  if (!state) return null
  let found = null
  const sales = state.sales.map((s) => {
    if (s.id !== saleId || s.paid) return s
    found = {
      ...s,
      paid: true,
      method,
      status: SALE_STATUS[method] || 'lunas',
      cashReceived: method === 'tunai' ? cashReceived : null,
      change: method === 'tunai' && cashReceived != null ? Math.max(0, cashReceived - s.total) : null,
    }
    return found
  })
  if (!found) return null
  commit({ ...state, sales })
  return found
}

// "Buat Dulu" — order is made now (stock consumed), payment at handover.
export function createPending() {
  if (!state || state.phase !== PHASE.SELLING || state.cart.length === 0) return null
  const sale = buildSale(state.cart, state.sales, { method: null, status: 'pending_payment', paid: false })
  commit({
    ...state,
    stock: applyCartToStock(state.stock, state.cart),
    cart: [],
    sales: [...state.sales, sale],
  })
  return sale
}

// ── Cooking queue (MSK-04) ──────────────────────────────
function patchSaleCook(saleId, cook) {
  if (!state) return null
  let found = null
  const sales = state.sales.map((s) => {
    if (s.id !== saleId) return s
    found = { ...s, cook: { ...s.cook, ...cook } }
    return found
  })
  if (!found) return null
  commit({ ...state, sales })
  return found
}

// GORENG → start one countdown for the whole order (6 or 8 minutes).
export function startFrying(saleId, durationMin) {
  const s = state?.sales.find((x) => x.id === saleId)
  if (!s) return null
  const status = s.cook?.status ?? 'queued'
  if (status !== 'queued') return null
  return patchSaleCook(saleId, { status: 'frying', durationMin, startAt: Date.now() })
}

// SELESAI (angkat) → order leaves the active queue.
export function finishCooking(saleId) {
  return patchSaleCook(saleId, { status: 'completed' })
}

// Hitungan antrean masak: belum digoreng (queued) & lagi digoreng (frying).
// Gabungan walk-in (sales) + online (orders diproses). Untuk badge tombol.
export function cookingCounts() {
  if (!state) return { queued: 0, frying: 0 }
  const cooks = [
    ...(state.sales || []).map((s) => s.cook || { status: 'queued' }),
    ...(getOrders() || []).filter((o) => o.branchId === state.branchId && o.paid && o.status === 'diproses' && (o.cook?.status || 'queued') !== 'completed').map((o) => o.cook || { status: 'queued' }),
  ].filter((c) => c.status !== 'completed')
  return { queued: cooks.filter((c) => c.status !== 'frying').length, frying: cooks.filter((c) => c.status === 'frying').length }
}

// ── Stock correction (BHN-06) ───────────────────────────
// Kasir PROPOSES only — this never changes stock. Owner executes later
// (OW-07 / step 1B.5), which is what actually applies the delta.
export function requestCorrection({ parentId, physicalQty, reason }) {
  if (!state) return null
  const systemQty = state.stock?.[parentId] ?? 0
  const req = {
    id: 'KOR-' + Date.now(),
    ts: new Date().toISOString(),
    parentId,
    systemQty,
    physicalQty,
    delta: physicalQty - systemQty,
    reason: reason || '',
    status: 'pending', // pending | approved | rejected (Owner sets)
  }
  commit({ ...state, corrections: [req, ...(state.corrections || [])] })
  return req
}

// OW-07 (step 1B.5) — Owner EXECUTES a kasir's correction. Separation of duties:
// kasir proposes (requestCorrection), only the Owner applies it. On approve, the
// physical count becomes the new live stock (delta applied; may go negative per
// PRD golden rule #7 — negative is an alarm, not a clamp). Resolved corrections
// are immutable audit entries (status flips once; can't re-resolve).
export function resolveCorrection(id, approve) {
  if (!state) return null
  let found = null
  const corrections = state.corrections.map((c) => {
    if (c.id !== id || c.status !== 'pending') return c
    found = { ...c, status: approve ? 'approved' : 'rejected', resolvedAt: new Date().toISOString() }
    return found
  })
  if (!found) return null
  // Approve → set live stock to the kasir's physical count (the truth on shelf).
  const stock = approve && state.stock
    ? { ...state.stock, [found.parentId]: found.physicalQty }
    : state.stock
  commit({ ...state, corrections, stock })
  return found
}

// ── Closing Day — CLS-02 Rekonsiliasi Stok (v56, urutan wajib) ──────────
// rows: [{parentId, opening, sold, patah, garansi, promo, sisaBagus, hilang,
//         hargaTerendah, potongan}]
// hilang = awal − terjual − patah − garansi − promo − sisa bagus.
// potong gaji = (patah + garansi + hilang) × harga terendah (promo TIDAK).
// Capped at 100% daily wage (Rp 0 floor). Sisa bagus → tomorrow's opening.
export function saveReconStock(rows, wage) {
  if (!state) return null
  const potongTotal = rows.reduce((s, r) => s + r.potongan, 0)
  const potongCapped = Math.min(potongTotal, wage)
  const gajiAkhir = Math.max(0, wage - potongTotal)
  const sisaBagus = {}
  rows.forEach((r) => { sisaBagus[r.parentId] = r.sisaBagus })
  const closing = {
    ...(state.closing || {}),
    recon: { rows, sisaBagus },
    payroll: { wage, potongTotal, potongCapped, gajiAkhir },
  }
  commit({ ...state, closing })
  return closing
}

// Paid revenue per channel (CLS-03). Pending (unpaid Buat Dulu) excluded.
export function channelTotals() {
  const t = { tunai: 0, qris_midtrans: 0, qris_gopay: 0, gofood: 0, grabfood: 0 }
  let count = { tunai: 0, qris_midtrans: 0, qris_gopay: 0, gofood: 0, grabfood: 0 }
  ;(state?.sales || []).forEach((s) => {
    if (s.paid && s.method && t[s.method] != null) {
      t[s.method] += s.total
      count[s.method] += 1
    }
  })
  // Order ONLINE (paid) cabang ini = QRIS Midtrans. TIDAK ada di state.sales (itu
  // walk-in saja), jadi tidak dobel. Disamakan dgn agregasi online di ClosingReport
  // → channel & total omzet konsisten dgn Variant Terjual.
  ;(getOrders() || []).forEach((o) => {
    if (o.paid && state?.branchId && o.branchId === state.branchId && new Date(o.createdAt).getTime() >= (state.startedAt || 0)) {
      t.qris_midtrans += o.total || 0
      count.qris_midtrans += 1
    }
  })
  return { total: t, count }
}

// CLS-00 — simpan checklist belanja besok (item id yang dicentang) → dipakai
// Analisa Bahan sebagai "unit dipakai" (tiap centang = habis 1, perlu beli lagi).
export function saveClosingBelanja(picked) {
  if (!state) return null
  // picked = { itemId: jumlah }. Simpan apa adanya (objek jumlah).
  const belanja = picked && typeof picked === 'object' && !Array.isArray(picked) ? picked : {}
  const closing = { ...(state.closing || {}), belanja }
  commit({ ...state, closing })
  return closing
}

// CLS-03 — save cash/channel reconciliation.
export function saveClosingReconcile(data) {
  if (!state) return null
  const closing = { ...(state.closing || {}), reconcile: data }
  commit({ ...state, closing })
  return closing
}

// CLS-04/04b — save urgent cash + refunds + employee daily pay. All three are
// cash paid out of the drawer, so all reduce the expected cash to deposit.
// urgent/refund/gaji: { items:[{id,amount,reason,ts}], total }
export function saveClosingUrgentRefund(urgent, refund, gaji, modalUsed) {
  if (!state) return null
  const closing = {
    ...(state.closing || {}),
    urgent, refund,
    gaji: gaji || { items: [], total: 0 },
    // Pemakaian modal/kembalian (float) — mengurangi modal yang disisihkan, bukan setoran.
    modalUsed: modalUsed || { items: [], total: 0 },
  }
  commit({ ...state, closing })
  return closing
}

// CLS-00 — tanggal laporan dipilih kasir di Langkah 1 (Request Belanja), dipakai
// saat Kirim di Langkah 5. ISO 'YYYY-MM-DD'.
export function setReportDate(iso) {
  if (!state) return
  commit({ ...state, reportDate: iso })
}

// CLS-06 — finalize: store the report snapshot and mark the day closed.
export function finalizeClosing(report) {
  if (!state) return null
  const closing = { ...(state.closing || {}), report, finalizedAt: Date.now() }
  commit({ ...state, closing, phase: PHASE.CLOSED })
  return closing
}

// Finalize / reset the local session (Closing → tomorrow's Opening).
export function endDay() {
  commit(null)
  setBranchOpen(false) // mode supabase: kabari customer cabang TUTUP untuk online
}
