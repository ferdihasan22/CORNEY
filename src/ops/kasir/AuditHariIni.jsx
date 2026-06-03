import { Navigate, useNavigate } from 'react-router-dom'
import { PARENT_FILLINGS, BRANCHES, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, soldByParent, breakageByParent, channelTotals } from '../../store/day.js'
import { useParStock } from '../../store/useParStock.js'
import { parOf } from '../../store/parstock.js'

// Audit Hari Ini (read-only) — for surprise operational/auditor checks:
//  • Stok per induk: Awal − Terjual − Patah = Sisa sistem (compare vs physical
//    fridge/freezer count).
//  • Omset per metode bayar (cross-check cash drawer & QRIS mutations).
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>
const CH = [
  { id: 'tunai', label: 'Tunai', icon: 'payments' },
  { id: 'qris_midtrans', label: 'QRIS Midtrans', icon: 'qr_code_2' },
  { id: 'qris_gopay', label: 'QRIS GoPay', icon: 'qr_code_scanner' },
  { id: 'gofood', label: 'GoFood', icon: 'delivery_dining' },
  { id: 'grabfood', label: 'GrabFood', icon: 'moped' },
]

export default function AuditHariIni() {
  const day = useDay()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  useParStock() // Stok Standar (diatur Owner)

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />

  const sold = soldByParent()
  const patah = breakageByParent()
  const standard = parOf(day.branchId)
  const { total, count } = channelTotals()
  const omzet = CH.reduce((s, c) => s + total[c.id], 0)
  const trx = CH.reduce((s, c) => s + count[c.id], 0)
  const belumBayar = (day.sales || []).filter((s) => !s.paid).length

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md flex items-center gap-3 px-4 sm:px-margin-page h-[64px] shrink-0">
        <button onClick={() => navigate('/ops/kasir/jualan')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary-container active:scale-95"><Icon name="arrow_back" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="font-headline-md text-headline-md leading-tight">Audit Hari Ini</h1>
          <p className="text-xs text-on-primary/80 truncate">{branch.name} · {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        <Icon name="fact_check" className="shrink-0" />
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-margin-page">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Stok hari ini */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Icon name="inventory_2" className="text-primary" />
              <h2 className="font-headline-md text-headline-md">Stok Hari Ini</h2>
            </div>
            <p className="text-xs text-on-surface-variant mb-3 flex items-center gap-1"><Icon name="info" className="!text-sm" /> Bandingkan <b>Sisa sistem</b> dengan hitung fisik di kulkas/freezer.</p>
            <div className="space-y-2">
              {PARENT_FILLINGS.map((p) => {
                const awal = day.openingStock?.[p.id] ?? 0
                const jual = sold[p.id] ?? 0
                const pat = patah[p.id] ?? 0
                const sisa = day.stock?.[p.id] ?? 0
                const std = standard[p.id] ?? 0
                const low = sisa <= 5
                return (
                  <div key={p.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-on-surface">{p.name}</h3>
                      <span className="text-xs text-on-surface-variant">standar {std}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex gap-2 text-sm text-on-surface-variant flex-wrap">
                        <span className="bg-surface-container px-2 py-1 rounded">Awal <b className="text-on-surface">{awal}</b></span>
                        <span className="bg-surface-container px-2 py-1 rounded">Terjual <b className="text-on-surface">−{jual}</b></span>
                        <span className="bg-error-container/50 px-2 py-1 rounded">Patah <b className="text-error">−{pat}</b></span>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-on-surface-variant leading-none">Sisa sistem</p>
                        <p className={`font-display-md text-headline-md ${low ? 'text-error' : 'text-primary'}`}>{sisa}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Omset per metode */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="account_balance_wallet" className="text-primary" />
              <h2 className="font-headline-md text-headline-md">Omset per Metode</h2>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 divide-y divide-outline-variant/40">
              {CH.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-3 text-on-surface"><Icon name={c.icon} className="text-on-surface-variant" /> {c.label} <span className="text-xs text-on-surface-variant">({count[c.id]} trx)</span></span>
                  <span className="font-bold text-on-surface">{fmtRp(total[c.id])}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low">
                <span className="font-bold text-on-surface">Total Omzet <span className="text-xs font-normal text-on-surface-variant">({trx} trx{belumBayar > 0 ? ` · ${belumBayar} belum bayar` : ''})</span></span>
                <span className="font-display-md text-headline-md text-primary">{fmtRp(omzet)}</span>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-2 flex items-center gap-1"><Icon name="info" className="!text-sm" /> Tunai = cocokkan laci · QRIS GoPay = cek mutasi · Midtrans/GoFood/Grab = catatan otomatis.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
