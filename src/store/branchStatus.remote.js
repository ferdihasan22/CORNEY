// Adapter Supabase: branch_status (status "buka untuk online" per cabang).
// Kasir set lewat RPC kasir_set_open (via outbox → tahan offline). Customer & staf
// baca status semua cabang (anon boleh baca, RLS bs_read=true).
import { supabase } from '../lib/supabase.js'
import { enqueue } from './outbox.js'
import { debounce } from '../lib/util.js'

// Kasir set buka/tutup cabang SENDIRI. Lewat outbox (durable, dedup key sama →
// open/close beruntun ambil yang terakhir).
export function setBranchOpenRemote(open) {
  enqueue({ kind: 'rpc', fn: 'kasir_set_open', args: { p_open: !!open }, key: 'kasir_set_open' })
}

// Kasir set ketersediaan menu cabang sendiri: { off:[menuId], sold:[parentId] }.
export function setBranchAvailabilityRemote(avail) {
  enqueue({ kind: 'rpc', fn: 'kasir_set_availability', args: { p_avail: avail || {} }, key: 'kasir_set_availability' })
}

// Hidrasi status semua cabang. Return fungsi refresh (panggil ulang saat perlu).
export function initBranchStatusSync(commit) {
  if (!supabase) return () => {}
  const hydrate = async () => {
    const { data, error } = await supabase.from('branch_status').select('*')
    if (error || !data) return
    const out = {}
    data.forEach((r) => { out[r.branch_id] = { open: !!r.online_open, openDate: r.open_date, availability: r.availability || {} } })
    commit(out)
  }
  hydrate() // customer anon bisa baca → picker tampil status terkini saat dibuka
  // REALTIME: update otomatis saat kasir buka/tutup atau menu habis/dinyalakan
  // (anon boleh subscribe; RLS bs_read mengizinkan). Poll tetap jadi jaring pengaman.
  try {
    supabase.channel('branch_status-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branch_status' }, debounce(hydrate, 300))
      .subscribe()
  } catch { /* realtime tak tersedia → andalkan poll */ }
  return hydrate
}
