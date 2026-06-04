// Adapter Supabase: ops_belanja (tambahan belanja operasional per cabang) — FASE 6.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'

export function initOpsBelanjaSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('ops_belanja')) return
    const { data, error } = await supabase.from('ops_belanja').select('*')
    if (error || !data) return
    const out = {}
    data.forEach((r) => { if (!out[r.branch_id]) out[r.branch_id] = {}; out[r.branch_id][r.item_id] = { name: r.name, qty: r.qty, remember: r.remember } })
    commit(out)
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
// Full-sync satu cabang: hapus baris cabang lalu upsert item terkini (item sedikit).
// Lewat outbox: delete-by-branch dulu (FIFO) lalu upsert baris → tahan offline.
export async function pushOpsBranch(bid, branchMap) {
  if (!supabase || !bid) return
  enqueue({ kind: 'delete', table: 'ops_belanja', col: 'branch_id', matchId: bid, key: `ops_belanja_del:${bid}` })
  const rows = Object.entries(branchMap || {}).map(([item_id, v]) => ({ branch_id: bid, item_id, name: v.name, qty: v.qty, remember: !!v.remember }))
  if (rows.length) enqueue({ kind: 'upsert', table: 'ops_belanja', onConflict: 'branch_id,item_id', key: `ops_belanja_ins:${bid}`, row: rows })
}
