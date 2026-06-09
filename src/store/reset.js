// CORNEY — Reset terpusat.
//  • resetGoLive(): bersihkan SEMUA data contoh & transaksi sebelum usaha live,
//    supaya laporan mulai dari NOL. Menulis nilai kosong yang VALID (bukan hapus
//    key) agar seed() dummy TIDAK muncul lagi. KONFIG dipertahankan (cabang, user,
//    menu, item belanja, takaran bahan) — owner edit lewat layarnya masing-masing.
//  Dipakai sekali saat onboarding. Setelah tulis, halaman di-reload agar semua
//  store re-init dari keadaan bersih.
import { INGREDIENTS } from '../data/menu.js'
import { isSupabase } from '../lib/backend.js'

// Store transaksi/laporan (array) → dikosongkan jadi [].
const EMPTY_ARRAY_KEYS = [
  'corney_salesdaily_v4', 'corney_stockdaily_v3', 'corney_expense_v2', 'corney_usage_v2', 'corney_deposits_v4',
  'corney_production', 'corney_shipments', 'corney_opname', 'corney_freezer_corrections_v1', 'corney_audits',
  'corney_orders', 'corney_supplier_req_v2', 'corney_supplier_fulfilled_v1', 'corney_ledger', 'corney_auditlog',
]
// Store map (object) → dikosongkan jadi {}.
// CATATAN: 'corney_parstock' SENGAJA TIDAK di sini — Stok Standar (par_stock) adalah
// KONFIG cabang yang dipertahankan saat Mulai Bersih (server pun tak men-truncate-nya),
// jadi jangan dikosongkan di lokal supaya konsisten (tak balik-balik via hydrate).
const EMPTY_OBJECT_KEYS = [
  'corney_opsbelanja_v2', 'corney_supplier_prices_v2', 'corney_freezer', 'corney_investor_cfg_v1',
]
// Store sesi → dihapus (tidak ada hari/keranjang aktif saat mulai).
const REMOVE_KEYS = ['corney_day', 'corney_cart']

export async function resetGoLive() {
  if (typeof window === 'undefined') return
  // 1) Mode supabase: truncate SERVER DULU. supabase.rpc TIDAK melempar error — ia
  //    mengembalikan { error } — jadi WAJIB diperiksa. Kalau gagal, JANGAN bersihkan
  //    lokal / reload; beri tahu user (cegah "kelihatan berhasil padahal tidak").
  if (isSupabase()) {
    try {
      const { supabase } = await import('../lib/supabase.js')
      if (!supabase) throw new Error('Supabase belum siap')
      const { error } = await supabase.rpc('owner_reset_transaksi')
      if (error) throw error
    } catch (e) {
      alert('Gagal Mulai Bersih di server: ' + (e?.message || e) +
        '\n\nData TIDAK dihapus. Pastikan kamu login sebagai Owner & koneksi stabil, lalu coba lagi.')
      return
    }
  }
  // 2) Server beres (atau mode lokal) → bersihkan cache lokal & reload.
  EMPTY_ARRAY_KEYS.forEach((k) => localStorage.setItem(k, '[]'))
  EMPTY_OBJECT_KEYS.forEach((k) => localStorage.setItem(k, '{}'))
  localStorage.setItem('corney_monthclose', JSON.stringify({ closed: {} }))
  // Bahan baku: nol-kan terstruktur (hindari undefined di layar Bahan Mentah).
  const mat = {}
  INGREDIENTS.forEach((i) => { mat[i.id] = { sisa: 0, threshold: 0, reorderedAt: null } })
  localStorage.setItem('corney_materials', JSON.stringify(mat))
  REMOVE_KEYS.forEach((k) => localStorage.removeItem(k))
  try { sessionStorage.clear() } catch { /* abaikan */ }
  window.location.reload()
}
