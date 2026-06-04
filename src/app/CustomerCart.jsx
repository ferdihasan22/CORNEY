import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { BRANCHES, SAUCES, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useCart } from '../store/useCart.js'
import { incLine, decLine, removeLine, setPromoCode, updateLineSauces } from '../store/cart.js'
import { menuForBranch } from '../store/master.js'
import { useBranchStatus } from '../store/useBranchStatus.js'
import { refreshBranchStatus } from '../store/branchStatus.js'
import { isSupabase } from '../lib/backend.js'
import SauceSheet from './SauceSheet.jsx'

// 2.1 — CORNEY App Customer · Keranjang. Ported from Stitch "keranjang_corney_app".
// One cart per branch. Promo code matches an active Owner voucher (kasir/customer
// can't invent discounts). Checkout → /app/checkout (next step).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function CustomerCart() {
  const navigate = useNavigate()
  const master = useMaster()
  const cart = useCart()
  const [code, setCode] = useState(cart?.promoCode || '')
  const [promoMsg, setPromoMsg] = useState('')
  const [editLine, setEditLine] = useState(null) // savory line whose sauce is being edited
  const status = useBranchStatus() // ketersediaan menu dari server (realtime)
  const supa = isSupabase()
  useEffect(() => { refreshBranchStatus() }, [])

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="bg-background text-on-surface min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 bg-surface shadow-sm flex items-center gap-3 px-4 h-[64px]">
          <button onClick={() => navigate('/app/cabang')} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="arrow_back" /></button>
          <h1 className="font-headline-md text-headline-md">Keranjang</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8 text-center">
          <Icon name="shopping_cart" className="!text-6xl opacity-30" />
          <p className="mt-3 font-medium">Keranjang masih kosong.</p>
          <button onClick={() => navigate('/app/cabang')} className="mt-6 bg-primary text-white px-6 py-3 rounded-xl font-bold active:scale-95">Mulai Pesan</button>
        </div>
      </div>
    )
  }

  const branch = BRANCHES.find((b) => b.id === cart.branchId)
  if (!branch) return <Navigate to="/app/cabang" replace />

  const menuById = (id) => { const b = (master?.menus || []).find((m) => m.id === id); return b ? menuForBranch(cart.branchId, b) : null }
  const sauceLabel = (sauces) => {
    if (!sauces?.length) return ''
    const names = sauces.map((s) => SAUCES.find((x) => x.id === s.id)?.name || s.id)
    const paid = sauces.reduce((sum, s) => sum + (SAUCES.find((x) => x.id === s.id)?.price || 0), 0)
    return names.join(', ') + (paid > 0 ? ` (+${fmtRp(paid)})` : '')
  }
  const lineTotal = (l) => {
    const m = menuById(l.menuId)
    const paid = (l.sauces || []).reduce((s, sc) => s + (SAUCES.find((x) => x.id === sc.id)?.price || 0), 0)
    return ((m?.price || 0) + paid) * l.qty
  }

  // Ketersediaan per item (mode supabase): habis bila menu dimatikan kasir / induk
  // stok 0, atau menu dihapus owner. Cegah pesan barang yang tak bisa dibuat.
  const avail = supa ? (status[cart.branchId]?.availability || {}) : {}
  const unavail = (l) => {
    const m = menuById(l.menuId)
    if (!m) return true
    if (!supa) return false
    return (avail.off || []).includes(m.id) || (avail.sold || []).includes(m.parent)
  }
  const anyUnavail = cart.lines.some(unavail)

  const subtotal = cart.lines.reduce((s, l) => s + lineTotal(l), 0)

  // Promo: match an ACTIVE voucher by code (Owner-defined). percent capped at capMax.
  const promo = (master?.promos || []).find((p) => p.active && p.code && p.code === (cart.promoCode || ''))
  let discount = 0
  if (promo) {
    discount = promo.discountKind === 'percent' ? Math.round(subtotal * promo.value / 100) : promo.value
    if (promo.capMax > 0) discount = Math.min(discount, promo.capMax)
    discount = Math.min(discount, subtotal)
  }
  const total = subtotal - discount

  const applyPromo = () => {
    const c = code.trim().toUpperCase()
    setPromoCode(c)
    const found = (master?.promos || []).find((p) => p.active && p.code === c)
    setPromoMsg(!c ? '' : found ? `Promo "${found.name}" dipakai!` : 'Kode promo tidak ditemukan / nonaktif.')
  }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-32">
      <header className="sticky top-0 z-50 bg-surface shadow-sm flex items-center justify-between px-4 h-[64px]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/app/katalog/${cart.branchId}`)} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="arrow_back" /></button>
          <h1 className="font-headline-md text-headline-md">Keranjang</h1>
        </div>
        <span className="flex items-center bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-full text-label-md font-label-md"><Icon name="location_on" fill className="!text-[16px] mr-1" />{branch.name.replace('CORNEY ', '')}</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-4 space-y-5">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-start gap-3">
          <Icon name="info" className="text-amber-600 mt-0.5" />
          <p className="text-label-md leading-tight">Harga &amp; stok mengikuti cabang <strong>{branch.name.replace('CORNEY ', '')}</strong>.</p>
        </div>

        <section className="space-y-3">
          <div className="flex justify-between items-end">
            <h2 className="font-headline-md text-primary">Pesanan Kamu</h2>
            <button onClick={() => navigate(`/app/katalog/${cart.branchId}`)} className="text-primary font-label-md hover:underline">+ Tambah item</button>
          </div>
          {cart.lines.map((l) => {
            const m = menuById(l.menuId)
            const ub = unavail(l)
            return (
              <div key={l.sig} className={`bg-white rounded-2xl p-3 flex gap-3 shadow-[0_4px_16px_rgba(26,26,26,0.08)] ${ub ? 'ring-2 ring-error/50' : ''}`}>
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-surface-container">
                  {m?.img ? <img src={m.img} alt={m.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="image" className="text-on-surface-variant" /></div>}
                </div>
                <div className="flex-grow flex flex-col justify-between min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-lg leading-tight truncate">{m?.name || l.menuId}</h3>
                      {ub && <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-black uppercase text-error"><Icon name="error" className="!text-[14px]" /> Habis — hapus dari keranjang</span>}
                      {sauceLabel(l.sauces) && <p className="text-sm text-on-surface-variant leading-tight mt-0.5">{sauceLabel(l.sauces)}</p>}
                      {m?.category !== 'sweet' && (
                        <button onClick={() => setEditLine(l)} className="mt-1 inline-flex items-center gap-1 text-primary text-[13px] font-label-md active:scale-95">
                          <Icon name="tune" className="!text-[15px]" /> {l.sauces?.length ? 'Ubah saus' : 'Pilih saus'}
                        </button>
                      )}
                    </div>
                    <button onClick={() => removeLine(l.sig)} className="text-on-surface-variant/40 hover:text-primary shrink-0"><Icon name="close" /></button>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-bold text-primary text-lg">{fmtRp(lineTotal(l))}</span>
                    <div className="flex items-center bg-surface-container rounded-full p-1">
                      <button onClick={() => decLine(l.sig)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm active:scale-90"><Icon name="remove" className="!text-[18px]" /></button>
                      <span className="px-4 font-bold">{l.qty}</span>
                      <button onClick={() => incLine(l.sig)} className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-container text-white shadow-sm active:scale-90"><Icon name="add" className="!text-[18px]" /></button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        {/* Promo */}
        <section className="bg-white rounded-2xl p-3 shadow-[0_4px_16px_rgba(26,26,26,0.08)]">
          <div className="flex items-center gap-2">
            <div className="flex-grow relative">
              <Icon name="local_offer" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]" />
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Punya kode promo?" className="w-full pl-10 pr-4 py-3 bg-surface-container border-none rounded-xl focus:ring-2 focus:ring-primary text-label-md" />
            </div>
            <button onClick={applyPromo} className="bg-secondary-container text-on-secondary-container px-6 py-3 rounded-xl font-bold active:scale-95">Pakai</button>
          </div>
          {promoMsg && <p className={`text-xs mt-2 ${promo ? 'text-green-600' : 'text-error'}`}>{promoMsg}</p>}
        </section>

        {/* Summary */}
        <section className="bg-white rounded-2xl p-padding-card shadow-[0_4px_16px_rgba(26,26,26,0.08)] space-y-3 border-t-4 border-primary">
          <h3 className="font-headline-md border-b border-surface-variant pb-2">Ringkasan Pesanan</h3>
          <div className="flex justify-between text-on-surface-variant"><span>Subtotal</span><span>{fmtRp(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between text-green-600"><span>Diskon {promo ? `(${promo.code})` : ''}</span><span>− {fmtRp(discount)}</span></div>}
          <div className="flex justify-between text-on-surface-variant"><span>Biaya Layanan</span><span>Rp 0</span></div>
          <div className="flex justify-between items-center pt-3 border-t border-surface-variant">
            <span className="font-headline-md font-bold">Total</span>
            <span className="font-display-md text-display-md text-primary tracking-tight">{fmtRp(total)}</span>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/90 backdrop-blur-md border-t border-outline-variant z-40">
        {anyUnavail && <p className="max-w-2xl mx-auto text-center text-[13px] text-error font-bold mb-2 flex items-center justify-center gap-1"><Icon name="error" className="!text-[16px]" /> Ada item HABIS di keranjang. Hapus dulu untuk lanjut.</p>}
        <button onClick={() => !anyUnavail && navigate('/app/checkout')} disabled={anyUnavail} className="max-w-2xl mx-auto w-full bg-primary text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:active:scale-100">
          Lanjut ke Checkout <Icon name="chevron_right" />
        </button>
      </div>

      {/* Per-line sauce editor (savory only) */}
      {editLine && (
        <SauceSheet
          title={menuById(editLine.menuId)?.name || 'Ubah Saus'}
          confirmLabel="Simpan"
          initial={(editLine.sauces || []).map((s) => s.id)}
          onCancel={() => setEditLine(null)}
          onConfirm={(picked) => { updateLineSauces(editLine.sig, picked.map((id) => ({ id }))); setEditLine(null) }}
        />
      )}
    </div>
  )
}
