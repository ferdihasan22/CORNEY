import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fmtRp } from '../data/menu.js'
import { useSupplier } from '../store/useSupplier.js'
import { toggleAvailable, SUP_CATS } from '../store/supplier.js'
import SupplierNav from './SupplierNav.jsx'

// 3.1 — SUP-05 Tandai Item Kosong. Ported from Stitch "mark_item_out_of_stock_supplier_app".
// Toggle ketersediaan → Owner & Operasional diberi tahu (satu arah); item kosong
// TIDAK otomatis masuk pesanan berikutnya. Cabang me-request ulang sendiri bila perlu.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const FILTERS = [['all', 'Semua'], ['ada', 'Tersedia'], ['kosong', 'Kosong']]

export default function SupplierStock() {
  const sup = useSupplier()
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState('')
  if (!localStorage.getItem('corney_supplier_session')) return <Navigate to="/supplier" replace />

  const match = (it) => filter === 'all' || (filter === 'ada' ? it.available : !it.available)
  const onToggle = (it) => { toggleAvailable(it.id); if (it.available) { setToast('Owner & Operasional diberi tahu. Item kosong tidak otomatis masuk pesanan berikutnya.'); setTimeout(() => setToast(''), 2800) } }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto"><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="inventory" /> Status Ketersediaan</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Supplier</p></div>
      </header>

      <div className="sticky top-[84px] z-30 bg-background px-5 py-3 flex gap-2">
        {FILTERS.map(([k, lbl]) => <button key={k} onClick={() => setFilter(k)} className={`px-4 py-1.5 rounded-full font-label-md transition-all ${filter === k ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant'}`}>{lbl}</button>)}
      </div>

      <main className="max-w-2xl mx-auto w-full px-5 pb-5 space-y-5">
        {Object.entries(SUP_CATS).map(([k, lbl]) => {
          const rows = (sup?.catalog || []).filter((i) => i.category === k && match(i))
          if (rows.length === 0) return null
          return (
            <section key={k} className="space-y-2">
              <h2 className="font-label-lg flex items-center gap-2"><span className={`w-1 h-5 rounded ${k === 'K1' ? 'bg-primary' : 'bg-secondary-container'}`} /> {k} · {lbl}</h2>
              {rows.map((it) => (
                <div key={it.id} className={`bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center justify-between gap-3 ${it.available ? '' : 'opacity-50 grayscale'}`}>
                  <div className="min-w-0"><h3 className="font-label-lg leading-tight">{it.name}</h3><p className="text-label-md text-on-surface-variant">{fmtRp(it.price)}/{it.unit} · <span className="text-[11px]">{it.category}</span></p></div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${it.available ? 'bg-green-100 text-green-700' : 'bg-surface-container-highest text-on-surface-variant'}`}>{it.available ? 'Tersedia' : 'Kosong'}</span>
                    <button onClick={() => onToggle(it)} className={`w-12 h-7 rounded-full p-0.5 transition-colors ${it.available ? 'bg-green-500' : 'bg-outline-variant'}`}>
                      <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${it.available ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )
        })}
        <p className="text-[12px] text-on-surface-variant/70 text-center flex items-center justify-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Cabang akan me-request ulang sendiri bila masih dibutuhkan (lewat peringatan stok cabang).</p>
      </main>

      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-on-surface text-surface px-5 py-3 rounded-2xl shadow-xl font-label-md text-center max-w-[90%]">{toast}</div>}
      <SupplierNav />
    </div>
  )
}
