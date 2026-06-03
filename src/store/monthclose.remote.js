// Adapter Supabase: month_close (snapshot beku tutup bulan) — TAHAP 4 FASE 4.
// Store: { closed: { 'YYYY-MM': snapshot } } <-> baris month_close(month_key, snapshot).
import { supabase } from '../lib/supabase.js'

export function initMonthCloseSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
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
  const { error } = await supabase.from('month_close').upsert({ month_key: key, snapshot })
  if (error) console.warn('[monthclose.write] upsert:', error.message || error)
}
export async function deleteMonthCloseRemote(key) {
  if (!supabase) return
  const { error } = await supabase.from('month_close').delete().eq('month_key', key)
  if (error) console.warn('[monthclose.write] delete:', error.message || error)
}
