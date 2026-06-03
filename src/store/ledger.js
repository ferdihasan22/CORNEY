// CORNEY — Purchase ledger store (OWN-08 Buku Besar Pembelian, Fase 2 dummy).
// One row per item TYPE: latest price + change marker, ordered vs received,
// period recap. Data flows from SupplierOrder + Operasional confirm (TAHAP 4).
//
// Row: { id, item, unit, latestPrice, prevPrice, ordered, received, lastDate }

import { isSupabase } from '../lib/backend.js'

const KEY = 'corney_ledger'
const subscribers = new Set()

function seed() {
  return [
    { id: 'sosis_jumbo', item: 'Sosis Jumbo', unit: 'pack', latestPrice: 48000, prevPrice: 45000, ordered: 20, received: 20, lastDate: '2026-05-30' },
    { id: 'keju', item: 'Keju Mozza Block', unit: 'pack', latestPrice: 62000, prevPrice: 62000, ordered: 15, received: 15, lastDate: '2026-05-30' },
    { id: 'kentang', item: 'Kentang Coating', unit: 'karung', latestPrice: 185000, prevPrice: 195000, ordered: 5, received: 4, lastDate: '2026-05-29' },
    { id: 'kotak', item: 'Kotak Kemasan', unit: 'ball', latestPrice: 92000, prevPrice: 88000, ordered: 8, received: 8, lastDate: '2026-05-28' },
    { id: 'glaze', item: 'Glaze Sweet', unit: 'galon', latestPrice: 75000, prevPrice: 75000, ordered: 6, received: 6, lastDate: '2026-05-28' },
    { id: 'minyak', item: 'Minyak Goreng', unit: 'jerigen', latestPrice: 210000, prevPrice: 198000, ordered: 10, received: 9, lastDate: '2026-05-27' },
  ]
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : seed() } catch { return seed() } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

if (isSupabase()) {
  import('./ledger.remote.js').then(({ initLedgerSync }) => initLedgerSync(commit)).catch(() => {})
}

export function getLedger() { return list }
export function subscribeLedger(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Operasional confirms goods arrival → received catches up to ordered.
export function markReceived(id) {
  let found = null
  commit(list.map((r) => { if (r.id !== id) return r; found = { ...r, received: r.ordered }; return found }))
  if (found && isSupabase()) import('./ledger.remote.js').then((w) => w.pushLedgerRow(found)).catch(() => {})
}
