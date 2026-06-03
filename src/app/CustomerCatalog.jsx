import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { BRANCHES, DUMMY_STOCK, LOW_STOCK_THRESHOLD, SAUCES, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useDay } from '../store/useDay.js'
import { useCart } from '../store/useCart.js'
import { cartCount, addItem } from '../store/cart.js'
import { menuForBranch } from '../store/master.js'
import SauceSheet from './SauceSheet.jsx'

// 1C.3 — CORNEY App Customer · Katalog (CUS-01). Ported from Stitch
// "menu_storefront_corney_app". Real-time stock per branch: if the chosen branch
// is the one with an OPEN kasir day on this device, stock + menu-off reflect the
// live session (sells drop "sisa N" instantly); otherwise a dummy per-branch
// snapshot is used (real cross-device sync = TAHAP 4). Fase 1 is browse-only:
// the cart bar + "Tambah" are replaced by "Lihat" → product detail; stock 0
// hard-locks the card (PRD: can't order at 0). Catalog is driven by the Owner's
// menu master (active menus only).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const FILTERS = ['Semua', 'Sweet', 'Savory', 'Best Seller']

export default function CustomerCatalog() {
  const { branchId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const master = useMaster()
  const day = useDay()
  const cart = useCart()
  const [filter, setFilter] = useState('Semua')
  const [bIdx, setBIdx] = useState(0)
  const [toast, setToast] = useState('')
  const [sheetMenu, setSheetMenu] = useState(null) // savory quick-add sauce sheet

  // Toast on arrival from the detail page ("2x Mozza Ori ditambahkan"), and a
  // self-dismiss timer for any toast (works for catalog quick-adds too).
  useEffect(() => {
    if (location.state?.added) {
      setToast(`${location.state.added} ditambahkan`)
      navigate(location.pathname, { replace: true, state: {} }) // clear so it won't re-toast
    }
  }, [location.state, location.pathname, navigate])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  // Auto-advance the banner carousel every 4s (cross-fade). Kept before any
  // early return so hook order stays stable.
  const bannerCount = (master?.banners || []).filter((b) => b.active).length
  useEffect(() => {
    if (bannerCount <= 1) return
    const t = setInterval(() => setBIdx((i) => (i + 1) % bannerCount), 4000)
    return () => clearInterval(t)
  }, [bannerCount])

  const branch = BRANCHES.find((b) => b.id === branchId)
  if (!branch) return <Navigate to="/app/cabang" replace />

  // Live stock when this device's open day belongs to the chosen branch.
  const isLive = day?.branchId === branchId && day?.stock
  const stockMap = isLive ? day.stock : (DUMMY_STOCK[branchId] || {})
  const menuOff = isLive ? (day.menuOff || []) : []
  const thresholdOf = (parentId) => master?.parents?.find((p) => p.id === parentId)?.threshold ?? LOW_STOCK_THRESHOLD

  const banners = (master?.banners || []).filter((b) => b.active)
  // Apply per-branch override (§2.3): effective price + hide menus turned off here.
  const menus = (master?.menus || []).filter((m) => m.active).map((m) => menuForBranch(branchId, m)).filter((m) => !m.off)

  // Cart summary for this branch (sticky bar + header badge).
  const count = cartCount(branchId)
  const cartTotal = (cart && cart.branchId === branchId ? cart.lines : []).reduce((sum, l) => {
    const base = (master?.menus || []).find((x) => x.id === l.menuId)
    const m = base ? menuForBranch(branchId, base) : null
    const paid = (l.sauces || []).reduce((s, sc) => s + (SAUCES.find((x) => x.id === sc.id)?.price || 0), 0)
    return sum + ((m?.price || 0) + paid) * l.qty
  }, 0)
  const shown = menus.filter((m) => {
    if (filter === 'Sweet') return m.category === 'sweet'
    if (filter === 'Savory') return m.category === 'savory'
    if (filter === 'Best Seller') return m.label === 'Best Seller'
    return true
  })

  const stockState = (m) => {
    if (menuOff.includes(m.id)) return { habis: true, qty: 0 }
    const qty = stockMap[m.parent] ?? 0
    return { habis: qty <= 0, qty, low: qty > 0 && qty <= thresholdOf(m.parent) }
  }

  // Quick add ("+"): sweet has no sauce → add straight away; savory opens the
  // sauce sheet (starts empty, customer picks) so the sauce is never forgotten.
  const quickAdd = (m) => {
    if (m.category === 'sweet') {
      addItem(branchId, m.id, [], 1)
      setToast(`${m.name} ditambahkan`)
    } else {
      setSheetMenu(m)
    }
  }
  const confirmSheet = (picked) => {
    if (!sheetMenu) return
    addItem(branchId, sheetMenu.id, picked.map((id) => ({ id })), 1)
    setToast(`${sheetMenu.name} ditambahkan`)
    setSheetMenu(null)
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-surface shadow-md h-[64px] flex items-center px-4 justify-between shrink-0">
        <h1 className="text-headline-md font-black text-primary uppercase tracking-tighter">CORNEY</h1>
        <button onClick={() => navigate('/app/cabang')} className="flex items-center gap-1 text-label-md font-bold text-on-surface active:scale-95">
          <Icon name="location_on" className="text-[18px] text-primary" />
          <span className="truncate max-w-[140px]">{branch.name.replace('CORNEY ', '')}</span>
          <Icon name="keyboard_arrow_down" className="text-[18px]" />
        </button>
        <div className="flex items-center">
          <button onClick={() => navigate('/app/riwayat')} aria-label="Pesanan Saya" className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90">
            <Icon name="receipt_long" className="text-primary" />
          </button>
          <button onClick={() => navigate('/app/keranjang')} className="relative w-10 h-10 flex items-center justify-center rounded-full active:scale-90">
            <Icon name="shopping_cart" className="text-primary" />
            {count > 0 && <span className="absolute -top-0.5 -right-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full">{count}</span>}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pt-5 pb-10 md:max-w-4xl mx-auto w-full px-4">
        {/* Banner carousel (CUS-06) — active banners from the Owner; falls back
            to a brand band when none are active. */}
        {banners.length > 0 ? (
          <section className="mb-6">
            <div className="relative w-full aspect-[5/2] rounded-[18px] overflow-hidden">
              {banners.map((b, i) => (
                <div key={b.id} className={`absolute inset-0 transition-opacity duration-700 ${i === bIdx % banners.length ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  {b.img ? <img src={b.img} alt={b.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary-container" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <p className="absolute bottom-4 left-5 right-5 text-white font-headline-lg text-headline-lg leading-tight">{b.title}</p>
                </div>
              ))}
              {banners.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {banners.map((b, i) => (
                    <button key={b.id} onClick={() => setBIdx(i)} aria-label={`Banner ${i + 1}`} className={`h-2 rounded-full transition-all ${i === bIdx % banners.length ? 'w-5 bg-white' : 'w-2 bg-white/50'}`} />
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="w-full h-36 rounded-[18px] overflow-hidden relative mb-6 bg-primary-container flex items-center px-6">
            <div className="absolute -right-6 -bottom-8 w-40 h-40 bg-primary rounded-full mix-blend-multiply blur-3xl opacity-60" />
            <div className="relative z-10">
              <h2 className="text-on-primary font-headline-lg text-headline-lg leading-tight">Korean Corndog<br />paling juicy</h2>
              <p className="text-on-primary/80 text-sm mt-1">#CeritanyaBersamaCorney · {branch.name.replace('CORNEY ', '')}</p>
            </div>
          </section>
        )}

        {/* Category filters */}
        <section className="mb-6 -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar py-1">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap px-5 py-2.5 rounded-full font-label-lg transition-all ${filter === f ? 'bg-secondary-container text-on-secondary-container shadow-sm' : 'border border-outline-variant text-on-surface-variant'}`}>{f}</button>
            ))}
          </div>
        </section>

        {/* Product grid */}
        {shown.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant"><Icon name="search_off" className="!text-5xl opacity-30" /><p className="mt-2">Tidak ada menu di kategori ini.</p></div>
        ) : (
          <section className="grid grid-cols-2 gap-4 md:gap-6">
            {shown.map((m) => {
              const st = stockState(m)
              return (
                <div key={m.id} className="bg-surface rounded-[18px] shadow-[0_4px_16px_rgba(26,26,26,0.08)] flex flex-col overflow-hidden relative transition-transform">
                  {st.habis && <div className="absolute inset-0 bg-white/40 z-10 pointer-events-none" />}
                  {/* Tap photo/name → full detail */}
                  <button onClick={() => navigate(`/app/produk/${branchId}/${m.id}`)} className="text-left active:scale-[.99] transition-transform">
                    <div className={`relative h-36 md:h-52 overflow-hidden ${st.habis ? 'grayscale-[0.5]' : ''}`}>
                      {m.label && <span className={`absolute top-2 left-2 z-20 text-[10px] font-bold px-2 py-1 rounded-md ${m.label === 'Pedas' ? 'bg-primary text-white' : 'bg-secondary-container text-on-secondary-container'}`}>{m.label}</span>}
                      {m.img ? <img src={m.img} alt={m.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-container flex items-center justify-center"><Icon name="image" className="text-on-surface-variant" /></div>}
                    </div>
                    <div className={`px-4 pt-4 ${st.habis ? 'opacity-60' : ''}`}>
                      <div className="mb-1 h-5">
                        {st.habis ? (
                          <span className="text-error font-label-md text-[12px] uppercase font-black">HABIS</span>
                        ) : (
                          <span className={`font-label-md text-[12px] flex items-center gap-1 ${st.low ? 'text-amber-600' : 'text-green-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.low ? 'bg-amber-600' : 'bg-green-600'}`} /> sisa {st.qty}
                          </span>
                        )}
                      </div>
                      <h3 className="font-headline-md text-[17px] mb-1 line-clamp-1">{m.name}</h3>
                      <p className="text-primary font-bold text-lg">{fmtRp(m.price)}</p>
                    </div>
                  </button>
                  <div className="px-4 pb-4 pt-3 mt-auto">
                    {st.habis ? (
                      <button disabled className="w-full h-[48px] bg-surface-container-highest text-on-surface-variant rounded-[14px] font-label-lg cursor-not-allowed">Stok Habis</button>
                    ) : (
                      <button onClick={() => quickAdd(m)} className="w-full h-[48px] bg-primary text-white rounded-[14px] font-label-lg flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20">
                        <Icon name="add" className="text-[22px]" /> Tambah
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        <div className="h-24" />
      </main>

      {/* Sticky cart bar */}
      {count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/90 backdrop-blur-md border-t border-outline-variant z-40">
          <button onClick={() => navigate('/app/keranjang')} className="max-w-[480px] mx-auto w-full h-[56px] bg-primary text-white rounded-2xl px-5 flex items-center justify-between active:scale-[0.98] transition-transform shadow-lg">
            <span className="flex flex-col items-start leading-none">
              <span className="text-[11px] opacity-90">{count} item</span>
              <span className="font-bold">{fmtRp(cartTotal)}</span>
            </span>
            <span className="flex items-center gap-2 font-bold"><Icon name="shopping_basket" className="!text-[20px]" /> Lihat Keranjang</span>
          </button>
        </div>
      )}

      {/* Add-to-cart toast (sits above the cart bar, auto-dismiss) */}
      {toast && (
        <div className={`fixed left-1/2 -translate-x-1/2 z-[60] ${count > 0 ? 'bottom-24' : 'bottom-6'}`}>
          <style>{`@keyframes toast-in { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
          <div className="bg-on-surface text-surface px-5 py-3 rounded-full shadow-xl flex items-center gap-2 font-label-lg whitespace-nowrap" style={{ animation: 'toast-in 0.2s ease-out' }}>
            <Icon name="check_circle" fill className="!text-[20px] text-green-400" /> {toast}
          </div>
        </div>
      )}

      {/* Savory quick-add sauce sheet */}
      {sheetMenu && (
        <SauceSheet
          title={sheetMenu.name}
          confirmLabel="Tambah"
          initial={[]}
          onCancel={() => setSheetMenu(null)}
          onConfirm={confirmSheet}
        />
      )}
    </div>
  )
}
