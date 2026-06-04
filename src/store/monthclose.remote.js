// Adapter Supabase: month_close (snapshot beku tutup bulan) — TAHAP 4 FASE 4.
// Store: { closed: { 'YYYY-MM': snapshot } } <-> baris month_close(month_key, snapshot).
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'

export function initMonthCloseSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('month_close')) return
    const { data, error } = await supabase.from('month_close').select('*')
    if (error || !data) return
    const closed = {}
    data.forEach((r) => { closed[r.month_key] = r.snapshot || {} })
    commit({ closed })
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushMonthClose(key, snapshot) {
  if (!supabase) return
  enqueue({ kind: 'upsert', table: 'month_close', key: `month_close:${key}`, row: { month_key: key, snapshot } })
}
export async function deleteMonthCloseRemote(key) {
  if (!supabase) return
  enqueue({ kind: 'delete', table: 'month_close', col: 'month_key', matchId: key, key: `month_close_del:${key}` })
}
