// Adapter Supabase: sales_daily (MASTER LAPORAN, SoT) — TAHAP 4 FASE 4.
// tgl store 'DD/MM/YYYY' <-> kolom date. Upsert by (tgl,branch_id). RLS kasir own + staf.
import { supabase } from '../lib/supabase.js'
import { ddToISO, isoToDD } from '../lib/util.js'
import { enqueue, flush, hasPending } from './outbox.js'

const fromRow = (r) => ({
  id: r.id, tgl: isoToDD(r.tgl), branchId: r.branch_id,
  variants: r.variants || {}, channels: r.channels || {}, source: r.source || {},
  potongan: r.potongan || {}, sauces: r.sauces || {}, belanja: r.belanja || {},
  kasAktual: r.kas_aktual, trx: r.trx, peakHour: r.peak_hour,
})
const toRow = (r) => ({
  tgl: ddToISO(r.tgl), branch_id: r.branchId,
  variants: r.variants || {}, channels: r.channels || {}, source: r.source || {},
  potongan: r.potongan || {}, sauces: r.sauces || {}, belanja: r.belanja || {},
  kas_aktual: r.kasAktual ?? 0, trx: r.trx ?? 0, peak_hour: r.peakHour || null,
})

export function initSalesSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush() // kirim dulu yang tertunda
    if (hasPending('sales_daily')) return // masih ada yg belum naik → JANGAN timpa lokal
    const { data, error } = await supabase.from('sales_daily').select('*')
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushSalesRow(row) {
  if (!supabase || !row?.tgl || !row?.branchId) return
  enqueue({ kind: 'upsert', table: 'sales_daily', row: toRow(row), onConflict: 'tgl,branch_id', key: `sales_daily:${ddToISO(row.tgl)}:${row.branchId}` })
}
