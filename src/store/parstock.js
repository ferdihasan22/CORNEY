// CORNEY — Stok Standar (par) per CABANG × per ISIAN, diatur Owner.
// "Stok Standar" = jumlah stok yang harus ada tiap pagi siap jual. Dipakai
// Operasional: Kirim = Stok Standar − Sisa Aktual (Master Laporan).
// Sebelumnya hardcoded di menu.js (DUMMY_STANDARD_STOCK); kini bisa diubah Owner.
// Dummy/localStorage; TAHAP 4 → backend.
import { BRANCHES, PARENT_FILLINGS, DUMMY_STANDARD_STOCK } from '../data/menu.js'
import { isSupabase } from '../lib/backend.js'

const KEY = 'corney_parstock'
const subscribers = new Set()

function seed() {
  const o = {}
  BRANCHES.forEach((b) => {
    o[b.id] = { ...(DUMMY_STANDARD_STOCK[b.id] || {}) }
    PARENT_FILLINGS.forEach((p) => { if (o[b.id][p.id] == null) o[b.id][p.id] = 0 })
  })
  return o
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' && !Array.isArray(s) ? s : seed() } catch { return seed() } }
let map = load()
function commit(next) { map = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab: reload saat tab lain menulis (cegah Operasional kirim qty
// salah saat Owner ubah Par di tab lain).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { map = load(); subscribers.forEach((fn) => fn()) } })
}

// Hidrasi Supabase (mode supabase) — dipicu saat ADA sesi staf (lihat
// parstock.remote.js). localStorage tetap cache/fallback offline.
if (isSupabase()) {
  import('./parstock.remote.js').then(({ initParStockSync }) => initParStockSync(commit, () => map)).catch((e) => console.warn('[parstock] modul remote gagal dimuat:', e?.message || e))
}

export function getParStock() { return map }
export function subscribeParStock(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Stok standar satu cabang → { mozza, sosis, jumbo, mix }.
export function parOf(branchId) { return map[branchId] || {} }
// Owner ubah satu angka (cabang × isian).
export function setPar(branchId, parentId, val) {
  const b = { ...(map[branchId] || {}), [parentId]: Math.max(0, Number(val) || 0) }
  commit({ ...map, [branchId]: b })
  if (isSupabase()) import('./parstock.remote.js').then((w) => w.pushPar(branchId, parentId, b[parentId])).catch(() => {})
}
