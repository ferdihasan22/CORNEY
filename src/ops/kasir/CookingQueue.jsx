import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MENUS, BRANCHES, SAUCES, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { useOrders } from '../../store/useOrders.js'
import { PHASE, startFrying, finishCooking, payPending } from '../../store/day.js'
import { startFryingOrder, finishFryingOrder } from '../../store/orders.js'
import PaymentModal from './PaymentModal.jsx'
import { onlineNo } from '../../lib/util.js'

// Step 1A.7 — MSK-01/02/04 Antrean Masak. UI ported from Stitch
// "cooking_queue_corney_kitchen", stripped of non-PRD decoration (kitchen
// side-nav, notif/settings icons, FAB, promo/tips card, "New Alert").
// One timer per order (MSK-04): GORENG 6/8 min → countdown → ANGKAT alarm →
// SELESAI. FIFO+ ordering (MSK-02). Capacity is informational (MSK-03 = P1).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const RING = 2 * Math.PI * 44 // timer ring circumference

function sourceBadge(sale) {
  if (sale.online) return { label: sale.method === 'maxim' ? 'Online · Maxim' : 'Online · Ambil', cls: 'bg-blue-600 text-white' }
  if (sale.method === 'gofood') return { label: 'GoFood', cls: 'bg-green-600 text-white' }
  if (sale.method === 'grabfood') return { label: 'GrabFood', cls: 'bg-emerald-700 text-white' }
  return { label: 'Walk-in', cls: 'bg-secondary-container text-on-secondary-container' }
}
const itemsLabel = (sale) => sale.lines.map((l) => `${l.qty}x ${MENUS.find((m) => m.id === l.menuId)?.name ?? l.menuId}`).join(', ')
// Online → "O-003", walk-in → "#003": deret nomor terpisah, ini cegah bentrok saat panggil.
const code = (sale) => (sale.online ? onlineNo(sale.no) : '#' + String(sale.no).padStart(3, '0'))
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}


export default function CookingQueue() {
  const day = useDay()
  const orders = useOrders()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  const [now, setNow] = useState(() => Date.now())
  const [payFor, setPayFor] = useState(null) // pending order being paid at handover
  const [detail, setDetail] = useState(null) // order yang dibuka detailnya (klik kartu)

  function selesai(s) {
    if (s.online) finishFryingOrder(s.id) // online sudah LUNAS (QRIS) → cukup angkat
    else if (!s.paid) setPayFor(s) // walk-in: collect payment at handover first
    else finishCooking(s.id)
  }
  const beginFry = (s, min) => (s.online ? startFryingOrder(s.id, min) : startFrying(s.id, min))

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />

  // MSK-01: ONE cook list = walk-in "Buat Dulu" + Online (status diproses).
  // Online orders are already paid (QRIS) and carry their own cook state.
  const walkin = (day.sales || []).map((sale, i) => ({ ...sale, no: sale.no ?? i + 1, online: false }))
  const online = (orders || [])
    .filter((o) => o.branchId === day.branchId && o.paid && o.status === 'diproses' && (o.cook?.status || 'queued') !== 'completed')
    .map((o) => ({ ...o, online: true, paid: true }))

  // Build active orders with derived cooking state. Default `cook` so items
  // without a cooking schema yet don't crash.
  const active = [...walkin, ...online]
    .map((s) => ({ ...s, cook: s.cook || { status: 'queued', durationMin: null, startAt: null } }))
    .filter((s) => s.cook.status !== 'completed')
    .map((s) => {
      const total = (s.cook.durationMin || 0) * 60000
      const remaining = s.cook.status === 'frying' ? s.cook.startAt + total - now : null
      const done = s.cook.status === 'frying' && remaining <= 0
      const rank = done ? 0 : s.cook.status === 'frying' ? 1 : 2
      return { s, total, remaining, done, rank }
    })
    .sort((a, b) => a.rank - b.rank || a.s.no - b.s.no)

  const fryingNow = active.filter((a) => a.s.cook.status === 'frying' && !a.done).length
  // Alarm "gorengan matang" kini ditangani global oleh <KasirAlerts/> (berbunyi di
  // layar kasir mana pun, pakai suara sudah-goreng.mp3) → tak perlu beep di sini.

  return (
    <div className="bg-background text-on-surface h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-primary flex justify-between items-center px-4 sm:px-margin-page h-[72px] shrink-0 shadow-sm text-on-primary gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-display-md text-xl sm:text-display-md font-black tracking-tighter whitespace-nowrap">CORNEY KITCHEN</h1>
          <div className="hidden lg:block h-8 w-px bg-white/20" />
          <h2 className="hidden lg:block font-headline-md text-headline-md truncate">Antrean Masak · {branch.name}</h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="bg-white/10 px-3 py-2 rounded-full border border-white/10 flex items-center gap-2">
            <Icon name="outdoor_grill" className="text-white" />
            <p className="font-label-lg text-label-lg"><span className="hidden sm:inline">Sedang digoreng: </span><span className="font-bold">{fryingNow}</span></p>
          </div>
          <button onClick={() => navigate('/ops/kasir/jualan')} className="bg-white/15 hover:bg-white/25 px-3 py-2 rounded-xl font-label-lg flex items-center gap-2 transition-colors">
            <Icon name="arrow_back" /> <span className="hidden sm:inline">Walk-in</span>
          </button>
        </div>
      </header>

      {/* Instruction banner (MSK-04) */}
      <div className="bg-[#FFFBEB] px-4 sm:px-margin-page py-3 border-b border-[#FEF3C7] flex items-start sm:items-center gap-3 shrink-0">
        <Icon name="info" className="text-[#B45309]" />
        <p className="font-label-lg text-label-lg text-[#92400E]">
          Adonan tipis → <span className="font-bold">6 menit</span> · Adonan tebal → <span className="font-bold">8 menit</span> · Suhu minyak maks <span className="font-bold">170°C</span> · <span className="font-bold">Ketuk kartu</span> untuk lihat detail pesanan
        </p>
      </div>

      {/* Queue */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-margin-page">
        {active.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-on-surface-variant">
            <Icon name="skillet" className="!text-6xl opacity-30" />
            <p className="mt-3 font-headline-md text-headline-md">Tidak ada antrean</p>
            <p className="text-sm opacity-70">Pesanan Walk-in & Order Online akan muncul di sini.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {active.map(({ s, total, remaining, done }) => {
              const badge = sourceBadge(s)
              if (done) {
                return (
                  <div key={s.id} onClick={() => setDetail(s)} className="bg-[#DC2626] rounded-[14px] p-4 sm:p-6 shadow-xl border-2 border-red-700 animate-flash flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="bg-white text-red-600 w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-inner shrink-0">
                        <Icon name="notifications_active" fill className="!text-3xl sm:!text-[40px]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`${badge.cls} px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider`}>{badge.label}</span>
                          <span className="text-white/80 font-bold">{code(s)}</span>
                          {!s.paid && <span className="bg-white text-red-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Belum bayar</span>}
                        </div>
                        <h3 className="text-white font-display-md text-3xl sm:text-display-md leading-none">ANGKAT!</h3>
                        <p className="text-white/90 font-headline-md text-base sm:text-headline-md mt-1">{itemsLabel(s)}</p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); selesai(s) }} className="w-full sm:w-auto bg-white text-red-600 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg shrink-0">
                      {s.paid ? 'SELESAI' : 'BAYAR & SELESAI'}
                    </button>
                  </div>
                )
              }
              if (s.cook.status === 'frying') {
                const offset = RING * (1 - Math.max(0, remaining) / total)
                return (
                  <div key={s.id} onClick={() => setDetail(s)} className="bg-white rounded-[14px] p-4 sm:p-6 shadow-sm border border-outline-variant flex items-center gap-4 relative overflow-hidden cursor-pointer active:bg-surface-container-low">
                    <div className="absolute left-0 top-0 w-2 h-full bg-blue-500" />
                    <div className="relative w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center shrink-0 ml-1">
                      <svg className="w-full h-full" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 96 96">
                        <circle cx="48" cy="48" r="44" fill="transparent" stroke="#e5e7eb" strokeWidth="6" />
                        <circle cx="48" cy="48" r="44" fill="transparent" stroke="#b50303" strokeWidth="6" strokeDasharray={RING} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.4s linear' }} />
                      </svg>
                      <span className="absolute text-on-surface font-bold text-base sm:text-lg">{mmss(remaining)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`${badge.cls} px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider`}>{badge.label}</span>
                        <span className="text-on-surface-variant font-bold">{code(s)}</span>
                      </div>
                      <h3 className="font-headline-lg text-lg sm:text-headline-lg text-on-surface">{itemsLabel(s)}</h3>
                      <p className="text-on-surface-variant flex items-center gap-1 font-label-md">
                        <Icon name="restaurant" className="text-[18px]" /> Sedang digoreng ({s.cook.durationMin} mnt)
                      </p>
                    </div>
                  </div>
                )
              }
              // queued
              return (
                <div key={s.id} onClick={() => setDetail(s)} className="bg-white rounded-[14px] p-4 sm:p-6 shadow-sm border border-outline-variant flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden cursor-pointer active:bg-surface-container-low">
                  <div className="absolute left-0 top-0 w-2 h-full bg-green-500" />
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 sm:w-24 sm:h-24 bg-surface-container rounded-full flex items-center justify-center text-on-surface-variant border-2 border-dashed border-outline shrink-0 ml-1">
                      <Icon name="hourglass_empty" className="!text-2xl sm:!text-[32px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`${badge.cls} px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider`}>{badge.label}</span>
                        <span className="text-on-surface-variant font-bold">{code(s)}</span>
                        {!s.paid && <span className="bg-secondary-fixed text-on-secondary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase">Belum bayar</span>}
                      </div>
                      <h3 className="font-headline-lg text-lg sm:text-headline-lg text-on-surface">{itemsLabel(s)}</h3>
                      <p className="text-on-surface-variant font-label-md">Siap untuk digoreng</p>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto shrink-0">
                    <p className="font-label-md text-center text-on-surface-variant mb-1">Pilih Durasi:</p>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); beginFry(s, 6) }} className="flex-1 sm:flex-none bg-primary text-on-primary px-6 py-3 rounded-xl font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex flex-col items-center">
                        <span>GORENG</span><span className="text-[10px] opacity-80">6 Menit</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); beginFry(s, 8) }} className="flex-1 sm:flex-none bg-on-primary-container text-primary px-6 py-3 rounded-xl font-bold border-2 border-primary active:scale-95 transition-all flex flex-col items-center">
                        <span>GORENG</span><span className="text-[10px] opacity-80">8 Menit</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Detail pesanan — klik kartu antrean → rincian item, saus, customer, total */}
      {detail && (() => {
        const s = detail
        const badge = sourceBadge(s)
        const lineName = (l) => MENUS.find((m) => m.id === l.menuId)?.name || l.menuId
        const sauceNames = (l) => (l.sauces || []).map((sc) => SAUCES.find((x) => x.id === sc.id)?.name || sc.id)
        return (
          <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDetail(null)}>
            <style>{`@keyframes detIn{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-surface rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" style={{ animation: 'detIn .22s ease-out' }}>
              <div className="bg-primary text-on-primary p-5 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`${badge.cls} px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider`}>{badge.label}</span>
                    <span className="font-headline-md text-headline-md">{code(s)}</span>
                    {!s.paid && <span className="bg-white text-red-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Belum bayar</span>}
                  </div>
                  <button onClick={() => setDetail(null)} className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center active:scale-95 shrink-0"><Icon name="close" /></button>
                </div>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                {s.online && (
                  <div className="space-y-2 text-sm">
                    {s.name && <div className="flex items-center gap-2"><Icon name="person" className="!text-[18px] text-on-surface-variant" /><span className="font-bold">{s.name}</span></div>}
                    {s.wa && <div className="flex items-center gap-2"><Icon name="call" className="!text-[18px] text-on-surface-variant" /><a href={`https://wa.me/${String(s.wa).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-700 font-bold">{s.wa}</a></div>}
                    <div className="flex items-center gap-2"><Icon name={s.method === 'maxim' ? 'two_wheeler' : 'storefront'} className="!text-[18px] text-on-surface-variant" />{s.method === 'maxim' ? 'Maxim / Ojek' : 'Ambil sendiri'}{s.schedule ? ` · ${s.schedule}` : ''}</div>
                    {s.method === 'maxim' && s.address && <div className="flex items-start gap-2"><Icon name="location_on" className="!text-[18px] text-on-surface-variant" /><span>{s.address}</span></div>}
                    {s.pin && <div className="flex items-center gap-2"><Icon name="key" className="!text-[18px] text-on-surface-variant" />PIN <span className="font-mono font-bold">{s.pin}</span></div>}
                  </div>
                )}
                <div className={`${s.online ? 'border-t border-outline-variant pt-3 ' : ''}space-y-3`}>
                  <p className="text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">Rincian Pesanan</p>
                  {(s.lines || []).map((l, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">{l.qty}×</span>
                      <div className="min-w-0">
                        <p className="font-label-lg leading-tight">{lineName(l)}</p>
                        {sauceNames(l).length > 0 && <p className="text-[12px] text-on-surface-variant">Saus: {sauceNames(l).join(', ')}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                {s.total != null && (
                  <div className="border-t border-outline-variant pt-3 flex justify-between items-center">
                    <span className="font-bold">Total</span>
                    <span className="font-display-md text-display-md text-primary">{fmtRp(s.total)}</span>
                  </div>
                )}
              </div>
              <div className="p-4 pt-0 shrink-0">
                <button onClick={() => setDetail(null)} className="w-full h-12 rounded-xl bg-surface-container text-on-surface font-label-lg active:scale-[0.98]">Tutup</button>
              </div>
            </div>
          </div>
        )
      })()}

      {payFor && (
        <PaymentModal
          total={payFor.total}
          onClose={() => setPayFor(null)}
          onComplete={({ method, cashReceived }) => {
            payPending(payFor.id, { method, cashReceived })
            finishCooking(payFor.id)
            setPayFor(null)
          }}
        />
      )}
    </div>
  )
}
