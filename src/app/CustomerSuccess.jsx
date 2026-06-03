import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useOrders } from '../store/useOrders.js'
import { getOrder, markOrderContacted } from '../store/orders.js'

// 2.1 — CUS-03 Payment Success + PIN (redesigned). The WhatsApp button is the
// mandatory hero: Lacak Pesanan & Kembali ke Menu only appear once the customer
// taps it (Jalur 2 nudge). WA = pre-typed wa.me (PRD golden rule #9, no API).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

// Decorative confetti pieces for the celebratory header.
const CONFETTI = [
  { left: '8%', delay: '0s', color: '#b50303', d: '2.4s' },
  { left: '22%', delay: '.5s', color: '#ffc72c', d: '2.8s' },
  { left: '40%', delay: '.2s', color: '#25D366', d: '2.2s' },
  { left: '62%', delay: '.7s', color: '#ffc72c', d: '3s' },
  { left: '78%', delay: '.1s', color: '#b50303', d: '2.6s' },
  { left: '90%', delay: '.4s', color: '#25D366', d: '2.9s' },
]

export default function CustomerSuccess() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const master = useMaster()
  useOrders() // reaktif ke order.contacted (persisted → tahan back/refresh)
  const order = getOrder(orderId)
  if (!order) return <Navigate to="/app/cabang" replace />
  const contacted = !!order.contacted // sudah menghubungi kasir? (dari order, bukan state lokal)
  const branch = BRANCHES.find((b) => b.id === order.branchId)
  const menuName = (id) => (master?.menus || []).find((m) => m.id === id)?.name || id

  const waText = encodeURIComponent(
    `Halo CORNEY ${branch?.name?.replace('CORNEY ', '') || ''}! Pesanan online saya:\n` +
    `No #${String(order.no).padStart(3, '0')} · PIN ${order.pin}\n` +
    order.lines.map((l) => `- ${l.qty}x ${menuName(l.menuId)}`).join('\n') +
    `\nTotal ${fmtRp(order.total)} (LUNAS via QRIS)\n` +
    `${order.method === 'maxim' ? `Diambil Maxim ke: ${order.address || '(alamat belum diisi)'}` : `Ambil sendiri jam ${order.schedule}`}. Terima kasih!`
  )
  const waUrl = `https://wa.me/${branch?.wa || ''}?text=${waText}`

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col items-center overflow-hidden">
      <style>{`
        @keyframes pop { 0% { transform: scale(.5); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes wa-glow { 0%,100% { box-shadow: 0 14px 30px -10px rgba(37,211,102,.7), 0 0 0 0 rgba(37,211,102,.55) } 50% { box-shadow: 0 14px 30px -10px rgba(37,211,102,.7), 0 0 0 16px rgba(37,211,102,0) } }
        @keyframes nudge { 0%,100% { transform: translateY(0) } 50% { transform: translateY(6px) } }
        @keyframes reveal { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes confetti { 0% { transform: translateY(-12px) rotate(0); opacity: 1 } 100% { transform: translateY(240px) rotate(420deg); opacity: 0 } }
      `}</style>

      <main className="relative w-full max-w-md flex flex-col px-6 pt-12 pb-10 flex-grow">
        {/* soft brand glow + confetti behind the header */}
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary-fixed/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-64 overflow-hidden pointer-events-none">
          {CONFETTI.map((c, i) => (
            <span key={i} className="absolute top-0 w-2 h-3 rounded-[2px]" style={{ left: c.left, backgroundColor: c.color, animation: `confetti ${c.d} ease-in ${c.delay} infinite` }} />
          ))}
        </div>

        {/* Header */}
        <header className="relative flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-green-300/50 blur-xl" />
            <div className="relative w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg border-[5px] border-green-100" style={{ animation: 'pop .5s ease-out' }}>
              <Icon name="check_circle" fill className="!text-[58px] text-green-500" />
            </div>
          </div>
          <h1 className="font-display-md text-[30px] leading-tight font-extrabold tracking-tight mb-1">Pembayaran Berhasil! 🎉</h1>
          <p className="text-body-md text-on-surface-variant">Pesanan kamu sudah masuk ke kasir.</p>
        </header>

        {/* PIN card */}
        <section className="relative rounded-[26px] p-6 mb-5 text-center overflow-hidden" style={{ background: 'linear-gradient(135deg,#ffc72c,#f6bf22)', boxShadow: '0 18px 34px -12px rgba(255,199,44,.65)' }}>
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/20" />
          <div className="absolute -left-6 -bottom-10 w-24 h-24 rounded-full bg-white/10" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-on-secondary-container/90 text-[12px] font-extrabold uppercase tracking-[0.2em]"><Icon name="confirmation_number" fill className="!text-[16px]" /> PIN Pengambilan</span>
            <div className="font-display-lg text-[68px] leading-none font-extrabold text-on-secondary-container my-2 tracking-tight tabular-nums">{order.pin}</div>
            <p className="text-[13px] text-on-secondary-container/80 max-w-[260px] mx-auto leading-snug">Tunjukkan PIN ini saat ambil / tulis di catatan driver Maxim.</p>
          </div>
        </section>

        {/* Recap */}
        <section className="bg-surface-container-lowest rounded-[22px] p-5 mb-7 shadow-[0_10px_28px_-14px_rgba(26,26,26,0.18)] border border-surface-container-highest">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-[12px] font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-md">#{String(order.no).padStart(3, '0')}</span>
              <h2 className="font-headline-md mt-1.5">{branch?.name}</h2>
            </div>
            <div className="text-right text-on-surface-variant">
              <Icon name="schedule" className="text-primary" />
              <p className="text-label-md font-bold">{order.method === 'maxim' ? 'Maxim' : `Ambil · ${order.schedule}`}</p>
            </div>
          </div>
          <div className="border-y border-dashed border-outline-variant py-3 my-1 flex flex-col gap-1.5">
            {order.lines.map((l) => (
              <div key={l.sig} className="flex justify-between text-body-md"><span className="text-on-surface-variant">{l.qty}x {menuName(l.menuId)}</span></div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-3">
            <span className="font-label-lg">Total Pembayaran</span>
            <div className="flex items-center gap-2">
              <span className="font-headline-md text-primary">{fmtRp(order.total)}</span>
              <span className="text-[11px] font-bold uppercase text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Lunas</span>
            </div>
          </div>
        </section>

        {/* Nudge above the hero CTA */}
        {!contacted && (
          <div className="flex flex-col items-center mb-3">
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary font-extrabold text-[13px] px-3.5 py-1.5 rounded-full">Tinggal 1 langkah lagi ya kak!</span>
            <Icon name="keyboard_double_arrow_down" className="text-[#1ebe5d] !text-[28px] mt-1" style={{ animation: 'nudge 1.1s ease-in-out infinite' }} />
          </div>
        )}

        {/* HERO WhatsApp CTA — hanya sebelum menghubungi kasir */}
        {!contacted && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => markOrderContacted(order.id)}
            className="group w-full rounded-[22px] p-4 flex items-center gap-4 text-white active:scale-[.98] transition-transform"
            style={{ background: 'linear-gradient(135deg,#25D366,#16a34a)', animation: 'wa-glow 1.8s ease-in-out infinite' }}
          >
            <span className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Icon name="chat" fill className="!text-[30px]" />
            </span>
            <span className="text-left leading-tight">
              <span className="block font-extrabold text-[18px]" style={{ textShadow: '0 1px 2px rgba(0,0,0,.25)' }}>Yeyyy sekarang Wajib hubungi kasir ya kak</span>
              <span className="block text-white/90 text-[12px] font-semibold mt-1">Pesan &amp; PIN sudah terketik — tinggal tekan Kirim</span>
            </span>
          </a>
        )}

        {/* Gated secondary actions */}
        {contacted ? (
          <div className="mt-6 flex flex-col gap-3" style={{ animation: 'reveal .35s ease-out' }}>
            <div className="flex items-center justify-center gap-1.5 text-green-700 font-bold text-label-md"><Icon name="check_circle" fill className="!text-[18px]" /> Sip! Kasir sudah kamu hubungi.</div>
            <button onClick={() => navigate(`/app/lacak/${order.id}`)} className="w-full h-[54px] rounded-full bg-primary text-on-primary font-bold text-[16px] shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"><Icon name="local_shipping" fill /> Lacak Pesanan</button>
            <button onClick={() => navigate(`/app/katalog/${order.branchId}`)} className="w-full h-[54px] rounded-full border-2 border-primary text-primary font-bold text-[16px] active:bg-primary/5 transition-colors">Kembali ke Menu</button>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-center gap-2 text-on-surface-variant/70 text-[12px] text-center px-4">
            <Icon name="lock" className="!text-[16px] shrink-0" /> Lacak Pesanan &amp; Kembali ke Menu aktif setelah kamu menghubungi kasir.
          </div>
        )}

        <footer className="mt-10">
          <p className="text-[11px] text-on-surface-variant/60 text-center leading-relaxed">Pembayaran kamu sudah <strong>LUNAS &amp; tersimpan</strong>.{!contacted && ' Agar pesanan langsung disiapkan kasir, tekan tombol WhatsApp di atas ya.'}{contacted && ' Pertanyaan soal pesanan? Lewat Lacak Pesanan ya.'}<br />#CeritanyaBersamaCorney</p>
        </footer>
      </main>
    </div>
  )
}
