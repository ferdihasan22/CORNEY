// Adapter Supabase: audits (audit lapangan Operasional) — TAHAP 4 FASE 5.
import { supabase } from '../lib/supabase.js'
import { BRANCHES } from '../data/menu.js'
const bn = (id) => BRANCHES.find((b) => b.id === id)?.name || id

export function initAuditsSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('audits').select('*').order('created_at', { ascending: false })
    if (error || !data) return
    commit(data.map((r) => ({ id: r.id, branchId: r.branch_id, branchName: bn(r.branch_id), note: r.note, rows: r.rows || [], allCocok: r.all_cocok, createdAt: r.created_at })))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushAudit(a) {
  if (!supabase || !a?.id) return
  const { error } = await supabase.from('audits').insert({ id: a.id, branch_id: a.branchId, note: a.note, all_cocok: a.allCocok, rows: a.rows || [] })
  if (error) console.warn('[audits.write]', error.message || error)
}
