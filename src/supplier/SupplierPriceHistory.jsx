import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fmtRp } from '../data/menu.js'
import { useSupplier } from '../store/useSupplier.js'
import SupplierNav from './SupplierNav.jsx'

// 3.1 — SUP-04 Riwayat Harga → Notif Owner. Ported from Stitch
// "price_history_owner_notification_supplier_app". Setiap perubahan harga memberi
// tahu Owner CORNEY (satu arah); supplier tak bisa lihat data internal CORNEY.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function SupplierPriceHistory() {
  const sup = useSupplier()
  const [q, setQ] = useState('')
  if (!localStorage.getItem('corney_supplier_session')) return <Navigate to="/supplier" replace />

  const catalog = (sup?.catalog || []).filter((it) => it.name.toLowerCase().includes(q.toLowerCase()))
  const histOf = (id) => (sup?.priceHistory || []).filter((h) => h.itemId === id)

  return (
    <div className="bg-background text-on-surface min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto"><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="history" /> Riwayat Harga</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Supplier</p></div>
      </header>

      <main className="max-w-2xl mx-auto w-full p-5 space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900"><Icon name="info" className="!text-[18px] shrink-0 mt-0.5" /><p className="text-label-md leading-snug">Setiap perubahan harga otomatis memberi tahu <strong>Owner CORNEY</strong> (satu arah). Anda tidak bisa melihat data internal CORNEY.</p></div>
        <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari item..." className="w-full pl-10 pr-4 h-11 rounded-xl border border-outline focus:border-primary outline-none bg-surface text-label-md" /></div>

        <div className="space-y-3">
          {catalog.map((it) => {
            const diff = it.price - it.prevPrice
            const hist = histOf(it.id)
            return (
              <div key={it.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)]">
                <div className="flex justify-between items-start">
                  <div><h3 className="font-headline-md text-headline-md leading-tight">{it.name}</h3><p className="text-[11px] text-on-surface-variant">per {it.unit} · diperbarui {it.lastPriceAt}</p></div>
                  <div className="text-right">
                    <p className={`font-headline-md flex items-center justify-end gap-1 ${diff > 0 ? 'text-error' : diff < 0 ? 'text-green-600' : 'text-on-surface'}`}>{diff !== 0 && <Icon name={diff > 0 ? 'trending_up' : 'trending_down'} className="!text-[18px]" />}{fmtRp(it.price)}</p>
                    <p className="text-[11px] text-on-surface-variant">{diff === 0 ? 'Harga tetap' : `${diff > 0 ? 'Naik' : 'Turun'} ${fmtRp(Math.abs(diff))}`}</p>
                  </div>
                </div>
                {hist.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-outline-variant/30 space-y-1">
                    {hist.map((h) => <div key={h.id} className="flex justify-between text-[12px] text-on-surface-variant"><span className="font-mono">{fmtRp(h.from)} → <strong className="text-on-surface">{fmtRp(h.to)}</strong></span><span>{h.at}</span></div>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
      <SupplierNav />
    </div>
  )
}
