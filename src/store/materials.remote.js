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
    if (error || !data) return
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
export async function pushMaterial(id, cell) {
  if (!supabase || !id || !cell) return
  enqueue({ kind: 'upsert', table: 'materials', onConflict: 'id', key: `materials:${id}`,
    row: { id, sisa: cell.sisa || 0, threshold: cell.threshold || 0, reordered_at: cell.reorderedAt || null, updated_at: new Date().toISOString() } })
}
