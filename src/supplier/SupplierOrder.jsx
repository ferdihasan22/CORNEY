import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BRANCHES, OWNER_WA, fmtRp } from '../data/menu.js'
import { useSupplier } from '../store/useSupplier.js'
import { SUP_CATS } from '../store/supplier.js'
import SupplierNav from './SupplierNav.jsx'

// 3.1 — SUP-03 Susun Pesanan (keranjang multi-cabang). Ported from Stitch
// "compose_order_multi_branch_cart". Order per cabang; kirim rekap ke WA Owner
// (satu arah, tidak auto-sync). Only available items can be ordered.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function SupplierOrder() {
  const navigate = useNavigate()
  const sup = useSupplier()
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const [cart, setCart] = useState({}) // { [branchId]: { [itemId]: qty } }

  if (!localStorage.getItem('corney_supplier_session')) return <Navigate to="/supplier" replace />
  const items = (sup?.catalog || []).filter((i) => i.available)
  const itemById = (id) => items.find((i) => i.id === id)
  const qtyOf = (b, id) => (cart[b]?.[id]) || 0
  const setQty = (b, id, q) => setCart((c) => ({ ...c, [b]: { ...(c[b] || {}), [id]: Math.max(0, q) } }))

  const branchTotal = (b) => Object.entries(cart[b] || {}).reduce((s, [id, q]) => s + (itemById(id)?.price || 0) * q, 0)
  const grand = BRANCHES.reduce((s, b) => s + branchTotal(b.id), 0)

  const waText = () => {
    const lines = ['*Pesanan ke Supplier — CORNEY*', '']
    BRANCHES.forEach((b) => {
      const entries = Object.entries(cart[b.id] || {}).filter(([, q]) => q > 0)
      if (!entries.length) return
      lines.push(`*${b.name}*`)
      entries.forEach(([id, q]) => { const it = itemById(id); lines.push(`- ${it.name}: ${q} ${it.unit} × ${fmtRp(it.price)} = ${fmtRp(it.price * q)}`) })
      lines.push(`Subtotal: ${fmtRp(branchTotal(b.id))}`, '')
    })
    lines.push(`*Grand Total: ${fmtRp(grand)}*`)
    return encodeURIComponent(lines.join('\n'))
  }
  const branchesWithItems = BRANCHES.filter((b) => branchTotal(b.id) > 0)

  return (
    <div className="bg-background text-on-surface min-h-screen pb-44">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto"><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="add_shopping_cart" /> Susun Pesanan</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Supplier</p></div>
      </header>

      <main className="max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Branch chips */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {BRANCHES.map((b) => (
            <button key={b.id} onClick={() => setBranchId(b.id)} className={`whitespace-nowrap px-4 py-2 rounded-full font-label-md transition-all flex items-center gap-1.5 ${branchId === b.id ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant'}`}>{b.name.replace('CORNEY ', '')}{branchTotal(b.id) > 0 && <span className="w-2 h-2 rounded-full bg-primary" />}</button>
          ))}
        </div>

        {Object.entries(SUP_CATS).map(([k, lbl]) => (
          <section key={k} className="space-y-2">
            <h2 className="font-label-lg text-on-surface-variant flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${k === 'K1' ? 'bg-primary' : 'bg-secondary-container'}`} /> {k === 'K1' ? '1' : '2'} · {lbl}</h2>
            {items.filter((i) => i.category === k).map((it) => {
              const q = qtyOf(branchId, it.id)
              return (
                <div key={it.id} className={`bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center gap-3 ${q > 0 ? '' : 'opacity-90'}`}>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-label-lg leading-tight">{it.name}</h3>
                    <p className="text-label-md text-on-surface-variant">{fmtRp(it.price)}/{it.unit}{q > 0 && <span className="text-primary font-bold"> · {q} × = {fmtRp(it.price * q)}</span>}</p>
                  </div>
                  <div className="flex items-center bg-surface-container rounded-full p-1 shrink-0">
                    <button onClick={() => setQty(branchId, it.id, q - 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm active:scale-90"><Icon name="remove" className="!text-[18px]" /></button>
                    <span className="px-3 font-bold w-10 text-center">{q}</span>
                    <button onClick={() => setQty(branchId, it.id, q + 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-container text-white shadow-sm active:scale-90"><Icon name="add" className="!text-[18px]" /></button>
                  </div>
                </div>
              )
            })}
          </section>
        ))}
      </main>

      {/* Sticky cart summary */}
      <div className="fixed bottom-[68px] left-0 right-0 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40 p-4">
        <div className="max-w-2xl mx-auto">
          {branchesWithItems.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-label-md text-on-surface-variant">
              {branchesWithItems.map((b) => <span key={b.id}>{b.name.replace('CORNEY ', '')}: <strong className="text-on-surface">{fmtRp(branchTotal(b.id))}</strong></span>)}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="font-headline-md">Grand Total: <span className="text-primary">{fmtRp(grand)}</span></span>
            <a href={grand > 0 ? `https://wa.me/${OWNER_WA}?text=${waText()}` : undefined} target="_blank" rel="noreferrer" onClick={(e) => grand === 0 && e.preventDefault()} className={`h-[48px] px-5 rounded-xl flex items-center gap-2 text-white font-bold active:scale-95 ${grand > 0 ? '' : 'opacity-40 pointer-events-none'}`} style={{ backgroundColor: '#25D366' }}>
              <Icon name="chat" /> Kirim ke WA Owner
            </a>
          </div>
        </div>
      </div>

      <SupplierNav />
    </div>
  )
}
