// CORNEY — Supplier store (SUP-01..05, Fase 2 dummy). STANDALONE "DB": only price
// changes (notif) + orders cross one-way to Owner; no read path back into CORNEY.
// 2 categories: K1 = Kebutuhan Cabang (daily), K2 = Bahan Adonan (dough).
//
// Item: { id, name, category:'K1'|'K2', unit, price, prevPrice, available, lastPriceAt }
// Price history: { id, itemId, from, to, at }

const KEY = 'corney_supplier'
const subscribers = new Set()

export const SUP_CATS = { K1: 'Kebutuhan Cabang', K2: 'Bahan Adonan' }

function seed() {
  return {
    catalog: [
      { id: 'glaze_coklat', name: 'Glaze Coklat', category: 'K1', unit: 'galon', price: 62000, prevPrice: 60000, available: true, lastPriceAt: '2026-05-20' },
      { id: 'saus_tomat', name: 'Saus Tomat', category: 'K1', unit: 'jerigen', price: 15500, prevPrice: 15500, available: true, lastPriceAt: '2026-03-01' },
      { id: 'kentang', name: 'Kentang', category: 'K1', unit: 'karung', price: 185000, prevPrice: 195000, available: true, lastPriceAt: '2026-05-29' },
      { id: 'terigu', name: 'Tepung Terigu', category: 'K2', unit: 'kg', price: 14500, prevPrice: 14500, available: true, lastPriceAt: '2026-04-10' },
      { id: 'tapioka', name: 'Tepung Tapioka', category: 'K2', unit: 'kg', price: 12000, prevPrice: 12000, available: true, lastPriceAt: '2026-04-10' },
      { id: 'ragi', name: 'Ragi Instan', category: 'K2', unit: 'pack', price: 8000, prevPrice: 8000, available: true, lastPriceAt: '2026-04-10' },
      { id: 'gula', name: 'Gula Pasir', category: 'K2', unit: 'kg', price: 16000, prevPrice: 16000, available: false, lastPriceAt: '2026-04-10' },
      { id: 'panir', name: 'Tepung Panir', category: 'K2', unit: 'kg', price: 42000, prevPrice: 45000, available: true, lastPriceAt: '2026-05-15' },
    ],
    priceHistory: [
      { id: 'PH-1', itemId: 'glaze_coklat', from: 60000, to: 62000, at: '2026-05-20' },
      { id: 'PH-2', itemId: 'panir', from: 45000, to: 42000, at: '2026-05-15' },
      { id: 'PH-3', itemId: 'kentang', from: 195000, to: 185000, at: '2026-05-29' },
    ],
  }
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && Array.isArray(s.catalog) ? s : seed() } catch { return seed() } }
let state = load()
function commit(next) { state = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

export function getSupplier() { return state }
export function subscribeSupplier(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Change a price → records history (notifies Owner one-way).
export function setItemPrice(id, newPrice) {
  const price = Math.max(0, Math.round(Number(newPrice) || 0))
  let changed = null
  const catalog = state.catalog.map((it) => {
    if (it.id !== id || it.price === price) return it
    changed = it
    return { ...it, prevPrice: it.price, price, lastPriceAt: new Date().toISOString().slice(0, 10) }
  })
  if (!changed) return null
  const hist = { id: 'PH-' + Date.now(), itemId: id, from: changed.price, to: price, at: new Date().toISOString().slice(0, 10) }
  commit({ ...state, catalog, priceHistory: [hist, ...state.priceHistory] })
  return hist
}

// Toggle availability → notifies Owner + Operasional one-way; not auto-carried next order.
export function toggleAvailable(id) {
  commit({ ...state, catalog: state.catalog.map((it) => (it.id === id ? { ...it, available: !it.available } : it)) })
}
