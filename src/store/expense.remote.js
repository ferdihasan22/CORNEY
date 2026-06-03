// Adapter Supabase: expense (uang belanjaan per tgl+cabang) — TAHAP 4 FASE 4.
import { supabase } from '../lib/supabase.js'
import { ddToISO, isoToDD } from '../lib/util.js'

export function initExpenseSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('expense').select('*')
    if (error || !data) return
    commit(data.map((r) => ({ tgl: isoToDD(r.tgl), branchId: r.branch_id, amount: r.amount })))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushExpense(tgl, branchId, amount) {
  if (!supabase || !tgl || !branchId) return
  const { error } = await supabase.from('expense').upsert(
    { tgl: ddToISO(tgl), branch_id: branchId, amount: Math.max(0, amount || 0) },
    { onConflict: 'tgl,branch_id' },
  )
  if (error) console.warn('[expense.write] upsert:', error.message || error)
}
