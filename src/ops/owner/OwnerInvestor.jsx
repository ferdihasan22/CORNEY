import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { useUsage } from '../../store/useUsage.js'
import { useExpense } from '../../store/useExpense.js'
import { useInvestorConfig } from '../../store/useInvestorConfig.js'
import { investorCfgOf, setInvestorField } from '../../store/investorconfig.js'
import { useMonthClose } from '../../store/useMonthClose.js'
import { aggregatePeriod, salesInPeriod } from '../../store/aggregate.js'
import { rowCashSistem, rowCashAktual, rowTransfer } from '../../store/salesdaily.js'
import { usageTotal, usageList } from '../../store/usage.js'
import { expenseAmount } from '../../store/expense.js'

// 2.6 — OWN-11 Bagi Hasil Investor. Tabel detail = SAMA seperti Data Laporan (per
// tanggal × cabang, bulan ini, dari MASTER LAPORAN). Di BAWAH tabel: Laba Operasional
// (Total Bersih, = aggregatePeriod().laba kanonik) − biaya TETAP (Sewa/Gaji/Value,
// DIPERSIST) → Laba Final → Dividen. Saat bulan TERKUNCI, semua angka dibaca dari
// SNAPSHOT beku & input dikunci. Guard: belum ada data / laba ≤ 0 → tidak hitung negatif.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name || id
const FIELDS = [['sewa', 'Sewa'], ['gaji', 'Gaji Bulanan'], ['value', 'Value (simpanan cabang)']]

export default function OwnerInvestor() {
  const navigate = useNavigate()
  useSalesDaily(); useUsage(); useExpense(); useInvestorConfig() // ikut MASTER LAPORAN + config
  const mc = useMonthClose() || { closed: {} }
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const snapBranch = (mc.closed || {})[monthKey]?.branches?.[branchId] || null
  const locked = !!snapBranch

  const ap = aggregatePeriod('Bulan', branchId)
  const noData = !locked && ap.hari === 0
  // Saat terkunci → pakai config & laba BEKU dari snapshot; selain itu → config persist.
  const d = locked ? { sewa: snapBranch.sewa, gaji: snapBranch.gaji, value: snapBranch.value, pct: snapBranch.pct } : investorCfgOf(branchId)
  const labaOperasional = locked ? snapBranch.laba : ap.laba
  const biayaTetap = d.sewa + d.gaji + d.value
  const labaFinal = labaOperasional - biayaTetap
  // Guard: dividen hanya dari laba positif (rugi → investor tidak menanggung negatif).
  const dividen = labaFinal > 0 ? Math.round((labaFinal * d.pct) / 100) : 0
  const owner = labaFinal - dividen
  const setField = (k, v) => { if (!locked) setInvestorField(branchId, k, v) }

  // Baris detail (sama seperti Data Laporan) untuk cabang + bulan ini.
  const rows = salesInPeriod('Bulan', branchId)
  const neg = (n) => (n ? '−' + fmtRp(n) : '–')

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="bg-primary text-on-primary px-5 pt-5 pb-4 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <h1 className="font-headline-lg text-headline-lg flex-1">Bagi Hasil Investor</h1>
          <button onClick={() => window.print()} className="bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 active:scale-95"><Icon name="picture_as_pdf" /> <span className="hidden sm:inline">Cetak / PDF</span></button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-5 space-y-4">
        {/* Pilih cabang */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {BRANCHES.map((b) => (
            <button key={b.id} onClick={() => setBranchId(b.id)} className={`whitespace-nowrap px-4 py-2 rounded-full font-label-md transition-all ${branchId === b.id ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant'}`}>{b.name.replace('CORNEY ', '')}</button>
          ))}
        </div>

        {/* Biaya tetap (diisi Owner) — TIDAK ikut tercetak (di luar area cetak) */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-sm">
          <p className="font-label-lg text-on-surface mb-3 flex items-center gap-2"><Icon name={locked ? 'lock' : 'edit_note'} className="text-primary" /> Biaya Tetap Bulanan (diisi Owner)
            {locked && <span className="ml-auto text-[11px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">terkunci — beku</span>}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FIELDS.map(([k, lbl]) => (
              <div key={k}>
                <label className="text-[11px] font-bold text-on-surface-variant uppercase">{lbl}</label>
                <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-label-md">Rp</span>
                  <input inputMode="numeric" disabled={locked} value={d[k].toLocaleString('id-ID')} onChange={(e) => setField(k, e.target.value)} className={`w-full h-11 pl-9 pr-2 text-right rounded-lg border outline-none font-bold ${locked ? 'border-outline-variant bg-surface-container text-on-surface-variant cursor-not-allowed' : 'border-outline focus:border-primary bg-surface'}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3"><span className="text-label-md text-on-surface-variant">Persentase Investor</span><input inputMode="numeric" disabled={locked} value={d.pct} onChange={(e) => setField('pct', e.target.value)} className={`w-16 h-9 text-center rounded-lg border outline-none font-bold ${locked ? 'border-outline-variant bg-surface-container text-on-surface-variant cursor-not-allowed' : 'border-outline focus:border-primary bg-surface'}`} /><span className="font-bold">%</span></div>
          {!locked && (d.sewa + d.gaji + d.value) === 0 && <p className="text-[11px] text-amber-700 mt-2 flex items-center gap-1"><Icon name="warning" className="!text-[14px]" /> Biaya tetap masih 0 — isi Sewa/Gaji/Value & % agar bagi hasil benar.</p>}
        </div>

        {/* AREA CETAK: tabel detail + ringkasan bagi hasil */}
        <div className="report-print space-y-4">
          <div className="print-only" style={{ marginBottom: 8 }}>
            <h2 style={{ fontWeight: 800, fontSize: 14 }}>CORNEY — Laporan Bagi Hasil Investor · {branchName(branchId).replace('CORNEY ', '')} · Bulan Ini</h2>
            <p style={{ fontSize: 10 }}>#CeritanyaBersamaCorney</p>
          </div>

          {/* Tabel detail — sama seperti Data Laporan */}
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            <table className="text-[11px] border-collapse min-w-max">
              <thead>
                <tr>
                  <th rowSpan={2} className="bg-primary text-on-primary px-3 py-2 text-left border-r border-white/20 align-bottom">Tanggal</th>
                  <th colSpan={9} className="bg-amber-500 text-white px-2 py-1.5 text-center border-l border-white/30 uppercase tracking-wide">💵 Tunai (Cash)</th>
                  <th colSpan={3} className="bg-blue-600 text-white px-2 py-1.5 text-center border-l border-white/30 uppercase tracking-wide">🏦 Transfer</th>
                  <th colSpan={3} className="bg-emerald-700 text-white px-2 py-1.5 text-center border-l border-white/30 uppercase tracking-wide">💰 Laba</th>
                </tr>
                <tr className="text-[10px]">
                  {['Jualan Tunai', '− Urgent', '− Refund', '− Harian', 'Cash Sistem', 'Aktual', 'Selisih', '− Pakai', 'Sisa Cash', 'Masuk', '− Pakai', 'Sisa Transfer', 'Sisa Bersih', '− Belanja', 'Total Bersih'].map((c, i) => (
                    <th key={i} className={`px-2 py-1 text-right border-l border-white/30 whitespace-nowrap ${i < 9 ? 'bg-amber-100 text-amber-900' : i < 12 ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900'}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={16} className="px-3 py-4 text-center text-on-surface-variant">Belum ada data bulan ini.</td></tr>}
                {rows.map((r, ri) => {
                  const p = r.potongan || {}
                  const tunai = r.channels?.tunai || 0
                  const cashS = rowCashSistem(r), aktual = rowCashAktual(r), sel = aktual - cashS
                  const pakaiC = usageTotal(r.tgl, r.branchId, 'cash'), sisaC = aktual - pakaiC
                  const tf = rowTransfer(r), pakaiT = usageTotal(r.tgl, r.branchId, 'transfer'), sisaT = tf - pakaiT
                  const sisaB = sisaC + sisaT, belanja = expenseAmount(r.tgl, r.branchId), laba = sisaB - belanja
                  return (
                    <tr key={r.id} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                      <td className="px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40">{r.tgl}</td>
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
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* DI BAWAH TABEL: Laba Operasional − biaya tetap → Laba Final → Dividen */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-5 max-w-md ml-auto">
            {noData ? (
              <div className="text-center py-4 text-on-surface-variant">
                <Icon name="hourglass_empty" className="text-3xl text-on-surface-variant/50" />
                <p className="font-label-lg mt-1">Belum ada data bulan ini</p>
                <p className="text-[12px]">Bagi hasil dihitung setelah ada penjualan. Dividen & bagian owner: <b>–</b></p>
              </div>
            ) : (<>
              <div className="flex justify-between items-center"><span className="font-label-lg text-on-surface-variant">Laba Operasional (Total Bersih)</span><span className={`font-headline-md ${labaOperasional < 0 ? 'text-error' : 'text-green-700'}`}>{fmtRp(labaOperasional)}</span></div>
              <div className="border-t border-dashed border-outline-variant mt-2 pt-2 space-y-1 text-label-md text-on-surface-variant">
                <div className="flex justify-between"><span>− Sewa</span><span className="text-error">{neg(d.sewa)}</span></div>
                <div className="flex justify-between"><span>− Gaji Bulanan</span><span className="text-error">{neg(d.gaji)}</span></div>
                <div className="flex justify-between"><span>− Value (simpanan cabang)</span><span className="text-error">{neg(d.value)}</span></div>
              </div>
              <div className="flex justify-between items-center border-t border-outline-variant mt-2 pt-2"><span className="font-label-lg">Laba Final</span><span className={`font-headline-lg ${labaFinal < 0 ? 'text-error' : 'text-green-700'}`}>{fmtRp(labaFinal)}</span></div>
              {labaFinal <= 0 && <p className="text-[11px] text-error mt-1 flex items-center gap-1"><Icon name="info" className="!text-[14px]" /> Laba final ≤ 0 (rugi/biaya tetap belum tertutup) — dividen investor 0.</p>}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-secondary-fixed/30 border border-secondary-fixed rounded-xl p-3 text-center"><p className="text-[11px] text-on-secondary-fixed-variant">Dividen Investor ({d.pct}%)</p><p className="font-headline-md text-primary mt-1">{fmtRp(dividen)}</p></div>
                <div className="bg-surface-container rounded-xl p-3 text-center"><p className="text-[11px] text-on-surface-variant">Bagian Owner ({100 - d.pct}%)</p><p className="font-headline-md text-on-surface mt-1">{fmtRp(owner)}</p></div>
              </div>
            </>)}
          </div>
        </div>

        <p className="text-[12px] text-on-surface-variant/70 leading-relaxed">Laba Operasional diambil dari <b>Total Bersih</b> bulan ini (Master Laporan) — sudah dikurangi urgent, refund, harian karyawan, pemakaian, & belanja supplier. Sewa/Gaji Bulanan/Value adalah biaya tetap yang kamu isi. Investor hanya menerima laporan ini.</p>
      </main>
    </div>
  )
}
