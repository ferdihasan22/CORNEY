// CORNEY — Analisa Bahan vs Jual. Bahan pendukung (glaze/kentang/saus) dibandingkan
// dgn penjualan tercatat (Master Laporan). "Unit dipakai" = berapa kali item-nya
// dicentang di checklist belanja kasir saat closing (tiap centang = habis 1, beli lagi).
// Owner set "batas aman" = berapa porsi yang WAJAR per 1 unit. Kalau porsi/unit di
// bawah batas → material habis lebih cepat dari penjualan → indikasi bocor/korupsi.
//
// terpakai (porsi): glaze/kentang = qty varian terjual; saus = jumlah corndog ber-saus itu.
// unit dipakai: jumlah hari (closing) di periode yg mencentang item belanjanya.

// Pemetaan material → varian/saus (Master Laporan) + item checklist belanja.
export const MATERIALS = [
  { id: 'glaze_coklat', name: 'Glaze Coklat', kind: 'glaze', variants: ['sweet_coklat'], shop: 'glaze_coklat', unitLabel: 'kaleng', def: 12, icon: 'icecream', hd: 'bg-amber-100', ic: 'text-amber-800', bd: 'border-amber-300' },
  { id: 'glaze_tiramisu', name: 'Glaze Tiramisu', kind: 'glaze', variants: ['sweet_tiramisu'], shop: 'glaze_tiramisu', unitLabel: 'kaleng', def: 12, icon: 'icecream', hd: 'bg-orange-100', ic: 'text-orange-700', bd: 'border-orange-300' },
  { id: 'glaze_greentea', name: 'Glaze Greentea', kind: 'glaze', variants: ['sweet_greentea'], shop: 'glaze_greentea', unitLabel: 'kaleng', def: 12, icon: 'icecream', hd: 'bg-emerald-100', ic: 'text-emerald-700', bd: 'border-emerald-300' },
  { id: 'kentang', name: 'Kentang Coating', kind: 'kentang', variants: ['mozza_kentang', 'sosis_kentang', 'jumbo_kentang', 'mix_kentang'], shop: 'kentang', unitLabel: 'pack', def: 30, icon: 'blur_circular', hd: 'bg-yellow-100', ic: 'text-yellow-800', bd: 'border-yellow-300' },
  { id: 'saus_tomat', name: 'Saus Tomat', kind: 'sauce', sauce: 'tomat', shop: 'saus_tomat', unitLabel: 'botol', def: 30, icon: 'water_drop', hd: 'bg-rose-100', ic: 'text-rose-700', bd: 'border-rose-300' },
  { id: 'saus_sambal', name: 'Saus Sambal', kind: 'sauce', sauce: 'sambal', shop: 'saus_sambal', unitLabel: 'botol', def: 30, icon: 'water_drop', hd: 'bg-red-100', ic: 'text-red-700', bd: 'border-red-300' },
  { id: 'saus_keju', name: 'Saus Keju', kind: 'sauce', sauce: 'keju', shop: 'saus_keju', unitLabel: 'botol', def: 25, icon: 'water_drop', hd: 'bg-lime-100', ic: 'text-lime-800', bd: 'border-lime-300' },
  { id: 'saus_mayo', name: 'Mayonaise', kind: 'sauce', sauce: 'mayo', shop: 'mayonaise', unitLabel: 'botol', def: 25, icon: 'water_drop', hd: 'bg-sky-100', ic: 'text-sky-700', bd: 'border-sky-300' },
]

const KEY = 'corney_analisa'
const subscribers = new Set()
function seed() { const o = {}; MATERIALS.forEach((m) => { o[m.id] = m.def }); return o }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' && !Array.isArray(s) ? { ...seed(), ...s } : seed() } catch { return seed() } }
let map = load()
function commit(next) { map = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

export function getAnalisa() { return map }
export function subscribeAnalisa(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }
export function batasOf(id) { return map[id] ?? (MATERIALS.find((m) => m.id === id)?.def || 0) }
export function setBatas(id, n) { commit({ ...map, [id]: Math.max(0, Number(n) || 0) }) }

// porsi terpakai dari baris penjualan (Master Laporan).
export function terpakaiOf(material, rows) {
  if (material.kind === 'sauce') return rows.reduce((s, r) => s + (r.sauces?.[material.sauce] || 0), 0)
  return rows.reduce((s, r) => s + material.variants.reduce((a, v) => a + (r.variants?.[v] || 0), 0), 0)
}
// unit dipakai = total JUMLAH item belanja material ini di periode (dari checklist
// kasir). belanja bisa objek { id: jumlah } (baru) atau array id lama (=1 tiap muncul).
function belanjaQty(belanja, shopId) {
  if (!belanja) return 0
  if (Array.isArray(belanja)) return belanja.includes(shopId) ? 1 : 0
  return belanja[shopId] || 0
}
export function unitDipakaiOf(material, rows) {
  return rows.reduce((s, r) => s + belanjaQty(r.belanja, material.shop), 0)
}
