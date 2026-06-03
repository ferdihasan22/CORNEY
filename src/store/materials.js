// CORNEY — Raw material stock store (PRD-03 Reorder Bahan Mentah, Fase 2 dummy).
// Produksi watches raw materials; order ~3 days before run-out (threshold-based).
// Separate buy-path from branch shopping requests. Replace w/ Supabase TAHAP 4.
//
// Shape: { [ingredientId]: { sisa, threshold, reorderedAt } }
import { INGREDIENTS } from '../data/menu.js'

const KEY = 'corney_materials'
const subscribers = new Set()

function seed() {
  // sisa in the ingredient's own unit; sosis_jumbo seeded BELOW threshold (urgent).
  const base = {
    tepung: { sisa: 8000, threshold: 3000 },
    keju: { sisa: 120, threshold: 50 },
    sosis_reg: { sisa: 200, threshold: 80 },
    sosis_jumbo: { sisa: 30, threshold: 80 },
    kentang: { sisa: 5000, threshold: 2000 },
    panir: { sisa: 4000, threshold: 1500 },
    minyak: { sisa: 12000, threshold: 5000 },
    tusuk: { sisa: 300, threshold: 200 },
    glaze: { sisa: 1800, threshold: 800 },
  }
  const out = {}
  INGREDIENTS.forEach((i) => { out[i.id] = { ...(base[i.id] || { sisa: 0, threshold: 0 }), reorderedAt: null } })
  return out
}

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' ? s : seed() } catch { return seed() }
}
let state = load()
function commit(next) { state = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); subscribers.forEach((fn) => fn()) } })
}

export function getMaterials() { return state }
export function subscribeMaterials(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Set stok bahan baku saat ini (dipakai untuk isi STOK AWAL go-live & koreksi).
export function setMaterialSisa(id, sisa) {
  const cur = state[id] || { sisa: 0, threshold: 0, reorderedAt: null }
  commit({ ...state, [id]: { ...cur, sisa: Math.max(0, Math.round(Number(sisa) || 0)) } })
}
export function setThreshold(id, threshold) {
  const cur = state[id] || { sisa: 0, threshold: 0, reorderedAt: null }
  commit({ ...state, [id]: { ...cur, threshold: Math.max(0, Math.round(Number(threshold) || 0)) } })
}
export function markReordered(id) {
  const cur = state[id]
  if (!cur) return
  commit({ ...state, [id]: { ...cur, reorderedAt: new Date().toISOString() } })
}
