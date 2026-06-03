import { useNavigate } from 'react-router-dom'
import { fmtRp } from '../../data/menu.js'
import { useLedger } from '../../store/useLedger.js'
import { markReceived } from '../../store/ledger.js'

// 2.6 — OWN-08 Buku Besar Pembelian. One row per item type: latest price + change
// marker, ordered vs received, period recap. Source = SupplierOrder + Operasional
// confirm (TAHAP 4). No dedicated Stitch ref; designed consistent with Owner.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OwnerLedger() {
  const navigate = useNavigate()
  const rows = useLedger() || []
  const totalReceived = rows.reduce((s, r) => s + r.received * r.latestPrice, 0)
  const pending = rows.filter((r) => r.received < r.ordered)

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Buku Besar Pembelian</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Recap */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 text-center"><p className="text-label-md text-on-surface-variant">Nilai diterima (periode)</p><p className="font-headline-lg text-primary mt-1">{fmtRp(totalReceived)}</p></div>
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 text-center"><p className="text-label-md text-on-surface-variant">Belum lengkap</p><p className="font-headline-lg text-on-surface mt-1">{pending.length} item</p></div>
        </div>

        <div className="space-y-2">
          {rows.map((r) => {
            const diff = r.latestPrice - r.prevPrice
            const kurang = r.ordered - r.received
            return (
              <div key={r.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-headline-md text-headline-md leading-tight">{r.item}</h3>
                    <p className="text-[11px] text-on-surface-variant">per {r.unit} · {r.lastDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-headline-md text-on-surface">{fmtRp(r.latestPrice)}</p>
                    <p className={`text-[11px] font-bold flex items-center justify-end gap-0.5 ${diff > 0 ? 'text-error' : diff < 0 ? 'text-green-600' : 'text-on-surface-variant'}`}>
                      {diff !== 0 && <Icon name={diff > 0 ? 'arrow_upward' : 'arrow_downward'} className="!text-[14px]" />}
                      {diff === 0 ? 'harga tetap' : `${diff > 0 ? '+' : ''}${fmtRp(diff)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/30">
                  <span className="text-label-md text-on-surface-variant">Dipesan <strong className="text-on-surface">{r.ordered}</strong> · Diterima <strong className="text-on-surface">{r.received}</strong></span>
                  {kurang > 0 ? (
                    <button onClick={() => markReceived(r.id)} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1"><Icon name="local_shipping" className="!text-[16px]" /> Kurang {kurang} · tandai diterima</button>
                  ) : (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"><Icon name="check" className="!text-[14px]" /> Lengkap</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[12px] text-on-surface-variant/70 text-center pt-1 flex items-center justify-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Data masuk dari pesanan Supplier + konfirmasi terima Operasional.</p>
      </main>
    </div>
  )
}
