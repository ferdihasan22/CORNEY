// CORNEY — Log Pemenuhan Supplier (permanen). Saat supplier "Tandai Selesai",
// hasil akhir tiap cabang dicatat di sini (qty dipenuhi vs diminta, item kosong,
// harga saat itu, total) → dibaca PWA Owner di tab Belanjaan ("Dipenuhi Supplier").
// Berbeda dari supplierReq (yang bisa dihapus): log ini riwayat permanen. Fase 1 lokal.
//
// Entry: { id, at, tgl, branchId, branchName,
//   items:[{ id, name, src, reqQty, qty, ready, price }] }
import { isSupabase } from '../lib/backend.js'
import { genUuid } from '../lib/util.js'

const KEY = 'corney_supplier_fulfilled_v1'
const subscribers = new Set()

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : [] } catch { return [] }
}
let list = load()
function commit(next) {
  list = next
  localStorage.setItem(KEY, JSON.stringify(next))
  subscribers.forEach((fn) => fn())
}

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./supplierFulfilled.remote.js').then(({ initSupplierFulfilledSync }) => initSupplierFulfilledSync(commit)).catch(() => {})
}

export function getSupplierFulfilled() { return list }
export function subscribeSupplierFulfilled(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function addFulfilled(entry) {
  const e = isSupabase() ? { ...entry, id: genUuid() } : entry
  commit([e, ...list])
  if (isSupabase()) import('./supplierFulfilled.remote.js').then((w) => w.pushFulfilled(e)).catch(() => {})
  return e
}

// Tandai item kosong "dibeli di luar" supplier (atau hapus tanda dgn data=null).
// data = { qty, harga, note }
export function setOutside(entryId, uid, data) {
  const luar = data ? { qty: Math.max(0, Math.round(data.qty || 0)), harga: Math.max(0, Math.round(data.harga || 0)), note: (data.note || '').trim() } : null
  commit(list.map((e) => e.id !== entryId ? e : {
    ...e,
    items: e.items.map((it) => (it.uid !== uid ? it : { ...it, luar })),
  }))
  if (isSupabase()) { const e = list.find((x) => x.id === entryId); if (e) import('./supplierFulfilled.remote.js').then((w) => w.pushFulfilled(e)).catch(() => {}) }
}

export function clearFulfilled() { commit([]) }

// Total biaya belanja TERVERIFIKASI (dipenuhi supplier + beli di luar) untuk satu
// tgl+cabang. Dipakai sbg ACUAN di Laporan Keuangan (Uang Belanjaan tetap manual,
// ini cuma pembanding + tombol "isi dari supplier").
export function fulfilledSpend(tgl, branchId) {
  return list.reduce((sum, e) => {
    if (e.tgl !== tgl || e.branchId !== branchId) return sum
    return sum + (e.items || []).reduce((s, it) => {
      const base = it.ready ? (it.qty || 0) * (it.price || 0) : 0
      const luar = it.luar ? (it.luar.qty || 0) * (it.luar.harga || 0) : 0
      return s + base + luar
    }, 0)
  }, 0)
}
