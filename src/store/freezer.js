// CORNEY — Central freezer stock per branch (PRD-02 Min-Maks, Fase 2 dummy/local).
// Owner/Produksi set target (standar) + min per branch×filling; Operasional take
// decreases sisa (PRD-04, later); below-min raises an alarm. Produksi sees
// standar/min (not the branch remainder beyond ops needs).
//
// Shape: { [branchId]: { [parent]: { sisa, min, target } } }

import { isSupabase } from '../lib/backend.js'

const KEY = 'corney_freezer'
const subscribers = new Set()

// Seed: Sepinggan has a below-min item (jumbo) for the alert demo; Gunungsari safe.
function seed() {
  return {
    sepinggan: {
      mozza: { sisa: 42, min: 20, target: 60 },
      sosis: { sisa: 28, min: 20, target: 50 },
      jumbo: { sisa: 12, min: 20, target: 30 },
      mix: { sisa: 22, min: 15, target: 25 },
    },
    gunungsari: {
      mozza: { sisa: 48, min: 18, target: 50 },
      sosis: { sisa: 36, min: 16, target: 40 },
      jumbo: { sisa: 24, min: 14, target: 25 },
      mix: { sisa: 20, min: 12, target: 20 },
    },
  }
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return s && typeof s === 'object' ? s : seed()
  } catch {
    return seed()
  }
}

let state = load()

function commit(next) {
  state = next
  localStorage.setItem(KEY, JSON.stringify(next))
  subscribers.forEach((fn) => fn())
}

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./freezer.remote.js').then(({ initFreezerSync }) => initFreezerSync(commit)).catch(() => {})
}
const pushCell = (b, p, cell) => { if (isSupabase()) import('./freezer.remote.js').then((w) => w.pushFreezerCell(b, p, cell)).catch(() => {}) }

export function getFreezer() {
  return state
}
export function subscribeFreezer(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

// Operasional self-takes stock (PRD-04, no per-take confirm) → sisa decreases.
export function takeFreezer(branchId, parent, qty) {
  const branch = state[branchId] || {}
  const cur = branch[parent]
  if (!cur) return null
  const taken = Math.max(0, Math.round(Number(qty) || 0))
  const next = { ...state, [branchId]: { ...branch, [parent]: { ...cur, sisa: Math.max(0, cur.sisa - taken) } } }
  commit(next)
  pushCell(branchId, parent, next[branchId][parent])
  return next[branchId][parent]
}

// Produksi menambah hasil produksi ke freezer cabang (sisa bertambah).
export function addFreezerStock(branchId, parent, qty) {
  const q = Math.max(0, Math.round(qty || 0))
  if (q <= 0) return
  const branch = state[branchId] || {}
  const cur = branch[parent] || { sisa: 0, min: 0, target: 0 }
  const next = { ...state, [branchId]: { ...branch, [parent]: { ...cur, sisa: cur.sisa + q } } }
  commit(next)
  pushCell(branchId, parent, next[branchId][parent])
}

// Produksi edits the min/target (and may correct sisa) for one branch×filling.
export function setFreezerLevel(branchId, parent, { sisa, min, target }) {
  const branch = state[branchId] || {}
  const cur = branch[parent] || { sisa: 0, min: 0, target: 0 }
  const next = {
    ...state,
    [branchId]: {
      ...branch,
      [parent]: {
        sisa: sisa == null ? cur.sisa : Math.max(0, Math.round(sisa)),
        min: min == null ? cur.min : Math.max(0, Math.round(min)),
        target: target == null ? cur.target : Math.max(0, Math.round(target)),
      },
    },
  }
  commit(next)
  pushCell(branchId, parent, next[branchId][parent])
  return next[branchId][parent]
}
