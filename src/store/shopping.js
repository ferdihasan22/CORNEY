// CORNEY — Daftar item Request Belanja Besok (CLS-00). Owner kelola daftarnya
// (OWN-06); kasir tinggal centang saat closing. Fase 2 dummy/local — seeded dgn
// daftar PRD. Checklist kasir tidak dipersist (sekali pakai → salin ke grup WA).
//
// Item: { id, name }

const KEY = 'corney_shopping_items'
const subscribers = new Set()

function seed() {
  return [
    { id: 'kentang', name: 'Kentang' },
    { id: 'glaze_coklat', name: 'Glaze Coklat' },
    { id: 'glaze_tiramisu', name: 'Glaze Tiramisu' },
    { id: 'glaze_greentea', name: 'Glaze Greentea' },
    { id: 'saus_tomat', name: 'Saus Tomat' },
    { id: 'saus_sambal', name: 'Saus Sambal' },
    { id: 'saus_keju', name: 'Saus Keju' },
    { id: 'panir', name: 'Tepung Panir' },
    { id: 'tisu', name: 'Tisu' },
    { id: 'sarung_tangan', name: 'Sarung Tangan' },
    { id: 'plastik15', name: 'Plastik 15' },
    { id: 'plastik24', name: 'Plastik 24' },
    { id: 'minyak', name: 'Minyak Goreng' },
    { id: 'mayonaise', name: 'Mayonaise' },
  ]
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : seed() } catch { return seed() } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

export function getShoppingItems() { return list }
export function subscribeShoppingItems(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Owner kelola daftar (dipakai nanti dari PWA Owner / OWN-06).
export function addShoppingItem(name) {
  const nm = (name || '').trim()
  if (!nm) return
  commit([...list, { id: 'itm-' + Date.now(), name: nm }])
}
export function removeShoppingItem(id) { commit(list.filter((i) => i.id !== id)) }
