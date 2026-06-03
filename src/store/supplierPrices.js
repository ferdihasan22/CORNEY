// CORNEY — Harga item versi Supplier. Supplier mengisi harga lalu menekan
// "Update Harga" untuk menyimpan. Tiap update menyimpan harga sebelumnya (prev)
// + tanggal → dipakai indikator NAIK/TURUN di dashboard Owner. Fase 1 lokal.
// Shape: { [itemId]: { price, prev, at } }
const KEY = 'corney_supplier_prices_v2'
const subscribers = new Set()

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (!s || typeof s !== 'object') return {}
    const out = {}
    Object.entries(s).forEach(([id, v]) => {
      out[id] = typeof v === 'number' ? { price: v, prev: null, at: '' } : { price: v.price || 0, prev: v.prev ?? null, at: v.at || '' }
    })
    return out
  } catch { return {} }
}
let map = load()
function commit(next) {
  map = next
  localStorage.setItem(KEY, JSON.stringify(next))
  subscribers.forEach((fn) => fn())
}

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { map = load(); subscribers.forEach((fn) => fn()) } })
}

export function getSupplierPrices() { return map }
export function subscribeSupplierPrices(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Simpan harga baru (menyimpan harga lama sbg prev jika berubah).
export function updateItemPrice(id, newPrice) {
  const p = Math.max(0, Math.round(Number(newPrice) || 0))
  const cur = map[id]
  if (cur && cur.price === p) return false
  commit({ ...map, [id]: { price: p, prev: cur ? cur.price : null, at: new Date().toISOString().slice(0, 10) } })
  return true
}
export function priceOfSup(id) { return map[id]?.price || 0 }
export function prevOfSup(id) { return map[id]?.prev ?? null }
// Arah perubahan: 'naik' | 'turun' | null
export function trendOfSup(id) {
  const e = map[id]
  if (!e || e.prev == null || e.prev === e.price) return null
  return e.price > e.prev ? 'naik' : 'turun'
}
