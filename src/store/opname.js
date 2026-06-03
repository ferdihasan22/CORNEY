// CORNEY — Freezer opname store (PRD-04, Fase 2 dummy). Produksi recounts the
// freezer (safety net for Operasional self-take). 2 modes: each refill / weekly.
// Records system-vs-physical diff; the dashboard flags late/missed opname.
//
// Opname: { id, branchId, branchName, mode, rows:[{parent,parentName,sys,fisik,selisih}], totalSelisih, createdAt }

import { isSupabase } from '../lib/backend.js'
import { genUuid } from '../lib/util.js'

const KEY = 'corney_opname'
const subscribers = new Set()
let list = load()
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : [] } catch { return [] } }
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab: reload saat tab lain menulis (cegah data basi → Pelacakan
// Stok salah menunjuk tahap kebocoran).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./opname.remote.js').then(({ initOpnameSync }) => initOpnameSync(commit)).catch(() => {})
}

export function getOpname() { return list }
export function subscribeOpname(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function submitOpname({ branchId, branchName, mode, rows }) {
  const checked = (rows || []).map((r) => ({ ...r, selisih: (r.fisik ?? r.sys) - r.sys }))
  const rec = {
    id: isSupabase() ? genUuid() : 'OPN-' + Date.now(),
    branchId, branchName: branchName || branchId, mode: mode || 'isi',
    rows: checked,
    totalSelisih: checked.reduce((s, r) => s + r.selisih, 0),
    createdAt: new Date().toISOString(),
  }
  commit([rec, ...list])
  if (isSupabase()) import('./opname.remote.js').then((w) => w.pushOpname(rec)).catch(() => {})
  return rec
}
