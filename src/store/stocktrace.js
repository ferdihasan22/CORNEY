// CORNEY — Pelacakan Stok (rekonsiliasi rantai stok), Fase 2 dummy/local.
// Menyatukan semua titik-cek serah-terima jadi SATU rekonsiliasi per cabang ×
// isian, supaya Owner bisa menunjuk DI TAHAP MANA stok bocor:
//   Produksi → [Freezer] → Operasional kirim → [Transit] → Kasir cabang → Jual.
// Tidak menyimpan apa-apa — murni turunan dari store lain (SoT tetap di sumbernya).
//
// Tiga selisih kunci (Δ) yang melokalisir kehilangan:
//   Δ Opname      = fisik − sistem (freezer)   → bocor di PRODUKSI / FREEZER bila −
//   Δ Kirim≠Terima = diterima − dikirim          → bocor di TRANSIT / OPERASIONAL bila −
//   Δ Hilang Closing = seharusnya − aktual (cabang) → bocor di KASIR bila +
import { PARENT_FILLINGS } from '../data/menu.js'
import { computeParent, effectiveV, STOCK_PARENTS } from './stockdaily.js'

const PARENT_KEYS = PARENT_FILLINGS.map((p) => p.id) // mozza, sosis, jumbo, mix

// "DD/MM/YYYY" → epoch ms (local). Tak valid → 0.
function parseTgl(t) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t || '')
  if (!m) return 0
  return new Date(+m[3], +m[2] - 1, +m[1]).getTime()
}

// Ambang periode: 'today' | '7d' | '30d' | 'all' → epoch ms (0 = tanpa batas).
export function periodCutoff(period) {
  if (period === 'all' || !period) return 0
  const now = new Date()
  if (period === 'today') { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return d.getTime() }
  const days = period === '7d' ? 7 : 30
  return now.getTime() - days * 864e5
}

const inPeriodISO = (iso, cut) => !cut || new Date(iso).getTime() >= cut
const inPeriodTgl = (tgl, cut) => !cut || parseTgl(tgl) >= cut

// Rekonsiliasi penuh. Mengembalikan { branches:[{branchId,branchName,parents:[...],totals}], grand }
// Tiap parent: { parent, name, produksi, susut, kirim, deltaOpname, diterima,
//   deltaTransit, terjual, patah, garansi, free, seharusnya, aktual, deltaClosing,
//   deltaAudit, hilangProduksi, hilangTransit, hilangKasir }
export function traceStock({ production = [], shipments = [], opname = [], stockDaily = [], audits = [], branches = [], period = 'all' }) {
  const cut = periodCutoff(period)

  const out = branches.map((b) => {
    const parents = PARENT_KEYS.map((pk) => {
      const name = PARENT_FILLINGS.find((p) => p.id === pk)?.name || pk

      // 1) PRODUKSI (+ masuk freezer) — branchId cocok (abaikan batch tanpa cabang).
      // susut = total rusak (saat bikin + saat pisah). susutPisah = bagian rusak pada
      // stok yg SUDAH di freezer (fromFreezer) → sisa sudah dikurangi langsung, jadi
      // tetap "wajar" (bukan hilang); dipisah agar bisa di-breakdown & dialarmkan.
      let produksi = 0, susut = 0, susutPisah = 0
      production.forEach((x) => {
        if (x.branchId === b.id && x.parent === pk && inPeriodISO(x.createdAt, cut)) {
          produksi += x.jadi || 0
          susut += x.susut || 0
          if (x.fromFreezer) susutPisah += x.susut || 0
        }
      })

      // 2) KIRIM (− keluar freezer) + Δ Kirim≠Terima (terima − kirim, hanya yg dikonfirmasi).
      let kirim = 0, diterima = 0, deltaTransit = 0, adaKonfirmasi = false
      shipments.forEach((s) => {
        if (s.branchId !== b.id || s.parent !== pk || !inPeriodISO(s.createdAt, cut)) return
        kirim += s.qty || 0
        if (s.status === 'diterima' || s.status === 'selisih') {
          adaKonfirmasi = true
          diterima += (s.qty || 0) + (s.selisih || 0) // selisih = terima − kirim
          deltaTransit += s.selisih || 0
        }
      })

      // 3) Δ OPNAME (fisik − sistem freezer).
      let deltaOpname = 0; let adaOpname = false
      opname.forEach((o) => {
        if (o.branchId !== b.id || !inPeriodISO(o.createdAt, cut)) return
        ;(o.rows || []).forEach((r) => { if (r.parent === pk) { deltaOpname += r.selisih || 0; adaOpname = true } })
      })

      // 4) CABANG — dari stockdaily (SoT harian) via effectiveV + computeParent.
      let terjual = 0, patah = 0, garansi = 0, free = 0, seharusnya = 0, aktual = 0, deltaClosing = 0, adaClosing = false
      stockDaily.forEach((row) => {
        if (row.branchId !== b.id || !inPeriodTgl(row.tgl, cut)) return
        const ev = effectiveV(row)
        const c = ev[pk]; if (!c) return
        const comp = computeParent(c)
        terjual += c.terjual || 0; patah += c.patah || 0; garansi += c.garansi || 0; free += c.free || 0
        seharusnya += comp.seharusnya; aktual += c.aktual || 0; deltaClosing += comp.selisih
        adaClosing = true
      })

      // 5) Δ AUDIT lapangan (riil − sys sisa) — lapis cek silang kasir.
      let deltaAudit = 0; let adaAudit = false
      audits.forEach((a) => {
        if (a.branchId !== b.id || !inPeriodISO(a.createdAt, cut)) return
        ;(a.rows || []).forEach((r) => { if (r.parent === pk) { deltaAudit += (r.riil?.sisa ?? 0) - (r.sys?.sisa ?? 0); adaAudit = true } })
      })

      return {
        parent: pk, name,
        produksi, susut, susutPisah, kirim, diterima,
        deltaOpname, adaOpname, deltaTransit, adaKonfirmasi,
        terjual, patah, garansi, free, seharusnya, aktual, deltaClosing, adaClosing,
        deltaAudit, adaAudit,
        // Kehilangan terlokalisir (selalu ≥ 0; arah "rugi"):
        hilangProduksi: adaOpname && deltaOpname < 0 ? -deltaOpname : 0,
        hilangTransit: adaKonfirmasi && deltaTransit < 0 ? -deltaTransit : 0,
        hilangKasir: (adaClosing && deltaClosing > 0 ? deltaClosing : 0) + (adaAudit && deltaAudit < 0 ? -deltaAudit : 0),
      }
    })

    const totals = parents.reduce((t, p) => ({
      hilangProduksi: t.hilangProduksi + p.hilangProduksi,
      hilangTransit: t.hilangTransit + p.hilangTransit,
      hilangKasir: t.hilangKasir + p.hilangKasir,
      susut: t.susut + p.susut,
      susutPisah: t.susutPisah + p.susutPisah,
      produksi: t.produksi + p.produksi,
    }), { hilangProduksi: 0, hilangTransit: 0, hilangKasir: 0, susut: 0, susutPisah: 0, produksi: 0 })

    return { branchId: b.id, branchName: b.name, parents, totals }
  })

  const grand = out.reduce((g, b) => ({
    hilangProduksi: g.hilangProduksi + b.totals.hilangProduksi,
    hilangTransit: g.hilangTransit + b.totals.hilangTransit,
    hilangKasir: g.hilangKasir + b.totals.hilangKasir,
    susut: g.susut + b.totals.susut,
    susutPisah: g.susutPisah + b.totals.susutPisah,
    produksi: g.produksi + b.totals.produksi,
  }), { hilangProduksi: 0, hilangTransit: 0, hilangKasir: 0, susut: 0, susutPisah: 0, produksi: 0 })

  return { branches: out, grand }
}

// ── CEK KEWAJARAN BELANJA (bukan auto-potong; cuma pembanding informatif) ──
// 1 balok keju → 75..85 pcs mozza (rentang, bukan angka pasti). Sosis 1:1.
// 1 Mix memakai ½ mozza + ½ sosis (jadi terjual Mix ikut "memakai" keduanya).
export const KEJU_YIELD_LO = 75
export const KEJU_YIELD_HI = 85
const RAW_IDS = { keju: ['keju_mozza', 'keju'], sosisReg: ['sosis_reguler', 'sosis_reg'], sosisJumbo: ['sosis_jumbo'] }

// Total bahan baku DIBELI (supplier dipenuhi + beli di luar) dalam periode.
export function boughtRaw({ fulfilled = [], period = 'all', branchId = null }) {
  const cut = periodCutoff(period)
  const sum = { keju: 0, sosisReg: 0, sosisJumbo: 0 }
  fulfilled.forEach((e) => {
    if (branchId && e.branchId !== branchId) return
    if (cut && new Date(e.at || 0).getTime() < cut) return
    ;(e.items || []).forEach((it) => {
      const qty = (it.ready ? (it.qty || 0) : 0) + (it.luar?.qty || 0)
      if (qty <= 0) return
      if (RAW_IDS.keju.includes(it.id)) sum.keju += qty
      else if (RAW_IDS.sosisReg.includes(it.id)) sum.sosisReg += qty
      else if (RAW_IDS.sosisJumbo.includes(it.id)) sum.sosisJumbo += qty
    })
  })
  return sum
}

// Status kewajaran untuk satuan 1:1 (sosis): terjual vs dibeli.
// Catatan: stok lama bisa bikin terpakai > dibeli (wajar) → cuma "janggal" bila jauh.
function wajar1to1(dibeli, terpakai) {
  if (dibeli === 0 && terpakai === 0) return { lbl: 'Belum ada data', cls: 'bg-surface-container text-on-surface-variant', ok: null }
  if (terpakai <= dibeli) return { lbl: 'Wajar', cls: 'bg-green-100 text-green-700', ok: true }
  if (terpakai <= dibeli * 1.15) return { lbl: 'Pas-pasan', cls: 'bg-amber-100 text-amber-700', ok: true }
  return { lbl: 'Janggal', cls: 'bg-error-container text-error', ok: false }
}
// Status untuk keju (rentang yield): mozza terpakai vs kapasitas 75..85 × balok.
function wajarKeju(balok, mozzaTerpakai) {
  if (balok === 0 && mozzaTerpakai === 0) return { lbl: 'Belum ada data', cls: 'bg-surface-container text-on-surface-variant', ok: null }
  const lo = balok * KEJU_YIELD_LO, hi = balok * KEJU_YIELD_HI
  if (mozzaTerpakai <= lo) return { lbl: 'Wajar', cls: 'bg-green-100 text-green-700', ok: true }
  if (mozzaTerpakai <= hi) return { lbl: 'Pas-pasan', cls: 'bg-amber-100 text-amber-700', ok: true }
  return { lbl: 'Janggal', cls: 'bg-error-container text-error', ok: false }
}

// Rekap kewajaran lengkap. terjual = { mozza, sosis, jumbo, mix } (total periode).
export function purchaseCheck({ fulfilled, period, branchId, terjual }) {
  const beli = boughtRaw({ fulfilled, period, branchId })
  const mix = terjual.mix || 0
  const mozzaPakai = (terjual.mozza || 0) + mix * 0.5
  const sosisPakai = (terjual.sosis || 0) + mix * 0.5
  const jumboPakai = terjual.jumbo || 0
  return {
    keju: { dibeli: beli.keju, kapasitasLo: beli.keju * KEJU_YIELD_LO, kapasitasHi: beli.keju * KEJU_YIELD_HI, terpakai: Math.round(mozzaPakai), status: wajarKeju(beli.keju, mozzaPakai) },
    sosisReg: { dibeli: beli.sosisReg, terpakai: Math.round(sosisPakai), status: wajar1to1(beli.sosisReg, sosisPakai) },
    sosisJumbo: { dibeli: beli.sosisJumbo, terpakai: Math.round(jumboPakai), status: wajar1to1(beli.sosisJumbo, jumboPakai) },
    mixTerjual: mix,
  }
}

// Pihak penanggung jawab tahap (untuk verdict & label).
export const STAGES = [
  { key: 'hilangProduksi', label: 'Produksi / Freezer', who: 'Orang Produksi', icon: 'ac_unit', cls: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  { key: 'hilangTransit', label: 'Transit / Operasional', who: 'Operasional', icon: 'local_shipping', cls: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
  { key: 'hilangKasir', label: 'Cabang / Kasir', who: 'Kasir', icon: 'storefront', cls: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
]

// Tahap dengan kehilangan terbesar (untuk "menunjuk jari"). null bila semua 0.
export function biggestLeak(totals) {
  let best = null
  STAGES.forEach((s) => { const v = totals[s.key] || 0; if (v > 0 && (!best || v > best.qty)) best = { ...s, qty: v } })
  return best
}
