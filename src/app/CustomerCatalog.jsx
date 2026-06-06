import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { BRANCHES, DUMMY_STOCK, LOW_STOCK_THRESHOLD, SAUCES, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useDay } from '../store/useDay.js'
import { useCart } from '../store/useCart.js'
import { cartCount, addItem } from '../store/cart.js'
import { menuForBranch, resolveSaucesForBranch } from '../store/master.js'
import { useBranchStatus } from '../store/useBranchStatus.js'
import { refreshBranchStatus } from '../store/branchStatus.js'
import { isSupabase } from '../lib/backend.js'
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
  const status = useBranchStatus() // ketersediaan menu dari SERVER (lintas perangkat)
  const cart = useCart()
  const [filter, setFilter] = useState('Semua')
  const [bIdx, setBIdx] = useState(0)
  const [toast, setToast] = useState('')
  const [sheetMenu, setSheetMenu] = useState(null) // savory quick-add sauce sheet

  // Scroll kategori ke samping (panah muncul hanya bila ada yang bisa digeser).
  const catRef = useRef(null)
  const [catArrow, setCatArrow] = useState({ l: false, r: false })
  const updateCatArrow = () => {
    const el = catRef.current
    if (!el) return
    const l = el.scrollLeft > 4
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setCatArrow((p) => (p.l === l && p.r === r ? p : { l, r }))
  }
  const scrollCat = (dir) => {
    const el = catRef.current
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' })
  }
  useEffect(() => {
    updateCatArrow()
    const onResize = () => updateCatArrow()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

  // Mode supabase: poll RINGAN ketersediaan menu (habis/dimatikan) tiap 30 dtk saat
  // di halaman ini, jeda saat tab tak aktif → update tanpa refresh & tanpa realtime.
  useEffect(() => {
    if (!isSupabase()) return
    let t = null
    const start = () => { if (!t) { refreshBranchStatus(); t = setInterval(refreshBranchStatus, 30000) } }
    const stop = () => { clearInterval(t); t = null }
    const onVis = () => (document.hidden ? stop() : start())
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

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

  // Ketersediaan menu:
  //  - mode supabase → dari SERVER (branch_status.availability: off=menu dimatikan
  //    kasir, sold=induk habis) → LINTAS PERANGKAT (kasir matikan → customer habis).
  //  - mode local → sesi day.js lokal (perangkat sama; tampil "sisa N").
  const supa = isSupabase()
  const avail = supa ? (status[branchId]?.availability || {}) : null
  const isLive = !supa && day?.branchId === branchId && day?.stock
  const stockMap = isLive ? day.stock : (DUMMY_STOCK[branchId] || {})
  const offList = supa ? (avail.off || []) : (isLive ? (day.menuOff || []) : [])
  const soldList = supa ? (avail.sold || []) : null
  const thresholdOf = (parentId) => master?.parents?.find((p) => p.id === parentId)?.threshold ?? LOW_STOCK_THRESHOLD

  const banners = (master?.banners || []).filter((b) => b.active)
  // Apply per-branch override (§2.3): effective price + hide menus turned off here.
  const menus = (master?.menus || []).filter((m) => m.active).map((m) => menuForBranch(branchId, m)).filter((m) => !m.off)
  // Saus efektif per cabang: harga override + sembunyikan owner-off + tandai habis
  // (kasir, hari ini). sauceOff dari server (supabase) atau day lokal.
  const sauceOffList = supa ? (avail?.sauceOff || []) : (isLive ? (day?.sauceOff || []) : [])
  const branchSauces = resolveSaucesForBranch(master, branchId, sauceOffList)

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
    if (offList.includes(m.id)) return { habis: true, qty: 0 }
    if (supa) return { habis: (soldList || []).includes(m.parent), qty: null } // server: tahu habis (qty pasti tak disinkron)
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

      <main className="flex-1 pt-5 pb-10 md:max-w-4xl mx-auto w-full px-4">
        {/* Banner carousel (CUS-06) — active banners from the Owner; falls back
            to a brand band when none are active. */}
        {banners.length > 0 ? (
          <section className="mb-6">
            <div className="relative w-full aspect-[16/9] rounded-[18px] overflow-hidden">
              {banners.map((b, i) => (
                <div key={b.id} className={`absolute inset-0 transition-opacity duration-700 ${i === bIdx % banners.length ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  {b.img ? <img src={b.img} alt={b.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary-container" />}
                  {b.title && <><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /><p className="absolute bottom-4 left-5 right-5 text-white font-headline-lg text-headline-lg leading-tight">{b.title}</p></>}
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
          <section className="w-full aspect-[16/9] rounded-[18px] overflow-hidden relative mb-6 bg-primary-container flex items-center px-6">
            <div className="absolute -right-6 -bottom-8 w-40 h-40 bg-primary rounded-full mix-blend-multiply blur-3xl opacity-60" />
            <div className="relative z-10">
              <h2 className="text-on-primary font-headline-lg text-headline-lg leading-tight">Korean Corndog<br />paling juicy</h2>
              <p className="text-on-primary/80 text-sm mt-1">#CeritanyaBersamaCorney · {branch.name.replace('CORNEY ', '')}</p>
            </div>
          </section>
        )}

        {/* Category filters — NEMPEL jadi header saat di-scroll (sticky) + geser samping */}
        <section className="sticky top-[64px] z-30 -mx-4 px-4 py-2.5 mb-6 bg-surface/95 backdrop-blur-sm border-b border-outline-variant/40 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          {catArrow.l && (
            <>
              <div className="absolute left-3 top-0 bottom-0 w-10 bg-gradient-to-r from-surface to-transparent pointer-events-none z-[5]" />
              <button onClick={() => scrollCat(-1)} aria-label="Geser kategori ke kiri" className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-surface shadow-md border border-outline-variant flex items-center justify-center active:scale-95">
                <Icon name="chevron_left" className="!text-[22px] text-primary" />
              </button>
            </>
          )}
          <div ref={catRef} onScroll={updateCatArrow} className="flex gap-3 overflow-x-auto hide-scrollbar py-1 scroll-smooth">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap px-5 py-2.5 rounded-full font-label-lg transition-all ${filter === f ? 'bg-secondary-container text-on-secondary-container shadow-sm' : 'border border-outline-variant text-on-surface-variant'}`}>{f}</button>
            ))}
          </div>
          {catArrow.r && (
            <>
              <div className="absolute right-3 top-0 bottom-0 w-10 bg-gradient-to-l from-surface to-transparent pointer-events-none z-[5]" />
              <button onClick={() => scrollCat(1)} aria-label="Geser kategori ke kanan" className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-surface shadow-md border border-outline-variant flex items-center justify-center active:scale-95">
                <Icon name="chevron_right" className="!text-[22px] text-primary" />
              </button>
            </>
          )}
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
                            <span className={`w-1.5 h-1.5 rounded-full ${st.low ? 'bg-amber-600' : 'bg-green-600'}`} /> {st.qty == null ? 'Tersedia' : `sisa ${st.qty}`}
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
          sauces={branchSauces}
          onCancel={() => setSheetMenu(null)}
          onConfirm={confirmSheet}
        />
      )}
    </div>
  )
}
