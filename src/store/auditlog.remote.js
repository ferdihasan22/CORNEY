// Adapter Supabase: audit_log (APPEND-ONLY) — TAHAP 4. Insert semua staf; baca owner/auditor.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'

export function initAuditLogSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('audit_log')) return
    const { data, error } = await supabase.from('audit_log').select('*').order('ts', { ascending: false })
    if (error || !data) return
    commit(data.map((r) => ({ id: r.id, hash: '', type: r.type, who: r.who, branchId: r.branch_id, oldVal: r.old_val, newVal: r.new_val, note: r.note, at: r.ts })))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushAuditLog(e) {
  if (!supabase || !e?.id) return
  enqueue({ kind: 'upsert', table: 'audit_log', key: `audit_log:${e.id}`, row: { id: e.id, type: e.type, who: e.who, branch_id: e.branchId || null, old_val: e.oldVal, new_val: e.newVal, note: e.note } })
}
