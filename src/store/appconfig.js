// CORNEY — Konfigurasi GLOBAL aplikasi (key-value). Satu sumber untuk setelan yang
// berlaku ke SEMUA cabang. Saat ini: nomor WhatsApp tujuan komplain customer.
// DIPERSIST localStorage + sinkron Supabase (tabel app_config). Owner tulis; semua
// baca (customer anon perlu nomor komplain tanpa login).
import { isSupabase } from '../lib/backend.js'

const KEY = 'corney_app_cfg_v1'
const subscribers = new Set()
// Default aman kalau server belum sempat hidrasi (mis. customer baru buka app).
const DEFAULTS = {
  complaint_wa: '6285174200152',
  // Link tombol di landing Customer. Kosongkan ('') → tombol disembunyikan.
  gofood_url: 'https://gofood.co.id',
  grabfood_url: 'https://food.grab.com',
  // Biaya layanan ONLINE (per order). Default OFF agar tak mengubah harga tiba-tiba.
  // Walk-in TIDAK kena. Disimpan sbg string (app_config.value = text).
  service_fee_on: '0',
  service_fee_amount: '1000',
  // Titik mulai "Pelacakan Stok" (ISO). Owner tekan "Bersihkan" → semua selisih
  // SEBELUM tanggal ini disembunyikan (fresh). '' = tampilkan semua (tanpa batas).
  // Tidak menghapus data sumber → laporan keuangan/stok tetap utuh.
  stocktrace_cleared_at: '',
}

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' && !Array.isArray(s) ? { ...DEFAULTS, ...s } : { ...DEFAULTS } }
  catch { return { ...DEFAULTS } }
}
let map = load()
function commit(next) { map = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab: reload saat tab lain menulis.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { map = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./appconfig.remote.js').then(({ initAppConfigSync }) => initAppConfigSync(commit, () => map)).catch(() => {})
}

export function getAppConfig() { return map }
export function subscribeAppConfig(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }
export function appConfigValue(key) { return map[key] ?? DEFAULTS[key] ?? '' }

// Biaya layanan ONLINE efektif: { on, amount }. amount=0 atau on=false → tanpa biaya.
export function serviceFeeOnline() {
  const on = (map.service_fee_on ?? DEFAULTS.service_fee_on) === '1'
  const amount = Math.max(0, Math.round(Number(map.service_fee_amount ?? DEFAULTS.service_fee_amount) || 0))
  return { on: on && amount > 0, amount }
}

// Baseline Pelacakan Stok → epoch ms AWAL HARI tanggal reset (0 = tanpa batas).
// Awal-hari supaya data hari reset tetap terhitung & data harian (closing) tak
// terpotong di tengah hari (hindari celah permanen).
export function stocktraceBaselineMs() {
  const iso = map.stocktrace_cleared_at ?? DEFAULTS.stocktrace_cleared_at
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function setAppConfigField(key, val) {
  const next = { ...map, [key]: val }
  commit(next)
  if (isSupabase()) import('./appconfig.remote.js').then((w) => w.pushAppConfig(key, val)).catch(() => {})
}

// Normalisasi nomor WA Indonesia → format internasional tanpa simbol (62xxxxxxxxxx).
// Terima "0851-7420-0152", "62 851...", "+62851...", dll.
export function normalizeWa(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('620')) d = '62' + d.slice(3)
  else if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d && !d.startsWith('62')) d = '62' + d
  return d
}
