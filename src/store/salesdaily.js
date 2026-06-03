// CORNEY — Penjualan harian per cabang (SUMBER KEBENARAN level VARIAN).
// Karena beberapa varian berbagi STOK INDUK yang sama tapi beda harga, qty
// terjual dicatat per-varian. Dari sini diturunkan: (a) stok induk terjual,
// (b) omzet (qty×harga). Omzet juga dirinci per metode bayar + online/walk-in.
// Fase 2 dummy; TAHAP 4 terisi otomatis dari closing kasir tiap cabang.
//
// Row: { id, tgl, branchId, variants: {menuId: qty}, channels: {tunai,qris_midtrans,
//        qris_gopay,gofood,grabfood}, source: {walkin, online},
//        potongan: {urgent, refund, gaji}, kasAktual }  // potongan = kas keluar laci;
//        kasAktual = uang tunai yg BENAR2 dihitung kasir di laci (sudah net potongan).
//        → Cash Bersih (Sistem) = tunai − urgent − refund − gaji; (Aktual) = kasAktual.
//        → Omzet Bersih (uang riil) = Cash Aktual + transfer (semua non-tunai).
//        trx = jumlah transaksi; peakHour = jam paling ramai (Laporan Keuangan + Dashboard).
import { MENUS } from '../data/menu.js'

const KEY = 'corney_salesdaily_v4' // v4: checklist belanja kini { item: jumlah }
const subscribers = new Set()

// Varian yang dilaporkan (11 menu). label pendek untuk header.
export const VARIANTS = MENUS.map((m) => ({ id: m.id, name: m.name, parent: m.parent, price: m.price }))
export const CHANNELS = [
  ['tunai', 'Tunai'], ['qris_midtrans', 'QRIS Midtrans'], ['qris_gopay', 'QRIS GoPay'], ['gofood', 'GoFood'], ['grabfood', 'GrabFood'],
]

function seed() {
  // qty varian dibuat konsisten dgn stok induk terjual di stockdaily (rollup).
  // trx = jumlah transaksi; peakHour = jam paling ramai (dipakai Laporan Keuangan
  // & tile Dashboard — semua derive dari sini, sumber kebenaran tunggal).
  // Baris Juni 2026 = periode berjalan (hari ini 02/06) agar Hari/Minggu/Bulan terisi.
  return [
    // ── SEMUA satu bulan (Juni 2026). Hari ini 02/06 → bulan ini baru 01 & 02. ──
    { id: 'SD-5', tgl: '02/06/2026', branchId: 'sepinggan',
      variants: { sweet_coklat: 6, sweet_tiramisu: 4, sweet_greentea: 3, mozza_ori: 13, mozza_kentang: 6, sosis_ori: 15, sosis_kentang: 8, jumbo_ori: 9, jumbo_kentang: 5, mix_ori: 9, mix_kentang: 5 },
      channels: { tunai: 620000, qris_midtrans: 260000, qris_gopay: 125000, gofood: 185000, grabfood: 92000 }, source: { walkin: 880000, online: 402000 }, potongan: { urgent: 45000, refund: 0, gaji: 100000 }, kasAktual: 470000, trx: 80, peakHour: '18:00–20:00', sauces: { tomat: 18, sambal: 10, keju: 6, mayo: 4 }, belanja: { glaze_coklat: 1, kentang: 2, saus_tomat: 1 } },
    { id: 'SD-6', tgl: '02/06/2026', branchId: 'gunungsari',
      variants: { sweet_coklat: 4, sweet_tiramisu: 3, sweet_greentea: 2, mozza_ori: 9, mozza_kentang: 6, sosis_ori: 11, sosis_kentang: 7, jumbo_ori: 7, jumbo_kentang: 5, mix_ori: 8, mix_kentang: 5 },
      channels: { tunai: 440000, qris_midtrans: 185000, qris_gopay: 92000, gofood: 122000, grabfood: 61000 }, source: { walkin: 610000, online: 290000 }, potongan: { urgent: 30000, refund: 10000, gaji: 80000 }, kasAktual: 320000, trx: 62, peakHour: '12:00–13:00', sauces: { tomat: 14, sambal: 8, keju: 4, mayo: 3 }, belanja: { saus_tomat: 1 } },
    { id: 'SD-7', tgl: '01/06/2026', branchId: 'sepinggan',
      variants: { sweet_coklat: 5, sweet_tiramisu: 4, sweet_greentea: 3, mozza_ori: 12, mozza_kentang: 6, sosis_ori: 14, sosis_kentang: 8, jumbo_ori: 9, jumbo_kentang: 5, mix_ori: 9, mix_kentang: 5 },
      channels: { tunai: 600000, qris_midtrans: 250000, qris_gopay: 120000, gofood: 180000, grabfood: 90000 }, source: { walkin: 850000, online: 390000 }, potongan: { urgent: 50000, refund: 0, gaji: 100000 }, kasAktual: 450000, trx: 77, peakHour: '19:00–21:00', sauces: { tomat: 16, sambal: 9, keju: 5, mayo: 3 }, belanja: { glaze_coklat: 1, saus_sambal: 1 } },
    { id: 'SD-8', tgl: '01/06/2026', branchId: 'gunungsari',
      variants: { sweet_coklat: 4, sweet_tiramisu: 3, sweet_greentea: 2, mozza_ori: 9, mozza_kentang: 5, sosis_ori: 11, sosis_kentang: 7, jumbo_ori: 7, jumbo_kentang: 4, mix_ori: 8, mix_kentang: 5 },
      channels: { tunai: 420000, qris_midtrans: 175000, qris_gopay: 88000, gofood: 118000, grabfood: 58000 }, source: { walkin: 590000, online: 269000 }, potongan: { urgent: 25000, refund: 0, gaji: 80000 }, kasAktual: 310000, trx: 59, peakHour: '18:00–20:00', sauces: { tomat: 12, sambal: 7, keju: 3, mayo: 2 }, belanja: { kentang: 1 } },
  ]
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : seed() } catch { return seed() } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

export function getSalesDaily() { return list }
export function subscribeSalesDaily(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function updateSalesRow(id, patch) {
  commit(list.map((r) => (r.id === id ? { ...r, ...patch } : r)))
}

// Omzet baris = Σ qty×harga varian (diturunkan dari varian = 1 sumber).
export function rowOmzet(row) {
  return VARIANTS.reduce((s, v) => s + (row.variants[v.id] || 0) * v.price, 0)
}
// Transfer (Saldo ATM) = semua non-tunai digabung (QRIS Midtrans/GoPay + GoFood/Grab,
// termasuk pembayaran online — semuanya masuk rekening, bukan kas laci).
export function rowTransfer(row) {
  return CHANNELS.reduce((s, [k]) => (k === 'tunai' ? s : s + (row.channels?.[k] || 0)), 0)
}
// Cash Bersih (SISTEM/seharusnya) = tunai tercatat POS − urgent − refund − gaji.
export function rowCashSistem(row) {
  const p = row.potongan || {}
  return (row.channels?.tunai || 0) - (p.urgent || 0) - (p.refund || 0) - (p.gaji || 0)
}
// Cash Bersih (AKTUAL) = uang tunai yang benar-benar dihitung kasir di laci saat
// closing (sudah net potongan). Fallback ke Sistem bila belum ada hitungan fisik.
export function rowCashAktual(row) {
  return row.kasAktual != null ? row.kasAktual : rowCashSistem(row)
}
// Omzet Bersih (uang riil) = Cash Aktual + Transfer.
export function rowOmzetBersih(row) {
  return rowCashAktual(row) + rowTransfer(row)
}
// Total qty terjual per induk (rollup varian → stok induk).
export function terjualPerParent(row) {
  const out = {}
  VARIANTS.forEach((v) => { out[v.parent] = (out[v.parent] || 0) + (row.variants[v.id] || 0) })
  return out
}

export function hasSalesDay(tgl, branchId) { return list.some((r) => r.tgl === tgl && r.branchId === branchId) }

// Reset (bulan baru) — kosongkan semua baris penjualan. Persist [] supaya TIDAK
// kembali ke seed (load() menerima array kosong sebagai data sah).
export function clearSalesDaily() { commit([]) }

// Tulis/timpa baris penjualan untuk satu tanggal+cabang (dipanggil saat closing kasir).
export function upsertSalesDay({ tgl, branchId, variants, channels, source, potongan, kasAktual, trx, peakHour, sauces, belanja }) {
  const ex = list.find((r) => r.tgl === tgl && r.branchId === branchId)
  const extra = { variants, channels, source, potongan, kasAktual, trx, peakHour, sauces, belanja }
  if (ex) commit(list.map((r) => (r === ex ? { ...r, ...extra } : r)))
  else commit([{ id: 'SD-' + Date.now(), tgl, branchId, ...extra }, ...list])
}

// Owner ganti tanggal → baris varian ikut pindah tanggal (tetap sinkron dgn stok).
export function setSalesDate(oldTgl, branchId, newTgl) {
  commit(list.map((r) => (r.tgl === oldTgl && r.branchId === branchId ? { ...r, tgl: newTgl } : r)))
}
