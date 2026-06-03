import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useOrders } from '../../store/useOrders.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { salesInPeriod } from '../../store/aggregate.js'
import { useMaster } from '../../store/useMaster.js'

// OWN Penjualan Online & Walk-in — KPI, grafik tren, perbandingan, analisa, +
// daftar pesanan online ringkas. Omzet split walk-in/online dari Master Laporan
// (salesdaily.source); detail Ambil/Maxim & daftar dari orders store.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const nameOf = (id) => (BRANCHES.find((b) => b.id === id)?.name || id).replace('CORNEY ', '')
const dnum = (t) => { const [d, m, y] = (t || '').split('/'); return Number(y) * 10000 + Number(m) * 100 + Number(d) }
const STATUS = { baru: 'Baru', diproses: 'Proses', siap: 'Siap', selesai: 'Selesai' }
const STATUS_CLS = { baru: 'bg-secondary-container text-on-secondary-container', diproses: 'bg-blue-100 text-blue-700', siap: 'bg-amber-100 text-amber-700', selesai: 'bg-green-100 text-green-700' }

export default function OwnerOnlineOrders() {
  const navigate = useNavigate()
  const orders = useOrders() || []
  const master = useMaster()
  useSalesDaily()
  const [period, setPeriod] = useState('Bulan')
  const [branchId, setBranchId] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const bid = branchId === 'all' ? undefined : branchId
  const menuName = (id) => (master?.menus || []).find((m) => m.id === id)?.name || id

  // ── Omzet walk-in vs online (Master Laporan) ──
  const sales = salesInPeriod(period, bid)
  const walkin = sales.reduce((s, r) => s + (r.source?.walkin || 0), 0)
  const onlineSd = sales.reduce((s, r) => s + (r.source?.online || 0), 0)
  const totalOmzet = walkin + onlineSd
  const pct = (v) => (totalOmzet > 0 ? Math.round((v / totalOmzet) * 100) : 0)

  // Tren per hari (gabungan cabang) untuk grafik batang.
  const byDayMap = {}
  sales.forEach((r) => { const k = r.tgl; if (!byDayMap[k]) byDayMap[k] = { tgl: k, walkin: 0, online: 0 }; byDayMap[k].walkin += r.source?.walkin || 0; byDayMap[k].online += r.source?.online || 0 })
  const byDay = Object.values(byDayMap).sort((a, b) => dnum(a.tgl) - dnum(b.tgl))
  const maxDay = Math.max(1, ...byDay.map((d) => d.walkin + d.online))
  const busiest = byDay.reduce((best, d) => (!best || (d.walkin + d.online) > (best.walkin + best.online) ? d : best), null)

  // ── Pesanan online (orders store): detail + Ambil/Maxim ──
  const now = new Date()
  const inPeriod = (iso) => { const d = new Date(iso); if (period === 'Hari') return d.toDateString() === now.toDateString(); if (period === 'Minggu') { const diff = (now - d) / 86400000; return diff >= 0 && diff < 7 } return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }
  const oRows = orders.filter((o) => o.paid && (!bid || o.branchId === bid) && inPeriod(o.createdAt)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const ambil = oRows.filter((o) => o.method !== 'maxim')
  const maxim = oRows.filter((o) => o.method === 'maxim')
  const oOmzet = oRows.reduce((s, o) => s + (o.total || 0), 0)
  const avgOrder = oRows.length ? Math.round(oOmzet / oRows.length) : 0

  // Perbandingan antar cabang (selalu semua cabang, periode terpilih).
  const perBranch = BRANCHES.map((b) => {
    const rs = salesInPeriod(period, b.id)
    const w = rs.reduce((s, r) => s + (r.source?.walkin || 0), 0)
    const on = rs.reduce((s, r) => s + (r.source?.online || 0), 0)
    const oc = orders.filter((o) => o.paid && o.branchId === b.id && inPeriod(o.createdAt)).length
    return { id: b.id, name: nameOf(b.id), w, on, tot: w + on, oc }
  }).sort((a, b) => b.tot - a.tot)
  const maxBranch = Math.max(1, ...perBranch.map((x) => x.tot))

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="insights" /> Penjualan Online & Walk-in</h1>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-5 space-y-4">
        {/* Filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="bg-surface-container-highest rounded-full p-1 flex">
            {['Hari', 'Minggu', 'Bulan'].map((p) => <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-full text-label-md ${period === p ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>{p}</button>)}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[['all', 'Semua'], ...BRANCHES.map((b) => [b.id, nameOf(b.id)])].map(([id, lbl]) => (
              <button key={id} onClick={() => setBranchId(id)} className={`px-3 py-1.5 rounded-full text-label-md ${branchId === id ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant'}`}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface-container-lowest rounded-2xl p-3 border border-outline-variant/40 text-center"><p className="text-[11px] text-on-surface-variant">Total Omzet</p><p className="font-headline-md text-primary mt-1 leading-tight">{fmtRp(totalOmzet)}</p></div>
          <div className="bg-tertiary-fixed/40 rounded-2xl p-3 border border-outline-variant/40 text-center"><p className="text-[11px] text-on-surface-variant">Walk-in</p><p className="font-headline-md mt-1 leading-tight">{fmtRp(walkin)}</p><p className="text-[11px] text-on-surface-variant">{pct(walkin)}%</p></div>
          <div className="bg-blue-50 rounded-2xl p-3 border border-blue-200 text-center"><p className="text-[11px] text-blue-800">Online</p><p className="font-headline-md text-blue-700 mt-1 leading-tight">{fmtRp(onlineSd)}</p><p className="text-[11px] text-blue-800">{pct(onlineSd)}%</p></div>
        </div>

        {/* Disclaimer bila omzet online (Master Laporan) ada tapi rincian pesanan kosong */}
        {onlineSd > 0 && oRows.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-amber-900 text-[12px] leading-snug">
            <Icon name="info" fill className="!text-[18px] shrink-0 mt-0.5" />
            <p>Omzet <b>Online {fmtRp(onlineSd)}</b> berasal dari <b>Master Laporan</b> (closing kasir) dan itulah angka yang dipakai. Tapi <b>rincian pesanan</b> (Ambil/Maxim & daftar di bawah) belum ada untuk periode ini — biasanya karena pesanan dicatat manual di closing tanpa lewat aplikasi pelanggan, atau ini sisa data contoh. KPI omzet tetap benar.</p>
          </div>
        )}

        {/* Pie: Walk-in vs Online */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40">
          <h2 className="font-label-lg flex items-center gap-2 mb-3"><Icon name="donut_large" className="text-primary !text-[18px]" /> Walk-in vs Online</h2>
          <div className="flex items-center gap-5">
            <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
              <div className="w-full h-full rounded-full" style={{ background: totalOmzet > 0 ? `conic-gradient(#f59e0b 0 ${pct(walkin)}%, #3b82f6 ${pct(walkin)}% 100%)` : '#e5e7eb' }} />
              <div className="absolute inset-0 m-auto rounded-full bg-surface-container-lowest flex flex-col items-center justify-center" style={{ width: 72, height: 72 }}>
                <span className="text-[9px] text-on-surface-variant">Total</span>
                <span className="font-bold text-[11px] leading-tight text-center px-1">{fmtRp(totalOmzet)}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5 text-label-md min-w-0">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#f59e0b' }} /> <span className="flex-1">Walk-in</span> <b>{pct(walkin)}%</b> <span className="text-on-surface-variant text-[12px] w-24 text-right">{fmtRp(walkin)}</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#3b82f6' }} /> <span className="flex-1">Online</span> <b>{pct(onlineSd)}%</b> <span className="text-on-surface-variant text-[12px] w-24 text-right">{fmtRp(onlineSd)}</span></div>
            </div>
          </div>
        </section>

        {/* Grafik tren per hari */}
        {byDay.length > 1 && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40">
            <h2 className="font-label-lg flex items-center gap-2 mb-3"><Icon name="bar_chart" className="text-primary !text-[18px]" /> Tren Harian <span className="text-label-md text-on-surface-variant font-normal">(▮ walk-in · ▮ online)</span></h2>
            <div className="flex items-end gap-1.5 h-40 overflow-x-auto pb-1">
              {byDay.map((d) => {
                const tot = d.walkin + d.online
                const h = Math.round((tot / maxDay) * 100)
                const wH = tot > 0 ? Math.round((d.walkin / tot) * 100) : 0
                return (
                  <div key={d.tgl} className="flex flex-col items-center gap-1 shrink-0 w-9" title={`${d.tgl}: ${fmtRp(tot)}`}>
                    <div className="w-full flex flex-col justify-end rounded-t overflow-hidden" style={{ height: `${Math.max(4, h)}%` }}>
                      <div className="bg-blue-500" style={{ height: `${100 - wH}%` }} />
                      <div className="bg-tertiary" style={{ height: `${wH}%` }} />
                    </div>
                    <span className="text-[9px] text-on-surface-variant">{d.tgl.slice(0, 5)}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Perbandingan antar cabang */}
        {perBranch.length > 1 && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40">
            <h2 className="font-label-lg flex items-center gap-2 mb-3"><Icon name="leaderboard" className="text-primary !text-[18px]" /> Perbandingan Cabang <span className="text-label-md text-on-surface-variant font-normal">({period})</span></h2>
            <div className="space-y-3">
              {perBranch.map((c) => (
                <div key={c.id}>
                  <div className="flex justify-between text-label-md mb-1"><span className="font-bold">{c.name}</span><span className="text-on-surface-variant">{fmtRp(c.tot)} · {c.oc} online</span></div>
                  <div className="h-5 rounded-full overflow-hidden flex bg-surface-container" style={{ width: `${Math.max(8, Math.round((c.tot / maxBranch) * 100))}%` }}>
                    <div className="bg-tertiary h-full" style={{ width: `${c.tot > 0 ? Math.round((c.w / c.tot) * 100) : 0}%` }} />
                    <div className="bg-blue-500 h-full flex-1" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-2 flex items-center gap-2"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#f59e0b' }} /> walk-in</span> <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#3b82f6' }} /> online</span> · panjang bar = total omzet</p>
          </section>
        )}

        {/* Online: Ambil vs Maxim */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 space-y-2">
          <h2 className="font-label-lg flex items-center gap-2"><Icon name="smartphone" className="text-primary !text-[18px]" /> Pesanan Online: Ambil vs Maxim</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-tertiary-fixed/40 rounded-xl p-3"><p className="text-label-md text-on-surface-variant flex items-center gap-1"><Icon name="storefront" className="!text-[15px]" /> Ambil Sendiri</p><p className="font-headline-md mt-1">{ambil.length} <span className="text-label-md font-normal text-on-surface-variant">pesanan</span></p><p className="text-[11px] text-on-surface-variant">{fmtRp(ambil.reduce((s, o) => s + o.total, 0))}</p></div>
            <div className="bg-secondary-fixed/40 rounded-xl p-3"><p className="text-label-md text-on-surface-variant flex items-center gap-1"><Icon name="two_wheeler" className="!text-[15px]" /> Maxim</p><p className="font-headline-md mt-1">{maxim.length} <span className="text-label-md font-normal text-on-surface-variant">pesanan</span></p><p className="text-[11px] text-on-surface-variant">{fmtRp(maxim.reduce((s, o) => s + o.total, 0))}</p></div>
          </div>
        </section>

        {/* Analisa */}
        <section className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-blue-900 space-y-1.5">
          <h2 className="font-label-lg flex items-center gap-2"><Icon name="lightbulb" fill className="!text-[18px]" /> Analisa</h2>
          <ul className="text-label-md leading-snug space-y-1 list-disc ml-5">
            <li><b>Online {pct(onlineSd)}%</b> vs <b>Walk-in {pct(walkin)}%</b> dari total omzet {period.toLowerCase()} ini.</li>
            {oRows.length > 0 ? <li>Mayoritas online via <b>{maxim.length >= ambil.length ? 'Maxim' : 'Ambil Sendiri'}</b> ({Math.max(maxim.length, ambil.length)} pesanan). Rata-rata <b>{fmtRp(avgOrder)}</b>/pesanan.</li> : <li>Belum ada pesanan online pada periode ini.</li>}
            {busiest && byDay.length > 1 && <li>Hari teramai: <b>{busiest.tgl}</b> ({fmtRp(busiest.walkin + busiest.online)}).</li>}
            <li>{onlineSd > walkin ? 'Online lebih besar dari walk-in — pertimbangkan tambah kuota online & promo Maxim.' : 'Walk-in masih dominan — dorong online lewat banner & promo aplikasi.'}</li>
          </ul>
        </section>

        {/* Daftar pesanan online — RINGKAS */}
        <section className="space-y-2">
          <h2 className="font-label-lg flex items-center gap-2"><Icon name="receipt_long" className="text-primary !text-[18px]" /> Daftar Pesanan Online <span className="text-on-surface-variant font-normal">({oRows.length})</span></h2>
          {oRows.length === 0 ? (
            <p className="text-center text-on-surface-variant py-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/40">Belum ada pesanan online.</p>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 divide-y divide-outline-variant/30 overflow-hidden">
              {(showAll ? oRows : oRows.slice(0, 12)).map((o) => (
                <div key={o.id} className="px-3 py-2 flex items-center gap-2 text-label-md">
                  <span className="font-bold w-10 shrink-0">#{String(o.no).padStart(3, '0')}</span>
                  <Icon name={o.method === 'maxim' ? 'two_wheeler' : 'storefront'} className={`!text-[16px] shrink-0 ${o.method === 'maxim' ? 'text-secondary' : 'text-tertiary'}`} />
                  <span className="flex-1 min-w-0 truncate">{o.name || 'Pelanggan'} <span className="text-on-surface-variant">· {nameOf(o.branchId)}</span></span>
                  <span className="font-bold shrink-0">{fmtRp(o.total)}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLS[o.status] || ''}`}>{STATUS[o.status] || o.status}</span>
                </div>
              ))}
              {oRows.length > 12 && (
                <button onClick={() => setShowAll((v) => !v)} className="w-full py-2.5 text-label-md text-primary font-bold active:bg-surface-container">{showAll ? 'Sembunyikan' : `Lihat semua (${oRows.length})`}</button>
              )}
            </div>
          )}
        </section>

        <p className="text-[11px] text-on-surface-variant/70 leading-relaxed flex items-start gap-1.5"><Icon name="info" className="!text-[16px] shrink-0 mt-0.5" /> Omzet walk-in/online dari Master Laporan (closing kasir). Detail Ambil/Maxim & daftar dari pesanan customer (lunas).</p>
      </main>
    </div>
  )
}
