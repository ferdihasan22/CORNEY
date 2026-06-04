// Adapter Supabase: shipments (kiriman stok ops→kasir) — TAHAP 4 FASE 5. Realtime.
import { supabase } from '../lib/supabase.js'
import { BRANCHES, PARENT_FILLINGS } from '../data/menu.js'
import { enqueue, flush, hasPending } from './outbox.js'
import { debounce } from '../lib/util.js'
const bn = (id) => BRANCHES.find((b) => b.id === id)?.name || id
const pn = (id) => PARENT_FILLINGS.find((p) => p.id === id)?.name || id
const fromRow = (r) => ({ id: r.id, branchId: r.branch_id, branchName: bn(r.branch_id), parent: r.parent_id, parentName: pn(r.parent_id), qty: r.qty, status: r.status, selisih: r.selisih, createdAt: r.created_at, confirmedAt: r.confirmed_at })

export function initShipmentsSync(commit) {
  if (!supabase) return
  let ch = null
  const hydrate = async () => {
    await flush()
    if (hasPending('shipments')) return
    const { data, error } = await supabase.from('shipments').select('*').order('created_at', { ascending: false })
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    if (!s) return
    hydrate()
    if (!ch) ch = supabase.channel('shipments-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, debounce(hydrate, 500)).subscribe()
  })
}
export async function pushShipment(s) {
  if (!supabase || !s?.id) return
  enqueue({
    kind: 'upsert', table: 'shipments', key: `shipments:${s.id}`,
    row: { id: s.id, branch_id: s.branchId, parent_id: s.parent, qty: s.qty, status: s.status, selisih: s.selisih || 0, confirmed_at: s.confirmedAt || null },
  })
}
