// CORNEY — Customer online orders store (Fase 2, dummy/local). Persists orders
// created at checkout so the success screen, order tracking, and history survive
// refreshes. Replace with Supabase + Midtrans webhook in TAHAP 4.
//
// Order: { id, no, branchId, lines, subtotal, discount, total, method
//          ('ambil'|'maxim'), schedule, name, wa, pin, status, paid, payMethod,
//          createdAt, promoCode }

import { isSupabase } from '../lib/backend.js'

const KEY = 'corney_orders'
export const ORDER_FLOW = ['baru', 'diproses', 'siap', 'selesai']

const subscribers = new Set()
let list = load()

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(s) ? s : []
  } catch {
    return []
  }
}
function commit(next) {
  list = next
  localStorage.setItem(KEY, JSON.stringify(next))
  subscribers.forEach((fn) => fn())
}

// Sinkron antar-tab: saat tab lain (customer ↔ kasir) menulis orders, reload data
// terbaru & beri tahu komponen. Cegah salah satu tab menimpa pakai data basi
// (mis. status balik "baru" setelah kasir konfirmasi → order double).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) }
  })
}

// ── Dual-mode TAHAP 4 FASE 3 ────────────────────────────────────────────────
// Jalankan fungsi di modul tulis Supabase (dynamic import → bundle local ramping).
function remote(fn) {
  if (!isSupabase()) return
  import('./orders.remote.js').then(fn).catch((e) => console.warn('[orders] modul remote gagal:', e?.message || e))
}
// Gabung/ganti satu order di cache lokal (poll customer & sinkron).
function applyOrder(o) {
  if (!o) return
  const i = list.findIndex((x) => x.id === o.id)
  commit(i >= 0 ? list.map((x) => (x.id === o.id ? { ...x, ...o } : x)) : [o, ...list])
}
function genUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
// KASIR/staf: hidrasi + realtime saat ada sesi (customer anon tak ke sini).
if (isSupabase()) {
  import('./orders.remote.js').then(({ initKasirOrdersSync }) => initKasirOrdersSync(commit)).catch((e) => console.warn('[orders] sync kasir gagal:', e?.message || e))
}

export function getOrders() {
  return list
}
export function subscribeOrders(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}
export function getOrder(id) {
  return list.find((o) => o.id === id) || null
}

// 4-digit pickup PIN (dummy). Math.random is fine in app runtime.
function genPin() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

// Tanggal LOKAL (YYYY-MM-DD) — reset nomor antrian per hari (zona waktu lokal).
function localDate(d) {
  const x = d ? new Date(d) : new Date()
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export async function createOrder(payload) {
  const createdAt = new Date().toISOString()
  const pin = genPin()
  if (isSupabase()) {
    // Customer: id uuid + pin di klien; INSERT ke DB lalu baca-balik (dapat 'no'
    // dari trigger). Jika insert gagal → throw → checkout TIDAK lanjut ke bayar.
    const base = { id: genUuid(), no: null, pin, status: 'baru', paid: false, payMethod: 'qris', createdAt, ...payload }
    const { insertOrder } = await import('./orders.remote.js')
    const order = await insertOrder(base)
    applyOrder(order) // cache lokal utk layar QRIS/Sukses (perangkat yang sama)
    return order
  }
  // Lokal (lama): nomor antrian dihitung di klien, reset per cabang per hari.
  const today = localDate()
  const no = list.filter((o) => o.branchId === payload.branchId && localDate(o.createdAt) === today).length + 1
  const order = { id: 'ORD-' + Date.now(), no, pin, status: 'baru', paid: false, payMethod: 'qris', createdAt, ...payload }
  commit([order, ...list])
  return order
}

// Pelanggan menekan tombol WA (menghubungi kasir lebih dulu) → tandai order.
// Kasir baru boleh balas/proses setelah ini (cegah WA kasir ke-banned krn chat duluan).
export function markOrderContacted(id) {
  let found = null
  const next = list.map((o) => { if (o.id !== id) return o; found = { ...o, contacted: true }; return found })
  if (found) { commit(next); remote((r) => r.rpcMarkContacted(id, found.pin)) }
  return found
}

export function markPaid(id) {
  let found = null
  const next = list.map((o) => {
    if (o.id !== id) return o
    found = { ...o, paid: true, status: 'baru', paidAt: new Date().toISOString() }
    return found
  })
  if (found) { commit(next); remote((r) => r.rpcMarkPaid(id, found.pin)) }
  return found
}

// Advance the prep status one step (demo stand-in for the kasir's live updates).
export function advanceOrder(id) {
  let found = null
  const next = list.map((o) => {
    if (o.id !== id) return o
    const i = ORDER_FLOW.indexOf(o.status)
    found = { ...o, status: ORDER_FLOW[Math.min(i + 1, ORDER_FLOW.length - 1)] }
    return found
  })
  if (found) { commit(next); remote((r) => r.updateOrderRemote(id, { status: found.status })) }
  return found
}

export function cancelOrder(id) {
  const o = list.find((x) => x.id === id)
  commit(list.filter((x) => x.id !== id))
  if (o) remote((r) => r.rpcCancel(id, o.pin))
}

// ── Cooking (MSK-01) ─────────────────────────────────────────
// Online orders join the kasir's cooking queue while status === 'diproses'.
// The kitchen only runs the frying timer here; the counter still notifies the
// customer ("Pesanan Siap" → WA) and hands over in KasirOnline — so status
// transitions + WA stay in one place. cook: { status, durationMin, startAt }.
export function startFryingOrder(id, durationMin) {
  let found = null
  const next = list.map((o) => {
    if (o.id !== id) return o
    found = { ...o, cook: { status: 'frying', durationMin, startAt: Date.now() } }
    return found
  })
  if (found) { commit(next); remote((r) => r.updateOrderRemote(id, { cook: found.cook })) }
  return found
}

// Kitchen done frying: mark the cook completed so it leaves the queue. Status
// stays 'diproses' — the counter presses "Pesanan Siap" in KasirOnline to notify.
export function finishFryingOrder(id) {
  let found = null
  const next = list.map((o) => {
    if (o.id !== id) return o
    found = { ...o, cook: { ...(o.cook || {}), status: 'completed' } }
    return found
  })
  if (found) { commit(next); remote((r) => r.updateOrderRemote(id, { cook: found.cook })) }
  return found
}

// Customer track (mode supabase): tarik order terbaru via RPC ber-pin → merge cache.
export async function refreshMyOrder(id, pin) {
  if (!isSupabase()) return null
  const { fetchMyOrder } = await import('./orders.remote.js')
  const o = await fetchMyOrder(id, pin)
  if (o) applyOrder(o)
  return o
}
