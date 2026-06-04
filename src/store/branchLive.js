// Store OMZET BERJALAN per cabang (live, sementara). Sumber: tabel branch_live
// (Supabase). TERPISAH dari MASTER LAPORAN (sales_daily) — JANGAN dipakai untuk
// laporan resmi. Shape: { [branchId]: { bizDate, omzet, trx, breakdown, updatedAt } }
import { isSupabase } from '../lib/backend.js'

const subscribers = new Set()
let state = {}
let started = false
let _hydrate = () => {}

function commit(next) { state = next; subscribers.forEach((f) => f()) }

export function getBranchLive() { return state }
export function subscribeBranchLive(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Mulai sinkron (hydrate + realtime) — dipanggil HANYA saat Owner buka dashboard
// (via useBranchLive). Kasir tak perlu baca (RLS owner/auditor saja) → tak subscribe.
export function startBranchLiveSync() {
  if (started || !isSupabase()) return
  started = true
  import('./branchLive.remote.js').then(({ initBranchLiveSync }) => { _hydrate = initBranchLiveSync(commit) || (() => {}) }).catch(() => { started = false })
}
export function refreshBranchLive() { _hydrate() }

// Kasir: dorong total berjalan cabang sendiri (lewat outbox, dedup key sama).
export function pushBranchLive(payload) {
  if (isSupabase()) import('./branchLive.remote.js').then((w) => w.setBranchLiveRemote(payload)).catch(() => {})
}
