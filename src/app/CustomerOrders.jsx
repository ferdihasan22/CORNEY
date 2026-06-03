import { useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useOrders } from '../store/useOrders.js'

// 2.1 — CUS-04 Riwayat Pesanan. Ported from Stitch "riwayat_pesanan_corney_app"
// but stripped of the decorative sidebar / bottom-nav (Menu/Promo/Profile aren't
// PRD features yet). Fase 1: "my orders" = the orders saved on this device
// (localStorage); real per-account history = TAHAP 4. Tap a card → Lacak Pesanan.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const STATUS = {
  baru: { label: 'Baru', cls: 'bg-secondary-container text-on-secondary-container' },
  diproses: { label: 'Diproses', cls: 'bg-blue-600 text-white' },
  siap: { label: 'Siap', cls: 'bg-amber-500 text-white' },
  selesai: { label: 'Selesai', cls: 'bg-green-600 text-white' },
}

export default function CustomerOrders() {
  const navigate = useNavigate()
  const master = useMaster()
  const orders = useOrders() || []

  const menuById = (id) => (master?.menus || []).find((m) => m.id === id)
  const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name?.replace('CORNEY ', '') || id
  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return '' }
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-surface shadow-sm flex items-center gap-3 px-4 h-[64px]">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Pesanan Saya</h1>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-44 h-44 mb-7 bg-surface-container-low rounded-full flex items-center justify-center">
              <Icon name="receipt_long" className="!text-[96px] text-outline-variant" />
            </div>
            <h2 className="font-headline-lg text-headline-lg mb-2">Belum ada pesanan</h2>
            <p className="text-body-md text-on-surface-variant mb-8 max-w-xs">Kamu belum pernah memesan lewat app CORNEY. Yuk, pilih menu favoritmu!</p>
            <button onClick={() => navigate('/app/cabang')} className="bg-primary text-on-primary font-bold px-12 py-4 rounded-2xl min-h-[52px] shadow-lg active:scale-95 transition-all">Pesan Sekarang</button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((o) => {
              const first = menuById(o.lines?.[0]?.menuId)
              const more = (o.lines?.length || 0) - 1
              const st = STATUS[o.status] || STATUS.baru
              return (
                <button key={o.id} onClick={() => navigate(`/app/lacak/${o.id}`)} className="bg-surface-container-lowest p-4 rounded-2xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] flex items-center gap-4 border border-surface-variant/20 active:scale-[0.99] transition-transform text-left">
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-surface-container">
                    {first?.img ? <img src={first.img} alt={first.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="lunch_dining" className="text-on-surface-variant" /></div>}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-headline-md text-[17px] truncate">{first?.name || 'Pesanan'}{more > 0 ? ` +${more} lainnya` : ''}</p>
                        <p className="font-label-md text-label-md text-on-surface-variant truncate">#{String(o.no).padStart(3, '0')} · {branchName(o.branchId)} · PIN {o.pin}</p>
                      </div>
                      <span className={`shrink-0 px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <p className="font-label-md text-label-md text-on-surface-variant">{fmtDate(o.createdAt)}</p>
                      <p className="font-headline-md text-headline-md text-primary">{fmtRp(o.total)}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
