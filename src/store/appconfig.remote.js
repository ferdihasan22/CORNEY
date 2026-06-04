// Adapter Supabase untuk app_config (key-value global) — TAHAP 4.
// Hidrasi SEGERA (bukan hanya saat login) karena customer anon perlu nomor komplain
// tanpa login. Realtime → owner ubah nomor, customer yang sedang buka app langsung dapat.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'

export function initAppConfigSync(commit, getMap) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('app_config')) return
    const { data, error } = await supabase.from('app_config').select('*')
    if (error || !data) return
    const next = { ...getMap() }
    for (const r of data) next[r.key] = r.value
    commit(next)
  }
  hydrate() // segera — customer anon (tanpa login) butuh nomor komplain
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
  // Realtime: owner ubah nomor → semua yang sedang buka app ikut terbarui.
  try {
    supabase.channel('app_config-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, hydrate)
      .subscribe()
  } catch { /* realtime opsional */ }
}

export async function pushAppConfig(key, value) {
  if (!supabase || !key) return
  enqueue({ kind: 'upsert', table: 'app_config', key: `app_config:${key}`, row: { key, value, updated_at: new Date().toISOString() } })
}
