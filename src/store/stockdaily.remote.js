// Adapter Supabase: stock_daily (SoT stok harian) — TAHAP 4 FASE 4.
import { supabase } from '../lib/supabase.js'
import { ddToISO, isoToDD } from '../lib/util.js'

const fromRow = (r) => ({ id: r.id, tgl: isoToDD(r.tgl), branchId: r.branch_id, v: r.v || {} })

export function initStockSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('stock_daily').select('*')
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushStockRow(row) {
  if (!supabase || !row?.tgl || !row?.branchId) return
  const { error } = await supabase.from('stock_daily').upsert(
    { tgl: ddToISO(row.tgl), branch_id: row.branchId, v: row.v || {} },
    { onConflict: 'tgl,branch_id' },
  )
  if (error) console.warn('[stock.write] upsert:', error.message || error)
}
