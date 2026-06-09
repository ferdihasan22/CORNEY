import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { logAudit } from '../../store/auditlog.js'
import { useStockDaily } from '../../store/useStockDaily.js'
import { computeParent as compute, updateStockRow, updateStockDate, effectiveV, STOCK_PARENTS, clearStockDaily } from '../../store/stockdaily.js'

const ddmmToISO = (s) => { const [d, m, y] = (s || '').split('/'); return y ? `${y}-${m}-${d}` : '' }
const isoToDDMM = (iso) => { const [y, m, d] = (iso || '').split('-'); return d ? `${d}/${m}/${y}` : '' }
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { VARIANTS, CHANNELS, rowOmzet, rowTransfer, rowCashSistem, rowCashAktual, updateSalesRow, clearSalesDaily } from '../../store/salesdaily.js'
import { clearDeposits } from '../../store/deposits.js'
import { useUsage } from '../../store/useUsage.js'
import { addUsage, removeUsage, usageTotal, usageList, clearUsage } from '../../store/usage.js'
import { useExpense } from '../../store/useExpense.js'
import { setExpense, expenseAmount, clearExpense } from '../../store/expense.js'
import { useDeposits } from '../../store/useDeposits.js'

// 3.4 — Laporan Stok Harian (Owner). Format lebar seperti spreadsheet operasional.
// Per induk (Mozza/Mix/Sosis/Sosis Jumbo). Rumus:
//   Sisa Seharusnya = (Datang + Sisa Kemarin) − Terjual − Patah − Garansi − Free
//   Selisih (Hilang) = Sisa Seharusnya − Sisa Aktual  (>0 = hilang, perlu dicek)
// Fase 1: data contoh; agregat nyata dari closing harian per cabang = TAHAP 4.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

// 4 isian induk + label pendek untuk header sub-kolom (dari store: 1 sumber).
const PARENTS = STOCK_PARENTS

// Kolom-kolom (urutan = referensi + tambahan Garansi & Selisih).
const GROUPS = [
  { key: 'datang', label: 'Datang Hari Ini', cls: 'bg-on-surface text-surface' },
  { key: 'kemarin', label: 'Sisa Kemarin', cls: 'bg-amber-500 text-white' },
  { key: 'terjual', label: 'Terjual', cls: 'bg-surface-container-high text-on-surface' },
  { key: 'patah', label: 'Patah', cls: 'bg-secondary-container text-on-secondary-container' },
  { key: 'garansi', label: 'Garansi', cls: 'bg-blue-100 text-blue-800' },
  { key: 'free', label: 'Free (Promo)', cls: 'bg-green-100 text-green-800' },
  { key: 'seharusnya', label: 'Sisa Seharusnya', cls: 'bg-yellow-200 text-yellow-900', computed: true },
  { key: 'aktual', label: 'Sisa Aktual', cls: 'bg-error-container text-on-error-container' },
  { key: 'selisih', label: 'Selisih (Hilang)', cls: 'bg-error text-on-error', computed: true, flag: true },
]

// Data contoh: tiap baris = 1 cabang × 1 tanggal. Per induk: input dasar
// {datang,kemarin,terjual,patah,garansi,free,aktual}. Seharusnya & selisih dihitung.
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name || id || ''

// "Terjual" TIDAK diedit di sini — diturunkan dari tab Variant Terjual (sinkron).
const EDIT_FIELDS = [['datang', 'Datang'], ['kemarin', 'Sisa Kemarin'], ['patah', 'Patah'], ['garansi', 'Garansi'], ['free', 'Free'], ['aktual', 'Sisa Aktual']]

// Panel pakai uang (1 jenis: cash / transfer). Tampilkan sisa, daftar entri,
// dan form tambah. Re-render ikut parent (parent subscribe useUsage).
function UsePanel({ jenis, label, icon, tone, available, tgl, branchId }) {
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const items = usageList(tgl, branchId, jenis)
  const dipakai = items.reduce((s, u) => s + u.amount, 0)
  const sisa = available - dipakai
  const tooMuch = amount > sisa
  const tones = {
    amber: { head: 'text-amber-800', chip: 'bg-amber-100 text-amber-900', btn: 'border-amber-500 text-amber-700 hover:bg-amber-50', sisa: sisa < 0 ? 'text-error' : 'text-amber-700' },
    blue: { head: 'text-blue-800', chip: 'bg-blue-100 text-blue-900', btn: 'border-blue-500 text-blue-700 hover:bg-blue-50', sisa: sisa < 0 ? 'text-error' : 'text-blue-700' },
  }[tone]
  const add = () => { if (amount <= 0) return; addUsage({ tgl, branchId, jenis, amount, note }); setAmount(0); setNote('') }
  return (
    <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-label-lg flex items-center gap-2 ${tones.head}`}><Icon name={icon} /> {label}</h3>
        <div className="text-right">
          <p className="text-[11px] text-on-surface-variant uppercase">Sisa sekarang</p>
          <p className={`font-headline-md ${tones.sisa}`}>{fmtRp(sisa)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant mb-3">
        <span className={`px-2 py-0.5 rounded-full ${tones.chip}`}>Uang masuk {fmtRp(available)}</span>
        <span className="px-2 py-0.5 rounded-full bg-surface-container">Sudah dipakai {fmtRp(dipakai)}</span>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2 mb-3">
          {items.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-white rounded-lg border border-outline-variant/50 px-3 py-2">
              <div className="min-w-0">
                <p className="font-bold text-on-surface text-body-md">{fmtRp(u.amount)}</p>
                <p className="text-label-md text-on-surface-variant truncate">{u.note || 'tanpa catatan'}{u.time ? ` · ${u.time}` : ''}</p>
              </div>
              <button onClick={() => removeUsage(u.id)} className="text-error hover:bg-error/10 p-2 rounded-full shrink-0"><Icon name="delete" className="!text-[18px]" /></button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-label-md text-on-surface-variant italic mb-3">Belum ada pemakaian.</p>
      )}

      <div className="space-y-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">Rp</span>
          <input type="text" inputMode="numeric" value={amount ? amount.toLocaleString('id-ID') : ''} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="Jumlah dipakai" className={`w-full h-11 pl-10 pr-4 rounded-lg border outline-none font-bold ${tooMuch ? 'border-error focus:ring-2 focus:ring-error/30' : 'border-outline focus:ring-2 focus:ring-primary/30'}`} />
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Untuk apa? (mis. beli gas, bayar listrik)" className="w-full h-11 px-4 rounded-lg border border-outline focus:ring-2 focus:ring-primary/30 outline-none" />
        {tooMuch && <p className="text-label-md text-error flex items-center gap-1"><Icon name="warning" className="!text-[16px]" /> Lebih besar dari sisa uang ({fmtRp(sisa)}). Boleh tetap dicatat (sisa jadi minus).</p>}
        <button onClick={add} disabled={amount <= 0} className={`w-full h-11 rounded-xl border-2 font-label-lg flex items-center justify-center gap-2 disabled:opacity-40 ${tones.btn}`}><Icon name="add" /> Catat pemakaian</button>
      </div>
    </section>
  )
}

export default function OwnerStockReport() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [tab, setTab] = useState('stok') // 'stok' | 'variant' | 'omzet'
  const data = useStockDaily() || [] // SATU SUMBER KEBENARAN (stok induk)
  const sales = useSalesDaily() || [] // sumber penjualan: varian + omzet
  useUsage() // langganan pemakaian uang → re-render saat berubah
  useExpense() // langganan uang belanjaan → re-render saat berubah
  const deposits = useDeposits() || [] // rantai setoran: kasir → operasional → auditor
  const [edit, setEdit] = useState(null) // { id, tgl, branchId, draft, reason }
  const [useRow, setUseRow] = useState(null) // { tgl, branchId, cashBersih, transfer } — modal pakai uang
  const [editAktual, setEditAktual] = useState(null) // { id, tgl, branchId, old, sistem, val, reason }
  const [resetOpen, setResetOpen] = useState(false) // modal konfirmasi reset bulan baru

  // Reset SEMUA data Master Laporan (untuk mulai bulan baru). Config (cabang, menu,
  // stok standar) TIDAK ikut. Ber-audit. Pakai SETELAH di-PDF arsip.
  const doReset = () => {
    clearSalesDaily(); clearStockDaily(); clearUsage(); clearExpense(); clearDeposits()
    logAudit({ type: 'Reset', who: 'Owner', branchId: 'all', oldVal: 'Data Master Laporan', newVal: 'DIKOSONGKAN untuk bulan baru', note: 'Reset bulanan oleh Owner (penjualan, stok, pemakaian, belanja, setoran).' })
    setResetOpen(false)
  }

  const rows = data.filter((r) => filter === 'all' || r.branchId === filter)
  const salesRows = sales.filter((r) => filter === 'all' || r.branchId === filter)

  // Detail spesifik yang hilang (selisih > 0).
  const hilangList = []
  rows.forEach((r) => { const ev = effectiveV(r); PARENTS.forEach(([pk, pl]) => { const s = compute(ev[pk]).selisih; if (s > 0) hilangList.push({ rowId: r.id, pk, tgl: r.tgl, branch: branchName(r.branchId).replace('CORNEY ', ''), parent: pl, qty: s }) }) })
  // Klik chip → scroll ke sel Selisih-nya di tabel + kedip merah (tunjuk lokasi).
  const flashHilang = (rowId, pk) => {
    const el = document.getElementById(`hil-${rowId}-${pk}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    el.classList.remove('flash-hilang'); void el.offsetWidth; el.classList.add('flash-hilang')
    setTimeout(() => el.classList.remove('flash-hilang'), 1700)
  }
  const totalHilang = hilangList.reduce((s, h) => s + h.qty, 0)

  // terjual diambil dari Variant Terjual (sinkron) lewat effectiveV.
  const cellVal = (row, group, pkey) => compute(effectiveV(row)[pkey])[group.key] ?? 0

  const openEdit = (r) => setEdit({ id: r.id, tgl: r.tgl, tglISO: ddmmToISO(r.tgl), branchId: r.branchId, draft: JSON.parse(JSON.stringify(r.v)), reason: '' })
  const setF = (pk, field, val) => setEdit((e) => ({ ...e, draft: { ...e.draft, [pk]: { ...e.draft[pk], [field]: Math.max(0, Number(String(val).replace(/\D/g, '')) || 0) } } }))
  const saveEdit = () => {
    if (!edit.reason.trim()) return
    const newTgl = isoToDDMM(edit.tglISO)
    // Ganti tanggal dulu (Variant Terjual ikut pindah tanggal) bila berubah.
    if (newTgl && newTgl !== edit.tgl) updateStockDate(edit.id, newTgl)
    updateStockRow(edit.id, edit.draft) // tulis ke SUMBER KEBENARAN → semua report ikut
    logAudit({ type: 'Stok', who: 'Owner', branchId: edit.branchId, oldVal: `Laporan stok ${edit.tgl}`, newVal: newTgl !== edit.tgl ? `koreksi + tanggal → ${newTgl}` : 'koreksi angka oleh Owner', note: edit.reason.trim() })
    setEdit(null)
  }

  // Owner koreksi uang AKTUAL (fisik kasir) — mis. besoknya kasir ganti uang yang
  // kurang. Sisa Cash & Sisa Bersih ikut terupdate (keduanya dari Aktual). Ber-audit.
  const saveAktual = () => {
    if (!editAktual.reason.trim()) return
    updateSalesRow(editAktual.id, { kasAktual: editAktual.val })
    logAudit({ type: 'Uang Aktual', who: 'Owner', branchId: editAktual.branchId, oldVal: `Aktual ${fmtRp(editAktual.old)} (tgl ${editAktual.tgl})`, newVal: `Aktual → ${fmtRp(editAktual.val)}`, note: editAktual.reason.trim() })
    setEditAktual(null)
  }

  // Status verifikasi rantai uang (Kasir→Operasional→Auditor) untuk satu baris.
  const verifOf = (row) => {
    const d = deposits.find((x) => x.branchId === row.branchId && x.tgl === row.tgl)
    if (!d) return { dot: 'bg-outline/50', text: 'Belum setor', full: 'Belum ada setoran (belum closing/diteruskan)' }
    const opsDone = d.status !== 'menunggu'
    const auditDone = !!d.auditorStatus
    const opsSelisih = d.status === 'selisih'
    const audSelisih = d.auditorStatus === 'selisih'
    if (!opsDone) return { dot: 'bg-amber-500', text: 'Tunggu Operasional', full: 'Kasir ✓ · Operasional belum konfirmasi' }
    if (!auditDone) return { dot: 'bg-amber-500', text: 'Tunggu Auditor', full: opsSelisih ? `Operasional selisih ${d.selisih > 0 ? '+' : ''}${fmtRp(d.selisih)} · Auditor belum verifikasi` : 'Kasir ✓ · Operasional ✓ · Auditor belum verifikasi' }
    // Semua tahap selesai — tapi cek apakah ada selisih di salah satu leg.
    if (opsSelisih || audSelisih) {
      const parts = []
      if (opsSelisih) parts.push(`Operasional ${d.selisih > 0 ? '+' : ''}${fmtRp(d.selisih)}`)
      if (audSelisih) parts.push(`Auditor ${d.auditorSelisih > 0 ? '+' : ''}${fmtRp(d.auditorSelisih)}`)
      return { dot: 'bg-error', text: 'Ada selisih', full: 'Selesai tapi ada beda — ' + parts.join(' · ') }
    }
    return { dot: 'bg-green-500', text: 'Terverifikasi', full: 'Kasir ✓ · Operasional ✓ · Auditor ✓ (semua cocok)' }
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">MASTER LAPORAN</h1>
      </header>

      <main className="flex-1 w-full p-4 sm:p-6 max-w-[1400px] mx-auto">
        {/* Filter per cabang */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-label-md text-on-surface-variant flex items-center gap-1.5 mr-1"><Icon name="storefront" className="!text-[18px] text-primary" /> Cabang:</span>
          {[['all', 'Semua'], ...BRANCHES.map((b) => [b.id, b.name.replace('CORNEY ', '')])].map(([id, lbl]) => (
            <button key={id} onClick={() => setFilter(id)} className={`px-4 py-1.5 rounded-full font-label-md transition-all ${filter === id ? 'bg-secondary-container text-on-secondary-container shadow-sm' : 'border border-outline-variant text-on-surface-variant'}`}>{lbl}</button>
          ))}
        </div>

        {/* Tab: Stok Isian / Variant Terjual / Omzet */}
        <div className="flex gap-2 mb-4 border-b border-outline-variant">
          {[['stok', 'Stok Isian'], ['variant', 'Variant Terjual'], ['omzet', 'Omzet'], ['bersih', 'Omzet Bersih'], ['laba', 'Laba Bersih'], ['data', 'Data Laporan']].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 pb-2 font-label-lg transition-all border-b-2 ${tab === k ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}>{lbl}</button>
          ))}
        </div>

        {tab === 'stok' && (<>
        {/* Rumus + ringkasan */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-on-surface-variant">
            <Icon name="functions" className="text-primary shrink-0" />
            <div className="text-label-md leading-snug">
              <p><b className="text-on-surface">Sisa Seharusnya</b> = (Datang + Sisa Kemarin) − Terjual − Patah − Garansi − Free. <b className="text-on-surface">Selisih</b> = Seharusnya − Sisa Aktual.</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-error/20 border border-error inline-block" /> <b className="text-error">Angka merah ({'>'} 0)</b> = stok <b>HILANG</b> (fisik kurang dari seharusnya, perlu dicek).</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-500 inline-block" /> <b className="text-green-700">0</b> = pas/cocok.</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-500 inline-block" /> <b className="text-amber-700">Angka minus (−1 dst)</b> = stok <b>LEBIH</b> (fisik lebih banyak dari seharusnya — biasanya salah input terjual/patah/sisa).</span>
              </div>
            </div>
          </div>
          <div className={`shrink-0 px-4 py-2 rounded-xl text-center ${totalHilang > 0 ? 'bg-error-container text-on-error-container' : 'bg-green-100 text-green-700'}`}>
            <p className="text-[11px] uppercase">Total Hilang (tampil)</p>
            <p className="font-headline-md">{totalHilang} porsi</p>
          </div>
        </div>

        {/* Detail spesifik yang hilang */}
        {hilangList.length > 0 && (
          <div className="bg-error-container/40 border border-error/30 rounded-2xl p-4 mb-4">
            <p className="font-label-lg text-on-error-container flex items-center gap-2 mb-2"><Icon name="warning" fill className="text-error" /> Stok hilang (perlu dicek):</p>
            <div className="flex flex-wrap gap-2">
              {hilangList.map((h, i) => (
                <button key={i} onClick={() => flashHilang(h.rowId, h.pk)} title="Lihat di tabel" className="bg-surface-container-lowest border border-error/30 rounded-lg px-3 py-1.5 text-label-md hover:bg-error-container/30 active:scale-95 transition-all flex items-center gap-1"><b className="text-primary">{h.branch}</b> · {h.tgl} · {h.parent} <b className="text-error">{h.qty} porsi</b> <Icon name="my_location" className="!text-[15px] text-error" /></button>
              ))}
            </div>
          </div>
        )}

        {/* Tabel lebar — scroll horizontal */}
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
          <table className="text-[11px] border-collapse min-w-max">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 z-20 bg-primary text-on-primary px-3 py-2 text-left border-r border-white/20">Tanggal</th>
                <th rowSpan={2} className="sticky left-[78px] z-20 bg-primary text-on-primary px-3 py-2 text-left border-r border-white/20">Cabang</th>
                {GROUPS.map((g) => <th key={g.key} colSpan={4} className={`${g.cls} px-2 py-1.5 text-center border-l border-white/30 font-bold uppercase tracking-wide whitespace-nowrap`}>{g.label}</th>)}
                <th rowSpan={2} className="bg-primary text-on-primary px-3 py-2 text-center border-l border-white/30">Aksi</th>
              </tr>
              <tr>
                {GROUPS.map((g) => PARENTS.map(([pk, plabel]) => (
                  <th key={g.key + pk} className={`${g.cls} px-2 py-1 text-center border-l border-white/20 opacity-90`}>{plabel}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                  <td className={`sticky left-0 z-10 ${ri % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'} px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40`}>{row.tgl}</td>
                  <td className={`sticky left-[78px] z-10 ${ri % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'} px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40 text-primary`}>{branchName(row.branchId).replace('CORNEY ', '')}</td>
                  {GROUPS.map((g) => PARENTS.map(([pk]) => {
                    const v = cellVal(row, g, pk)
                    let cls = g.computed ? 'font-bold' : ''
                    let label = v
                    if (g.flag) {
                      if (v > 0) { cls = 'bg-error/10 text-error font-bold'; label = `${v} hilang` }
                      else if (v < 0) { cls = 'bg-amber-100 text-amber-700 font-bold'; label = `${v} lebih` }
                      else { cls = 'text-green-600 font-bold'; label = 'pas' }
                    }
                    return (
                      <td key={g.key + pk} id={g.flag ? `hil-${row.id}-${pk}` : undefined} className={`px-2 py-2 text-center border-l border-outline-variant/20 tabular-nums whitespace-nowrap ${cls}`}>{label}</td>
                    )
                  }))}
                  <td className="px-2 py-2 text-center border-l border-outline-variant/20">
                    <button onClick={() => openEdit(row)} className="text-primary hover:bg-primary/10 rounded-lg px-2 py-1 inline-flex items-center gap-1 font-bold"><Icon name="edit" className="!text-[16px]" /> Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>)}

        {/* TAB: Variant Terjual — qty per varian (sumber rollup ke stok induk & omzet) */}
        {tab === 'variant' && (
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            <table className="text-[11px] border-collapse min-w-max">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="sticky left-0 z-10 bg-primary px-3 py-2 text-left border-r border-white/20">Tanggal</th>
                  <th className="sticky left-[78px] z-10 bg-primary px-3 py-2 text-left border-r border-white/20">Cabang</th>
                  {VARIANTS.map((v) => <th key={v.id} className="px-2 py-2 text-center border-l border-white/20 whitespace-nowrap">{v.name}<br /><span className="opacity-70 font-normal">{fmtRp(v.price)}</span></th>)}
                  <th className="px-3 py-2 text-center border-l border-white/30 bg-secondary-container text-on-secondary-container">Total Qty</th>
                  <th className="px-3 py-2 text-center border-l border-white/30 bg-yellow-200 text-yellow-900">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((row, ri) => {
                  const totQty = VARIANTS.reduce((s, v) => s + (row.variants[v.id] || 0), 0)
                  return (
                    <tr key={row.id} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                      <td className={`sticky left-0 z-10 ${ri % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'} px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40`}>{row.tgl}</td>
                      <td className={`sticky left-[78px] z-10 ${ri % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'} px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40 text-primary`}>{branchName(row.branchId).replace('CORNEY ', '')}</td>
                      {VARIANTS.map((v) => <td key={v.id} className="px-2 py-2 text-center border-l border-outline-variant/20 tabular-nums">{row.variants[v.id] || 0}</td>)}
                      <td className="px-3 py-2 text-center border-l border-outline-variant/30 font-bold bg-secondary-container/30">{totQty}</td>
                      <td className="px-3 py-2 text-center border-l border-outline-variant/30 font-bold text-primary whitespace-nowrap">{fmtRp(rowOmzet(row))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB: Omzet — rincian metode bayar + online/walk-in */}
        {tab === 'omzet' && (<>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-2 text-amber-900">
            <Icon name="info" className="shrink-0" />
            <p className="text-label-md leading-snug">Ini <b>omzet KOTOR</b> (nilai penjualan, semua metode bayar). <b>Uang urgent & gaji karyawan tidak</b> mengurangi omzet — itu biaya (memengaruhi <b>Laba</b> di Bagi Hasil & <b>Setoran Tunai</b> di closing). Untuk uang yang benar-benar disetor → lihat closing kasir; untuk laba bersih → menu Bagi Hasil Investor.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            <table className="text-[12px] border-collapse min-w-max w-full">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="px-3 py-2 text-left border-r border-white/20">Tanggal</th>
                  <th className="px-3 py-2 text-left border-r border-white/20">Cabang</th>
                  {CHANNELS.map(([k, l]) => <th key={k} className="px-3 py-2 text-right border-l border-white/20 whitespace-nowrap">{l}</th>)}
                  <th className="px-3 py-2 text-right border-l border-white/30 bg-tertiary-fixed text-on-tertiary-fixed">Walk-in</th>
                  <th className="px-3 py-2 text-right border-l border-white/20 bg-blue-100 text-blue-800">Online</th>
                  <th className="px-3 py-2 text-right border-l border-white/30 bg-yellow-200 text-yellow-900">Total</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((row, ri) => {
                  const tot = CHANNELS.reduce((s, [k]) => s + (row.channels[k] || 0), 0)
                  return (
                    <tr key={row.id} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                      <td className="px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40">{row.tgl}</td>
                      <td className="px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40 text-primary">{branchName(row.branchId).replace('CORNEY ', '')}</td>
                      {CHANNELS.map(([k]) => <td key={k} className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap">{fmtRp(row.channels[k] || 0)}</td>)}
                      <td className="px-3 py-2 text-right border-l border-outline-variant/30 tabular-nums whitespace-nowrap bg-tertiary-fixed/20">{fmtRp(row.source?.walkin || 0)}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap bg-blue-50">{fmtRp(row.source?.online || 0)}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/30 font-bold text-primary tabular-nums whitespace-nowrap">{fmtRp(tot)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>)}

        {/* TAB: Omzet Bersih — uang tunai sudah dipotong biaya laci; non-tunai digabung jadi Transfer */}
        {tab === 'bersih' && (<>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-start gap-2 text-green-900">
            <Icon name="savings" className="shrink-0" />
            <div className="text-label-md leading-snug space-y-1">
              <p><b>Omzet Bersih</b> = uang yang <b>benar-benar masuk</b>, dibagi 2 jenis:</p>
              <p>💵 <b>Tunai (Cash)</b> — hasil jualan tunai <b>setelah dipotong</b> uang urgent, refund, dan harian karyawan. Ada 2 angka: <b>Sistem</b> (seharusnya, dari catatan kasir) dan <b>Aktual</b> (uang yang benar-benar dihitung kasir di laci). <b>Selisih</b> = beda keduanya (− berarti uang kurang dari seharusnya). Uang yang bisa dipakai = <b>Aktual</b> (uang riil).</p>
              <p>🏦 <b>Transfer (Saldo ATM)</b> — semua yang <b>masuk rekening</b>: QRIS Midtrans, QRIS GoPay, GoFood, GrabFood, dan pesanan online — digabung jadi satu. Uang ini <b>tidak dipotong</b> (potongan selalu dari laci tunai).</p>
              <p className="text-green-700">Jadi: <b>Sisa Bersih = Sisa Cash (dari Aktual) + Sisa Transfer</b>. Tombol <b>Pakai</b> mengurangi dari uang Aktual.</p>
            </div>
          </div>
          <h3 className="font-label-lg text-on-surface flex items-center gap-2 mb-2"><Icon name="account_balance_wallet" className="text-primary" /> Omzet Bersih & Sisa Uang — pakai Cash / Transfer, sisa berkurang otomatis</h3>
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            <table className="text-[12px] border-collapse min-w-max w-full">
              <thead>
                <tr>
                  <th rowSpan={2} className="bg-primary text-on-primary px-3 py-2 text-left border-r border-white/20 align-bottom">Tanggal</th>
                  <th rowSpan={2} className="bg-primary text-on-primary px-3 py-2 text-left border-r border-white/20 align-bottom">Cabang</th>
                  <th colSpan={9} className="bg-amber-500 text-white px-3 py-1.5 text-center border-l border-white/30 uppercase tracking-wide">💵 Tunai (Cash)</th>
                  <th rowSpan={2} className="bg-primary text-on-primary px-2 py-2 text-center border-l border-white/30 align-bottom uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th colSpan={3} className="bg-blue-600 text-white px-3 py-1.5 text-center border-l border-white/30 uppercase tracking-wide">🏦 Transfer (Saldo ATM)</th>
                  <th rowSpan={2} className="bg-green-600 text-white px-3 py-2 text-right border-l border-white/30 align-bottom uppercase tracking-wide whitespace-nowrap">Sisa Bersih</th>
                  <th rowSpan={2} className="bg-primary text-on-primary px-3 py-2 text-center border-l border-white/30 align-bottom">Aksi</th>
                </tr>
                <tr className="text-[11px]">
                  <th className="bg-amber-100 text-amber-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">Jualan Tunai</th>
                  <th className="bg-amber-100 text-amber-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">− Urgent</th>
                  <th className="bg-amber-100 text-amber-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">− Refund</th>
                  <th className="bg-amber-100 text-amber-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">− Harian Krywn</th>
                  <th className="bg-amber-200 text-amber-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">Cash Bersih (Sistem)</th>
                  <th className="bg-amber-200 text-amber-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">Aktual (Fisik Kasir)</th>
                  <th className="bg-amber-100 text-amber-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">Selisih</th>
                  <th className="bg-amber-100 text-amber-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">− Dipakai</th>
                  <th className="bg-amber-300 text-amber-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap font-bold">= Sisa Cash</th>
                  <th className="bg-blue-100 text-blue-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">Masuk</th>
                  <th className="bg-blue-100 text-blue-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap">− Dipakai</th>
                  <th className="bg-blue-200 text-blue-900 px-3 py-1 text-right border-l border-white/40 whitespace-nowrap font-bold">= Sisa Transfer</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((row, ri) => {
                  const p = row.potongan || {}
                  const tunai = row.channels?.tunai || 0
                  const cashSistem = rowCashSistem(row)
                  const cashAktual = rowCashAktual(row)
                  const selisihCash = cashAktual - cashSistem // + lebih, − kurang dari sistem
                  const transfer = rowTransfer(row)
                  const pakaiCash = usageTotal(row.tgl, row.branchId, 'cash')
                  const pakaiTransfer = usageTotal(row.tgl, row.branchId, 'transfer')
                  const sisaCash = cashAktual - pakaiCash // sisa pakai uang RIIL (aktual)
                  const sisaTransfer = transfer - pakaiTransfer
                  const sisaBersih = sisaCash + sisaTransfer
                  return (
                    <tr key={row.id} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                      <td className="px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40">{row.tgl}</td>
                      <td className="px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40 text-primary">{branchName(row.branchId).replace('CORNEY ', '')}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap bg-amber-50/40">{fmtRp(tunai)}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap text-error">{(p.urgent || 0) ? '−' + fmtRp(p.urgent) : '–'}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap text-error">{(p.refund || 0) ? '−' + fmtRp(p.refund) : '–'}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap text-error">{(p.gaji || 0) ? '−' + fmtRp(p.gaji) : '–'}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap bg-amber-100/40 text-on-surface-variant">{fmtRp(cashSistem)}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap font-bold bg-amber-100/60">
                        <button onClick={() => setEditAktual({ id: row.id, tgl: row.tgl, branchId: row.branchId, old: cashAktual, sistem: cashSistem, val: cashAktual, reason: '' })} className="inline-flex items-center gap-1 hover:text-primary group" title="Edit uang aktual">{fmtRp(cashAktual)} <Icon name="edit" className="!text-[13px] opacity-50 group-hover:opacity-100" /></button>
                      </td>
                      <td className={`px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap ${selisihCash === 0 ? 'text-green-600' : 'text-error font-bold'}`}>{selisihCash === 0 ? 'pas' : (selisihCash > 0 ? '+' : '−') + fmtRp(Math.abs(selisihCash))}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap text-error">{pakaiCash ? '−' + fmtRp(pakaiCash) : '–'}</td>
                      <td className={`px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap font-bold bg-amber-200/50 ${sisaCash < 0 ? 'text-error' : 'text-amber-900'}`}>{fmtRp(sisaCash)}</td>
                      {(() => { const v = verifOf(row); const tc = v.dot === 'bg-error' ? 'text-error font-bold' : v.dot === 'bg-green-500' ? 'text-green-700' : v.dot === 'bg-amber-500' ? 'text-amber-700' : 'text-on-surface-variant'; return (
                        <td className="px-2 py-2 border-l border-outline-variant/30 text-center whitespace-nowrap" title={v.full}>
                          <span className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full shrink-0 ${v.dot}`} /><span className={`text-[10px] leading-tight ${tc}`}>{v.text}</span></span>
                        </td>
                      ) })()}
                      <td className="px-3 py-2 text-right border-l border-outline-variant/30 tabular-nums whitespace-nowrap bg-blue-50/60 text-blue-800">{fmtRp(transfer)}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap text-error">{pakaiTransfer ? '−' + fmtRp(pakaiTransfer) : '–'}</td>
                      <td className={`px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap font-bold bg-blue-100/60 ${sisaTransfer < 0 ? 'text-error' : 'text-blue-900'}`}>{fmtRp(sisaTransfer)}</td>
                      <td className={`px-3 py-2 text-right border-l border-outline-variant/30 tabular-nums whitespace-nowrap font-bold bg-green-50 ${sisaBersih < 0 ? 'text-error' : 'text-green-700'}`}>{fmtRp(sisaBersih)}</td>
                      <td className="px-3 py-2 text-center border-l border-outline-variant/20">
                        <button onClick={() => setUseRow({ tgl: row.tgl, branchId: row.branchId, cashBersih: cashAktual, transfer })} className="text-primary hover:bg-primary/10 rounded-lg px-2 py-1 inline-flex items-center gap-1 font-bold whitespace-nowrap"><Icon name="payments" className="!text-[16px]" /> Pakai</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>)}

        {/* TAB: Laba Bersih — Sisa Bersih (dari Omzet Bersih) − Uang Belanjaan (diisi Owner) */}
        {tab === 'laba' && (() => {
          let totSisa = 0, totBelanja = 0, totLaba = 0
          const rowsLaba = salesRows.map((row) => {
            const cashAktual = rowCashAktual(row)
            const transfer = rowTransfer(row)
            const sisaCash = cashAktual - usageTotal(row.tgl, row.branchId, 'cash')
            const sisaTransfer = transfer - usageTotal(row.tgl, row.branchId, 'transfer')
            const sisaBersih = sisaCash + sisaTransfer
            const belanja = expenseAmount(row.tgl, row.branchId)
            const laba = sisaBersih - belanja
            totSisa += sisaBersih; totBelanja += belanja; totLaba += laba
            return { row, sisaBersih, belanja, laba }
          })
          return (<>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-start gap-2 text-green-900">
              <Icon name="trending_up" className="shrink-0" />
              <div className="text-label-md leading-snug space-y-1">
                <p><b>Laba Bersih</b> = uang yang benar-benar jadi keuntungan, per tanggal & cabang.</p>
                <p>💰 <b>Sisa Bersih</b> — diambil otomatis dari tab <b>Omzet Bersih</b> (Sisa Cash aktual + Sisa Transfer, sesudah dipakai).</p>
                <p>🛒 <b>Uang Belanjaan Supplier</b> — modal belanja bahan/stok ke supplier hari itu. <b>Diisi sendiri</b> oleh Owner di kolom yang bisa diketik.</p>
                <p className="text-green-700">Jadi: <b>Total Bersih = Sisa Bersih − Uang Belanjaan Supplier</b>.</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
              <table className="text-[12px] border-collapse min-w-max w-full">
                <thead>
                  <tr className="bg-primary text-on-primary">
                    <th className="px-3 py-2 text-left border-r border-white/20">Tanggal</th>
                    <th className="px-3 py-2 text-left border-r border-white/20">Cabang</th>
                    <th className="px-3 py-2 text-right border-l border-white/20 bg-green-600 whitespace-nowrap">💰 Sisa Bersih</th>
                    <th className="px-3 py-2 text-right border-l border-white/20 bg-orange-500 whitespace-nowrap">🛒 Uang Belanjaan Supplier</th>
                    <th className="px-3 py-2 text-right border-l border-white/30 bg-emerald-700 whitespace-nowrap">Total Bersih (Laba)</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsLaba.map(({ row, sisaBersih, belanja, laba }, ri) => (
                    <tr key={row.id} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                      <td className="px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40">{row.tgl}</td>
                      <td className="px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40 text-primary">{branchName(row.branchId).replace('CORNEY ', '')}</td>
                      <td className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap font-bold bg-green-50 text-green-700">{fmtRp(sisaBersih)}</td>
                      <td className="px-2 py-1.5 border-l border-outline-variant/20 bg-orange-50/50">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-on-surface-variant">Rp</span>
                          <input type="text" inputMode="numeric" value={belanja ? belanja.toLocaleString('id-ID') : ''} onChange={(e) => setExpense(row.tgl, row.branchId, Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="0" className="w-32 h-9 pl-7 pr-2 text-right rounded-lg border border-outline focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold tabular-nums bg-white" />
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right border-l border-outline-variant/30 tabular-nums whitespace-nowrap font-bold bg-emerald-50 ${laba < 0 ? 'text-error' : 'text-emerald-800'}`}>{fmtRp(laba)}</td>
                    </tr>
                  ))}
                  {rowsLaba.length > 0 && (
                    <tr className="bg-surface-container-high font-bold border-t-2 border-outline-variant">
                      <td className="px-3 py-2.5 border-r border-outline-variant/40" colSpan={2}>TOTAL {filter !== 'all' ? `(${branchName(filter).replace('CORNEY ', '')})` : '(semua cabang)'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-green-700 bg-green-100/60">{fmtRp(totSisa)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-orange-700 bg-orange-100/60">{fmtRp(totBelanja)}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap bg-emerald-100/60 ${totLaba < 0 ? 'text-error' : 'text-emerald-800'}`}>{fmtRp(totLaba)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-on-surface-variant/70 mt-3 flex items-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Uang Belanjaan Supplier diketik manual & tersimpan otomatis per tanggal+cabang. Sisa Bersih ikut berubah kalau ada koreksi di Omzet Bersih.</p>
          </>)
        })()}

        {/* TAB: Data Laporan — gabungan detail Omzet Bersih + Laba Bersih (1 tempat,
            untuk arsip/PDF bulanan + reset bulan baru) */}
        {tab === 'data' && (() => {
          const cols = ['Jualan Tunai', '− Urgent', '− Refund', '− Harian Krywn', 'Cash Sistem', 'Aktual', 'Selisih', '− Pakai', 'Sisa Cash', 'Masuk', '− Pakai', 'Sisa Transfer', 'Sisa Bersih', '− Belanja Supplier', 'Total Bersih']
          let T = { tunai: 0, urgent: 0, refund: 0, gaji: 0, cashS: 0, aktual: 0, sel: 0, pakaiC: 0, sisaC: 0, tf: 0, pakaiT: 0, sisaT: 0, sisaB: 0, belanja: 0, laba: 0 }
          const drows = salesRows.map((r) => {
            const p = r.potongan || {}
            const tunai = r.channels?.tunai || 0
            const cashS = rowCashSistem(r), aktual = rowCashAktual(r), sel = aktual - cashS
            const pakaiC = usageTotal(r.tgl, r.branchId, 'cash'), sisaC = aktual - pakaiC
            const tf = rowTransfer(r), pakaiT = usageTotal(r.tgl, r.branchId, 'transfer'), sisaT = tf - pakaiT
            const sisaB = sisaC + sisaT, belanja = expenseAmount(r.tgl, r.branchId), laba = sisaB - belanja
            T = { tunai: T.tunai + tunai, urgent: T.urgent + (p.urgent || 0), refund: T.refund + (p.refund || 0), gaji: T.gaji + (p.gaji || 0), cashS: T.cashS + cashS, aktual: T.aktual + aktual, sel: T.sel + sel, pakaiC: T.pakaiC + pakaiC, sisaC: T.sisaC + sisaC, tf: T.tf + tf, pakaiT: T.pakaiT + pakaiT, sisaT: T.sisaT + sisaT, sisaB: T.sisaB + sisaB, belanja: T.belanja + belanja, laba: T.laba + laba }
            return { r, p, tunai, cashS, aktual, sel, pakaiC, sisaC, tf, pakaiT, sisaT, sisaB, belanja, laba }
          })
          const neg = (n) => (n ? '−' + fmtRp(n) : '–')
          return (<>
            <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2 text-on-surface-variant">
                <Icon name="description" className="text-primary shrink-0" />
                <p className="text-label-md leading-snug"><b className="text-on-surface">Data Laporan</b> = semua detail uang dalam satu tabel (urgent, refund, harian karyawan, selisih, pakai, belanja, laba). Untuk <b>arsip/PDF bulanan</b>. Sesudah di-PDF, <b>Reset</b> untuk mulai bulan baru.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => window.print()} className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold flex items-center gap-2 active:scale-95"><Icon name="picture_as_pdf" /> Cetak / PDF</button>
                <button onClick={() => setResetOpen(true)} className="px-4 py-2.5 rounded-xl border-2 border-error text-error font-bold flex items-center gap-2 active:scale-95"><Icon name="restart_alt" /> Reset Bulan</button>
              </div>
            </div>

            <div className="report-print">
            <div className="print-only" style={{ marginBottom: 8 }}>
              <h2 style={{ fontWeight: 800, fontSize: 14 }}>CORNEY — Data Laporan {filter !== 'all' ? `· ${branchName(filter).replace('CORNEY ', '')}` : '· Semua Cabang'}</h2>
              <p style={{ fontSize: 10 }}>#CeritanyaBersamaCorney</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
              <table className="text-[11px] border-collapse min-w-max">
                <thead>
                  <tr>
                    <th rowSpan={2} className="sticky left-0 z-20 bg-primary text-on-primary px-3 py-2 text-left border-r border-white/20 align-bottom">Tanggal</th>
                    <th rowSpan={2} className="sticky left-[78px] z-20 bg-primary text-on-primary px-3 py-2 text-left border-r border-white/20 align-bottom">Cabang</th>
                    <th colSpan={9} className="bg-amber-500 text-white px-2 py-1.5 text-center border-l border-white/30 uppercase tracking-wide">💵 Tunai (Cash)</th>
                    <th colSpan={3} className="bg-blue-600 text-white px-2 py-1.5 text-center border-l border-white/30 uppercase tracking-wide">🏦 Transfer (Saldo ATM)</th>
                    <th colSpan={3} className="bg-emerald-700 text-white px-2 py-1.5 text-center border-l border-white/30 uppercase tracking-wide">💰 Laba</th>
                  </tr>
                  <tr className="text-[10px]">
                    {cols.map((c, i) => <th key={i} className={`px-2 py-1 text-right border-l border-white/30 whitespace-nowrap ${i < 9 ? 'bg-amber-100 text-amber-900' : i < 12 ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900'}`}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {drows.map(({ r, p, tunai, cashS, aktual, sel, pakaiC, sisaC, tf, pakaiT, sisaT, sisaB, belanja, laba }, ri) => (
                    <tr key={r.id} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                      <td className={`sticky left-0 z-10 ${ri % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'} px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40`}>{r.tgl}</td>
                      <td className={`sticky left-[78px] z-10 ${ri % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'} px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40 text-primary`}>{branchName(r.branchId).replace('CORNEY ', '')}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap">{fmtRp(tunai)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap text-error">{neg(p.urgent || 0)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap text-error">{neg(p.refund || 0)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap text-error">{neg(p.gaji || 0)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap">{fmtRp(cashS)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap font-bold bg-amber-50">{fmtRp(aktual)}</td>
                      <td className={`px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap ${sel === 0 ? 'text-green-600' : 'text-error font-bold'}`}>{sel === 0 ? 'pas' : (sel > 0 ? '+' : '−') + fmtRp(Math.abs(sel))}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums text-error align-top">{neg(pakaiC)}{pakaiC > 0 && (<div className="text-[9px] text-on-surface-variant/80 font-normal leading-tight mt-0.5">{usageList(r.tgl, r.branchId, 'cash').map((u, i) => <div key={i}>• {u.note || 'tanpa ket.'} {fmtRp(u.amount)}</div>)}</div>)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap font-bold bg-amber-100/50 align-top">{fmtRp(sisaC)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/30 tabular-nums whitespace-nowrap text-blue-800">{fmtRp(tf)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums text-error align-top">{neg(pakaiT)}{pakaiT > 0 && (<div className="text-[9px] text-on-surface-variant/80 font-normal leading-tight mt-0.5">{usageList(r.tgl, r.branchId, 'transfer').map((u, i) => <div key={i}>• {u.note || 'tanpa ket.'} {fmtRp(u.amount)}</div>)}</div>)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap font-bold bg-blue-100/50 text-blue-900 align-top">{fmtRp(sisaT)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/30 tabular-nums whitespace-nowrap font-bold bg-green-50 text-green-700">{fmtRp(sisaB)}</td>
                      <td className="px-2 py-2 text-right border-l border-outline-variant/20 tabular-nums whitespace-nowrap text-orange-700">{neg(belanja)}</td>
                      <td className={`px-2 py-2 text-right border-l border-outline-variant/30 tabular-nums whitespace-nowrap font-bold bg-emerald-50 ${laba < 0 ? 'text-error' : 'text-emerald-800'}`}>{fmtRp(laba)}</td>
                    </tr>
                  ))}
                  {drows.length > 0 && (
                    <tr className="bg-surface-container-high font-bold border-t-2 border-outline-variant">
                      <td className="sticky left-0 z-10 bg-surface-container-high px-3 py-2.5 border-r border-outline-variant/40" colSpan={2}>TOTAL</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(T.tunai)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-error">{neg(T.urgent)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-error">{neg(T.refund)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-error">{neg(T.gaji)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(T.cashS)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums bg-amber-100/60">{fmtRp(T.aktual)}</td>
                      <td className={`px-2 py-2.5 text-right tabular-nums ${T.sel === 0 ? 'text-green-600' : 'text-error'}`}>{T.sel === 0 ? 'pas' : (T.sel > 0 ? '+' : '−') + fmtRp(Math.abs(T.sel))}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-error">{neg(T.pakaiC)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums bg-amber-200/50">{fmtRp(T.sisaC)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-blue-800">{fmtRp(T.tf)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-error">{neg(T.pakaiT)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums bg-blue-200/50 text-blue-900">{fmtRp(T.sisaT)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums bg-green-100/60 text-green-700">{fmtRp(T.sisaB)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-orange-700">{neg(T.belanja)}</td>
                      <td className={`px-2 py-2.5 text-right tabular-nums bg-emerald-100/60 ${T.laba < 0 ? 'text-error' : 'text-emerald-800'}`}>{fmtRp(T.laba)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </div>
            <p className="text-[12px] text-on-surface-variant/70 mt-3 flex items-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Satu baris = satu hari × cabang. Semua kolom dari Master Laporan (live). Cetak → "Simpan sebagai PDF" untuk arsip bulanan.</p>
          </>)
        })()}

        <p className="text-[12px] text-on-surface-variant/70 mt-3 flex items-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Data contoh. Nantinya terisi otomatis dari <b>closing harian kasir</b> tiap cabang (qty varian → stok induk + omzet) — TAHAP 4.</p>
      </main>

      {/* Owner koreksi angka (mis. karyawan salah input) — wajib alasan, tercatat di Jejak Audit */}
      {edit && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEdit(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-surface rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-headline-md text-headline-md">Koreksi Laporan Stok</h2>
            <p className="text-label-md text-on-surface-variant mb-3">{branchName(edit.branchId)} — perbaiki angka yang salah input. <b>Terjual</b> tidak di sini (ikut tab Variant Terjual).</p>
            <div className="flex items-center gap-2 mb-4 bg-surface-container-low rounded-xl p-3">
              <Icon name="event" className="text-primary" />
              <label className="text-label-md font-bold">Tanggal laporan:</label>
              <input type="date" value={edit.tglISO} onChange={(e) => setEdit((x) => ({ ...x, tglISO: e.target.value }))} className="h-10 px-3 rounded-lg border border-outline focus:border-primary outline-none font-bold bg-surface-container-lowest" />
              {isoToDDMM(edit.tglISO) !== edit.tgl && <span className="text-[11px] text-amber-700">Tanggal Variant Terjual ikut berubah.</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="text-[12px] border-collapse w-full">
                <thead><tr className="text-on-surface-variant"><th className="text-left p-1">Induk</th>{EDIT_FIELDS.map(([k, l]) => <th key={k} className="p-1 text-center font-bold">{l}</th>)}</tr></thead>
                <tbody>
                  {PARENTS.map(([pk, pl]) => (
                    <tr key={pk} className="border-t border-outline-variant/30">
                      <td className="p-1 font-bold">{pl}</td>
                      {EDIT_FIELDS.map(([f]) => (
                        <td key={f} className="p-1"><input inputMode="numeric" value={edit.draft[pk][f]} onChange={(e) => setF(pk, f, e.target.value)} className="w-14 h-9 text-center rounded-lg border border-outline focus:border-primary outline-none bg-surface-container-lowest" /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <label className="text-[12px] font-bold text-primary uppercase">Alasan koreksi (wajib) *</label>
              <input value={edit.reason} onChange={(e) => setEdit((x) => ({ ...x, reason: e.target.value }))} placeholder="contoh: karyawan salah tulis sisa Mozza" className="w-full h-11 mt-1 px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" />
              <p className="text-[11px] text-on-surface-variant mt-1 flex items-center gap-1"><Icon name="gpp_good" className="!text-[14px]" /> Koreksi tercatat permanen di Jejak Audit (siapa, alasan, waktu).</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEdit(null)} className="flex-1 h-[52px] rounded-xl border border-outline text-on-surface-variant font-label-lg">Batal</button>
              <button onClick={saveEdit} disabled={!edit.reason.trim()} className="flex-[2] h-[52px] rounded-xl bg-primary text-on-primary font-headline-md shadow-lg active:scale-[0.98] disabled:opacity-40">Simpan Koreksi</button>
            </div>
          </div>
        </div>
      )}

      {/* Pakai uang — Owner belanja apa pun pakai Cash Bersih / Transfer (per tgl+cabang) */}
      {useRow && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setUseRow(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-surface rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-1">
              <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="payments" className="text-primary" /> Pakai Uang</h2>
              <button onClick={() => setUseRow(null)} className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center"><Icon name="close" /></button>
            </div>
            <p className="text-label-md text-on-surface-variant mb-4"><b className="text-primary">{branchName(useRow.branchId)}</b> · {useRow.tgl} — catat uang yang dipakai untuk pembelian apa pun. Sisa di tabel langsung berkurang.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UsePanel jenis="cash" label="💵 Pakai Cash Bersih" icon="payments" tone="amber" available={useRow.cashBersih} tgl={useRow.tgl} branchId={useRow.branchId} />
              <UsePanel jenis="transfer" label="🏦 Pakai Transfer (Saldo ATM)" icon="account_balance" tone="blue" available={useRow.transfer} tgl={useRow.tgl} branchId={useRow.branchId} />
            </div>
            <button onClick={() => setUseRow(null)} className="mt-5 w-full h-[52px] rounded-xl bg-primary text-on-primary font-headline-md shadow-lg active:scale-[0.98]">Selesai</button>
          </div>
        </div>
      )}

      {/* Edit uang Aktual (fisik kasir) — mis. besoknya kasir ganti uang kurang. Ber-audit. */}
      {editAktual && (() => {
        const selisih = editAktual.val - editAktual.sistem
        const beda = editAktual.val - editAktual.old
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditAktual(null)}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-surface rounded-3xl p-6 shadow-2xl">
              <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="payments" className="text-primary" /> Edit Uang Aktual (Fisik Kasir)</h2>
              <p className="text-label-md text-on-surface-variant mb-4"><b className="text-primary">{branchName(editAktual.branchId)}</b> · {editAktual.tgl} — perbaiki jumlah uang tunai yang benar-benar ada. <b>Sisa Cash & Sisa Bersih</b> langsung ikut berubah.</p>
              <div className="bg-surface-container-low rounded-xl p-3 mb-3 space-y-1 text-label-md">
                <div className="flex justify-between text-on-surface-variant"><span>Cash Bersih (Sistem / seharusnya)</span><b className="text-on-surface">{fmtRp(editAktual.sistem)}</b></div>
                <div className="flex justify-between text-on-surface-variant"><span>Aktual sebelumnya</span><span>{fmtRp(editAktual.old)}</span></div>
              </div>
              <label className="block text-label-md font-bold text-on-surface-variant mb-1">Uang aktual (fisik) sekarang</label>
              <div className="relative mb-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-headline-md font-bold text-on-surface-variant">Rp</span>
                <input type="text" inputMode="numeric" autoFocus value={editAktual.val ? editAktual.val.toLocaleString('id-ID') : ''} onChange={(e) => setEditAktual((x) => ({ ...x, val: Number(e.target.value.replace(/\D/g, '')) || 0 }))} placeholder="0" className="w-full h-[60px] pl-14 pr-4 rounded-xl border-2 border-primary focus:ring-4 focus:ring-primary/10 text-headline-md font-bold outline-none" />
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] mb-4">
                <span className={`px-2 py-0.5 rounded-full ${selisih === 0 ? 'bg-green-100 text-green-700' : 'bg-error-container text-on-error-container'}`}>Selisih vs sistem: {selisih === 0 ? 'pas' : (selisih > 0 ? '+' : '−') + fmtRp(Math.abs(selisih))}</span>
                {beda !== 0 && <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">Perubahan: {beda > 0 ? '+' : '−'}{fmtRp(Math.abs(beda))}</span>}
              </div>
              <label className="block text-[12px] font-bold text-primary uppercase">Alasan koreksi (wajib) *</label>
              <input value={editAktual.reason} onChange={(e) => setEditAktual((x) => ({ ...x, reason: e.target.value }))} placeholder="contoh: kasir mengganti uang yang kurang Rp5.000" className="w-full h-11 mt-1 px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" />
              <p className="text-[11px] text-on-surface-variant mt-1 flex items-center gap-1"><Icon name="gpp_good" className="!text-[14px]" /> Tercatat di Jejak Audit (siapa, dari berapa ke berapa, alasan, waktu).</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setEditAktual(null)} className="flex-1 h-[52px] rounded-xl border border-outline text-on-surface-variant font-label-lg">Batal</button>
                <button onClick={saveAktual} disabled={!editAktual.reason.trim()} className="flex-[2] h-[52px] rounded-xl bg-primary text-on-primary font-headline-md shadow-lg active:scale-[0.98] disabled:opacity-40">Simpan</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Konfirmasi RESET data bulan baru */}
      {resetOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setResetOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-surface rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mx-auto mb-4"><Icon name="restart_alt" className="text-error !text-[34px]" /></div>
            <h2 className="font-headline-md text-headline-md">Reset Data untuk Bulan Baru?</h2>
            <p className="text-label-md text-on-surface-variant mt-2 leading-snug">Semua <b>data laporan</b> dikosongkan: penjualan, stok harian, pemakaian uang, belanja supplier, & setoran. <b className="text-error">Tidak bisa dibatalkan.</b></p>
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 mt-3 text-label-md flex items-start gap-2 text-left"><Icon name="picture_as_pdf" className="shrink-0 !text-[18px]" /> Pastikan sudah <b>Cetak/PDF</b> dulu sebagai arsip bulan ini sebelum reset.</div>
            <p className="text-[11px] text-on-surface-variant mt-2">Pengaturan cabang, menu, & stok standar TIDAK ikut terhapus. Tercatat di Jejak Audit.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setResetOpen(false)} className="flex-1 h-[52px] rounded-xl border border-outline text-on-surface-variant font-label-lg">Batal</button>
              <button onClick={doReset} className="flex-[2] h-[52px] rounded-xl bg-error text-on-error font-headline-md shadow-lg active:scale-[0.98]">Ya, Reset Sekarang</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
