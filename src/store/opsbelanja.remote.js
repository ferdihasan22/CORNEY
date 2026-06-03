// Adapter Supabase: ops_belanja (tambahan belanja operasional per cabang) — FASE 6.
import { supabase } from '../lib/supabase.js'

export function initOpsBelanjaSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('ops_belanja').select('*')
    if (error || !data) return
    const out = {}
    data.forEach((r) => { if (!out[r.branch_id]) out[r.branch_id] = {}; out[r.branch_id][r.item_id] = { name: r.name, qty: r.qty, remember: r.remember } })
    commit(out)
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
// Full-sync satu cabang: hapus semua lalu insert item terkini (jumlah item sedikit).
export async function pushOpsBranch(bid, branchMap) {
  if (!supabase || !bid) return
  await supabase.from('ops_belanja').delete().eq('branch_id', bid)
  const rows = Object.entries(branchMap || {}).map(([item_id, v]) => ({ branch_id: bid, item_id, name: v.name, qty: v.qty, remember: !!v.remember }))
  if (rows.length) { const { error } = await supabase.from('ops_belanja').insert(rows); if (error) console.warn('[opsbelanja.write]', error.message || error) }
}
