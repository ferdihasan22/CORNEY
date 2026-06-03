import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PARENT_FILLINGS, MENUS, BRANCHES, LOW_STOCK_THRESHOLD, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { useOrders } from '../../store/useOrders.js'
import { PHASE, parentAvailable, addToCart, incLine, decLine, removeLine, clearCart, endDay, commitSale, createPending, toggleMenu, cookingCounts } from '../../store/day.js'
import { flyBall, pulse } from './flyBall.js'
import { clearKasirBranch } from './kasirSession.js'
import NetworkIndicator from './NetworkIndicator.jsx'
import { useBtPrinter } from './useBtPrinter.js'
import { btSupported, btConnect, btDisconnect, btDeviceName, btAutoReconnect } from './btprinter.js'
import AddSauceModal from './AddSauceModal.jsx'
import PaymentModal from './PaymentModal.jsx'
import Receipt from './Receipt.jsx'
import BreakageModal from './BreakageModal.jsx'

// Step 1A.4/1A.5 — WLK-01 Grid Menu per Induk + WLK-02 Keranjang Menetap.
// UI ported from the Stitch export "CORNEY POS - Walk-in Sale" (Material-3
// tokens, Plus Jakarta Sans, Material Symbols). Wired to the real day store:
// hard-lock at 0, live "sisa N", 1:1 parent decrement, sauce only for savory.

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
)

// Product photo that fills its parent; falls back to an icon if the image
// fails to load (Stitch photo URLs are external and may expire).
function ProductImg({ src, imgClass = '' }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="w-full h-full bg-surface-variant flex items-center justify-center">
        <Icon name="lunch_dining" className="!text-5xl text-on-surface-variant/50" />
      </div>
    )
  }
  return <img src={src} alt="" onError={() => setFailed(true)} className={`w-full h-full object-cover ${imgClass}`} />
}

const baseOf = (l) => MENUS.find((m) => m.id === l.menuId)?.price ?? 0
const sauceOf = (l) => l.sauces.reduce((s, x) => s + (x.price || 0), 0)

export default function WalkinSale() {
  const day = useDay()
  const orders = useOrders()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  const onlineNew = (orders || []).filter((o) => o.branchId === day?.branchId && o.paid && o.status === 'baru').length
  const [filter, setFilter] = useState('all') // 'all' | parentId
  const [query, setQuery] = useState('')
  const [sauceFor, setSauceFor] = useState(null)
  const [payOpen, setPayOpen] = useState(false)
  const [lastSale, setLastSale] = useState(null) // success overlay
  const [showReceipt, setShowReceipt] = useState(false)
  const [cartOpen, setCartOpen] = useState(false) // portrait cart drawer
  const [menuOpen, setMenuOpen] = useState(false) // portrait actions dropdown
  const [breakOpen, setBreakOpen] = useState(false) // catat patah
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const cart = day?.cart ?? []
  const cook = cookingCounts() // {queued, frying} untuk badge Antrean Masak
  const masakRef = useRef(null)
  const printerOn = useBtPrinter()
  useEffect(() => { btAutoReconnect() }, []) // sambung otomatis ke printer terakhir (tanpa dialog)
  const togglePrinter = async () => {
    if (!btSupported()) { alert('Web Bluetooth perlu HTTPS & Android Chrome. Kalau pakai printer Classic, gunakan RawBT.'); return }
    try { printerOn ? btDisconnect() : await btConnect() } catch (e) { alert(e.message || 'Gagal menghubungkan printer.') }
  }
  const flyToMasak = (x, y) => { if (masakRef.current) { flyBall(x ?? window.innerWidth / 2, y ?? window.innerHeight * 0.55, masakRef.current, { color: '#b50303' }); pulse(masakRef.current) } }
  const subtotal = useMemo(() => cart.reduce((s, l) => s + baseOf(l) * l.qty, 0), [cart])
  const biayaTambahan = useMemo(() => cart.reduce((s, l) => s + sauceOf(l) * l.qty, 0), [cart])
  const total = subtotal + biayaTambahan
  const totalQty = cart.reduce((s, l) => s + l.qty, 0)

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />

  const shownParents = filter === 'all' ? PARENT_FILLINGS : PARENT_FILLINGS.filter((p) => p.id === filter)
  const q = query.trim().toLowerCase()

  function handleAdd(menu) {
    if (menu.category === 'savory') setSauceFor(menu)
    else addToCart(menu.id, [])
  }
  function handleLogout() {
    endDay()
    clearKasirBranch()
    navigate('/ops/kasir/login', { replace: true })
  }

  // Filters = the 4 isian induk (PRD product model). Stitch's Snacks/Drinks/
  // Promos categories aren't in the PRD, so they're dropped.
  const cats = [
    { id: 'all', label: 'Semua', icon: 'grid_view' },
    ...PARENT_FILLINGS.map((p) => ({ id: p.id, label: p.name, icon: 'restaurant' })),
  ]

  // Cart content — reused by the landscape side panel AND the portrait drawer.
  const cartInner = (
    <>
      <div className="p-6 border-b border-outline-variant flex justify-between items-center shrink-0">
        <h2 className="font-display-md text-headline-lg text-on-surface">Keranjang</h2>
        {cart.length > 0 && (
          <button onClick={clearCart} className="text-primary font-bold flex items-center gap-1 hover:underline">
            <Icon name="delete_sweep" className="text-sm" /> Bersihkan
          </button>
        )}
      </div>
      <div className="flex-grow overflow-y-auto p-6 space-y-6 hide-scrollbar">
        {cart.length === 0 ? (
          <div className="text-center text-on-surface-variant mt-16">
            <Icon name="shopping_cart" className="!text-5xl opacity-30" />
            <p className="mt-2 font-medium">Keranjang kosong.</p>
            <p className="text-sm opacity-70">Pilih menu untuk mulai.</p>
          </div>
        ) : (
          cart.map((l) => {
            const m = MENUS.find((x) => x.id === l.menuId)
            const parent = PARENT_FILLINGS.find((p) => p.id === l.parent)
            return (
              <div key={l.sig} className="flex gap-4 group">
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0"><ProductImg src={m?.img} /></div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-lg text-on-surface leading-tight">{l.qty}x {m?.name}</h4>
                    <p className="font-bold text-primary">{fmtRp(baseOf(l) * l.qty)}</p>
                  </div>
                  <p className="text-on-surface-variant text-sm mt-1">− {parent?.name}</p>
                  {l.sauces.map((s) => (<p key={s.id} className="text-on-surface-variant text-sm">− {s.name}</p>))}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center border border-outline rounded-lg overflow-hidden">
                      <button onClick={() => decLine(l.sig)} className="w-8 h-8 flex items-center justify-center hover:bg-surface-variant transition-colors"><Icon name="remove" className="text-base" /></button>
                      <span className="w-10 text-center font-bold">{l.qty}</span>
                      <button onClick={() => incLine(l.sig)} disabled={parentAvailable(l.parent) <= 0} className="w-8 h-8 flex items-center justify-center hover:bg-surface-variant transition-colors disabled:opacity-30"><Icon name="add" className="text-base" /></button>
                    </div>
                    <button onClick={() => removeLine(l.sig)} className="p-2 text-on-surface-variant hover:text-error transition-colors"><Icon name="delete" /></button>
                  </div>
                </div>
              </div>
            )
          })
        )}
        {cart.length > 0 && (
          <div className="bg-secondary-container/10 border-2 border-dashed border-secondary-container rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-secondary-container/20 transition-all group">
            <div className="flex items-center gap-3 text-on-secondary-container"><Icon name="local_offer" /><span className="font-bold">Terapkan Promo</span></div>
            <Icon name="chevron_right" className="group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </div>
      <div className="bg-surface-container-low p-6 space-y-3 shrink-0">
        <div className="flex justify-between text-on-surface-variant"><span className="font-body-md text-body-md">Subtotal</span><span className="font-label-lg text-label-lg">{fmtRp(subtotal)}</span></div>
        <div className="flex justify-between text-primary font-bold"><span className="font-body-md text-body-md">Biaya Tambahan</span><span className="font-label-lg text-label-lg">{fmtRp(biayaTambahan)}</span></div>
        <div className="flex justify-between text-on-secondary-fixed-variant font-bold"><span className="font-body-md text-body-md">Promo</span><span className="font-label-lg text-label-lg">{fmtRp(0)}</span></div>
        <div className="pt-3 border-t border-outline-variant flex justify-between items-center"><span className="font-display-md text-headline-md text-on-surface">Total</span><span className="font-display-md text-display-md text-primary tracking-tight">{fmtRp(total)}</span></div>
        <div className="flex gap-3 pt-2">
          <button disabled={cart.length === 0} onClick={(e) => { const s = createPending(); if (s) { setLastSale(s); setCartOpen(false); flyToMasak(e.clientX, e.clientY) } }} className="flex-1 h-min-tap-target border-2 border-secondary-container text-on-secondary-container rounded-[14px] font-black uppercase tracking-wider hover:bg-secondary-container/10 active:scale-95 transition-all disabled:opacity-40">
            Buat Dulu
          </button>
          <button disabled={cart.length === 0} onClick={() => { setPayOpen(true); setCartOpen(false) }} className="flex-[1.5] h-min-tap-target bg-primary text-on-primary rounded-[14px] font-black uppercase tracking-widest shadow-[0_8px_20px_rgba(181,3,3,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
            <Icon name="payments" /> Bayar Sekarang
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="bg-background text-on-surface overflow-hidden">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center gap-2 px-3 sm:px-margin-page h-min-tap-target bg-primary shadow-md text-on-primary">
        <div className="flex flex-col justify-center shrink-0 min-w-0 leading-none">
          <span className="font-display-md text-sm sm:text-base font-black tracking-tighter">CORNEY</span>
          <span className="text-[10px] sm:text-[11px] font-bold text-on-primary/90 truncate -mt-0.5">{branch.name.replace('CORNEY ', '')}</span>
        </div>
        <nav className="flex gap-1 sm:gap-6 h-full shrink-0">
          <button className="h-full flex items-center px-2 sm:px-4 text-secondary-container font-bold border-b-4 border-secondary-container pb-1 active:scale-95 transition-all whitespace-nowrap">
            Walk-in
          </button>
          <button onClick={() => navigate('/ops/kasir/online')} className="relative h-full flex items-center px-2 sm:px-4 text-on-primary/80 font-medium hover:bg-primary-container/20 active:scale-95 transition-all whitespace-nowrap">
            <span className="hidden sm:inline">Order&nbsp;</span>Online
            {onlineNew > 0 && <span className="absolute -top-1 -right-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold h-5 min-w-5 px-1 flex items-center justify-center rounded-full border-2 border-primary">{onlineNew}</span>}
          </button>
        </nav>
        <div className="flex items-center gap-1 sm:gap-6 shrink-0">
          <button
            ref={masakRef}
            onClick={() => navigate('/ops/kasir/masak')}
            className="flex items-center gap-2 bg-on-primary/10 hover:bg-on-primary/20 px-4 py-2 rounded-xl font-label-lg transition-colors"
          >
            <Icon name="outdoor_grill" /> <span className="hidden sm:inline">Antrean Masak</span>
            {(cook.frying > 0 || cook.queued > 0) && (
              <span className="flex items-center gap-1">
                {cook.frying > 0 && <span className="inline-flex items-center gap-0.5 bg-orange-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"><Icon name="local_fire_department" className="!text-[12px]" />{cook.frying}</span>}
                {cook.queued > 0 && <span className="inline-flex items-center gap-0.5 bg-on-primary/25 text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full"><Icon name="schedule" className="!text-[12px]" />{cook.queued}</span>}
              </span>
            )}
          </button>
          {/* Setting / status Printer Bluetooth */}
          <button onClick={togglePrinter} title={printerOn ? btDeviceName() : 'Hubungkan printer Bluetooth'} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-label-md transition-colors ${printerOn ? 'bg-green-500/90 text-white' : 'bg-on-primary/10 hover:bg-on-primary/20'}`}>
            <Icon name={printerOn ? 'bluetooth_connected' : 'print'} />
            <span className="hidden md:inline">{printerOn ? 'Printer Terhubung' : 'Setting Printer'}</span>
          </button>
          {/* Indikator jaringan */}
          <NetworkIndicator />
          <div className="text-right hidden sm:block">
            <p className="font-headline-md text-headline-md leading-none">
              {clock.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-[10px] font-bold tracking-widest opacity-70 uppercase">
              {clock.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {/* Portrait actions menu (sidebar bottom actions live here on portrait) */}
          <div className="relative lg:hidden">
            <button onClick={() => setMenuOpen((o) => !o)} className="p-2 hover:bg-primary-container/20 rounded-xl"><Icon name="more_vert" /></button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white text-on-surface rounded-xl shadow-xl border border-outline-variant z-50 overflow-hidden">
                  <button onClick={() => { setMenuOpen(false); navigate('/ops/kasir/riwayat') }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left"><Icon name="receipt_long" className="text-on-surface-variant" /> Riwayat Transaksi</button>
                  <button onClick={() => { setMenuOpen(false); navigate('/ops/kasir/audit') }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left"><Icon name="fact_check" className="text-on-surface-variant" /> Audit Hari Ini</button>
                  <button onClick={() => { setMenuOpen(false); setBreakOpen(true) }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left"><Icon name="report" className="text-error" /> Catat Patah</button>
                  <button onClick={() => { setMenuOpen(false); navigate('/ops/kasir/koreksi') }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left"><Icon name="edit_note" className="text-on-surface-variant" /> Koreksi Stok</button>
                  <button onClick={() => { setMenuOpen(false); navigate('/ops/kasir/closing/belanja') }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left"><Icon name="nightlight" className="text-primary" /> Tutup Hari</button>
                  <button onClick={() => { setMenuOpen(false); handleLogout() }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-error-container hover:text-on-error-container text-left border-t border-outline-variant"><Icon name="logout" /> Logout</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex pt-min-tap-target h-screen">
        {/* SideNav */}
        <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[240px] flex-col py-6 border-r border-outline-variant bg-surface-container-low z-40 pt-24">
          <div className="flex flex-col gap-1 px-2">
            {cats.map((c) => {
              const active = filter === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setFilter(c.id)}
                  className={`flex items-center gap-4 rounded-xl p-4 mx-2 transition-all duration-200 ${
                    active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-variant'
                  }`}
                >
                  <Icon name={c.icon} />
                  <span className="font-label-lg text-label-lg text-left">{c.label}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-auto px-4 pb-8">
            <button
              onClick={() => navigate('/ops/kasir/closing/belanja')}
              className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 mb-2"
            >
              <Icon name="nightlight" /> Tutup Hari
            </button>
            <button
              onClick={() => navigate('/ops/kasir/riwayat')}
              className="flex items-center gap-4 text-on-surface-variant p-4 w-full hover:bg-surface-variant rounded-xl transition-all duration-200"
            >
              <Icon name="receipt_long" />
              <span className="font-label-lg text-label-lg">Riwayat Transaksi</span>
            </button>
            <button
              onClick={() => navigate('/ops/kasir/audit')}
              className="flex items-center gap-4 text-on-surface-variant p-4 w-full hover:bg-surface-variant rounded-xl transition-all duration-200"
            >
              <Icon name="fact_check" />
              <span className="font-label-lg text-label-lg">Audit Hari Ini</span>
            </button>
            <button
              onClick={() => setBreakOpen(true)}
              className="flex items-center gap-4 text-on-surface-variant p-4 w-full hover:bg-surface-variant rounded-xl transition-all duration-200"
            >
              <Icon name="report" className="text-error" />
              <span className="font-label-lg text-label-lg">Catat Patah</span>
            </button>
            <button
              onClick={() => navigate('/ops/kasir/koreksi')}
              className="flex items-center gap-4 text-on-surface-variant p-4 w-full hover:bg-surface-variant rounded-xl transition-all duration-200"
            >
              <Icon name="edit_note" />
              <span className="font-label-lg text-label-lg">Koreksi Stok</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 text-on-surface-variant p-4 w-full hover:bg-error-container hover:text-on-error-container rounded-xl transition-all duration-200"
            >
              <Icon name="logout" />
              <span className="font-label-lg text-label-lg">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="w-full lg:ml-[240px] lg:w-[calc(65%-240px)] flex-grow p-gutter-grid overflow-y-auto bg-background pb-24 lg:pb-gutter-grid">
          {/* Portrait: category chips (sidebar is hidden on portrait) */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-2 -mx-1 px-1">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-label-md font-bold whitespace-nowrap transition-colors ${filter === c.id ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}
              >
                <Icon name={c.icon} className="text-[18px]" /> {c.label}
              </button>
            ))}
          </div>
          {shownParents.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-on-surface-variant">
              <Icon name="inventory_2" className="!text-6xl opacity-30" />
              <p className="mt-3 font-medium">Belum ada produk di kategori ini.</p>
            </div>
          )}

          {shownParents.map((parent, idx) => {
            const avail = parentAvailable(parent.id)
            const menus = MENUS.filter((m) => m.parent === parent.id && (!q || m.name.toLowerCase().includes(q)))
            if (menus.length === 0) return null
            return (
              <section key={parent.id} className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display-md text-headline-lg text-on-surface flex items-center gap-3">
                    <span className="w-2 h-8 bg-primary rounded-full" />
                    <span className="uppercase">{parent.name}</span>
                    <span className="text-on-surface-variant font-normal opacity-50">· sisa {avail}</span>
                  </h2>
                  {idx === 0 && (
                    <div className="relative">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-12 pr-4 h-[52px] w-64 rounded-xl border border-outline bg-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                        placeholder="Cari menu..."
                      />
                      <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    </div>
                  )}
                </div>

                {/* Portrait tablet = 3 compact cols; landscape (narrow main) = 2, wide = 3 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {menus.map((m) => {
                    const off = (day.menuOff || []).includes(m.id) // menu dimatikan (coating habis)
                    const habis = !off && avail <= 0
                    const sellable = !off && avail > 0
                    const sweet = m.category === 'sweet'
                    return (
                      <div key={m.id} className={`bg-surface-container-lowest rounded-xl overflow-hidden border border-surface-variant/40 ${sellable ? 'shadow-[0_2px_10px_rgba(26,26,26,0.07)] group hover:-translate-y-0.5 transition-all duration-200' : 'opacity-75'}`}>
                        <div className={`h-28 overflow-hidden relative ${off ? 'grayscale' : ''}`}>
                          <ProductImg src={m.img} imgClass={sellable ? 'group-hover:scale-105 transition-transform duration-300' : ''} />
                          <span className={`absolute top-1.5 left-1.5 font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wide ${sweet ? 'bg-secondary-container text-on-secondary-container' : 'bg-on-tertiary-fixed-variant text-on-tertiary-container'}`}>
                            {sweet ? 'Sweet' : 'Savory'}
                          </span>
                          {/* Toggle ON/OFF ketersediaan (coating habis) — WLK-01 */}
                          <button
                            onClick={() => toggleMenu(m.id)}
                            title={off ? 'Aktifkan menu' : 'Matikan menu (coating habis)'}
                            className={`absolute top-1 right-1 flex items-center gap-0.5 pl-1 pr-1.5 py-0.5 rounded-full text-[9px] font-black shadow ${off ? 'bg-on-surface-variant text-white' : 'bg-white/90 text-green-700'}`}
                          >
                            <Icon name={off ? 'toggle_off' : 'toggle_on'} className="!text-sm" />{off ? 'OFF' : 'ON'}
                          </button>
                          {m.label && sellable && (
                            <span className="absolute bottom-1.5 left-1.5 bg-secondary-container text-on-secondary-container font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wide">{m.label}</span>
                          )}
                          {sellable && avail <= LOW_STOCK_THRESHOLD && (
                            <span className="absolute bottom-1.5 right-1.5 bg-secondary-fixed text-on-secondary-fixed-variant font-black text-[9px] px-2 py-0.5 rounded-full uppercase">sisa {avail}</span>
                          )}
                          {off && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="bg-on-surface-variant text-white font-black text-sm px-3 py-1 rounded -rotate-6 shadow-lg">NONAKTIF</span>
                            </div>
                          )}
                          {habis && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="bg-error text-on-error font-black text-base px-4 py-1 rounded rotate-12 shadow-lg border-2 border-on-error">HABIS</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-bold text-sm text-on-surface leading-tight line-clamp-1">{m.name}</h3>
                          <p className={`font-bold text-base mb-2 ${sellable ? 'text-primary' : 'text-on-surface-variant'}`}>{fmtRp(m.price)}</p>
                          {off ? (
                            <button onClick={() => toggleMenu(m.id)} className="w-full h-9 bg-surface-variant text-on-surface-variant rounded-lg font-bold text-sm flex items-center justify-center gap-1 active:scale-95">
                              <Icon name="restart_alt" className="!text-base" /> Aktifkan
                            </button>
                          ) : habis ? (
                            <button disabled className="w-full h-9 bg-surface-variant text-on-surface-variant rounded-lg font-bold text-sm">Stok Kosong</button>
                          ) : (
                            <button onClick={() => handleAdd(m)} className="w-full h-9 bg-primary text-on-primary rounded-lg font-bold text-sm flex items-center justify-center gap-1 shadow active:scale-95 transition-all">
                              <Icon name="add_circle" className="!text-base" /> Tambah
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </main>

        {/* Cart Panel — landscape only (portrait uses the drawer below) */}
        <section className="hidden lg:flex w-[35%] bg-surface flex-col border-l border-outline-variant shadow-[-8px_0_24px_rgba(0,0,0,0.04)] z-10">
          {cartInner}
        </section>
      </div>

      {/* Portrait: cart summary bottom bar */}
      <button
        onClick={() => setCartOpen(true)}
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-primary text-on-primary px-5 py-3 flex items-center justify-between shadow-[0_-8px_24px_rgba(0,0,0,0.15)]"
      >
        <span className="flex items-center gap-2 font-bold"><Icon name="shopping_cart" /> {totalQty} item</span>
        <span className="font-display-md text-headline-md">{fmtRp(total)}</span>
        <span className="font-black uppercase tracking-wider flex items-center gap-1">Keranjang <Icon name="expand_less" /></span>
      </button>

      {/* Portrait: cart drawer */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-[95] flex" onClick={() => setCartOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative ml-auto w-full max-w-md bg-surface flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end px-3 pt-3 pb-1 shrink-0">
              <button onClick={() => setCartOpen(false)} className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-90"><Icon name="close" /></button>
            </div>
            {cartInner}
          </div>
        </div>
      )}

      {sauceFor && (
        <AddSauceModal
          menu={sauceFor}
          onClose={() => setSauceFor(null)}
          onConfirm={(sauces) => {
            addToCart(sauceFor.id, sauces)
            setSauceFor(null)
          }}
        />
      )}

      {payOpen && (
        <PaymentModal
          total={total}
          onClose={() => setPayOpen(false)}
          onComplete={({ method, cashReceived }) => {
            const sale = commitSale({ method, cashReceived })
            setPayOpen(false)
            if (sale) { setLastSale(sale); flyToMasak() }
          }}
        />
      )}

      {lastSale && <SaleSuccess sale={lastSale} onClose={() => setLastSale(null)} onReceipt={() => setShowReceipt(true)} />}
      {showReceipt && lastSale && <Receipt sale={lastSale} branch={branch} onClose={() => setShowReceipt(false)} />}
      {breakOpen && <BreakageModal onClose={() => setBreakOpen(false)} />}
    </div>
  )
}

// Lightweight success overlay (no Stitch ref for POS success — kept consistent
// with the design system). Confirms the sale, shows change for cash, and notes
// the order goes to the cooking queue (MSK, step 1A.7). Receipt = STR-01 (1A.15).
function SaleSuccess({ sale, onClose, onReceipt }) {
  const pending = sale.status === 'pending_payment'
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-blur-overlay p-4" onClick={onClose}>
      <div className="w-full max-w-[420px] bg-white rounded-xl shadow-[0_16px_32px_rgba(26,26,26,0.12)] p-margin-page text-center" onClick={(e) => e.stopPropagation()}>
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${pending ? 'bg-secondary-container' : 'bg-green-100'}`}>
          <Icon name={pending ? 'schedule' : 'check_circle'} fill className={`!text-4xl ${pending ? 'text-on-secondary-container' : 'text-green-600'}`} />
        </div>
        <h2 className="font-display-md text-headline-lg text-on-surface mt-4">{pending ? 'Pesanan Dibuat' : 'Pembayaran Berhasil'}</h2>
        <p className="font-body-md text-on-surface-variant mt-1">
          {sale.id} · {pending ? 'Bayar saat penyerahan' : { tunai: 'Tunai', qris_midtrans: 'QRIS Midtrans', qris_gopay: 'QRIS GoPay', gofood: 'GoFood', grabfood: 'GrabFood' }[sale.method]}
        </p>

        <div className="mt-4 bg-surface-container-low rounded-xl p-4 space-y-2 text-left">
          <div className="flex justify-between"><span className="text-on-surface-variant">Total</span><span className="font-bold text-on-surface">{fmtRp(sale.total)}</span></div>
          {sale.method === 'tunai' && (
            <>
              <div className="flex justify-between"><span className="text-on-surface-variant">Tunai diterima</span><span className="text-on-surface">{fmtRp(sale.cashReceived)}</span></div>
              <div className="flex justify-between text-green-700 font-bold"><span>Kembalian</span><span>{fmtRp(sale.change)}</span></div>
            </>
          )}
        </div>

        <p className="mt-4 text-sm text-on-surface-variant flex items-center justify-center gap-2">
          <Icon name="outdoor_grill" className="text-base" /> Pesanan masuk antrean masak (langkah 1A.7).
        </p>

        <div className="mt-5 flex gap-3">
          <button onClick={onReceipt} className="px-5 h-min-tap-target rounded-[14px] border-2 border-primary text-primary font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Icon name="receipt_long" /> Struk
          </button>
          <button onClick={onClose} className="flex-1 h-min-tap-target bg-primary text-on-primary rounded-[14px] font-bold active:scale-95 transition-all">
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  )
}
