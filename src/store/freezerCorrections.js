// CORNEY — Pengajuan koreksi SISA stok freezer (Produksi → Owner approval).
// Produksi tak boleh ubah sisa langsung; ajukan → Owner setujui/tolak. Min tetap
// boleh diatur Produksi langsung. Fase 1 lokal + sinkron antar-tab.
import { setFreezerLevel } from './freezer.js'
import { isSupabase } from '../lib/backend.js'
import { genUuid } from '../lib/util.js'

const KEY = 'corney_freezer_corrections_v1'
const subscribers = new Set()
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : [] } catch { return [] } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./freezerCorrections.remote.js').then(({ initFreezerCorrectionsSync }) => initFreezerCorrectionsSync(commit)).catch(() => {})
}

export function getFreezerCorrections() { return list }
export function subscribeFreezerCorrections(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function createFreezerCorrection({ branchId, branchName, parent, parentName, current, proposed, reason }) {
  const c = {
    id: isSupabase() ? genUuid() : 'FZC-' + Date.now(), branchId, branchName: branchName || branchId, parent, parentName: parentName || parent,
    current: Math.max(0, Math.round(current || 0)), proposed: Math.max(0, Math.round(proposed || 0)),
    reason: (reason || '').trim(), status: 'pending', createdAt: new Date().toISOString(),
  }
  commit([c, ...list])
  if (isSupabase()) import('./freezerCorrections.remote.js').then((w) => w.pushFreezerCorrection(c)).catch(() => {})
  return c
}

// Owner setujui → terapkan ke freezer; tolak → tidak mengubah stok.
export function resolveFreezerCorrection(id, approve) {
  let found = null
  const next = list.map((c) => { if (c.id !== id) return c; found = { ...c, status: approve ? 'approved' : 'rejected', resolvedAt: new Date().toISOString() }; return found })
  if (found) { commit(next); if (approve) setFreezerLevel(found.branchId, found.parent, { sisa: found.proposed }); if (isSupabase()) import('./freezerCorrections.remote.js').then((w) => w.pushFreezerCorrection(found)).catch(() => {}) }
  return found
}

export function pendingFreezerCount() { return list.filter((c) => c.status === 'pending').length }

// Hapus SATU riwayat koreksi (cleanup salah input). Tak meng-undo perubahan freezer
// yang sudah diterapkan — hanya membersihkan catatan/riwayat.
export function removeFreezerCorrection(id) {
  commit(list.filter((c) => c.id !== id))
  if (isSupabase()) import('./freezerCorrections.remote.js').then((w) => w.removeFreezerCorrectionRemote(id)).catch(() => {})
}
// Hapus SEMUA riwayat koreksi → fresh. (Stok freezer saat ini tak diubah.)
export function clearAllFreezerCorrections() {
  const ids = list.map((c) => c.id)
  commit([])
  if (isSupabase()) import('./freezerCorrections.remote.js').then((w) => ids.forEach((id) => w.removeFreezerCorrectionRemote(id))).catch(() => {})
}
