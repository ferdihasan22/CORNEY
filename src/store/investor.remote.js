// Adapter Supabase untuk Bagi Hasil Investor per cabang — TAHAP 4.
// Tabel investor_config(branch_id, sewa, gaji, value, pct) ; store: {branchId:{...}}.
// RLS: owner/auditor baca; owner tulis → hidrasi on-auth.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'

export function initInvestorSync(commit, getMap) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('investor_config')) return
    const { data, error } = await supabase.from('investor_config').select('*')
    if (error || !data) return
    const next = { ...getMap() }
    for (const r of data) next[r.branch_id] = { sewa: r.sewa || 0, gaji: r.gaji || 0, value: r.value || 0, pct: r.pct || 0 }
    commit(next)
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushInvestor(branchId, cfg) {
  if (!supabase || !branchId) return
  enqueue({ kind: 'upsert', table: 'investor_config', key: `investor_config:${branchId}`, row: { branch_id: branchId, sewa: cfg.sewa || 0, gaji: cfg.gaji || 0, value: cfg.value || 0, pct: cfg.pct || 0 } })
}
