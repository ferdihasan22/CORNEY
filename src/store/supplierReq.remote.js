// Adapter Supabase: supplier_requests (Operasional → Supplier) — FASE 6. Realtime.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'
import { ddToISO, isoToDD, debounce } from '../lib/util.js'
import { BRANCHES } from '../data/menu.js'
const bn = (id) => BRANCHES.find((b) => b.id === id)?.name || id
const fromRow = (r) => ({ id: r.id, createdAt: r.created_at, status: r.status, branchId: r.branch_id, branchName: bn(r.branch_id), tgl: r.tgl ? isoToDD(r.tgl) : '', items: r.items || [] })

export function initSupplierReqSync(commit) {
  if (!supabase) return
  let ch = null
  const hydrate = async () => {
    await flush(); if (hasPending('supplier_requests')) return
    const { data, error } = await supabase.from('supplier_requests').select('*').order('created_at', { ascending: false })
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    if (!s) return
    hydrate()
    if (!ch) ch = supabase.channel('sreq-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_requests' }, debounce(hydrate, 500)).subscribe()
  })
}
export async function pushSupplierReq(o) {
  if (!supabase || !o?.id) return
  enqueue({ kind: 'upsert', table: 'supplier_requests', key: `supplier_requests:${o.id}`, row: { id: o.id, branch_id: o.branchId, tgl: o.tgl && o.tgl.includes('/') ? ddToISO(o.tgl) : null, status: o.status, items: o.items || [] } })
}
// Supplier: tak punya hak tulis tabel supplier_requests (RLS read-only) → lewat RPC
// ber-gate supplier (ubah items/status request yg dibuat Operasional). Cegah update
// checklist gagal diam-diam.
export async function supplierSetRequestRemote(o) {
  if (!supabase || !o?.id) return
  enqueue({ kind: 'rpc', fn: 'supplier_set_request', args: { p_id: o.id, p_items: o.items || [], p_status: o.status || null }, key: `supplier_set_req:${o.id}` })
}
export async function removeSupplierReqRemote(id) {
  if (!supabase || !id) return
  // Supplier tak boleh delete tabel langsung (RLS) → lewat RPC ber-gate supplier.
  enqueue({ kind: 'rpc', fn: 'supplier_remove_request', args: { p_id: id }, key: `supplier_remove_req:${id}` })
}
