// CORNEY — Reset terpusat.
//  • resetGoLive(): bersihkan SEMUA data contoh & transaksi sebelum usaha live,
//    supaya laporan mulai dari NOL. Menulis nilai kosong yang VALID (bukan hapus
//    key) agar seed() dummy TIDAK muncul lagi. KONFIG dipertahankan (cabang, user,
//    menu, item belanja, takaran bahan) — owner edit lewat layarnya masing-masing.
//  Dipakai sekali saat onboarding. Setelah tulis, halaman di-reload agar semua
//  store re-init dari keadaan bersih.
import { INGREDIENTS } from '../data/menu.js'

// Store transaksi/laporan (array) → dikosongkan jadi [].
const EMPTY_ARRAY_KEYS = [
  'corney_salesdaily_v4', 'corney_stockdaily_v3', 'corney_expense_v2', 'corney_usage_v2', 'corney_deposits_v4',
  'corney_production', 'corney_shipments', 'corney_opname', 'corney_freezer_corrections_v1', 'corney_audits',
  'corney_orders', 'corney_supplier_req_v2', 'corney_supplier_fulfilled_v1', 'corney_ledger', 'corney_auditlog',
]
// Store map (object) → dikosongkan jadi {}.
const EMPTY_OBJECT_KEYS = [
  'corney_opsbelanja_v2', 'corney_supplier_prices_v2', 'corney_freezer', 'corney_investor_cfg_v1', 'corney_parstock',
]
// Store sesi → dihapus (tidak ada hari/keranjang aktif saat mulai).
const REMOVE_KEYS = ['corney_day', 'corney_cart']

export function resetGoLive() {
  if (typeof window === 'undefined') return
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
