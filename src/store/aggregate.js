// CORNEY — Selektor turunan dari MASTER LAPORAN (satu-satunya sumber kebenaran).
// Semua angka omzet/sisa/laba di layar lain (Agregat, Dashboard, Keuangan) HARUS
// dihitung dari sini, bukan data sendiri. Sumber: salesdaily + usage + expense.
import { getSalesDaily, VARIANTS, CHANNELS, rowTransfer, rowCashAktual, rowCashSistem } from './salesdaily.js'
import { getStockDaily, STOCK_PARENTS, effectiveV } from './stockdaily.js'
import { stockHilang } from './stockdaily.js'
import { usageTotal } from './usage.js'
import { expenseAmount, getExpense } from './expense.js'

// Parse tanggal DD/MM/YYYY → Date (tengah malam lokal).
const ddmmToDate = (tgl) => { const [d, m, y] = (tgl || '').split('/'); return new Date(Number(y), Number(m) - 1, Number(d)) }
// Nama induk ramah untuk tampilan (tile Stok Menipis).
const PARENT_NAME = { mozza: 'Mozza', mix: 'Mix', sosis: 'Sosis', jumbo: 'Sosis Jumbo' }

// Omzet kotor 1 baris = total semua channel (uang masuk, sama dgn kolom Total tab Omzet).
export function rowChannelsTotal(row) { return CHANNELS.reduce((s, [k]) => s + (row.channels?.[k] || 0), 0) }

// Sisa Bersih 1 baris = (Cash Aktual − pakai cash) + (Transfer − pakai transfer).
export function rowSisaBersih(row) {
  const sisaCash = rowCashAktual(row) - usageTotal(row.tgl, row.branchId, 'cash')
  const sisaTransfer = rowTransfer(row) - usageTotal(row.tgl, row.branchId, 'transfer')
  return sisaCash + sisaTransfer
}
// Laba Bersih 1 baris = Sisa Bersih − Uang Belanjaan Supplier.
export function rowLaba(row) { return rowSisaBersih(row) - expenseAmount(row.tgl, row.branchId) }

// Agregat per cabang (semua tanggal di salesdaily). branchId → {omzet, sisaBersih, laba, hari}.
export function aggregateByBranch() {
  const map = {}
  getSalesDaily().forEach((row) => {
    const b = map[row.branchId] || (map[row.branchId] = { branchId: row.branchId, omzet: 0, sisaBersih: 0, laba: 0, hari: 0 })
    b.omzet += rowChannelsTotal(row)
    b.sisaBersih += rowSisaBersih(row)
    b.laba += rowLaba(row)
    b.hari += 1
  })
  return map
}
export function aggregateTotals() {
  return Object.values(aggregateByBranch()).reduce(
    (t, b) => ({ omzet: t.omzet + b.omzet, sisaBersih: t.sisaBersih + b.sisaBersih, laba: t.laba + b.laba }),
    { omzet: 0, sisaBersih: 0, laba: 0 },
  )
}

// Varian terlaris (qty) lintas semua baris → { name, qty } atau null.
export function topVariant() {
  const tot = {}
  getSalesDaily().forEach((row) => VARIANTS.forEach((v) => { tot[v.id] = (tot[v.id] || 0) + (row.variants?.[v.id] || 0) }))
  let best = null
  VARIANTS.forEach((v) => { const q = tot[v.id] || 0; if (!best || q > best.qty) best = { name: v.name, qty: q } })
  return best && best.qty > 0 ? best : null
}
// Varian paling sepi (qty terkecil, tetap > 0 kalau ada penjualan).
export function bottomVariant() {
  const tot = {}
  getSalesDaily().forEach((row) => VARIANTS.forEach((v) => { tot[v.id] = (tot[v.id] || 0) + (row.variants?.[v.id] || 0) }))
  let worst = null
  VARIANTS.forEach((v) => { const q = tot[v.id] || 0; if (worst === null || q < worst.qty) worst = { name: v.name, qty: q } })
  return worst
}

// ── Periode (Laporan Keuangan): 'Hari' (hari ini), 'Minggu' (7 hari terakhir),
//    'Bulan' (bulan kalender berjalan). Filter relatif terhadap hari ini. ──
export function salesInPeriod(period, branchId) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return getSalesDaily().filter((r) => {
    if (branchId && r.branchId !== branchId) return false
    const dt = ddmmToDate(r.tgl)
    if (period === 'Hari') return dt.getTime() === today.getTime()
    if (period === 'Minggu') { const from = new Date(today); from.setDate(today.getDate() - 6); return dt >= from && dt <= today }
    if (period === 'Bulan') return dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear()
    return true // 'all'
  })
}
// Agregat satu periode → angka untuk Laporan Keuangan (semua DARI MASTER LAPORAN).
export function aggregatePeriod(period, branchId) {
  const rows = salesInPeriod(period, branchId)
  const channels = { tunai: 0, qris_midtrans: 0, qris_gopay: 0, gofood: 0, grabfood: 0 }
  const acc = { omzet: 0, trx: 0, urgent: 0, refund: 0, gaji: 0, selisihKas: 0, laba: 0, channels, hari: rows.length }
  rows.forEach((r) => {
    acc.omzet += rowChannelsTotal(r)
    acc.trx += r.trx || 0
    acc.urgent += r.potongan?.urgent || 0
    acc.refund += r.potongan?.refund || 0
    acc.gaji += r.potongan?.gaji || 0
    acc.selisihKas += rowCashAktual(r) - rowCashSistem(r)
    acc.laba += rowLaba(r)
    CHANNELS.forEach(([k]) => { channels[k] += r.channels?.[k] || 0 })
  })
  return acc
}

// Total Uang Belanjaan Supplier untuk satu periode (+cabang opsional). Dipakai
// Bagi Hasil & Tutup Bulan supaya biaya belanja = dari Master Laporan (store expense).
export function expenseInPeriod(period, branchId) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return getExpense().reduce((s, e) => {
    if (branchId && e.branchId !== branchId) return s
    const dt = ddmmToDate(e.tgl)
    let inRange = true
    if (period === 'Hari') inRange = dt.getTime() === today.getTime()
    else if (period === 'Minggu') { const from = new Date(today); from.setDate(today.getDate() - 6); inRange = dt >= from && dt <= today }
    else if (period === 'Bulan') inRange = dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear()
    return inRange ? s + (e.amount || 0) : s
  }, 0)
}

// Stok menipis: baris stok TERBARU per cabang, induk dgn sisa aktual ≤ ambang.
export function lowStockList(threshold = 5) {
  const latest = {}
  getStockDaily().forEach((r) => { const cur = latest[r.branchId]; if (!cur || ddmmToDate(r.tgl) > ddmmToDate(cur.tgl)) latest[r.branchId] = r })
  const out = []
  Object.values(latest).forEach((r) => {
    const ev = effectiveV(r)
    STOCK_PARENTS.forEach(([pk]) => { const a = ev[pk]?.aktual ?? 0; if (a <= threshold) out.push({ name: PARENT_NAME[pk] || pk, qty: a, branchId: r.branchId }) })
  })
  return out.sort((a, b) => a.qty - b.qty)
}

// Sisa Aktual TERBARU per cabang (dari baris stok paling baru di Master Laporan)
// → { mozza, mix, sosis, jumbo, tgl }. Dipakai "Isi Stok ke Par" (kirim = par − sisa).
export function latestSisaByBranch(branchId) {
  let latest = null
  getStockDaily().forEach((r) => { if (r.branchId !== branchId) return; if (!latest || ddmmToDate(r.tgl) >= ddmmToDate(latest.tgl)) latest = r })
  if (!latest) return null
  const out = { tgl: latest.tgl }
  STOCK_PARENTS.forEach(([pk]) => { out[pk] = latest.v?.[pk]?.aktual ?? 0 })
  return out
}

// Jam paling ramai (modus peakHour lintas baris penjualan).
export function peakHour() {
  const count = {}
  getSalesDaily().forEach((r) => { if (r.peakHour) count[r.peakHour] = (count[r.peakHour] || 0) + 1 })
  let best = null
  Object.entries(count).forEach(([h, c]) => { if (!best || c > best.c) best = { h, c } })
  return best ? best.h : null
}

// Jumlah kejanggalan: stok hilang (selisih>0) + hari dgn selisih kas ≠ 0.
export function anomaliCount() {
  const hilang = stockHilang().length
  const kas = getSalesDaily().filter((r) => rowCashAktual(r) - rowCashSistem(r) !== 0).length
  return hilang + kas
}
