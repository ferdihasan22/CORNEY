// Adapter Supabase: usage (pemakaian uang) — TAHAP 4 FASE 4. id uuid (klien) di supabase.
import { supabase } from '../lib/supabase.js'
import { ddToISO, isoToDD } from '../lib/util.js'

export function initUsageSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('usage').select('*').order('ts', { ascending: false })
    if (error || !data) return
    commit(data.map((r) => ({ id: r.id, tgl: isoToDD(r.tgl), branchId: r.branch_id, jenis: r.jenis, amount: r.amount, note: r.note, ts: r.ts })))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushUsage(u) {
  if (!supabase) return
  const { error } = await supabase.from('usage').insert({
    id: u.id, tgl: ddToISO(u.tgl), branch_id: u.branchId, jenis: u.jenis, amount: u.amount, note: u.note || null, ts: u.ts,
  })
  if (error) console.warn('[usage.write] insert:', error.message || error)
}
export async function removeUsageRemote(id) {
  if (!supabase) return
  const { error } = await supabase.from('usage').delete().eq('id', id)
  if (error) console.warn('[usage.write] delete:', error.message || error)
}
