// CORNEY — Jembatan Request Belanja: Operasional → PWA Supplier.
// Saat operasional menekan "Kirim ke Supplier", rekap dipecah jadi 1 request
// PER CABANG (+ tanggal + item & jumlah). Supplier memprosesnya sbg checklist:
// centang = siap dikirim, un-centang = stok kosong; jumlah bisa disesuaikan.
// Fase 1 lokal.
//
// Order (per cabang): { id, createdAt, status:'baru'|'diproses'|'selesai',
//   branchId, branchName, tgl, items:[{ uid, id, name, reqQty, qty, src:'kasir'|'ops', ready }] }
const KEY = 'corney_supplier_req_v2'
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

export function getSupplierReq() { return list }
export function subscribeSupplierReq(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Operasional kirim rekap → 1 order per cabang.
// branches = [{ branchId, branchName, tgl, items:[{id,name,qty,src}] }]
export function createSupplierRequest({ branches }) {
  const stamp = Date.now()
  const orders = []
  ;(branches || []).forEach((b, i) => {
    const items = (b.items || []).map((it) => ({ uid: `${it.src || 'k'}_${it.id}`, id: it.id, name: it.name, reqQty: it.qty, qty: it.qty, src: it.src || 'kasir', ready: true }))
    if (items.length === 0) return
    orders.push({ id: `REQ-${stamp}-${i}`, createdAt: new Date().toISOString(), status: 'baru', branchId: b.branchId, branchName: b.branchName, tgl: b.tgl || '', items })
  })
  if (orders.length === 0) return null
  commit([...orders, ...list])
  return orders
}

// Supplier centang/un-centang item (siap kirim ↔ stok kosong).
export function toggleReqItem(orderId, uid) {
  commit(list.map((o) => o.id !== orderId ? o : {
    ...o,
    status: o.status === 'baru' ? 'diproses' : o.status,
    items: o.items.map((it) => (it.uid !== uid ? it : { ...it, ready: !it.ready })),
  }))
}

// Supplier sesuaikan jumlah yang bisa dikirim (stok tak cukup). Min 1.
export function setReqItemQty(orderId, uid, qty) {
  const n = Math.max(1, Number(qty) || 1)
  commit(list.map((o) => o.id !== orderId ? o : {
    ...o,
    status: o.status === 'baru' ? 'diproses' : o.status,
    items: o.items.map((it) => (it.uid !== uid ? it : { ...it, qty: n })),
  }))
}

export function setReqStatus(orderId, status) {
  commit(list.map((o) => (o.id === orderId ? { ...o, status } : o)))
}
export function removeRequest(orderId) {
  commit(list.filter((o) => o.id !== orderId))
}
export function clearSupplierReq() { commit([]) }

// Jumlah request yang belum selesai (untuk badge nav).
export function pendingReqCount() { return list.filter((o) => o.status !== 'selesai').length }
