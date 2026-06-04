import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES } from '../../data/menu.js'
import { useStockDaily } from '../../store/useStockDaily.js'
import { computeParent as compute, effectiveV, STOCK_PARENTS } from '../../store/stockdaily.js'

// OPS — Cek Selisih Stok (read-only). Menampilkan tabel Stok Isian yang SAMA seperti
// MASTER LAPORAN Owner (Sisa Seharusnya / Sisa Aktual / Selisih), tapi TANPA edit.
// Sumber: stock_daily (server) — RLS sudah mengizinkan operasional baca. Operasional
// bisa lihat kalau ada stok yang HILANG (selisih > 0) saat cek lapangan.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const PARENTS = STOCK_PARENTS
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
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name || id

export default function OperasionalCekSelisih() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const data = useStockDaily() || []
  const rows = data.filter((r) => filter === 'all' || r.branchId === filter)

  // Detail stok hilang (selisih > 0).
  const hilangList = []
  rows.forEach((r) => { const ev = effectiveV(r); PARENTS.forEach(([pk, pl]) => { const s = compute(ev[pk]).selisih; if (s > 0) hilangList.push({ rowId: r.id, pk, tgl: r.tgl, branch: branchName(r.branchId).replace('CORNEY ', ''), parent: pl, qty: s }) }) })
  const totalHilang = hilangList.reduce((s, h) => s + h.qty, 0)
  const flashHilang = (rowId, pk) => {
    const el = document.getElementById(`opshil-${rowId}-${pk}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    el.classList.remove('flash-hilang'); void el.offsetWidth; el.classList.add('flash-hilang')
    setTimeout(() => el.classList.remove('flash-hilang'), 1700)
  }
  const cellVal = (row, group, pkey) => compute(effectiveV(row)[pkey])[group.key] ?? 0

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/operasional')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Cek Selisih Stok</h1>
      </header>

      <main className="flex-1 w-full p-4 sm:p-6 max-w-[1400px] mx-auto">
        {/* Filter per cabang */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-label-md text-on-surface-variant flex items-center gap-1.5 mr-1"><Icon name="storefront" className="!text-[18px] text-primary" /> Cabang:</span>
          {[['all', 'Semua'], ...BRANCHES.map((b) => [b.id, b.name.replace('CORNEY ', '')])].map(([id, lbl]) => (
            <button key={id} onClick={() => setFilter(id)} className={`px-4 py-1.5 rounded-full font-label-md transition-all ${filter === id ? 'bg-secondary-container text-on-secondary-container shadow-sm' : 'border border-outline-variant text-on-surface-variant'}`}>{lbl}</button>
          ))}
        </div>

        {/* Rumus + ringkasan total hilang */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-on-surface-variant">
            <Icon name="functions" className="text-primary shrink-0" />
            <div className="text-label-md leading-snug">
              <p><b className="text-on-surface">Sisa Seharusnya</b> = (Datang + Sisa Kemarin) − Terjual − Patah − Garansi − Free. <b className="text-on-surface">Selisih</b> = Seharusnya − Sisa Aktual.</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-error/20 border border-error inline-block" /> <b className="text-error">Merah ({'>'} 0)</b> = stok <b>HILANG</b> (perlu dicek).</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-500 inline-block" /> <b className="text-green-700">0</b> = pas/cocok.</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-500 inline-block" /> <b className="text-amber-700">Minus</b> = stok <b>LEBIH</b>.</span>
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

        {/* Tabel lebar (read-only) */}
        {rows.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-10 text-center text-on-surface-variant">
            <Icon name="inventory_2" className="!text-5xl opacity-30" />
            <p className="mt-2 font-label-lg">Belum ada data stok.</p>
            <p className="text-label-md">Data muncul setelah kasir Tutup Toko (Closing) per cabang.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            <table className="text-[11px] border-collapse min-w-max">
              <thead>
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-20 bg-primary text-on-primary px-3 py-2 text-left border-r border-white/20">Tanggal</th>
                  <th rowSpan={2} className="sticky left-[78px] z-20 bg-primary text-on-primary px-3 py-2 text-left border-r border-white/20">Cabang</th>
                  {GROUPS.map((g) => <th key={g.key} colSpan={4} className={`${g.cls} px-2 py-1.5 text-center border-l border-white/30 font-bold uppercase tracking-wide whitespace-nowrap`}>{g.label}</th>)}
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
                        <td key={g.key + pk} id={g.flag ? `opshil-${row.id}-${pk}` : undefined} className={`px-2 py-2 text-center border-l border-outline-variant/20 tabular-nums whitespace-nowrap ${cls}`}>{label}</td>
                      )
                    }))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[12px] text-on-surface-variant/70 mt-3 flex items-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Tampilan ini <b>hanya baca</b> — koreksi stok tetap diusulkan lewat Audit Lapangan & dieksekusi Owner.</p>
      </main>
    </div>
  )
}
