import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS, fmtRp } from '../../data/menu.js'
import { useDeposits } from '../../store/useDeposits.js'
import { useFreezer } from '../../store/useFreezer.js'
import { useStockDaily } from '../../store/useStockDaily.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { useUsage } from '../../store/useUsage.js'
import { useExpense } from '../../store/useExpense.js'
import { stockHilang } from '../../store/stockdaily.js'
import { aggregateByBranch } from '../../store/aggregate.js'

// 3.4 — Agregat Lintas Cabang. Bandingkan kinerja cabang berdampingan: omzet,
// laba, hari laporan + anomali kas & alarm freezer. SEMUA angka omzet/laba
// dihitung dari MASTER LAPORAN (satu-satunya sumber kebenaran), bukan data sendiri.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OwnerCrossBranch() {
  const navigate = useNavigate()
  const deposits = useDeposits() || []
  const freezer = useFreezer() || {}
  useStockDaily(); useSalesDaily(); useUsage(); useExpense() // subscribe → ikut update MASTER LAPORAN
  const agg = aggregateByBranch() // omzet/laba/hari per cabang DARI MASTER LAPORAN

  const rows = BRANCHES.map((b) => {
    const s = agg[b.id] || { omzet: 0, laba: 0, hari: 0 }
    const kasAnomali = deposits.filter((d) => d.branchId === b.id && (d.status === 'selisih' || d.auditorStatus === 'selisih')).length
    const freezerAlerts = PARENT_FILLINGS.filter((p) => { const f = (freezer[b.id] || {})[p.id]; return f && f.sisa < f.min }).length
    const hilang = stockHilang(b.id).reduce((sum, h) => sum + h.qty, 0)
    return { b, omzet: s.omzet, laba: s.laba, hari: s.hari, kasAnomali, freezerAlerts, hilang }
  })
  const maxOmzet = Math.max(1, ...rows.map((r) => r.omzet))
  const totOmzet = rows.reduce((s, r) => s + r.omzet, 0)
  const totLaba = rows.reduce((s, r) => s + r.laba, 0)

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Agregat Lintas Cabang</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary-container text-on-primary-container rounded-2xl p-4"><p className="text-label-md opacity-90">Total Omzet</p><p className="font-headline-lg mt-1">{fmtRp(totOmzet)}</p></div>
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40"><p className="text-label-md text-on-surface-variant">Total Laba Bersih</p><p className={`font-headline-lg mt-1 ${totLaba < 0 ? 'text-error' : 'text-green-600'}`}>{fmtRp(totLaba)}</p></div>
        </div>

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.b.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)]">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="storefront" className="!text-[18px] text-primary" /> {r.b.name}</h3>
                <span className="font-headline-md text-primary">{fmtRp(r.omzet)}</span>
              </div>
              <div className="h-2.5 bg-surface-container rounded-full overflow-hidden mb-3"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((r.omzet / maxOmzet) * 100)}%` }} /></div>
              <div className="grid grid-cols-5 gap-2 text-center">
                <div><p className="text-[10px] uppercase text-on-surface-variant">Laba</p><p className="font-label-lg text-green-600">{fmtRp(r.laba).replace('Rp', '').trim()}</p></div>
                <div><p className="text-[10px] uppercase text-on-surface-variant">Hari Laporan</p><p className="font-label-lg">{r.hari}</p></div>
                <div><p className="text-[10px] uppercase text-on-surface-variant">Anomali Kas</p><p className={`font-label-lg ${r.kasAnomali > 0 ? 'text-error' : 'text-on-surface'}`}>{r.kasAnomali}</p></div>
                <div><p className="text-[10px] uppercase text-on-surface-variant">Freezer Min</p><p className={`font-label-lg ${r.freezerAlerts > 0 ? 'text-error' : 'text-on-surface'}`}>{r.freezerAlerts}</p></div>
                <div><p className="text-[10px] uppercase text-on-surface-variant">Stok Hilang</p><p className={`font-label-lg ${r.hilang > 0 ? 'text-error' : 'text-on-surface'}`}>{r.hilang}</p></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-on-surface-variant/70 text-center flex items-center justify-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Omzet & laba dihitung LIVE dari <b>Master Laporan</b> (sumber kebenaran), ikut berubah saat ada koreksi. Anomali kas & alarm freezer juga LIVE.</p>
      </main>
    </div>
  )
}
