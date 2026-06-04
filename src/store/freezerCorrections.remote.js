// Adapter Supabase: freezer_corrections (Produksi ajukan → Owner approve) — FASE 5. Realtime.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'
import { BRANCHES, PARENT_FILLINGS } from '../data/menu.js'
const bn = (id) => BRANCHES.find((b) => b.id === id)?.name || id
const pn = (id) => PARENT_FILLINGS.find((p) => p.id === id)?.name || id

export function initFreezerCorrectionsSync(commit) {
  if (!supabase) return
  let ch = null
  const hydrate = async () => {
    await flush(); if (hasPending('freezer_corrections')) return
    const { data, error } = await supabase.from('freezer_corrections').select('*').order('created_at', { ascending: false })
    if (error || !data) return
    commit(data.map((r) => ({ id: r.id, branchId: r.branch_id, branchName: bn(r.branch_id), parent: r.parent_id, parentName: pn(r.parent_id), current: r.current, proposed: r.proposed, reason: r.reason, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at })))
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    if (!s) return
    hydrate()
    if (!ch) ch = supabase.channel('fc-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'freezer_corrections' }, hydrate).subscribe()
  })
}
export async function pushFreezerCorrection(c) {
  if (!supabase || !c?.id) return
  enqueue({ kind: 'upsert', table: 'freezer_corrections', key: `freezer_corrections:${c.id}`, row: { id: c.id, branch_id: c.branchId, parent_id: c.parent, current: c.current, proposed: c.proposed, reason: c.reason, status: c.status, resolved_at: c.resolvedAt || null } })
}
