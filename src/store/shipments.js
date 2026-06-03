// CORNEY — Stock shipments store (OPS-01 Isi Stok ke Par, Fase 2 dummy/local).
// Operasional sends fillings to a branch (kirim = par − sisa). Each shipment row
// awaits kasir confirmation at Opening Day (OPN-01); send-vs-receive diff lands
// here. Fase 1 records the send side; kasir-confirm wiring = TAHAP 4.
//
// Shipment: { id, branchId, branchName, parent, parentName, qty, status
//   ('menunggu'|'diterima'|'selisih'), selisih, createdAt }

import { isSupabase } from '../lib/backend.js'
import { genUuid } from '../lib/util.js'

const KEY = 'corney_shipments'
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

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./shipments.remote.js').then(({ initShipmentsSync }) => initShipmentsSync(commit)).catch(() => {})
}

export function getShipments() {
  return list
}
export function subscribeShipments(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

// items: [{ parent, parentName, qty }]; only qty > 0 are sent.
export function createShipment({ branchId, branchName, items }) {
  const stamp = Date.now()
  const rows = (items || [])
    .filter((it) => (it.qty || 0) > 0)
    .map((it, i) => ({
      id: isSupabase() ? genUuid() : `SHP-${stamp}-${i}`,
      branchId,
      branchName: branchName || branchId,
      parent: it.parent,
      parentName: it.parentName || it.parent,
      qty: Math.round(it.qty),
      status: 'menunggu',
      selisih: 0,
      createdAt: new Date().toISOString(),
    }))
  if (rows.length === 0) return []
  commit([...rows, ...list])
  if (isSupabase()) rows.forEach((s) => import('./shipments.remote.js').then((w) => w.pushShipment(s)).catch(() => {}))
  return rows
}

// Total barang datang per induk (kiriman yang masih "menunggu") untuk satu cabang.
// Dipakai kasir di Buka Toko sebagai "Barang Datang".
export function arrivalByBranch(branchId) {
  const out = {}
  list.forEach((s) => { if (s.branchId === branchId && s.status === 'menunggu') out[s.parent] = (out[s.parent] || 0) + s.qty })
  return out
}

// Kasir konfirmasi terima saat Buka Toko (sisi ke-2). receivedByParent = jumlah
// yang benar-benar diterima per induk → status diterima/selisih (kirim vs terima).
export function confirmShipmentsReceived(branchId, receivedByParent) {
  const sent = {}
  list.forEach((s) => { if (s.branchId === branchId && s.status === 'menunggu') sent[s.parent] = (sent[s.parent] || 0) + s.qty })
  const stamp = new Date().toISOString()
  const changed = []
  commit(list.map((s) => {
    if (s.branchId !== branchId || s.status !== 'menunggu') return s
    const ns = { ...s, status: ((receivedByParent?.[s.parent] == null ? sent[s.parent] : receivedByParent[s.parent]) - (sent[s.parent] || 0)) === 0 ? 'diterima' : 'selisih', selisih: (receivedByParent?.[s.parent] == null ? sent[s.parent] : receivedByParent[s.parent]) - (sent[s.parent] || 0), confirmedAt: stamp }
    changed.push(ns); return ns
  }))
  if (isSupabase()) changed.forEach((s) => import('./shipments.remote.js').then((w) => w.pushShipment(s)).catch(() => {}))
}
