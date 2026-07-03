// Adapter Supabase: materials (stok bahan baku/mentah global) — Reorder Bahan Mentah.
// Produksi tulis (sisa/threshold/reorder), Owner baca (notifikasi/anomali). Realtime.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'
import { debounce } from '../lib/util.js'

export function initMaterialsSync(commit) {
  if (!supabase) return
  let ch = null
  const hydrate = async () => {
    await flush(); if (hasPending('materials')) return
    const { data, error } = await supabase.from('materials').select('*')
    // Server kosong (belum ada yg entri / baru go-live) → JANGAN timpa cache lokal
    // (cegah data bahan yg sudah diketik Produksi hilang saat migrasi awal).
    if (error || !data || data.length === 0) return
    const out = {}
    data.forEach((r) => { out[r.id] = { sisa: r.sisa || 0, threshold: r.threshold || 0, reorderedAt: r.reordered_at || null } })
    commit(out)
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    if (!s) return
    hydrate()
    if (!ch) ch = supabase.channel('materials-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, debounce(hydrate, 500)).subscribe()
  })
}
// Push SELURUH peta bahan sekaligus (bukan per-baris) → server selalu punya set
// lengkap; hydrate full-state tak pernah kehilangan baris yg belum sempat ter-push.
export async function pushMaterials(state) {
  if (!supabase || !state) return
  const now = new Date().toISOString()
  const rows = Object.entries(state).map(([id, c]) => ({
    id, sisa: c?.sisa || 0, threshold: c?.threshold || 0, reordered_at: c?.reorderedAt || null, updated_at: now,
  }))
  if (!rows.length) return
  enqueue({ kind: 'upsert', table: 'materials', onConflict: 'id', key: 'materials:all', row: rows })
}
