import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { useUsage } from '../../store/useUsage.js'
import { useExpense } from '../../store/useExpense.js'
import { aggregatePeriod, salesInPeriod, rowChannelsTotal, expenseInPeriod, rowSisaBersih } from '../../store/aggregate.js'
import { rowCashAktual, rowCashSistem } from '../../store/salesdaily.js'
import { expenseAmount, setExpense } from '../../store/expense.js'
import { useSupplierFulfilled } from '../../store/useSupplierFulfilled.js'
import { fulfilledSpend } from '../../store/supplierFulfilled.js'

// 1B.6 — OWN-03 Laporan Keuangan Ringkas. SEMUA angka (Hari/Minggu/Bulan) dihitung
// dari MASTER LAPORAN (salesdaily + usage + expense) lewat aggregate.js — satu-satunya
// sumber kebenaran. Tidak ada lagi data contoh. Potongan Gaji detail (CLS-02b) tampil
// dari sesi kasir berjalan bila ada (bonus live), selebihnya pakai uang harian dari master.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name || id

const CHANNELS = [
  { id: 'tunai', label: 'Tunai', icon: 'payments', color: 'bg-primary', text: 'text-primary' },
  { id: 'qris_midtrans', label: 'QRIS Midtrans', icon: 'qr_code_2', color: 'bg-secondary-container', text: 'text-secondary' },
  { id: 'qris_gopay', label: 'QRIS GoPay', icon: 'account_balance_wallet', color: 'bg-blue-500', text: 'text-blue-600' },
  { id: 'gofood', label: 'GoFood', icon: 'delivery_dining', color: 'bg-green-600', text: 'text-green-600' },
  { id: 'grabfood', label: 'GrabFood', icon: 'delivery_dining', color: 'bg-emerald-500', text: 'text-emerald-600' },
]

export default function OwnerFinancialReports() {
  const navigate = useNavigate()
  const day = useDay()
  const [period, setPeriod] = useState('Bulan')
  const [branchId, setBranchId] = useState('all') // 'all' | id cabang
  const [labaOpen, setLabaOpen] = useState(false) // rincian Laba Bersih (drill-down)
  const [reasonPopup, setReasonPopup] = useState(null) // {tgl, branch, selisih, reason} → popup alasan selisih kas
  useSalesDaily(); useUsage(); useExpense(); useSupplierFulfilled() // subscribe → ikut MASTER LAPORAN + acuan supplier
  const bid = branchId === 'all' ? undefined : branchId

  // Semua angka DARI MASTER LAPORAN, per periode + cabang terpilih.
  const agg = aggregatePeriod(period, bid)
  const hasData = agg.hari > 0
  const trendLabel = period === 'Hari' ? 'hari ini' : period === 'Minggu' ? '7 hari terakhir' : 'bulan ini'
  const belanja = expenseInPeriod(period, bid) // Uang Belanjaan Supplier (master)
  const data = {
    omzet: agg.omzet, trx: agg.trx, channels: agg.channels,
    selisihKas: hasData ? agg.selisihKas : null,
    urgent: agg.urgent, gaji: agg.gaji, laba: agg.laba, belanja,
    payroll: day?.closing?.payroll || null, // bonus: detail potong gaji sesi berjalan
    trend: trendLabel,
  }
  // Ringkasan closing per cabang untuk periode (dari MASTER LAPORAN).
  const closingCards = salesInPeriod(period, bid).map((r) => ({ id: r.id, branchId: r.branchId, tgl: r.tgl, omzet: rowChannelsTotal(r), selisihKas: rowCashAktual(r) - rowCashSistem(r), cashReason: r.cashReason || '' }))
  const channelTotal = Object.values(data.channels || {}).reduce((s, v) => s + v, 0)
  const activeChannels = CHANNELS.filter((c) => (data.channels?.[c.id] || 0) > 0)

  const exportCsv = () => {
    const lines = [
      ['CORNEY — Laporan Keuangan'],
      ['Periode', period, `${branchId === 'all' ? 'Semua Cabang' : branchName(bid)} · ${trendLabel}`],
      [],
      ['Ringkasan'],
      ['Total Omzet', data.omzet],
      ['Transaksi', data.trx],
      ['Selisih Kas', data.selisihKas ?? '-'],
      ['Uang Urgent', data.urgent ?? 0],
      ['Uang Harian Karyawan', data.gaji ?? 0],
      ['Belanja Supplier', data.belanja ?? 0],
      ['Laba Bersih', data.laba ?? 0],
      [],
      ['Rekap per Channel', 'Nominal', '%'],
      ...CHANNELS.map((c) => [c.label, data.channels?.[c.id] || 0, channelTotal ? Math.round(((data.channels?.[c.id] || 0) / channelTotal) * 100) + '%' : '0%']),
    ]
    if (data.payroll) {
      lines.push([], ['Potongan Gaji'], ['Gaji harian', data.payroll.wage], ['Potongan (patah+garansi+hilang)', data.payroll.potongCapped], ['Gaji dibayar', data.payroll.gajiAkhir])
    }
    const csv = lines.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `corney-laporan-${period.toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const Card = ({ className = '', children }) => (
    <section className={`bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant ${className}`}>{children}</section>
  )

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container shadow-sm shrink-0">
        <div className="flex items-center gap-3 px-4 h-[64px] max-w-3xl mx-auto">
          <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <h1 className="text-headline-md font-headline-md tracking-tight flex-1">Laporan Keuangan</h1>
          <button onClick={exportCsv} title="Export CSV" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 active:scale-95"><Icon name="ios_share" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 max-w-3xl mx-auto w-full space-y-5">
        {/* Period + branch */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-surface-container-highest rounded-full p-1 flex items-center">
              {['Bulan', 'Minggu', 'Hari'].map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`flex-1 py-2 rounded-full text-label-md font-label-md transition-all ${period === p ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-on-surface-variant'}`}>{p}</button>
              ))}
            </div>
            <button onClick={exportCsv} className="w-12 h-12 flex items-center justify-center bg-surface-container-high rounded-xl text-primary active:scale-95"><Icon name="download" /></button>
          </div>
          <div className="bg-surface-container-low border border-outline-variant px-3 py-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 mb-2 text-on-surface-variant"><Icon name="storefront" className="text-primary !text-[18px]" /> <span className="text-label-md">Cabang</span> <span className="ml-auto text-[11px] italic">dari Master Laporan</span></div>
            <div className="flex gap-2 flex-wrap">
              {[['all', 'Semua Cabang'], ...BRANCHES.map((b) => [b.id, b.name.replace('CORNEY ', '')])].map(([id, lbl]) => (
                <button key={id} onClick={() => setBranchId(id)} className={`px-3 py-1.5 rounded-full font-label-md transition-all ${branchId === id ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant text-on-surface-variant'}`}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI band */}
        <section className="grid grid-cols-2 gap-3">
          <div className="col-span-2 bg-primary-container text-on-primary-container p-5 rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] relative overflow-hidden">
            <div className="relative z-10">
              <p className="opacity-80 text-label-md font-label-md uppercase tracking-wider">Total Omzet</p>
              <h2 className="text-display-md font-display-md mt-1">{fmtRp(data.omzet)}</h2>
              <div className="flex items-center gap-1 mt-2 text-label-md"><Icon name="trending_up" className="text-sm" /> <span>{data.trend}</span></div>
            </div>
            <Icon name="payments" fill className="absolute -right-4 -bottom-4 opacity-10 !text-[120px]" />
          </div>

          {/* Laba Bersih — klik untuk rincian per tanggal × cabang (dari Master Laporan) */}
          <button onClick={() => setLabaOpen((v) => !v)} className="col-span-2 text-left bg-surface-container-lowest p-5 rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] border-l-8 border-green-500 flex items-center justify-between gap-3 active:scale-[.99] hover:border-green-600 transition-all">
            <div className="min-w-0">
              <p className="text-on-surface-variant text-label-md font-label-md uppercase tracking-wider flex items-center gap-1">Laba Bersih <Icon name={labaOpen ? 'expand_less' : 'expand_more'} className="!text-[18px]" /></p>
              <h3 className={`text-display-md font-display-md mt-1 ${data.laba < 0 ? 'text-error' : 'text-green-700'}`}>{fmtRp(data.laba)}</h3>
              <p className="text-[11px] text-on-surface-variant mt-1">= uang masuk bersih − uang keluar laci − <b>belanja supplier {fmtRp(data.belanja)}</b> · <span className="text-primary font-bold">ketuk untuk rincian</span></p>
            </div>
            <Icon name="savings" fill className="text-green-600/30 !text-[56px] shrink-0" />
          </button>
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-surface-variant">
            <p className="text-on-surface-variant text-label-md font-label-md">Transaksi</p>
            <h3 className="text-headline-lg font-headline-lg mt-1">{data.trx.toLocaleString('id-ID')}</h3>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-surface-variant">
            <p className="text-on-surface-variant text-label-md font-label-md">Selisih Kas</p>
            <div className="flex items-center gap-2 mt-1">
              {data.selisihKas == null ? (
                <span className="text-headline-lg font-headline-lg text-on-surface-variant">—</span>
              ) : (
                <>
                  <span className={`text-headline-lg font-headline-lg ${data.selisihKas === 0 ? 'text-green-600' : 'text-error'}`}>{data.selisihKas > 0 ? '+' : ''}{fmtRp(data.selisihKas)}</span>
                  {data.selisihKas !== 0 && <span className="bg-error-container text-on-error-container text-[10px] px-1.5 py-0.5 rounded-full font-bold">CEK</span>}
                </>
              )}
            </div>
            {data.selisihKas == null && <p className="text-[11px] text-on-surface-variant mt-1">belum ada data periode ini</p>}
          </div>
          <div className="col-span-2 bg-secondary-container text-on-secondary-container p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-label-md font-label-md">Uang Urgent (Petty Cash)</p>
              <h3 className="text-headline-md font-headline-md">{fmtRp(data.urgent || 0)}</h3>
            </div>
            <Icon name="emergency" className="text-3xl" />
          </div>
        </section>

        {/* Rincian Laba Bersih (drill-down) — per tanggal × cabang, belanja bisa diisi di sini */}
        {labaOpen && (() => {
          const rows = salesInPeriod(period, bid)
          let tSisa = 0, tBel = 0, tLaba = 0
          return (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant bg-green-50/50 flex items-center gap-2">
                <Icon name="savings" className="text-green-600" />
                <h3 className="font-label-lg text-on-surface">Rincian Laba Bersih · {period}{branchId !== 'all' ? ` · ${branchName(bid).replace('CORNEY ', '')}` : ''}</h3>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-label-md text-on-surface-variant text-center">Belum ada data penjualan pada periode ini. Belanja menempel ke tanggalnya — isi di tanggal yang masuk periode ini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] border-collapse min-w-max">
                    <thead>
                      <tr className="bg-surface-container-low text-on-surface-variant">
                        <th className="px-3 py-2 text-left">Tanggal</th>
                        <th className="px-3 py-2 text-left">Cabang</th>
                        <th className="px-3 py-2 text-right bg-green-600 text-white">💰 Sisa Bersih</th>
                        <th className="px-3 py-2 text-center bg-orange-500 text-white">🛒 Belanja Supplier</th>
                        <th className="px-3 py-2 text-right bg-emerald-700 text-white">Total Bersih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, ri) => {
                        const sb = rowSisaBersih(r)
                        const bel = expenseAmount(r.tgl, r.branchId)
                        const acuan = fulfilledSpend(r.tgl, r.branchId) // total belanja terverifikasi supplier
                        const beda = acuan > 0 && bel !== acuan
                        const laba = sb - bel
                        tSisa += sb; tBel += bel; tLaba += laba
                        return (
                          <tr key={r.id} className={ri % 2 ? 'bg-surface-container-low/40' : ''}>
                            <td className="px-3 py-2 font-bold whitespace-nowrap">{r.tgl}</td>
                            <td className="px-3 py-2 text-primary font-bold whitespace-nowrap">{branchName(r.branchId).replace('CORNEY ', '')}</td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-green-700 font-bold bg-green-50">{fmtRp(sb)}</td>
                            <td className="px-2 py-1.5 bg-orange-50/50 align-top">
                              <div className="relative"><span className="absolute left-2 top-[18px] -translate-y-1/2 text-[11px] font-bold text-on-surface-variant">Rp</span>
                                <input inputMode="numeric" value={bel ? bel.toLocaleString('id-ID') : ''} onChange={(e) => setExpense(r.tgl, r.branchId, Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="0" className={`w-28 h-9 pl-7 pr-2 text-right rounded-lg border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold tabular-nums bg-white ${beda ? 'border-amber-400' : 'border-outline'}`} />
                              </div>
                              {acuan > 0 && (
                                <div className="mt-1 text-[10px] leading-tight flex flex-col items-end gap-0.5">
                                  <button onClick={() => setExpense(r.tgl, r.branchId, acuan)} title="Klik untuk isi dari total belanja supplier" className="text-primary font-bold hover:underline flex items-center gap-0.5"><Icon name="content_paste" className="!text-[12px]" /> Supplier: {fmtRp(acuan)}</button>
                                  {beda && <span className="px-1 rounded bg-amber-100 text-amber-700 font-bold">{bel === 0 ? 'belum diisi' : `beda ${fmtRp(Math.abs(bel - acuan))}`}</span>}
                                </div>
                              )}
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-bold bg-emerald-50 ${laba < 0 ? 'text-error' : 'text-emerald-800'}`}>{fmtRp(laba)}</td>
                          </tr>
                        )
                      })}
                      <tr className="bg-surface-container-high font-bold border-t-2 border-outline-variant">
                        <td className="px-3 py-2.5" colSpan={2}>TOTAL</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-green-700 bg-green-100/60">{fmtRp(tSisa)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-orange-700 bg-orange-100/60">{fmtRp(tBel)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums bg-emerald-100/60 ${tLaba < 0 ? 'text-error' : 'text-emerald-800'}`}>{fmtRp(tLaba)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              <p className="px-4 py-2.5 text-[11px] text-on-surface-variant flex items-start gap-1.5 border-t border-outline-variant"><Icon name="info" className="!text-[15px] mt-0.5 shrink-0" /> <span>Isi <b>Belanja Supplier</b> di baris tanggalnya → Total Bersih & Laba langsung berubah. Angka <b className="text-primary">Supplier: Rp…</b> di bawah kotak adalah <b>total belanja terverifikasi</b> (dipenuhi supplier + beli luar) sebagai acuan — klik untuk mengisi otomatis. Badge <span className="px-1 rounded bg-amber-100 text-amber-700 font-bold">beda</span> muncul bila ketikanmu ≠ data supplier (tetap boleh beda, sekadar pengingat).</span></p>
            </Card>
          )
        })()}

        {/* Potongan Gaji (owner-only) */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-label-lg font-label-lg flex items-center gap-2"><Icon name="account_balance_wallet" className="text-primary text-[20px]" /> Potongan Gaji Kasir</h3>
            <span className="text-[10px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full font-bold uppercase">Owner</span>
          </div>
          {data.payroll ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center"><span className="text-on-surface-variant">Gaji harian</span><span className="font-bold">{fmtRp(data.payroll.wage)}</span></div>
              <div className="flex justify-between items-center"><span className="text-on-surface-variant">Potongan (patah + garansi + hilang)</span><span className="font-bold text-error">− {fmtRp(data.payroll.potongCapped)}</span></div>
              {data.payroll.potongTotal > data.payroll.potongCapped && (
                <p className="text-[11px] text-on-surface-variant -mt-1">Nilai asli {fmtRp(data.payroll.potongTotal)} dibatasi 100% gaji (sisanya kerugian usaha).</p>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-outline-variant"><span className="font-label-lg">Gaji dibayar</span><span className="font-headline-md text-headline-md text-primary">{fmtRp(data.payroll.gajiAkhir)}</span></div>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-surface-container-low rounded-lg p-3">
              <Icon name="info" className="text-on-surface-variant shrink-0" />
              <p className="text-sm text-on-surface-variant">Uang harian karyawan periode ini (dari Master Laporan): <b>{fmtRp(data.gaji || 0)}</b>. Rincian potongan gaji (patah/garansi/hilang) tampil saat kasir menyelesaikan Closing hari ini.</p>
            </div>
          )}
        </Card>

        {/* Trend (sample sparkline) */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-label-lg font-label-lg">Tren Pertumbuhan</h3>
            <span className="text-label-md text-primary font-bold">{period === 'Hari' ? 'hari ini' : period === 'Bulan' ? '30 hari' : '7 hari'}</span>
          </div>
          <div className="h-32 w-full relative">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 400 100" preserveAspectRatio="none">
              <defs><linearGradient id="cf" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#DA291C" stopOpacity="0.2" /><stop offset="100%" stopColor="#DA291C" stopOpacity="0" /></linearGradient></defs>
              <path d="M0,80 Q50,75 100,50 T200,40 T300,20 T400,10 L400,100 L0,100 Z" fill="url(#cf)" />
              <path d="M0,80 Q50,75 100,50 T200,40 T300,20 T400,10" fill="none" stroke="#DA291C" strokeLinecap="round" strokeWidth="3" />
            </svg>
          </div>
          <p className="text-[11px] text-on-surface-variant italic">Grafik tren ilustratif — kurva harian detail menyusul saat backend siap (TAHAP 4).</p>
        </Card>

        {/* Rekap per Channel */}
        <Card className="p-5">
          <h3 className="text-label-lg font-label-lg mb-4">Rekap per Channel</h3>
          {activeChannels.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-4 text-center">Belum ada transaksi pada periode ini.</p>
          ) : (
            <div className="space-y-4">
              {activeChannels.map((c) => {
                const val = data.channels[c.id] || 0
                const pct = channelTotal ? Math.round((val / channelTotal) * 100) : 0
                return (
                  <div key={c.id} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0"><Icon name={c.icon} className={c.text} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center"><span className="text-body-md font-semibold">{c.label}</span><span className="text-body-md font-bold">{fmtRp(val)}</span></div>
                      <div className="w-full bg-surface-variant h-1.5 rounded-full mt-1.5"><div className={`${c.color} h-full rounded-full`} style={{ width: `${pct}%` }} /></div>
                    </div>
                    <span className="text-label-md font-label-md text-outline w-9 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Laporan Tutup Hari */}
        <section className="space-y-3">
          <h3 className="text-headline-md font-headline-md">Laporan Tutup Hari</h3>
          {closingCards.length > 0 ? (
            <div className="space-y-2">
              {closingCards.map((c) => (
                <div key={c.id} className={`bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center justify-between border-l-4 ${c.selisihKas === 0 ? 'border-l-green-500' : 'border-l-error'}`}>
                  <div>
                    <p className="text-label-md text-outline">{c.tgl}</p>
                    <h4 className="text-body-lg font-bold">{branchName(c.branchId)}</h4>
                    <span className="text-label-md bg-surface-container-high px-2 py-0.5 rounded text-on-surface inline-block mt-1">Omzet: {fmtRp(c.omzet)}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-label-md text-outline">Selisih Kas</p>
                    <p className={`text-body-md font-bold ${c.selisihKas === 0 ? 'text-green-600' : 'text-error'}`}>{c.selisihKas === 0 ? 'Normal' : fmtRp(c.selisihKas)}</p>
                    {c.selisihKas !== 0 && (
                      c.cashReason ? (
                        <button onClick={() => setReasonPopup({ tgl: c.tgl, branch: branchName(c.branchId), selisih: c.selisihKas, reason: c.cashReason })} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline active:scale-95">
                          <Icon name="chat" className="!text-[14px]" /> Lihat Alasan
                        </button>
                      ) : (
                        <span className="mt-1 inline-block text-[11px] text-on-surface-variant/70 italic">tanpa alasan</span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface-container-low p-4 rounded-xl border border-dashed border-outline-variant flex items-start gap-3">
              <Icon name="history" className="text-on-surface-variant shrink-0" />
              <p className="text-sm text-on-surface-variant">Belum ada closing pada periode ini. Kartu laporan tutup hari muncul setelah kasir menyelesaikan Closing.</p>
            </div>
          )}
        </section>

        {/* Tutup Bulan (Fase 2 / 7.1.3) */}
        <section className="bg-surface-container p-6 rounded-xl border-2 border-dashed border-outline-variant text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-secondary-container/40 text-on-secondary-container px-4 py-1.5 rounded-full">
            <Icon name="lock_clock" className="text-[18px]" /> <span className="text-label-lg font-bold">Tutup & Finalisasi Bulan</span>
          </div>
          <p className="text-on-surface-variant text-body-md">Mengunci laporan jadi arsip resmi + PDF bulanan. Tersedia di <strong>Fase 2</strong> (§7.1.3, butuh backend).</p>
          <button disabled className="w-full bg-surface-variant text-on-surface-variant/60 h-[52px] rounded-xl font-bold cursor-not-allowed">Segera (Fase 2)</button>
        </section>
      </main>

      {/* Popup kecil: alasan selisih kas (ditulis kasir saat tutup toko) */}
      {reasonPopup && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4" onClick={() => setReasonPopup(null)}>
          <div className="w-full max-w-sm bg-surface rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 bg-error-container/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon name="chat_info" className="text-error" />
                <h3 className="font-headline-md text-error leading-tight">Alasan Selisih Kas</h3>
              </div>
              <button onClick={() => setReasonPopup(null)} className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center active:scale-95"><Icon name="close" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-label-md">
                <span className="text-on-surface-variant">{reasonPopup.branch} · {reasonPopup.tgl}</span>
                <span className="font-bold text-error">{reasonPopup.selisih > 0 ? '+' : ''}{fmtRp(reasonPopup.selisih)}</span>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3 text-on-surface text-body-md leading-snug whitespace-pre-line">
                {reasonPopup.reason}
              </div>
              <p className="text-[11px] text-on-surface-variant/70 italic flex items-start gap-1"><Icon name="info" className="!text-[14px] shrink-0 mt-0.5" /> Ditulis kasir saat tutup toko. Hilang otomatis saat Reset Bulan (satu paket dengan laporan harian ini).</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
