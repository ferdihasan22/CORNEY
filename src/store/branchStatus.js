// Store status buka cabang (untuk online). Sumber: tabel branch_status di Supabase
// (lintas perangkat). Mode local: kosong (CustomerChooseBranch fallback ke sesi
// day.js lokal). Shape: { [branchId]: { open: bool, openDate: 'YYYY-MM-DD' } }
import { isSupabase } from '../lib/backend.js'

const subscribers = new Set()
let state = {}
let _refresh = () => {}

function commit(next) { state = next; subscribers.forEach((f) => f()) }

if (isSupabase()) {
  import('./branchStatus.remote.js').then(({ initBranchStatusSync }) => { _refresh = initBranchStatusSync(commit) || (() => {}) }).catch(() => {})
}

export function getBranchStatus() { return state }
export function subscribeBranchStatus(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }
export function refreshBranchStatus() { _refresh() }

// Dipanggil kasir saat buka (Opening selesai) / tutup (Closing).
export function setBranchOpen(open) {
  if (isSupabase()) import('./branchStatus.remote.js').then((w) => w.setBranchOpenRemote(open)).catch(() => {})
}

// Dipanggil kasir saat ketersediaan menu berubah (matikan menu / stok induk habis).
// avail = { off:[menuId], sold:[parentId] }
export function setBranchAvailability(avail) {
  if (isSupabase()) import('./branchStatus.remote.js').then((w) => w.setBranchAvailabilityRemote(avail)).catch(() => {})
}
