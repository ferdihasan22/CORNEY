// CORNEY — Pengajuan koreksi SISA stok freezer (Produksi → Owner approval).
// Produksi tak boleh ubah sisa langsung; ajukan → Owner setujui/tolak. Min tetap
// boleh diatur Produksi langsung. Fase 1 lokal + sinkron antar-tab.
import { setFreezerLevel } from './freezer.js'

const KEY = 'corney_freezer_corrections_v1'
const subscribers = new Set()
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : [] } catch { return [] } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

export function getFreezerCorrections() { return list }
export function subscribeFreezerCorrections(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function createFreezerCorrection({ branchId, branchName, parent, parentName, current, proposed, reason }) {
  const c = {
    id: 'FZC-' + Date.now(), branchId, branchName: branchName || branchId, parent, parentName: parentName || parent,
    current: Math.max(0, Math.round(current || 0)), proposed: Math.max(0, Math.round(proposed || 0)),
    reason: (reason || '').trim(), status: 'pending', createdAt: new Date().toISOString(),
  }
  commit([c, ...list])
  return c
}

// Owner setujui → terapkan ke freezer; tolak → tidak mengubah stok.
export function resolveFreezerCorrection(id, approve) {
  let found = null
  const next = list.map((c) => { if (c.id !== id) return c; found = { ...c, status: approve ? 'approved' : 'rejected', resolvedAt: new Date().toISOString() }; return found })
  if (found) { commit(next); if (approve) setFreezerLevel(found.branchId, found.parent, { sisa: found.proposed }) }
  return found
}

export function pendingFreezerCount() { return list.filter((c) => c.status === 'pending').length }
