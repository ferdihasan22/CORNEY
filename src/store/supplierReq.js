// CORNEY — Jembatan Request Belanja: Operasional → PWA Supplier.
// Saat operasional menekan "Kirim ke Supplier", rekap dipecah jadi 1 request
// PER CABANG (+ tanggal + item & jumlah). Supplier memprosesnya sbg checklist:
// centang = siap dikirim, un-centang = stok kosong; jumlah bisa disesuaikan.
// Fase 1 lokal.
//
// Order (per cabang): { id, createdAt, status:'baru'|'diproses'|'selesai',
//   branchId, branchName, tgl, items:[{ uid, id, name, reqQty, qty, src:'kasir'|'ops', ready }] }
import { isSupabase } from '../lib/backend.js'
import { genUuid } from '../lib/util.js'

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

if (isSupabase()) {
  import('./supplierReq.remote.js').then(({ initSupplierReqSync }) => initSupplierReqSync(commit)).catch(() => {})
}
// Dipakai HANYA oleh aksi SUPPLIER (centang/qty/status) → lewat RPC ber-gate supplier
// (RLS tak izinkan supplier tulis tabel langsung). Pembuatan request oleh Operasional
// tetap lewat pushSupplierReq (upsert, ops boleh).
const pushReqById = (orderId) => { if (isSupabase()) { const o = list.find((x) => x.id === orderId); if (o) import('./supplierReq.remote.js').then((w) => w.supplierSetRequestRemote(o)).catch(() => {}) } }

export function getSupplierReq() { return list }
export function subscribeSupplierReq(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Operasional kirim rekap → 1 order per cabang.
// branches = [{ branchId, branchName, tgl, items:[{id,name,qty,src}] }]
// status: 'baru' (langsung ke supplier) | 'menunggu' (SUSULAN, perlu ACC Owner dulu —
// disembunyikan dari supplier sampai Owner setujui).
export function createSupplierRequest({ branches, status = 'baru' }) {
  const stamp = Date.now()
  const orders = []
  ;(branches || []).forEach((b, i) => {
    const items = (b.items || []).map((it) => ({ uid: `${it.src || 'k'}_${it.id}`, id: it.id, name: it.name, reqQty: it.qty, qty: it.qty, src: it.src || 'kasir', ready: true }))
    if (items.length === 0) return
    orders.push({ id: isSupabase() ? genUuid() : `REQ-${stamp}-${i}`, createdAt: new Date().toISOString(), status, branchId: b.branchId, branchName: b.branchName, tgl: b.tgl || '', items })
  })
  if (orders.length === 0) return null
  commit([...orders, ...list])
  if (isSupabase()) orders.forEach((o) => import('./supplierReq.remote.js').then((w) => w.pushSupplierReq(o)).catch(() => {}))
  return orders
}

// ── SUSULAN: persetujuan Owner ──────────────────────────────────────────────
// Owner SETUJUI susulan: status 'menunggu' → 'baru' (baru kelihatan supplier).
// Tulis lewat upsert biasa (RLS owner = ALL), BUKAN RPC supplier.
export function approveSusulan(orderId) {
  const o = list.find((x) => x.id === orderId)
  if (!o || o.status !== 'menunggu') return
  const next = { ...o, status: 'baru' }
  commit(list.map((x) => (x.id === orderId ? next : x)))
  if (isSupabase()) import('./supplierReq.remote.js').then((w) => w.pushSupplierReq(next)).catch(() => {})
}
// Owner TOLAK susulan: hapus request (item kembali bisa diajukan ulang oleh ops).
export function rejectSusulan(orderId) { removeRequest(orderId) }
// Susulan yang menunggu ACC Owner (untuk badge & layar Owner).
export function pendingSusulan() { return list.filter((o) => o.status === 'menunggu') }

// Supplier centang/un-centang item (siap kirim ↔ stok kosong).
export function toggleReqItem(orderId, uid) {
  commit(list.map((o) => o.id !== orderId ? o : {
    ...o,
    status: o.status === 'baru' ? 'diproses' : o.status,
    items: o.items.map((it) => (it.uid !== uid ? it : { ...it, ready: !it.ready })),
  }))
  pushReqById(orderId)
}

// Supplier sesuaikan jumlah yang bisa dikirim (stok tak cukup). Min 1.
export function setReqItemQty(orderId, uid, qty) {
  const n = Math.max(1, Number(qty) || 1)
  commit(list.map((o) => o.id !== orderId ? o : {
    ...o,
    status: o.status === 'baru' ? 'diproses' : o.status,
    items: o.items.map((it) => (it.uid !== uid ? it : { ...it, qty: n })),
  }))
  pushReqById(orderId)
}

export function setReqStatus(orderId, status) {
  commit(list.map((o) => (o.id === orderId ? { ...o, status } : o)))
  pushReqById(orderId)
}
export function removeRequest(orderId) {
  commit(list.filter((o) => o.id !== orderId))
  if (isSupabase()) import('./supplierReq.remote.js').then((w) => w.removeSupplierReqRemote(orderId)).catch(() => {})
}
export function clearSupplierReq() { commit([]) }

// Jumlah request AKTIF utk badge supplier (susulan 'menunggu' belum tampil ke supplier).
export function pendingReqCount() { return list.filter((o) => o.status !== 'selesai' && o.status !== 'menunggu').length }
