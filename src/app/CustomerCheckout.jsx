import { useState, useCallback } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import TurnstileWidget from '../components/TurnstileWidget.jsx'
import { turnstileEnabled, setTurnstileToken } from '../lib/turnstile.js'
import { BRANCHES, SAUCES, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useCart } from '../store/useCart.js'
import { createOrder } from '../store/orders.js'
import { menuForBranchOnline, onlinePriceOf } from '../store/master.js'
import { serviceFeeOnline } from '../store/appconfig.js'
import { useAppConfig } from '../store/useAppConfig.js'
import { useBranchStatus } from '../store/useBranchStatus.js'
import { getBranchStatus, refreshBranchStatusAsync } from '../store/branchStatus.js'
import { isSupabase } from '../lib/backend.js'

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
  const status = useBranchStatus() // ketersediaan + status buka cabang (realtime)
  useAppConfig() // re-render saat Owner ubah biaya layanan
  const [method, setMethod] = useState('ambil')
  const [schedule, setSchedule] = useState(() => timeSlots()[0] || defaultPickup())
  const [name, setName] = useState(() => loadContact().name || '')
  const [wa, setWa] = useState(() => loadContact().wa || '')
  const [address, setAddress] = useState(() => loadContact().address || '')
  const [remember, setRemember] = useState(() => !!loadContact().name)
  const [confirm, setConfirm] = useState(false)
  // Popup edukasi Maxim: muncul saat pilih Maxim, sampai user centang "jangan tampilkan
  // lagi" (persisten di localStorage). maximNoApp = tampilan tombol instal (setelah "Belum").
  const MAXIM_DISMISS_KEY = 'corney_maxim_ask_dismissed'
  const MAXIM_PLAY = 'https://play.google.com/store/apps/details?id=com.taxsee.taxsee'
  const MAXIM_APPSTORE = 'https://apps.apple.com/id/search?term=maxim%20order%20a%20taxi'
  // Deteksi platform utk arahkan ke store yang tepat (jalan jg di webview IG: UA tetap
  // memuat "iPhone"/"Android"). Tak dikenali (desktop/UA aneh) → tampilkan keduanya.
  const _ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : ''
  const isIOS = /iphone|ipad|ipod/i.test(_ua)
  const isAndroid = /android/i.test(_ua)
  const [maximAsk, setMaximAsk] = useState(false)
  const [maximNoApp, setMaximNoApp] = useState(false)
  const [maximDontShow, setMaximDontShow] = useState(false)
  const closeMaximAsk = () => {
    if (maximDontShow) { try { localStorage.setItem(MAXIM_DISMISS_KEY, '1') } catch { /* ignore */ } }
    setMaximAsk(false)
  }
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [cfToken, setCfToken] = useState('') // token Turnstile (kalau fitur aktif)
  const onCf = useCallback((t) => { setCfToken(t || ''); setTurnstileToken(t) }, [])

  if (!cart || cart.lines.length === 0) return <Navigate to="/app/cabang" replace />
  const branch = BRANCHES.find((b) => b.id === cart.branchId)
  if (!branch) return <Navigate to="/app/cabang" replace />

  const menuById = (id) => { const b = (master?.menus || []).find((m) => m.id === id); return b ? menuForBranchOnline(cart.branchId, b) : null }
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
  // Biaya layanan ONLINE (global, per order). Walk-in TIDAK kena (kasir terpisah).
  const svc = serviceFeeOnline()
  const serviceFee = svc.on ? svc.amount : 0
  const total = subtotal - discount + serviceFee

  // Validasi ketersediaan (mode supabase): menu habis / cabang tutup → cegah buat order.
  const supa = isSupabase()
  const avail = supa ? (status[cart.branchId]?.availability || {}) : {}
  const unavail = (l) => { const m = menuById(l.menuId); if (!m) return true; if (!supa) return false; return (avail.off || []).includes(m.id) || (avail.sold || []).includes(m.parent) }
  const unavailNames = cart.lines.filter(unavail).map((l) => menuById(l.menuId)?.name || 'item').join(', ')
  // Anti-oversell (gerbang keras): total per induk tak boleh melebihi sisa server.
  const overStock = (() => {
    if (!supa) return null
    const byParent = {}
    cart.lines.forEach((l) => { const m = menuById(l.menuId); if (m) byParent[m.parent] = (byParent[m.parent] || 0) + l.qty })
    for (const p of Object.keys(byParent)) { const r = avail.stock?.[p]; if (typeof r === 'number' && byParent[p] > r) return { sisa: r } }
    return null
  })()
  const stCab = supa ? status[cart.branchId] : null
  const todayISO2 = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const branchClosed = supa ? !(stCab?.open && stCab.openDate === todayISO2) : false

  // Bila cache lokal bilang cabang TUTUP, JANGAN langsung tolak — re-cek status
  // segar ke server dulu. Cegah blok palsu saat cabang BARU buka & sinkron realtime
  // ke HP customer belum sampai (customer langsung checkout begitu cabang buka).
  const ensureBranchOpen = async () => {
    if (!supa || !branchClosed) return true
    await refreshBranchStatusAsync()
    const fresh = getBranchStatus()[cart.branchId]
    return !!(fresh?.open && fresh.openDate === todayISO2)
  }

  // Jam sekarang (HH:MM) untuk batas bawah jam ambil.
  const now = new Date()
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const slots = timeSlots()

  // Tapping "Bayar" only validates + opens the confirm popup; the actual order is
  // created in confirmPay() after the customer re-confirms their WA number.
  const pay = async () => {
    if (!(await ensureBranchOpen())) return setErr('Cabang sedang tutup untuk pesanan online. Coba lagi saat buka ya.')
    if (unavailNames) return setErr('Maaf, ada menu HABIS: ' + unavailNames + '. Hapus dari keranjang dulu.')
    if (overStock) return setErr(`Maaf, jumlah pesanan melebihi stok yang tersisa (tinggal ${overStock.sisa}). Kurangi dulu di keranjang ya.`)
    if (!name.trim()) return setErr('Nama wajib diisi.')
    if (!/^[0-9]{8,15}$/.test(wa.replace(/\D/g, ''))) return setErr('Nomor WhatsApp tidak valid.')
    if (method === 'maxim' && !address.trim()) return setErr('Alamat antar wajib diisi untuk Maxim.')
    if (method !== 'maxim' && schedule && schedule < nowHHMM) return setErr('Jam ambil tidak boleh sebelum waktu sekarang.')
    if (turnstileEnabled() && !cfToken) return setErr('Selesaikan verifikasi keamanan dulu (kotak di bawah).')
    setErr('')
    setConfirm(true)
  }

  const confirmPay = async () => {
    if (submitting) return
    // Re-cek tepat sebelum buat order (status bisa berubah realtime sejak buka checkout).
    // ensureBranchOpen re-cek SEGAR ke server bila cache bilang tutup (anti blok palsu).
    if (!(await ensureBranchOpen())) { setConfirm(false); return setErr('Cabang sedang tutup untuk pesanan online.') }
    if (unavailNames) { setConfirm(false); return setErr('Maaf, ada menu HABIS: ' + unavailNames + '. Hapus dari keranjang dulu.') }
    // Re-cek stok SEGAR (anti-oversell): pakai status terbaru dari store, bukan snapshot
    // saat render — stok bisa turun (walk-in / customer lain) sejak buka checkout.
    if (supa) {
      const freshStock = (getBranchStatus()[cart.branchId]?.availability || {}).stock || {}
      const byParent = {}
      cart.lines.forEach((l) => { const m = menuById(l.menuId); if (m) byParent[m.parent] = (byParent[m.parent] || 0) + l.qty })
      for (const p of Object.keys(byParent)) {
        const r = freshStock[p]
        if (typeof r === 'number' && byParent[p] > r) { setConfirm(false); return setErr(`Maaf, stok berkurang — tinggal ${r}. Kurangi dulu di keranjang ya.`) }
      }
    }
    const cleanWa = wa.replace(/\D/g, '')
    if (remember) saveContact({ name: name.trim(), wa: cleanWa, address: address.trim() })
    else saveContact({})
    setSubmitting(true)
    try {
      // Mode supabase: createOrder INSERT ke DB (await) → baru ke QRIS. Kalau gagal,
      // jangan lanjut ke pembayaran (cegah bayar tanpa order tercatat).
      const order = await createOrder({
        branchId: cart.branchId,
        // Bekukan HARGA ONLINE per-baris (seperti walk-in) → struk online benar,
        // tahan walau Owner ubah harga setelahnya.
        lines: cart.lines.map((l) => ({ ...l, price: onlinePriceOf(cart.branchId, l.menuId) })),
        subtotal, discount, total, serviceFee,
        method, schedule: method === 'maxim' ? '' : schedule, name: name.trim(), wa: cleanWa,
        address: method === 'maxim' ? address.trim() : '',
        promoCode: cart.promoCode || '',
      })
      // JANGAN clearCart() di sini — mengosongkan keranjang memicu guard "cart kosong
      // → /app/cabang" yang menyalip navigasi. Keranjang dibersihkan di layar QRIS.
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
          {(() => {
            // Opsi Maxim hanya muncul bila cabang mengaktifkannya (Owner › Kelola Cabang).
            const opts = [['ambil', 'Ambil Sendiri', 'storefront', 'Nggak perlu antri/nunggu, datang langsung ambil']]
            if (branch.maximEnabled !== false) opts.push(['maxim', 'Maxim / Ojek', 'two_wheeler', 'ongkir terpisah'])
            return (
              <div className={`grid ${opts.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                {opts.map(([val, lbl, ic, hint]) => (
                  <button key={val} onClick={() => { setMethod(val); if (val === 'maxim' && !localStorage.getItem(MAXIM_DISMISS_KEY)) { setMaximNoApp(false); setMaximDontShow(false); setMaximAsk(true) } }} className={`p-4 rounded-xl border-2 flex flex-col items-start gap-1 transition-all ${method === val ? 'border-primary bg-primary-fixed' : 'border-outline-variant'}`}>
                    <Icon name={ic} className={method === val ? 'text-primary' : ''} />
                    <span className="font-label-lg">{lbl}</span>
                    <span className="text-[11px] text-on-surface-variant leading-snug text-left">{hint}</span>
                  </button>
                ))}
              </div>
            )
          })()}
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

          {turnstileEnabled() && (
            <div className="pt-1">
              <p className="text-[12px] text-on-surface-variant mb-1 flex items-center gap-1"><Icon name="verified_user" className="!text-[15px]" /> Verifikasi keamanan (anti-spam):</p>
              <TurnstileWidget onToken={onCf} />
            </div>
          )}
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
            {serviceFee > 0 && <div className="flex justify-between text-on-surface-variant"><span>Biaya Layanan</span><span>{fmtRp(serviceFee)}</span></div>}
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

      {/* Popup edukasi Maxim — muncul saat memilih Maxim/Ojek (sampai "jangan tampilkan lagi") */}
      {maximAsk && (
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeMaximAsk}>
          <style>{`@keyframes pop-in { from { transform: translateY(24px) scale(.96); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }`}</style>
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md bg-surface rounded-3xl p-6 shadow-2xl" style={{ animation: 'pop-in 0.25s ease-out' }}>
            <button onClick={closeMaximAsk} aria-label="Tutup" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center active:scale-90 hover:bg-surface-container-highest z-10"><Icon name="close" className="!text-[20px]" /></button>
            <div className="flex flex-col items-center text-center">
              {/* Logo aplikasi Maxim (gaya ikon app) */}
              <img src="/maxim-logo.jpg" alt="Maxim — Transportasi Online" width="96" height="96" className="w-24 h-24 rounded-3xl shadow-md object-cover" />
              {!maximNoApp ? (
                <>
                  <h2 className="font-headline-md text-headline-md mt-2">Sudah ada aplikasi Maxim?</h2>
                  <p className="text-sm text-on-surface-variant mt-1.5 leading-snug">Kamu atau temanmu butuh aplikasi <b className="text-primary">Maxim</b> untuk pesan ojek menjemput pesanan ke cabang.</p>
                </>
              ) : (
                <>
                  <h2 className="font-headline-md text-headline-md mt-2">Instal Maxim dulu yuk</h2>
                  <p className="text-sm text-on-surface-variant mt-1.5 leading-snug">Gratis — pasang aplikasinya, lalu pesan ojek untuk menjemput pesananmu.</p>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              {!maximNoApp ? (
                <>
                  <button onClick={closeMaximAsk} className="w-full h-[52px] bg-primary text-white rounded-xl font-headline-md shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"><Icon name="check_circle" fill className="!text-[20px]" /> Ya, sudah ada</button>
                  <button onClick={() => setMaximNoApp(true)} className="w-full h-[52px] border-2 border-outline-variant text-on-surface rounded-xl font-label-lg active:bg-surface-container">Belum punya</button>
                </>
              ) : (
                <>
                  {/* Auto-detect: tampilkan store sesuai HP. Yang cocok = tombol utama;
                      platform lain = tautan kecil. Tak dikenali → keduanya setara. */}
                  {isIOS ? (
                    <>
                      <a href={MAXIM_APPSTORE} target="_blank" rel="noopener noreferrer" className="w-full h-[52px] bg-primary text-white rounded-xl font-label-lg shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"><Icon name="phone_iphone" className="!text-[20px]" /> Buka di App Store</a>
                      <a href={MAXIM_PLAY} target="_blank" rel="noopener noreferrer" className="text-[12px] text-on-surface-variant underline underline-offset-2 text-center py-1">Pakai Android? Buka Play Store</a>
                    </>
                  ) : isAndroid ? (
                    <>
                      <a href={MAXIM_PLAY} target="_blank" rel="noopener noreferrer" className="w-full h-[52px] bg-primary text-white rounded-xl font-label-lg shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"><Icon name="android" className="!text-[20px]" /> Buka di Play Store</a>
                      <a href={MAXIM_APPSTORE} target="_blank" rel="noopener noreferrer" className="text-[12px] text-on-surface-variant underline underline-offset-2 text-center py-1">Pakai iPhone? Buka App Store</a>
                    </>
                  ) : (
                    <>
                      <a href={MAXIM_PLAY} target="_blank" rel="noopener noreferrer" className="w-full h-[52px] bg-primary text-white rounded-xl font-label-lg shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"><Icon name="android" className="!text-[20px]" /> Play Store (Android)</a>
                      <a href={MAXIM_APPSTORE} target="_blank" rel="noopener noreferrer" className="w-full h-[52px] bg-on-surface text-surface rounded-xl font-label-lg shadow active:scale-[0.98] flex items-center justify-center gap-2"><Icon name="phone_iphone" className="!text-[20px]" /> App Store (iPhone)</a>
                    </>
                  )}
                  <button onClick={closeMaximAsk} className="w-full h-[48px] text-on-surface-variant rounded-xl font-label-lg active:bg-surface-container">Sudah, lanjut</button>
                </>
              )}
            </div>

            <label className="mt-4 flex items-center justify-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={maximDontShow} onChange={(e) => setMaximDontShow(e.target.checked)} className="w-4 h-4 accent-primary" />
              <span className="text-[13px] text-on-surface-variant">Jangan tampilkan lagi</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
