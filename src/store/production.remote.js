// Adapter Supabase: production (log hasil produksi) — TAHAP 4 FASE 5.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'
import { BRANCHES, PARENT_FILLINGS } from '../data/menu.js'
const bn = (id) => BRANCHES.find((b) => b.id === id)?.name || id
const pn = (id) => PARENT_FILLINGS.find((p) => p.id === id)?.name || id

export function initProductionSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('production')) return
    const { data, error } = await supabase.from('production').select('*').order('created_at', { ascending: false })
    if (error || !data) return
    commit(data.map((r) => ({ id: r.id, branchId: r.branch_id, branchName: bn(r.branch_id), parent: r.parent_id, parentName: pn(r.parent_id), jadi: r.jadi, susut: r.susut, alasan: r.alasan, createdAt: r.created_at })))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushProduction(b) {
  if (!supabase || !b?.id) return
  enqueue({ kind: 'upsert', table: 'production', key: `production:${b.id}`, row: { id: b.id, branch_id: b.branchId, parent_id: b.parent, jadi: b.jadi, susut: b.susut, alasan: b.alasan } })
}
