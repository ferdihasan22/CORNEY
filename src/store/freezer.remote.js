// Adapter Supabase: freezer (sisa/min/target per cabang×induk) — TAHAP 4 FASE 5. Realtime.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'
import { debounce } from '../lib/util.js'

export function initFreezerSync(commit) {
  if (!supabase) return
  let ch = null
  const hydrate = async () => {
    await flush(); if (hasPending('freezer')) return
    const { data, error } = await supabase.from('freezer').select('*')
    if (error || !data) return
    const out = {}
    data.forEach((r) => { if (!out[r.branch_id]) out[r.branch_id] = {}; out[r.branch_id][r.parent_id] = { sisa: r.sisa, min: r.min, target: r.target } })
    commit(out)
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    if (!s) return
    hydrate()
    if (!ch) ch = supabase.channel('freezer-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'freezer' }, debounce(hydrate, 500)).subscribe()
  })
}
export async function pushFreezerCell(branchId, parentId, cell) {
  if (!supabase || !cell) return
  enqueue({ kind: 'upsert', table: 'freezer', onConflict: 'branch_id,parent_id', key: `freezer:${branchId}:${parentId}`, row: { branch_id: branchId, parent_id: parentId, sisa: cell.sisa || 0, min: cell.min || 0, target: cell.target || 0 } })
}
