// Adapter Supabase: usage (pemakaian uang) — TAHAP 4 FASE 4. id uuid (klien) di supabase.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'
import { ddToISO, isoToDD } from '../lib/util.js'

export function initUsageSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('usage')) return
    const { data, error } = await supabase.from('usage').select('*').order('ts', { ascending: false })
    if (error || !data) return
    commit(data.map((r) => ({ id: r.id, tgl: isoToDD(r.tgl), branchId: r.branch_id, jenis: r.jenis, amount: r.amount, note: r.note, ts: r.ts })))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushUsage(u) {
  if (!supabase || !u?.id) return
  enqueue({ kind: 'upsert', table: 'usage', key: `usage:${u.id}`, row: { id: u.id, tgl: ddToISO(u.tgl), branch_id: u.branchId, jenis: u.jenis, amount: u.amount, note: u.note || null, ts: u.ts } })
}
export async function removeUsageRemote(id) {
  if (!supabase) return
  enqueue({ kind: 'delete', table: 'usage', matchId: id, key: `usage_del:${id}` })
}
