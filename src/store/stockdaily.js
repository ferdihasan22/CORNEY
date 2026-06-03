// CORNEY — Daily stock report = SATU SUMBER KEBENARAN stok harian per cabang
// (Fase 2 dummy/local). Dipakai bersama oleh: Laporan Stok (Owner), Laporan
// Anomali, Agregat Lintas Cabang. Owner mengoreksi di sini → semua report ikut.
// Di TAHAP 4 baris ini terisi otomatis dari closing harian tiap cabang (Supabase).
//
// Row: { id, tgl, branchId, v: { mozza|mix|sosis|jumbo: {datang,kemarin,terjual,patah,garansi,free,aktual} } }
// CATATAN SINKRON: "terjual" per induk TIDAK berdiri sendiri — DITURUNKAN dari
// Variant Terjual (salesdaily) via rollup, supaya Stok Isian & Variant pasti cocok.
import { getSalesDaily, terjualPerParent, setSalesDate } from './salesdaily.js'
import { isSupabase } from '../lib/backend.js'

const KEY = 'corney_stockdaily_v3' // v3: Juni-only (samakan dgn salesdaily)
export const STOCK_PARENTS = [['mozza', 'MOZ'], ['mix', 'MIX'], ['sosis', 'SOS'], ['jumbo', 'SOS-J']]
const subscribers = new Set()

const mk = (datang, kemarin, terjual, patah, garansi, free, aktual) => ({ datang, kemarin, terjual, patah, garansi, free, aktual })
function seed() {
  return [
    // ── SEMUA satu bulan (Juni 2026). Sebagian sisa aktual rendah utk tile Stok Menipis. ──
    { id: 'SR-5', tgl: '02/06/2026', branchId: 'sepinggan', v: { mozza: mk(28, 8, 31, 1, 0, 2, 8), mix: mk(15, 7, 14, 0, 0, 0, 7), sosis: mk(20, 5, 23, 0, 0, 1, 5), jumbo: mk(13, 4, 14, 0, 0, 0, 4) } },
    { id: 'SR-6', tgl: '02/06/2026', branchId: 'gunungsari', v: { mozza: mk(22, 6, 24, 0, 1, 0, 5), mix: mk(12, 5, 13, 0, 0, 0, 4), sosis: mk(16, 7, 18, 1, 0, 0, 6), jumbo: mk(10, 4, 11, 0, 0, 0, 3) } },
    { id: 'SR-7', tgl: '01/06/2026', branchId: 'sepinggan', v: { mozza: mk(28, 11, 30, 1, 0, 1, 9), mix: mk(15, 6, 14, 0, 0, 0, 7), sosis: mk(20, 8, 22, 0, 0, 1, 6), jumbo: mk(13, 5, 14, 0, 0, 0, 5) } },
    { id: 'SR-8', tgl: '01/06/2026', branchId: 'gunungsari', v: { mozza: mk(22, 8, 23, 0, 0, 0, 7), mix: mk(12, 4, 13, 0, 0, 0, 4), sosis: mk(16, 6, 18, 1, 0, 0, 5), jumbo: mk(10, 4, 11, 0, 0, 0, 4) } },
  ]
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : seed() } catch { return seed() } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./stockdaily.remote.js').then(({ initStockSync }) => initStockSync(commit)).catch(() => {})
}

export function getStockDaily() { return list }
export function subscribeStockDaily(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Rumus tunggal — dipakai semua consumer biar konsisten.
export function computeParent(c) {
  const seharusnya = c.datang + c.kemarin - c.terjual - c.patah - c.garansi - c.free
  return { ...c, seharusnya, selisih: seharusnya - c.aktual }
}

// Owner koreksi satu baris (audit log dipanggil dari layar).
export function updateStockRow(id, v) {
  let found = null
  commit(list.map((r) => { if (r.id !== id) return r; found = { ...r, v }; return found }))
  if (found && isSupabase()) import('./stockdaily.remote.js').then((w) => w.pushStockRow(found)).catch(() => {})
}

export function hasStockDay(tgl, branchId) { return list.some((r) => r.tgl === tgl && r.branchId === branchId) }

// Reset (bulan baru) — kosongkan semua baris stok harian.
export function clearStockDaily() { commit([]) }

// Tulis/timpa baris stok induk untuk satu tanggal+cabang (dipanggil saat closing).
export function upsertStockDay({ tgl, branchId, v }) {
  const ex = list.find((r) => r.tgl === tgl && r.branchId === branchId)
  const row = ex ? { ...ex, v } : { id: 'SR-' + Date.now(), tgl, branchId, v }
  if (ex) commit(list.map((r) => (r === ex ? row : r)))
  else commit([row, ...list])
  if (isSupabase()) import('./stockdaily.remote.js').then((w) => w.pushStockRow(row)).catch(() => {})
}

// Owner ganti tanggal laporan → tanggal di Variant Terjual ikut berubah (sinkron).
export function updateStockDate(id, newTgl) {
  const row = list.find((r) => r.id === id)
  if (!row || !newTgl) return
  const oldTgl = row.tgl
  commit(list.map((r) => (r.id === id ? { ...r, tgl: newTgl } : r)))
  setSalesDate(oldTgl, row.branchId, newTgl)
}

// Nilai efektif per induk: "terjual" DIAMBIL dari rollup Variant Terjual
// (salesdaily) bila ada baris penjualan yang cocok (tgl+cabang). Inilah yang
// menjamin Stok Isian & Variant Terjual SELALU sinkron.
export function effectiveV(row) {
  const sr = getSalesDaily().find((s) => s.tgl === row.tgl && s.branchId === row.branchId)
  if (!sr) return row.v
  const t = terjualPerParent(sr)
  const out = {}
  STOCK_PARENTS.forEach(([pk]) => { out[pk] = { ...row.v[pk], terjual: t[pk] ?? row.v[pk].terjual } })
  return out
}

// Selektor: daftar item HILANG (selisih>0). Dipakai Anomali & Agregat → sinkron.
export function stockHilang(branchId) {
  const out = []
  list.forEach((r) => {
    if (branchId && r.branchId !== branchId) return
    const ev = effectiveV(r)
    STOCK_PARENTS.forEach(([pk, pl]) => {
      const s = computeParent(ev[pk]).selisih
      if (s > 0) out.push({ rowId: r.id, tgl: r.tgl, branchId: r.branchId, parent: pk, parentLabel: pl, qty: s })
    })
  })
  return out
}
