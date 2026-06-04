// Adapter Supabase: supplier_fulfilled (log pemenuhan supplier) — FASE 6. Realtime.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'
import { debounce } from '../lib/util.js'
import { BRANCHES } from '../data/menu.js'
const bn = (id) => BRANCHES.find((b) => b.id === id)?.name || id
const fromRow = (r) => ({ id: r.id, at: r.at, tgl: r.tgl, branchId: r.branch_id, branchName: bn(r.branch_id), items: r.items || [] })

export function initSupplierFulfilledSync(commit) {
  if (!supabase) return
  let ch = null
  const hydrate = async () => {
    await flush(); if (hasPending('supplier_fulfilled')) return
    const { data, error } = await supabase.from('supplier_fulfilled').select('*').order('at', { ascending: false })
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    if (!s) return
    hydrate()
    if (!ch) ch = supabase.channel('sful-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_fulfilled' }, debounce(hydrate, 500)).subscribe()
  })
}
// tgl di entry kemungkinan 'DD/MM/YYYY' atau ISO atau null → normalisasi ke 'YYYY-MM-DD'.
export async function pushFulfilled(e) {
  if (!supabase || !e?.id) return
  const tgl = e.tgl && /^\d{4}-\d{2}-\d{2}$/.test(e.tgl) ? e.tgl : (e.tgl && e.tgl.includes('/') ? e.tgl.split('/').reverse().join('-') : null)
  enqueue({ kind: 'upsert', table: 'supplier_fulfilled', key: `supplier_fulfilled:${e.id}`, row: { id: e.id, branch_id: e.branchId, tgl, items: e.items || [] } })
}
