// Adapter Supabase: supplier_requests (Operasional → Supplier) — FASE 6. Realtime.
import { supabase } from '../lib/supabase.js'
import { ddToISO, isoToDD } from '../lib/util.js'
import { BRANCHES } from '../data/menu.js'
const bn = (id) => BRANCHES.find((b) => b.id === id)?.name || id
const fromRow = (r) => ({ id: r.id, createdAt: r.created_at, status: r.status, branchId: r.branch_id, branchName: bn(r.branch_id), tgl: r.tgl ? isoToDD(r.tgl) : '', items: r.items || [] })

export function initSupplierReqSync(commit) {
  if (!supabase) return
  let ch = null
  const hydrate = async () => {
    const { data, error } = await supabase.from('supplier_requests').select('*').order('created_at', { ascending: false })
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    if (!s) return
    hydrate()
    if (!ch) ch = supabase.channel('sreq-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_requests' }, hydrate).subscribe()
  })
}
export async function pushSupplierReq(o) {
  if (!supabase || !o?.id) return
  const { error } = await supabase.from('supplier_requests').upsert({
    id: o.id, branch_id: o.branchId, tgl: o.tgl && o.tgl.includes('/') ? ddToISO(o.tgl) : null, status: o.status, items: o.items || [],
  })
  if (error) console.warn('[sreq.write]', error.message || error)
}
export async function removeSupplierReqRemote(id) {
  if (!supabase) return
  const { error } = await supabase.from('supplier_requests').delete().eq('id', id)
  if (error) console.warn('[sreq.write] delete', error.message || error)
}
