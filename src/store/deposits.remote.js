// Adapter Supabase: deposits (rantai setoran kasir→ops→auditor) — TAHAP 4 FASE 4.
// Field kompleks (rincian, opsAmount, auditor*, dll) disimpan di kolom meta(jsonb).
// REALTIME (lintas perangkat: kasir buat → ops lihat). id uuid (klien) di supabase.
import { supabase } from '../lib/supabase.js'
import { ddToISO, isoToDD, debounce } from '../lib/util.js'
import { enqueue, flush, hasPending } from './outbox.js'

const META = ['branchName', 'kasirName', 'rincian', 'opsAmount', 'opsName', 'selisih', 'forwarded',
  'confirmedAt', 'auditorAmount', 'auditorSelisih', 'auditorStatus', 'auditorNote', 'auditedAt']

const fromRow = (r) => ({
  id: r.id, tgl: r.tgl ? isoToDD(r.tgl) : null, branchId: r.branch_id,
  kasirAmount: r.amount, status: r.status, createdAt: r.created_at, ...(r.meta || {}),
})
const toRow = (d) => {
  const meta = {}
  META.forEach((k) => { if (d[k] !== undefined) meta[k] = d[k] })
  return { id: d.id, tgl: d.tgl ? ddToISO(d.tgl) : null, branch_id: d.branchId, amount: d.kasirAmount ?? 0, status: d.status || 'menunggu', meta }
}

export function initDepositsSync(commit) {
  if (!supabase) return
  let ch = null
  const hydrate = async () => {
    await flush()
    if (hasPending('deposits')) return // jangan timpa setoran lokal yg belum naik
    const { data, error } = await supabase.from('deposits').select('*').order('created_at', { ascending: false })
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    if (!s) return
    hydrate()
    if (!ch) ch = supabase.channel('deposits-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'deposits' }, debounce(hydrate, 500)).subscribe()
  })
}
export async function pushDeposit(d) {
  if (!supabase || !d?.id) return
  enqueue({ kind: 'upsert', table: 'deposits', row: toRow(d), key: `deposits:${d.id}` })
}

// Auditor: tak punya hak tulis tabel deposits (RLS read-only) → lewat RPC ber-gate
// auditor (merge field verifikasi ke meta). Cegah verifikasi gagal diam-diam.
export async function auditorVerifyRemote(d) {
  if (!supabase || !d?.id) return
  const meta = {
    auditorAmount: d.auditorAmount, auditorSelisih: d.auditorSelisih,
    auditorStatus: d.auditorStatus, auditorNote: d.auditorNote, auditedAt: d.auditedAt,
  }
  enqueue({ kind: 'rpc', fn: 'auditor_verify_deposit', args: { p_id: d.id, p_meta: meta }, key: `auditor_verify:${d.id}` })
}
