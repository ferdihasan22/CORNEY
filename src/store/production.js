// CORNEY — Production log store (PRD-01 Catat Hasil Produksi, Fase 2 dummy/local).
// Produksi records yield per session into the central freezer (+) plus production
// susut + reason. Owner/Auditor read it.
//
// Batch: { id, parent, parentName, jadi, susut, alasan, createdAt }

import { isSupabase } from '../lib/backend.js'
import { genUuid } from '../lib/util.js'

const KEY = 'corney_production'
const subscribers = new Set()
let list = load()

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(s) ? s : []
  } catch {
    return []
  }
}
function commit(next) {
  list = next
  localStorage.setItem(KEY, JSON.stringify(next))
  subscribers.forEach((fn) => fn())
}

// Sinkron antar-tab: reload saat tab lain menulis (cegah data basi → Pelacakan
// Stok salah menunjuk tahap kebocoran).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./production.remote.js').then(({ initProductionSync }) => initProductionSync(commit)).catch(() => {})
}

export function getProduction() {
  return list
}
export function subscribeProduction(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

export function addProduction({ branchId, branchName, parent, parentName, jadi, susut, alasan }) {
  const batch = {
    id: isSupabase() ? genUuid() : 'PRD-' + Date.now(),
    branchId: branchId || null,
    branchName: branchName || null,
    parent,
    parentName: parentName || parent,
    jadi: Math.max(0, Math.round(jadi || 0)),
    susut: Math.max(0, Math.round(susut || 0)),
    alasan: (alasan || '').trim(),
    createdAt: new Date().toISOString(),
  }
  commit([batch, ...list])
  if (isSupabase()) import('./production.remote.js').then((w) => w.pushProduction(batch)).catch(() => {})
  return batch
}
