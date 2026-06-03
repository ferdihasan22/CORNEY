// Adapter Supabase: supplier_fulfilled (log pemenuhan supplier) — FASE 6. Realtime.
import { supabase } from '../lib/supabase.js'
import { BRANCHES } from '../data/menu.js'
const bn = (id) => BRANCHES.find((b) => b.id === id)?.name || id
const fromRow = (r) => ({ id: r.id, at: r.at, tgl: r.tgl, branchId: r.branch_id, branchName: bn(r.branch_id), items: r.items || [] })

export function initSupplierFulfilledSync(commit) {
  if (!supabase) return
  let ch = null
  const hydrate = async () => {
    const { data, error } = await supabase.from('supplier_fulfilled').select('*').order('at', { ascending: false })
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    if (!s) return
    hydrate()
    if (!ch) ch = supabase.channel('sful-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_fulfilled' }, hydrate).subscribe()
  })
}
// tgl di entry kemungkinan 'DD/MM/YYYY' (dari rekap) atau null. Disimpan apa adanya
// di kolom date jika valid ISO; di sini entry.tgl dipakai langsung — kolom date
// menerima 'YYYY-MM-DD'. Bila format DD/MM, biarkan null agar tak error.
export async function pushFulfilled(e) {
  if (!supabase || !e?.id) return
  const tgl = e.tgl && /^\d{4}-\d{2}-\d{2}$/.test(e.tgl) ? e.tgl : (e.tgl && e.tgl.includes('/') ? e.tgl.split('/').reverse().join('-') : null)
  const { error } = await supabase.from('supplier_fulfilled').upsert({ id: e.id, branch_id: e.branchId, tgl, items: e.items || [] })
  if (error) console.warn('[sful.write]', error.message || error)
}
