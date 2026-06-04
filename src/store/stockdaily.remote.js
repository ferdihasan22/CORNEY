// Adapter Supabase: stock_daily (SoT stok harian) — TAHAP 4 FASE 4.
import { supabase } from '../lib/supabase.js'
import { ddToISO, isoToDD } from '../lib/util.js'
import { enqueue, flush, hasPending } from './outbox.js'

const fromRow = (r) => ({ id: r.id, tgl: isoToDD(r.tgl), branchId: r.branch_id, v: r.v || {} })

export function initStockSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush()
    if (hasPending('stock_daily')) return
    const { data, error } = await supabase.from('stock_daily').select('*')
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushStockRow(row) {
  if (!supabase || !row?.tgl || !row?.branchId) return
  enqueue({ kind: 'upsert', table: 'stock_daily', row: { tgl: ddToISO(row.tgl), branch_id: row.branchId, v: row.v || {} }, onConflict: 'tgl,branch_id', key: `stock_daily:${ddToISO(row.tgl)}:${row.branchId}` })
}
