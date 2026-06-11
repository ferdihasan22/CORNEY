import { useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { BRANCHES, SAUCES, DUMMY_STOCK, LOW_STOCK_THRESHOLD, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useDay } from '../store/useDay.js'
import { addItem } from '../store/cart.js'
import { useCart } from '../store/useCart.js'
import { menuForBranch, resolveSaucesForBranch } from '../store/master.js'
import { useBranchStatus } from '../store/useBranchStatus.js'
import { isSupabase } from '../lib/backend.js'

// 1C.4 — CORNEY App Customer · Detail Produk (CUS-01). Ported from Stitch
// "product_detail_mozza_ori_refined" (savory) + the sweet variant. Sweet = glaze,
// NO sauce (topping rule from the menu category). Savory shows the sauce picker
// with the free-max-2 rule + paid sauces, and a live estimated total. Fase 1 is
// browse-only: the footer shows the estimate but ordering online is Fase 2
// (cart/checkout). Stock badge mirrors the catalog (live when the branch has an
// open kasir day on this device).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

function describe(menu) {
  const core = {
    mozza: 'Keju mozzarella melimpah yang lumer',
    sosis: 'Sosis premium yang juicy',
    jumbo: 'Sosis jumbo ekstra besar',
    mix: 'Perpaduan keju mozzarella & sosis',
  }[menu.parent] || 'Korean corndog spesial'
  const coat = menu.id.includes('kentang') ? ', dibalut kentang renyah' : ''
  if (menu.category === 'sweet') return `${core}${coat}, disiram glaze manis — tanpa saus tambahan.`
  return `${core}${coat}, dibalut adonan korean corndog yang krispi sempurna.`
}

export default function CustomerProductDetail() {
  const { branchId, menuId } = useParams()
  const navigate = useNavigate()
  const master = useMaster()
  const day = useDay()
  const status = useBranchStatus()
  const cart = useCart()
  const [qty, setQty] = useState(1)
  const [picked, setPicked] = useState([]) // sauce ids (savory only)

  const branch = BRANCHES.find((b) => b.id === branchId)
  const rawMenu = (master?.menus || []).find((m) => m.id === menuId)
  // Apply per-branch override (§2.3): effective price; redirect if hidden here.
  const menu = rawMenu ? menuForBranch(branchId, rawMenu) : null
  if (!branch || !menu || menu.off) return <Navigate to={`/app/katalog/${branchId || ''}`} replace />

  const supa = isSupabase()
  // Ketersediaan: mode supabase → dari SERVER (branch_status.availability) LINTAS
  // PERANGKAT (off = menu dimatikan kasir, sold = induk habis); qty pasti TIDAK
  // disinkron → tampil "Tersedia"/"Habis". Mode lokal → sesi day.js (perangkat sama,
  // bisa "sisa N"). Sebelumnya keliru jatuh ke DUMMY_STOCK → cabang baru selalu HABIS.
  const avail = supa ? (status[branchId]?.availability || {}) : null
  const isLive = !supa && day?.branchId === branchId && day?.stock
  const stockMap = isLive ? day.stock : (DUMMY_STOCK[branchId] || {})
  const off = supa ? (avail.off || []).includes(menu.id) : (isLive && (day.menuOff || []).includes(menu.id))
  const threshold = master?.parents?.find((p) => p.id === menu.parent)?.threshold ?? LOW_STOCK_THRESHOLD
  // Sisa per induk: mode supabase dari server (avail.stock) bila ada → tampil "sisa N"
  // & batasi jumlah; bila tak ada (kasir versi lama) → null = tak dibatasi.
  const remaining = supa ? (typeof avail.stock?.[menu.parent] === 'number' ? avail.stock[menu.parent] : null) : null
  const qtyStock = supa ? remaining : (off ? 0 : (stockMap[menu.parent] ?? 0))
  const habis = off || (supa ? (avail.sold || []).includes(menu.parent) : qtyStock <= 0)
  const low = !habis && (supa ? (remaining != null && remaining <= threshold) : qtyStock <= threshold)
  // Jumlah induk ini yg SUDAH di keranjang cabang ini → sisa yg bisa ditambah.
  const inCartParent = (cart?.branchId === branchId ? (cart.lines || []) : []).filter((l) => (master?.menus || []).find((m) => m.id === l.menuId)?.parent === menu.parent).reduce((s, l) => s + (l.qty || 0), 0)
  const maxAdd = remaining == null ? Infinity : Math.max(0, remaining - inCartParent)

  const isSweet = menu.category === 'sweet'
  // Saus efektif per cabang: harga override + sembunyikan owner-off + tandai habis
  // (kasir, hari ini). sauceOff dari server (supabase) atau day lokal.
  const sauceOffList = supa ? (status[branchId]?.availability?.sauceOff || []) : (isLive ? (day?.sauceOff || []) : [])
  const branchSauces = resolveSaucesForBranch(master, branchId, sauceOffList).filter((s) => !s.ownerOff)
  const priceOf = (id) => branchSauces.find((s) => s.id === id)?.price || 0
  const toggleSauce = (s) => {
    if (s.habis) return // saus habis → tak bisa dipilih
    // Tanpa batas jumlah: semua saus bisa dipilih. Saus premium tetap menambah harga.
    setPicked((cur) => (cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id]))
  }
  const saucePaid = picked.reduce((sum, id) => sum + priceOf(id), 0)
  const total = (menu.price + saucePaid) * qty

  return (
    <div className="bg-background text-on-background min-h-screen pb-28">
      {/* Hero */}
      <header className="relative w-full aspect-[4/5] max-h-[60vh] overflow-hidden bg-surface-container">
        {menu.img && <img src={menu.img} alt={menu.name} className="w-full h-full object-cover" />}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10">
          <button onClick={() => navigate(`/app/katalog/${branchId}`)} className="w-12 h-12 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg active:scale-95"><Icon name="arrow_back" className="text-on-surface" /></button>
          {habis ? (
            <div className="bg-error text-on-error px-3 py-1.5 rounded-full font-label-md text-label-md shadow-lg uppercase font-black">Habis</div>
          ) : (
            <div className={`px-3 py-1.5 rounded-full font-label-md text-label-md flex items-center gap-1.5 shadow-lg text-white ${low ? 'bg-amber-600' : 'bg-green-700'}`}>
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> {low && qtyStock != null ? `sisa ${qtyStock} lagi` : 'Tersedia'}
            </div>
          )}
        </div>
      </header>

      <main className="px-6 relative z-20 -mt-4 rounded-t-[24px] bg-background pt-6">
        <section className="flex flex-col gap-3">
          <h1 className="font-display-md text-display-md text-primary tracking-tight leading-none">{menu.name}</h1>
          <p className="font-headline-lg text-headline-lg text-primary">{fmtRp(menu.price)}</p>
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full font-label-md text-label-md ${isSweet ? 'bg-pink-100 text-pink-700' : 'bg-primary-fixed text-on-primary-fixed-variant'}`}>{isSweet ? 'Sweet' : 'Savory'}</span>
            {menu.label && <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-label-md text-label-md">{menu.label}</span>}
          </div>
          <p className="font-body-md text-on-surface-variant leading-relaxed mt-1 whitespace-pre-line">{menu.desc?.trim() || describe(menu)}</p>
        </section>

        {/* Sauce / topping rule */}
        {isSweet ? (
          <section className="mt-8 bg-pink-50 border border-pink-100 rounded-xl p-4 flex items-start gap-3">
            <Icon name="icecream" className="text-pink-600 shrink-0" />
            <p className="text-sm text-on-surface-variant"><strong className="text-pink-700">Menu sweet</strong> memakai glaze manis dan <strong>tidak pakai saus</strong>. Langsung nikmat apa adanya.</p>
          </section>
        ) : (
          <section className="mt-8">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Pilih Saus</h2>
                <p className="font-label-md text-label-md text-on-surface-variant">Pilih sesukamu · saus premium menambah harga</p>
              </div>
              {picked.length > 0 && <span className="bg-surface-container-high px-3 py-1 rounded-lg font-label-md text-label-md text-primary">{picked.length} dipilih</span>}
            </div>
            <div className="flex flex-col gap-3">
              {branchSauces.map((s) => {
                const checked = picked.includes(s.id)
                const isFree = s.price === 0
                const disabled = s.habis
                return (
                  <button key={s.id} onClick={() => toggleSauce(s)} disabled={disabled} className={`flex items-center justify-between p-4 bg-white rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.06)] border transition-all text-left ${checked ? 'border-primary ring-2 ring-primary/40' : 'border-surface-container-high'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[.99]'}`}>
                    <div className="flex items-center gap-4">
                      <span className={`w-6 h-6 rounded-md border flex items-center justify-center ${checked ? 'bg-primary border-primary text-white' : 'border-outline'}`}>{checked && <Icon name="check" className="!text-[18px]" />}</span>
                      <span className="font-label-lg text-label-lg">{s.name}</span>
                    </div>
                    <span className={`font-label-md text-label-md ${s.habis ? 'text-on-surface-variant' : isFree ? 'text-green-700' : 'text-amber-700'}`}>{s.habis ? 'Habis' : isFree ? 'Gratis' : `+${fmtRp(s.price)}`}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {/* Sticky footer — qty + add to cart, then back to catalog (keep browsing) */}
      <footer className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-outline-variant p-4 z-50 shadow-[0_-12px_32px_rgba(0,0,0,0.10)]">
        {maxAdd !== Infinity && maxAdd <= 0 && !habis && (
          <p className="max-w-lg mx-auto mb-2 text-center text-[12px] text-amber-700 font-bold flex items-center justify-center gap-1"><Icon name="info" className="!text-[14px]" /> Maksimal {remaining} {menu.name} sudah ada di keranjang</p>
        )}
        {maxAdd !== Infinity && maxAdd > 0 && qty >= maxAdd && (
          <p className="max-w-lg mx-auto mb-2 text-center text-[12px] text-amber-700 font-bold flex items-center justify-center gap-1"><Icon name="info" className="!text-[14px]" /> Maksimal {maxAdd} lagi (sisa {remaining})</p>
        )}
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="flex items-center bg-surface-container rounded-xl h-[52px] p-1 shrink-0">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-primary active:scale-90"><Icon name="remove" /></button>
            <span className="w-8 text-center font-headline-md text-headline-md">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(q + 1, maxAdd))} disabled={habis || qty >= maxAdd} className="w-10 h-10 flex items-center justify-center text-primary active:scale-90 disabled:opacity-40"><Icon name="add" /></button>
          </div>
          <button
            onClick={() => { const n = Math.min(qty, maxAdd); if (n < 1) return; addItem(branchId, menu.id, picked.map((id) => ({ id })), n); navigate(`/app/katalog/${branchId}`, { state: { added: `${n}x ${menu.name}` } }) }}
            disabled={habis || maxAdd < 1}
            className="flex-1 h-[52px] bg-primary text-white rounded-xl px-4 flex items-center justify-between shadow-[0_4px_12px_rgba(181,3,3,0.3)] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">Total</span>
              <span className="font-label-lg text-label-lg">{fmtRp(total)}</span>
            </div>
            <span className="flex items-center gap-2 font-label-lg"><Icon name="shopping_basket" className="!text-[20px]" /> Tambah ke Keranjang</span>
          </button>
        </div>
      </footer>
    </div>
  )
}
