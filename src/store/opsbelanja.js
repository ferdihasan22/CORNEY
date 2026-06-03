// CORNEY — Tambahan Belanja Operasional (OPS-03), PER CABANG.
// Sebelum rekap belanja kasir diteruskan ke Supplier, operasional (Riski) bisa
// MENAMBAH belanjaan untuk cabang tertentu: pilih cabang → centang item + isi
// jumlah. Tersimpan lokal sbg draft rekap berjalan. Fase 1 dummy/localStorage.
// Shape: { [branchId]: { [itemId]: { name, qty } } }
const KEY = 'corney_opsbelanja_v2'
const subscribers = new Set()

// Item bawaan yang sering ditambah operasional (bisa +custom).
export const OPS_ITEMS = [
  { id: 'keju_mozza', name: 'Keju Mozza' },
  { id: 'sosis_reguler', name: 'Sosis Reguler' },
  { id: 'sosis_jumbo', name: 'Sosis Jumbo' },
  { id: 'sumpit', name: 'Sumpit' },
  { id: 'tisu', name: 'Tisu' },
  { id: 'tbm', name: 'TBM' },
  { id: 'ragi', name: 'Ragi' },
  { id: 'spidol', name: 'Spidol' },
  { id: 'isian_staples', name: 'Isian Staples' },
  { id: 'mika', name: 'Mika' },
  { id: 'plastik15', name: 'Plastik 15' },
  { id: 'plastik24', name: 'Plastik 24' },
  { id: 'tepung', name: 'Tepung' },
  { id: 'gula', name: 'Gula' },
  { id: 'garam', name: 'Garam' },
]

let state = load() // { [branchId]: { [itemId]: { name, qty } } }

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return s && typeof s === 'object' ? s : {}
  } catch {
    return {}
  }
}
function commit(next) {
  state = next
  localStorage.setItem(KEY, JSON.stringify(next))
  subscribers.forEach((fn) => fn())
}

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); subscribers.forEach((fn) => fn()) } })
}

export function getOpsBelanja() {
  return state
}
export function subscribeOpsBelanja(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

const branchOf = (bid) => state[bid] || {}
function setBranch(bid, next) {
  const merged = { ...state, [bid]: next }
  if (Object.keys(next).length === 0) delete merged[bid]
  commit(merged)
}

// Centang/hapus item bawaan untuk satu cabang (qty mulai 1).
export function toggleOpsItem(bid, id, name) {
  const b = branchOf(bid)
  if (b[id]) {
    const next = { ...b }; delete next[id]; setBranch(bid, next)
  } else {
    setBranch(bid, { ...b, [id]: { name, qty: 1, remember: false } })
  }
}
// Set jumlah utk satu cabang; 0/kosong = hapus dari draft cabang itu.
export function setOpsQty(bid, id, name, qty) {
  const b = branchOf(bid)
  const n = Math.max(0, Number(qty) || 0)
  if (n <= 0) {
    const next = { ...b }; delete next[id]; setBranch(bid, next)
  } else {
    setBranch(bid, { ...b, [id]: { name: b[id]?.name || name, qty: n, remember: b[id]?.remember || false } })
  }
}
// "Ingat data ini": item rutin yang jumlahnya tersimpan & auto-muncul tiap hari
// (tidak ikut terhapus saat Kosongkan). Toggle on/off.
export function toggleOpsRemember(bid, id, name) {
  const b = branchOf(bid)
  const cur = b[id]
  if (cur) setBranch(bid, { ...b, [id]: { ...cur, remember: !cur.remember } })
  else setBranch(bid, { ...b, [id]: { name, qty: 1, remember: true } })
}
// Tambah item custom (nama bebas) ke satu cabang.
export function addCustomOpsItem(bid, name) {
  const nm = (name || '').trim()
  if (!nm) return
  setBranch(bid, { ...branchOf(bid), ['ops-' + Date.now()]: { name: nm, qty: 1, remember: false } })
}
// Kosongkan draft satu cabang — item yang "diingat" tetap dipertahankan.
export function clearOpsBelanja(bid) {
  const b = branchOf(bid)
  const kept = {}
  Object.entries(b).forEach(([id, v]) => { if (v.remember) kept[id] = v })
  setBranch(bid, kept)
}
// Daftar siap-render utk satu cabang: [{ id, name, qty, remember }].
export function opsBelanjaList(bid) {
  return Object.entries(branchOf(bid)).map(([id, v]) => ({ id, name: v.name, qty: v.qty, remember: !!v.remember }))
}
// Total item tambahan lintas semua cabang (utk label tombol).
export function opsTotalCount() {
  return Object.values(state).reduce((s, b) => s + Object.keys(b).length, 0)
}
