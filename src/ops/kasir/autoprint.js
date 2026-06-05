// CORNEY — Auto-cetak struk + antrean tahan-gagal.
//
// Dipakai saat: (a) walk-in LUNAS (commitSale), (b) order online baru masuk.
// Bila printer TAK TERHUBUNG saat cetak → struk masuk ANTREAN (persisten di
// localStorage, tahan app ditutup), banner peringatan muncul, dan struk
// di-cetak-ulang OTOMATIS begitu printer tersambung lagi.
//
// Batas jujur: "kertas habis" saat printer menyala TIDAK bisa dideteksi (printer
// Bluetooth murah tak melaporkan status kertas). Mitigasi = antrean + cetak ulang
// manual yang selalu tersedia + kasir cek fisik.
import { MENUS } from '../../data/menu.js'
import { btConnected, btPrintReceipt, isPrinterConfigured } from './btprinter.js'

const KEY = 'corney_print_pending'
const subs = new Set()
let pending = load()

function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : [] } catch { return [] } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(pending)) } catch { /* noop */ } subs.forEach((f) => f()) }

export function subscribePending(fn) { subs.add(fn); return () => subs.delete(fn) }
export function pendingCount() { return pending.length }

function enqueue(sale, branch) {
  // Hindari duplikat id; batasi 30 entri terakhir.
  if (pending.some((p) => p.sale?.id === sale.id)) return
  pending = [...pending, { sale, branch, at: Date.now() }].slice(-30)
  save()
}

// Cetak struk; bila gagal/tak terhubung → antre. Bila TAK ADA printer di-set
// sama sekali → diam (jangan ganggu kasir yang memang tak pakai printer).
export async function autoPrint(sale, branch) {
  if (!sale) return false
  if (!btConnected() && !isPrinterConfigured()) return false
  if (btConnected()) {
    try { await btPrintReceipt(sale, branch, MENUS, false); return true } catch { /* → antre */ }
  }
  enqueue(sale, branch)
  return false
}

// Coba cetak semua yang tertunda (dipanggil saat printer connect / tombol manual).
export async function retryPending() {
  if (!btConnected() || pending.length === 0) return
  const items = [...pending]
  const sisa = []
  for (const it of items) {
    try { await btPrintReceipt(it.sale, it.branch, MENUS, false) }
    catch { sisa.push(it) }
  }
  pending = sisa
  save()
}

export function clearPending() { pending = []; save() }

// Map order online → bentuk `sale` untuk buildReceipt (lines shape-nya sama).
export function orderToSale(order) {
  return {
    id: 'ONLINE #' + (order.no ?? order.id),
    ts: order.createdAt || new Date().toISOString(),
    lines: order.lines || [],
    subtotal: order.subtotal ?? order.total ?? 0,
    biaya: 0,
    total: order.total ?? 0,
    paid: !!order.paid,
    method: 'qris_midtrans',
    cashReceived: null,
    change: null,
  }
}
