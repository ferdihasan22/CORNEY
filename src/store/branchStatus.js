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

// Owner: buka/tutup Toko Online cabang TERTENTU (override kasir). Optimistik di lokal
// lalu dorong ke server (realtime menyusul) → tombol langsung terasa responsif.
export function setBranchOpenFor(branchId, open) {
  if (!branchId) return
  const cur = state[branchId] || {}
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  commit({ ...state, [branchId]: { ...cur, open: !!open, openDate: open ? today : null } })
  if (isSupabase()) import('./branchStatus.remote.js').then((w) => w.setBranchOpenOwnerRemote(branchId, open)).catch(() => {})
}

// Dipanggil kasir saat ketersediaan menu berubah (matikan menu / stok induk habis).
// avail = { off:[menuId], sold:[parentId] }
export function setBranchAvailability(avail) {
  if (isSupabase()) import('./branchStatus.remote.js').then((w) => w.setBranchAvailabilityRemote(avail)).catch(() => {})
}
