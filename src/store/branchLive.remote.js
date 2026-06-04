// Adapter Supabase untuk branch_live (omzet berjalan per cabang).
// Kasir set via RPC kasir_set_live (outbox, tahan offline). Owner/Auditor baca semua
// (RLS bl_read). Realtime → Owner dashboard update otomatis.
import { supabase } from '../lib/supabase.js'
import { enqueue } from './outbox.js'
import { debounce } from '../lib/util.js'

// Kasir dorong omzet berjalan cabang sendiri. Dedup key sama → ambil yang terakhir.
export function setBranchLiveRemote({ omzet, trx, bizDate, breakdown }) {
  enqueue({
    kind: 'rpc', fn: 'kasir_set_live',
    args: { p_omzet: Math.round(omzet || 0), p_trx: Math.round(trx || 0), p_biz_date: bizDate || null, p_breakdown: breakdown || {} },
    key: 'kasir_set_live',
  })
}

// Hidrasi + realtime semua cabang (untuk Owner). Return fungsi refresh.
export function initBranchLiveSync(commit) {
  if (!supabase) return () => {}
  const hydrate = async () => {
    const { data, error } = await supabase.from('branch_live').select('*')
    if (error || !data) return
    const out = {}
    data.forEach((r) => { out[r.branch_id] = { bizDate: r.biz_date, omzet: r.omzet || 0, trx: r.trx || 0, breakdown: r.breakdown || {}, updatedAt: r.updated_at } })
    commit(out)
  }
  hydrate()
  try {
    supabase.channel('branch_live-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branch_live' }, debounce(hydrate, 400))
      .subscribe()
  } catch { /* realtime tak tersedia → andalkan refresh manual */ }
  return hydrate
}
