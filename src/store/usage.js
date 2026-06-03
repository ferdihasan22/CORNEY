// CORNEY — Pemakaian uang hasil jualan (Owner), per TANGGAL + CABANG + JENIS.
// Owner memakai "Cash Bersih" atau "Transfer (Saldo ATM)" untuk pembelian apa pun
// → mengurangi sisa uang hari itu di cabang itu. Tidak menyentuh omzet/closing kasir
// (itu sumber kebenaran penjualan); ini lapisan terpisah "uang dipakai".
// Row: { id, tgl, branchId, jenis: 'cash'|'transfer', amount, note, ts }
// Fase: dummy/localStorage; TAHAP 4 → backend.
import { isSupabase } from '../lib/backend.js'
import { genUuid } from '../lib/util.js'

const KEY = 'corney_usage_v2'
const subscribers = new Set()
let seq = 0

function seed() {
  // Contoh: di 02/06/2026 Sepinggan, Owner pakai cash beli gas & transfer bayar listrik.
  return [
    { id: 'U-seed-1', tgl: '02/06/2026', branchId: 'sepinggan', jenis: 'cash', amount: 75000, note: 'Beli gas LPG', ts: '2026-06-02T20:10:00.000Z' },
    { id: 'U-seed-2', tgl: '02/06/2026', branchId: 'sepinggan', jenis: 'transfer', amount: 50000, note: 'Bayar token listrik', ts: '2026-06-02T20:12:00.000Z' },
  ]
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : seed() } catch { return seed() } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber → laba salah).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./usage.remote.js').then(({ initUsageSync }) => initUsageSync(commit)).catch(() => {})
}

export function getUsage() { return list }
export function subscribeUsage(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function addUsage({ tgl, branchId, jenis, amount, note }) {
  if (!tgl || !branchId || !jenis || !(amount > 0)) return
  const t = new Date()
  const id = isSupabase() ? genUuid() : 'U-' + Date.now() + '-' + seq++
  const u = { id, tgl, branchId, jenis, amount, note: (note || '').trim(), ts: t.toISOString(), time: t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }
  commit([u, ...list])
  if (isSupabase()) import('./usage.remote.js').then((w) => w.pushUsage(u)).catch(() => {})
}
export function removeUsage(id) {
  commit(list.filter((u) => u.id !== id))
  if (isSupabase()) import('./usage.remote.js').then((w) => w.removeUsageRemote(id)).catch(() => {})
}
export function clearUsage() { commit([]) } // reset bulan baru

// Total uang dipakai untuk satu tgl+cabang (+jenis opsional).
export function usageTotal(tgl, branchId, jenis) {
  return list.filter((u) => u.tgl === tgl && u.branchId === branchId && (!jenis || u.jenis === jenis)).reduce((s, u) => s + u.amount, 0)
}
// Daftar entri pemakaian untuk satu tgl+cabang+jenis (untuk ditampilkan & dihapus).
export function usageList(tgl, branchId, jenis) {
  return list.filter((u) => u.tgl === tgl && u.branchId === branchId && (!jenis || u.jenis === jenis))
}
