import { useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useMonthClose } from '../../store/useMonthClose.js'
import { lockMonth, unlockMonth } from '../../store/monthclose.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { useUsage } from '../../store/useUsage.js'
import { useExpense } from '../../store/useExpense.js'
import { useInvestorConfig } from '../../store/useInvestorConfig.js'
import { investorCfgOf } from '../../store/investorconfig.js'
import { aggregatePeriod } from '../../store/aggregate.js'

// 2.6 — Tutup Bulan. Mengunci bulan & MEMBEKUKAN angka final (→ Bagi Hasil OWN-11).
// Laba memakai SATU rumus kanonik aggregatePeriod().laba (sama persis dgn Laporan
// Keuangan & Bagi Hasil — sudah termasuk uang dipakai & selisih kas). Biaya = Omzet
// − Laba. Saat dikunci, angka per cabang + config investor disimpan sebagai snapshot.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OwnerMonthClose() {
  const navigate = useNavigate()
  useSalesDaily(); useUsage(); useExpense(); useInvestorConfig() // ikut MASTER LAPORAN + config
  const mc = useMonthClose() || { closed: {} }
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const snap = (mc.closed || {})[monthKey] || null
  const locked = !!snap

  // SATU rumus laba (kanonik) = aggregatePeriod().laba. Biaya = Omzet − Laba.
  // Saat terkunci, baca dari SNAPSHOT beku (bukan hitung-ulang live).
  const rows = BRANCHES.map((b) => {
    if (locked && snap.branches?.[b.id]) { const s = snap.branches[b.id]; return { b, omzet: s.omzet, biaya: s.biaya, laba: s.laba } }
    const a = aggregatePeriod('Bulan', b.id)
    return { b, omzet: a.omzet, biaya: a.omzet - a.laba, laba: a.laba }
  })
  const tot = rows.reduce((s, r) => ({ omzet: s.omzet + r.omzet, biaya: s.biaya + r.biaya, laba: s.laba + r.laba }), { omzet: 0, biaya: 0, laba: 0 })

  // Kunci → bekukan angka per cabang + config investor saat ini.
  const doLock = () => {
    const branches = {}
    BRANCHES.forEach((b) => {
      const a = aggregatePeriod('Bulan', b.id)
      const c = investorCfgOf(b.id)
      branches[b.id] = { omzet: a.omzet, laba: a.laba, biaya: a.omzet - a.laba, sewa: c.sewa, gaji: c.gaji, value: c.value, pct: c.pct }
    })
    lockMonth(monthKey, { branches })
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Tutup Bulan</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center justify-between">
          <div className="flex items-center gap-2"><Icon name="calendar_month" className="text-primary" /><span className="font-headline-md text-headline-md">{monthLabel}</span></div>
          {locked
            ? <span className="bg-green-500 text-white px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"><Icon name="lock" className="!text-[14px]" /> Terkunci</span>
            : <span className="bg-secondary-fixed text-on-secondary-fixed-variant px-3 py-1 rounded-full text-[11px] font-bold">Berjalan</span>}
        </div>

        {/* Per-branch recap */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 divide-y divide-outline-variant/30 shadow-[0_4px_16px_rgba(26,26,26,0.06)]">
          {rows.map((r) => (
            <div key={r.b.id} className="p-4">
              <div className="flex justify-between items-center mb-1"><h3 className="font-headline-md">{r.b.name}</h3><span className={`font-headline-md ${r.laba >= 0 ? 'text-green-600' : 'text-error'}`}>{fmtRp(r.laba)}</span></div>
              <p className="text-label-md text-on-surface-variant">Omzet {fmtRp(r.omzet)} · Biaya {fmtRp(r.biaya)}</p>
            </div>
          ))}
          <div className="p-4 bg-surface-container">
            <div className="flex justify-between items-center"><span className="font-label-lg">Total Laba Bersih (final)</span><span className="font-display-md text-primary">{fmtRp(tot.laba)}</span></div>
            <p className="text-label-md text-on-surface-variant mt-1">Omzet {fmtRp(tot.omzet)} · Biaya {fmtRp(tot.biaya)}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-amber-900"><Icon name="info" className="!text-[18px] shrink-0 mt-0.5" /><p className="text-label-md leading-snug">{locked
          ? <>Bulan ini <strong>terkunci & angka dibekukan</strong>. Mengoreksi Master Laporan tidak lagi mengubah angka final. Buka kunci bila perlu hitung ulang.</>
          : <>Setelah dikunci, angka bulan ini <strong>dibekukan</strong> (disimpan apa adanya) & dipakai untuk <strong>Bagi Hasil Investor</strong>.</>}</p></div>

        <button onClick={() => (locked ? unlockMonth(monthKey) : doLock())} className={`w-full min-h-[52px] rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg ${locked ? 'bg-surface-container-high text-on-surface' : 'bg-primary text-on-primary'}`}>
          <Icon name={locked ? 'lock_open' : 'lock'} /> {locked ? 'Buka Kunci Bulan' : 'Kunci & Tutup Bulan'}
        </button>
        {locked && <button onClick={() => navigate('/ops/owner/bagihasil')} className="w-full min-h-[48px] rounded-2xl border-2 border-primary text-primary font-bold flex items-center justify-center gap-2 active:scale-[0.98]"><Icon name="paid" /> Lihat Bagi Hasil Investor</button>}
      </main>
    </div>
  )
}
