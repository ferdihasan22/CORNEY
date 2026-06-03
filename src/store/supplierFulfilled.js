// CORNEY — Log Pemenuhan Supplier (permanen). Saat supplier "Tandai Selesai",
// hasil akhir tiap cabang dicatat di sini (qty dipenuhi vs diminta, item kosong,
// harga saat itu, total) → dibaca PWA Owner di tab Belanjaan ("Dipenuhi Supplier").
// Berbeda dari supplierReq (yang bisa dihapus): log ini riwayat permanen. Fase 1 lokal.
//
// Entry: { id, at, tgl, branchId, branchName,
//   items:[{ id, name, src, reqQty, qty, ready, price }] }
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

export function getSupplierFulfilled() { return list }
export function subscribeSupplierFulfilled(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function addFulfilled(entry) {
  commit([entry, ...list])
}

// Tandai item kosong "dibeli di luar" supplier (atau hapus tanda dgn data=null).
// data = { qty, harga, note }
export function setOutside(entryId, uid, data) {
  const luar = data ? { qty: Math.max(0, Math.round(data.qty || 0)), harga: Math.max(0, Math.round(data.harga || 0)), note: (data.note || '').trim() } : null
  commit(list.map((e) => e.id !== entryId ? e : {
    ...e,
    items: e.items.map((it) => (it.uid !== uid ? it : { ...it, luar })),
  }))
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
