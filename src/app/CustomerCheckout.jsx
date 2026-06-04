import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { BRANCHES, SAUCES, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useCart } from '../store/useCart.js'
import { clearCart } from '../store/cart.js'
import { createOrder } from '../store/orders.js'
import { menuForBranch } from '../store/master.js'

// 2.1 — CUS-02 Checkout. No dedicated Stitch ref; designed consistent with the
// app + PRD §4: pickup method (ambil sendiri / Maxim), schedule (≥15 min), and
// contact. Creates a pending order → QRIS (no OTP: order is paid, OTP is just
// friction). Instead, an animated warning makes sure the WA number is active so
// the kasir can reach the customer. Cart is cleared once the order is created.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

// PENTING: definisikan di level MODUL (bukan di dalam komponen). Kalau di dalam,
// tiap render = fungsi baru = React bongkar-pasang input → fokus hilang & keyboard
// nutup tiap ketik 1 huruf.
const Field = ({ label, children }) => (
  <div className="space-y-1.5"><label className="font-label-md text-on-surface-variant">{label}</label>{children}</div>
)

// "now + 15 min" as HH:MM (Date is allowed in app runtime, just not in workflows).
function defaultPickup() {
  const d = new Date(Date.now() + 15 * 60000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Slot jam ambil: mulai ~15 menit dari sekarang, dibulatkan ke kelipatan 15 menit,
// 10 slot ke depan (≈2,5 jam). Semua otomatis ≥ sekarang.
function timeSlots() {
  const d = new Date(Date.now() + 15 * 60000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  const pad = (x) => String(x).padStart(2, '0')
  return Array.from({ length: 10 }, (_, i) => { const t = new Date(d.getTime() + i * 15 * 60000); return `${pad(t.getHours())}:${pad(t.getMinutes())}` })
}

// Group a WA number for easy reading & consistency: 0895-3418-69458 (4-4-rest).
function fmtWa(raw) {
  const s = (raw || '').replace(/\D/g, '')
  return s.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3')
}

// Remembered contact (name/wa/address) for auto-fill on the next order.
const CONTACT_KEY = 'corney_contact'
function loadContact() {
  try { return JSON.parse(localStorage.getItem(CONTACT_KEY)) || {} } catch { return {} }
}
function saveContact(c) {
  try { localStorage.setItem(CONTACT_KEY, JSON.stringify(c)) } catch { /* ignore */ }
}

export default function CustomerCheckout() {
  const navigate = useNavigate()
  const master = useMaster()
  const cart = useCart()
  const [method, setMethod] = useState('ambil')
  const [schedule, setSchedule] = useState(() => timeSlots()[0] || defaultPickup())
  const [name, setName] = useState(() => loadContact().name || '')
  const [wa, setWa] = useState(() => loadContact().wa || '')
  const [address, setAddress] = useState(() => loadContact().address || '')
  const [remember, setRemember] = useState(() => !!loadContact().name)
  const [confirm, setConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  if (!cart || cart.lines.length === 0) return <Navigate to="/app/cabang" replace />
  const branch = BRANCHES.find((b) => b.id === cart.branchId)
  if (!branch) return <Navigate to="/app/cabang" replace />

  const menuById = (id) => { const b = (master?.menus || []).find((m) => m.id === id); return b ? menuForBranch(cart.branchId, b) : null }
  const lineTotal = (l) => {
    const paid = (l.sauces || []).reduce((s, sc) => s + (SAUCES.find((x) => x.id === sc.id)?.price || 0), 0)
    return ((menuById(l.menuId)?.price || 0) + paid) * l.qty
  }
  const subtotal = cart.lines.reduce((s, l) => s + lineTotal(l), 0)
  const promo = (master?.promos || []).find((p) => p.active && p.code && p.code === (cart.promoCode || ''))
  let discount = 0
  if (promo) {
    discount = promo.discountKind === 'percent' ? Math.round(subtotal * promo.value / 100) : promo.value
    if (promo.capMax > 0) discount = Math.min(discount, promo.capMax)
    discount = Math.min(discount, subtotal)
  }
  const total = subtotal - discount

  // Jam sekarang (HH:MM) untuk batas bawah jam ambil.
  const now = new Date()
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const slots = timeSlots()

  // Tapping "Bayar" only validates + opens the confirm popup; the actual order is
  // created in confirmPay() after the customer re-confirms their WA number.
  const pay = () => {
    if (!name.trim()) return setErr('Nama wajib diisi.')
    if (!/^[0-9]{8,15}$/.test(wa.replace(/\D/g, ''))) return setErr('Nomor WhatsApp tidak valid.')
    if (method === 'maxim' && !address.trim()) return setErr('Alamat antar wajib diisi untuk Maxim.')
    if (method !== 'maxim' && schedule && schedule < nowHHMM) return setErr('Jam ambil tidak boleh sebelum waktu sekarang.')
    setErr('')
    setConfirm(true)
  }

  const confirmPay = async () => {
    if (submitting) return
    const cleanWa = wa.replace(/\D/g, '')
    if (remember) saveContact({ name: name.trim(), wa: cleanWa, address: address.trim() })
    else saveContact({})
    setSubmitting(true)
    try {
      // Mode supabase: createOrder INSERT ke DB (await) → baru ke QRIS. Kalau gagal,
      // jangan lanjut ke pembayaran (cegah bayar tanpa order tercatat).
      const order = await createOrder({
        branchId: cart.branchId,
        lines: cart.lines.map((l) => ({ ...l })),
        subtotal, discount, total,
        method, schedule: method === 'maxim' ? '' : schedule, name: name.trim(), wa: cleanWa,
        address: method === 'maxim' ? address.trim() : '',
        promoCode: cart.promoCode || '',
      })
      clearCart()
      navigate(`/app/qris/${order.id}`)
    } catch (e) {
      setSubmitting(false)
      setConfirm(false)
      setErr('Gagal membuat pesanan: ' + (e?.message || 'periksa koneksi & coba lagi.'))
    }
  }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-32">
      <header className="sticky top-0 z-50 bg-surface shadow-sm flex items-center gap-3 px-4 h-[64px]">
        <button onClick={() => navigate('/app/keranjang')} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Checkout</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-4 space-y-5">
        {/* Pickup method */}
        <section className="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(26,26,26,0.08)] space-y-3">
          <h2 className="font-label-lg">Cara Ambil</h2>
          <div className="grid grid-cols-2 gap-3">
            {[['ambil', 'Ambil Sendiri', 'storefront', 'Nggak perlu antri/nunggu, datang langsung ambil'], ['maxim', 'Maxim / Ojek', 'two_wheeler', 'ongkir terpisah']].map(([val, lbl, ic, hint]) => (
              <button key={val} onClick={() => setMethod(val)} className={`p-4 rounded-xl border-2 flex flex-col items-start gap-1 transition-all ${method === val ? 'border-primary bg-primary-fixed' : 'border-outline-variant'}`}>
                <Icon name={ic} className={method === val ? 'text-primary' : ''} />
                <span className="font-label-lg">{lbl}</span>
                <span className="text-[11px] text-on-surface-variant leading-snug text-left">{hint}</span>
              </button>
            ))}
          </div>
          {method === 'maxim' && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2 text-amber-900">
                <Icon name="warning" fill className="!text-[18px] shrink-0 mt-0.5 text-amber-600" />
                <p className="text-label-md leading-snug font-bold">Pastikan sudah menginstal Aplikasi MAXIM.</p>
              </div>
              <p className="text-xs text-on-surface-variant flex items-center gap-1"><Icon name="info" className="!text-[14px]" /> Ongkir Maxim dibayar langsung ke driver, terpisah dari harga produk.</p>
            </>
          )}
        </section>

        {/* Schedule + contact */}
        <section className="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(26,26,26,0.08)] space-y-4">
          {method !== 'maxim' && (
            <Field label="Jam Ambil">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 pt-2 -mx-1 px-1">
                {slots.map((t, i) => (
                  <button key={t} type="button" onClick={() => setSchedule(t)} className={`relative shrink-0 px-4 h-12 rounded-xl border-2 font-label-lg transition-all active:scale-95 ${schedule === t ? 'border-primary bg-primary text-on-primary shadow-md' : 'border-outline-variant bg-surface-container-lowest text-on-surface'}`}>
                    {i === 0 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">Tercepat</span>}
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[12px] text-on-surface-variant flex items-center gap-1"><Icon name="schedule" className="!text-[15px]" /> Jam lain:</span>
                <input type="time" min={nowHHMM} value={schedule} onChange={(e) => { const v = e.target.value; setSchedule(v && v < nowHHMM ? nowHHMM : v) }} className="h-10 px-3 rounded-lg border border-outline focus:border-primary outline-none bg-surface-container-lowest" />
              </div>
            </Field>
          )}
          <Field label="Nama Pemesan">
            <input value={name} onChange={(e) => { setName(e.target.value); setErr('') }} placeholder="Nama kamu" className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" />
          </Field>
          <Field label="Nomor WhatsApp">
            <input value={wa} onChange={(e) => { setWa(e.target.value); setErr('') }} type="tel" placeholder="0812xxxxxxx" className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" />
          </Field>
          {method === 'maxim' && (
            <Field label="Alamat Antar (untuk driver Maxim)">
              <textarea value={address} onChange={(e) => { setAddress(e.target.value); setErr('') }} rows={2} placeholder="Patokan, nama gang, warna pagar/rumah, dll." className="w-full px-4 py-3 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest resize-none" />
            </Field>
          )}

          {/* Animated WA warning — order is paid, so the WA number is the ONLY way
              the kasir can reach the customer on issues / when ready. */}
          <style>{`
            @keyframes wa-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(181,3,3,0.35) } 50% { box-shadow: 0 0 0 6px rgba(181,3,3,0) } }
            @keyframes wa-shake { 0%,90%,100% { transform: rotate(0) } 92% { transform: rotate(-12deg) } 94% { transform: rotate(12deg) } 96% { transform: rotate(-8deg) } 98% { transform: rotate(8deg) } }
          `}</style>
          <div className="rounded-xl bg-primary-fixed border-2 border-primary p-4 flex items-start gap-3" style={{ animation: 'wa-glow 2s ease-in-out infinite' }}>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0" style={{ animation: 'wa-shake 2.5s ease-in-out infinite' }}>
              <Icon name="notifications_active" fill className="text-white !text-[22px]" />
            </div>
            <div className="space-y-0.5">
              <p className="font-headline-md text-primary leading-tight">PENTING!!</p>
              <p className="text-sm text-on-surface leading-snug">Pastikan nomor WhatsApp ini <strong>aktif</strong> — agar kamu bisa dihubungi kasir saat ada kendala atau pesanan sudah selesai.</p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-5 h-5 accent-primary rounded shrink-0" />
            <span className="text-sm text-on-surface-variant">Ingat data ini untuk order berikutnya (terisi otomatis)</span>
          </label>

          {err && <p className="text-sm text-error flex items-center gap-1"><Icon name="error" className="!text-[16px]" /> {err}</p>}
        </section>

        {/* Summary */}
        <section className="bg-white rounded-2xl p-padding-card shadow-[0_4px_16px_rgba(26,26,26,0.08)] space-y-3 border-t-4 border-primary">
          <div className="flex items-center justify-between"><h3 className="font-headline-md">Ringkasan</h3><span className="text-label-md text-on-surface-variant flex items-center gap-1"><Icon name="location_on" className="!text-[16px] text-primary" />{branch.name.replace('CORNEY ', '')}</span></div>
          {cart.lines.map((l) => (
            <div key={l.sig} className="flex justify-between text-body-md"><span className="text-on-surface-variant">{l.qty}x {menuById(l.menuId)?.name}</span><span>{fmtRp(lineTotal(l))}</span></div>
          ))}
          <div className="border-t border-surface-variant pt-3 space-y-2">
            <div className="flex justify-between text-on-surface-variant"><span>Subtotal</span><span>{fmtRp(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-green-600"><span>Diskon ({promo.code})</span><span>− {fmtRp(discount)}</span></div>}
            <div className="flex justify-between items-center pt-2 border-t border-surface-variant"><span className="font-bold">Total</span><span className="font-display-md text-display-md text-primary">{fmtRp(total)}</span></div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/90 backdrop-blur-md border-t border-outline-variant z-40">
        <button onClick={pay} className="max-w-2xl mx-auto w-full bg-primary text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          <Icon name="qr_code_2" /> Bayar dengan QRIS · {fmtRp(total)}
        </button>
      </div>

      {/* Pre-payment confirmation — re-shows the WA number + WHY it matters, since
          the order is paid and the kasir reaches the customer only via WhatsApp. */}
      {confirm && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirm(false)}>
          <style>{`@keyframes pop-in { from { transform: translateY(24px) scale(.96); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }`}</style>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-surface rounded-3xl p-6 shadow-2xl" style={{ animation: 'pop-in 0.25s ease-out' }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-3">
                <Icon name="contact_phone" fill className="!text-[32px] text-on-secondary-container" />
              </div>
              <h2 className="font-headline-md text-headline-md">Nomor WhatsApp sudah benar?</h2>
              <p className="text-sm text-on-surface-variant mt-1">Cek sekali lagi sebelum bayar ya.</p>
            </div>
            <div className="my-5 rounded-2xl bg-primary-fixed border border-primary/30 p-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">Nomor kamu</p>
              <p className="font-display-md text-primary tabular-nums whitespace-nowrap leading-none text-[clamp(1.6rem,8vw,2.25rem)]">{fmtWa(wa)}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3 flex items-start gap-2 mb-5">
              <Icon name="info" className="text-primary !text-[18px] shrink-0 mt-0.5" />
              <p className="text-[13px] text-on-surface-variant leading-snug">Kasir akan menghubungi nomor ini lewat WhatsApp kalau ada kendala stok atau saat pesanan sudah siap. Kalau nomor salah, pesananmu bisa terlewat.</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button onClick={confirmPay} disabled={submitting} className="w-full h-[52px] bg-primary text-white rounded-xl font-headline-md shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">{submitting ? 'Memproses…' : 'Ya, sudah benar · Bayar'}</button>
              <button onClick={() => setConfirm(false)} disabled={submitting} className="w-full h-[52px] text-on-surface-variant rounded-xl font-label-lg active:bg-surface-container disabled:opacity-40">Ubah nomor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
