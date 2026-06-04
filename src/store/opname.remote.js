// Adapter Supabase: opname (recount freezer) — TAHAP 4 FASE 5.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'
import { BRANCHES } from '../data/menu.js'
const bn = (id) => BRANCHES.find((b) => b.id === id)?.name || id

export function initOpnameSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('opname')) return
    const { data, error } = await supabase.from('opname').select('*').order('created_at', { ascending: false })
    if (error || !data) return
    commit(data.map((r) => ({ id: r.id, branchId: r.branch_id, branchName: bn(r.branch_id), mode: r.mode, rows: r.rows || [], totalSelisih: r.total_selisih, createdAt: r.created_at })))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushOpname(o) {
  if (!supabase || !o?.id) return
  enqueue({ kind: 'upsert', table: 'opname', key: `opname:${o.id}`, row: { id: o.id, branch_id: o.branchId, mode: o.mode, rows: o.rows || [], total_selisih: o.totalSelisih } })
}
