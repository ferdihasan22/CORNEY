import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useOrders } from '../store/useOrders.js'
import { getOrder, advanceOrder, ORDER_FLOW } from '../store/orders.js'

// 2.1 — CUS Lacak Pesanan. Ported from Stitch "lacak_pesanan_status_diproses".
// Status comes from the orders store; in Fase 1 the kasir's live updates are
// simulated by the "Perbarui status" button (real push = backend, TAHAP 4).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const STEPS = [
  { key: 'baru', label: 'Baru', desc: 'Pesanan diterima sistem' },
  { key: 'diproses', label: 'Diproses', desc: 'Sedang dibuat' },
  { key: 'siap', label: 'Siap', desc: 'Siap diambil / pesan Maxim' },
  { key: 'selesai', label: 'Selesai', desc: 'Pesanan selesai' },
]

export default function CustomerTrack() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const master = useMaster()
  useOrders() // re-render on status change
  const order = getOrder(orderId)
  if (!order) return <Navigate to="/app/cabang" replace />
  const branch = BRANCHES.find((b) => b.id === order.branchId)
  const menuName = (id) => (master?.menus || []).find((m) => m.id === id)?.name || id
  const cur = ORDER_FLOW.indexOf(order.status)
  const itemsLabel = order.lines.map((l) => `${l.qty}x ${menuName(l.menuId)}`).join(', ')

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-40">
      <header className="sticky top-0 z-50 flex items-center px-4 h-[64px] bg-surface">
        <button onClick={() => navigate(-1)} className="p-2 text-primary active:scale-95"><Icon name="arrow_back" /></button>
        <div className="ml-2">
          <h1 className="font-headline-md text-headline-md text-primary leading-tight">Lacak Pesanan</h1>
          <span className="text-[10px] font-label-md bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full uppercase tracking-wider">diperbarui real-time</span>
        </div>
      </header>

      <main className="px-6 space-y-6 mt-2">
        {/* Order header */}
        <section className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_16px_rgba(26,26,26,0.08)] relative">
          <div className="absolute top-3 right-3 bg-secondary-container text-on-secondary-container px-4 py-1.5 rounded-lg text-center">
            <p className="text-[10px] uppercase opacity-80">Kode PIN</p>
            <p className="font-headline-md leading-none">{order.pin}</p>
          </div>
          <span className="text-on-surface-variant font-label-md">Order #{String(order.no).padStart(3, '0')}</span>
          <h2 className="font-headline-md text-primary-container">{branch?.name}</h2>
          <div className="flex items-center gap-2 text-on-surface-variant pt-2"><Icon name="schedule" className="!text-[18px]" /><p className="font-label-md">{order.method === 'maxim' ? 'Maxim' : `Ambil · ${order.schedule}`}</p></div>
        </section>

        {/* Stepper */}
        <section className="relative pl-1">
          {STEPS.map((s, i) => {
            const done = i < cur, active = i === cur
            const last = i === STEPS.length - 1
            return (
              <div key={s.key} className="flex gap-4 pb-7 relative">
                {!last && <div className="absolute left-[11px] top-6 w-0.5 h-full" style={{ background: i < cur ? '#22c55e' : '#f0eded' }} />}
                <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-green-500' : active ? 'bg-blue-600' : 'bg-surface-container-high border-2 border-surface-container'}`}>
                  {done && <Icon name="check" fill className="text-white !text-[16px]" />}
                  {active && <Icon name="restaurant" fill className="text-white !text-[14px]" />}
                </div>
                <div className="flex-1 flex justify-between items-start">
                  <div>
                    <p className={`font-label-lg ${done ? 'text-green-600' : active ? 'text-blue-600' : 'text-on-surface-variant'}`}>{s.label}</p>
                    <p className={`text-sm text-on-surface-variant ${!done && !active ? 'opacity-60' : ''}`}>{s.desc}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        {/* Current status context */}
        {order.status !== 'selesai' ? (
          <section className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shrink-0"><Icon name="restaurant" fill className="text-white" /></div>
            <p className="text-blue-900 font-label-md">{order.status === 'siap' ? 'Pesananmu sudah siap! Silakan ambil / pesan Maxim.' : 'Sedang menyiapkan corndog spesialmu. Tunggu sebentar ya!'}</p>
          </section>
        ) : (
          <section className="bg-green-50 border border-green-100 rounded-xl p-5 flex items-center gap-4">
            <Icon name="celebration" fill className="text-green-600 !text-3xl" /><p className="text-green-900 font-label-md">Pesanan selesai. Terima kasih sudah pesan di CORNEY!</p>
          </section>
        )}

        <a href={`https://wa.me/${branch?.wa || ''}?text=${encodeURIComponent(`Halo, mau tanya pesanan #${String(order.no).padStart(3, '0')} (PIN ${order.pin})`)}`} target="_blank" rel="noreferrer" className="w-full min-h-[52px] rounded-xl flex items-center justify-center gap-3 text-white font-label-lg shadow-lg active:scale-[0.98]" style={{ backgroundColor: '#25D366' }}>
          <Icon name="chat" /> Hubungi Kasir via WhatsApp
        </a>

        {import.meta.env.DEV && order.status !== 'selesai' && (
          <button onClick={() => advanceOrder(order.id)} className="w-full py-3 rounded-xl border border-dashed border-outline text-on-surface-variant text-sm flex items-center justify-center gap-2 active:scale-95">
            <Icon name="bolt" className="!text-[18px]" /> Simulasi: majukan status (demo)
          </button>
        )}
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest shadow-[0_-4px_16px_rgba(26,26,26,0.08)] px-6 py-4 rounded-t-xl z-[60]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-secondary-container border-2 border-white flex items-center justify-center text-[10px] font-bold shrink-0">{order.lines.reduce((s, l) => s + l.qty, 0)}x</div>
          <p className="text-on-surface-variant text-sm font-label-md flex-1 truncate">{itemsLabel}</p>
          <span className="font-bold text-primary">{fmtRp(order.total)}</span>
        </div>
      </div>
    </div>
  )
}
