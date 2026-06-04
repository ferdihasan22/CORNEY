import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { fmtRp } from '../data/menu.js'
import { getOrder, markPaid, cancelOrder, refreshMyOrder } from '../store/orders.js'
import { isSupabase } from '../lib/backend.js'
import { supabase } from '../lib/supabase.js'

// 2.1 — CUS-03 Pembayaran QRIS. Now wired to REAL Midtrans (sandbox) via the Vite
// dev middleware (/api/midtrans/*). On mount we charge QRIS server-side and show
// the real QR image + copyable qr_string (paste into the Midtrans QRIS simulator
// to simulate paying) and poll the transaction status → success on settlement.
// If the API is unreachable (build/preview, no key), it falls back to a dummy QR
// with a manual "cek status" that marks the order paid locally.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

// The Midtrans QRIS simulator expects the QR-code IMAGE URL (generate-qr-code
// action), NOT the raw qr_string — pasting qr_string gives "QR inputted unparsable".
const SIMULATOR_URL = 'https://simulator.sandbox.midtrans.com/v2/qris/index'
const PAID_STATUSES = ['settlement', 'capture']

export default function CustomerQris() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const order = getOrder(orderId)
  const [secs, setSecs] = useState(5 * 60)
  const [mode, setMode] = useState('loading') // 'loading' | 'live' | 'dummy'
  const [qrString, setQrString] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [midId, setMidId] = useState('') // midtrans order_id (unique per charge)
  const [checking, setChecking] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const charged = useRef(false)

  // Countdown
  useEffect(() => {
    if (secs <= 0) return
    const t = setInterval(() => setSecs((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [secs])

  // Charge QRIS once on mount (ref guard survives StrictMode double-invoke).
  useEffect(() => {
    if (!order || charged.current) return
    charged.current = true
    const mid = `${order.id}-${Date.now().toString(36)}`
    setMidId(mid)

    // Mode supabase: panggil Edge Function (Server Key di server, aman).
    // Mode local: panggil Vite dev middleware /api/midtrans/charge (Server Key via Vite).
    const chargePromise = isSupabase() && supabase
      ? supabase.functions.invoke('midtrans-charge', { body: { orderId: mid, gross: order.total } })
          .then(({ data, error }) => { if (error) throw error; return data })
      : fetch('/api/midtrans/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: mid, gross: order.total }),
        }).then((r) => r.json())

    chargePromise
      .then((d) => {
        const qrAction = (d.actions || []).find((a) => a.name === 'generate-qr-code')
        if (d.qr_string || qrAction) {
          setQrString(d.qr_string || '')
          setQrUrl(qrAction?.url || '')
          setMode('live')
        } else {
          setStatusMsg(d.error || d.status_message || 'QRIS tidak bisa dibuat — pakai mode dummy.')
          setMode('dummy')
        }
      })
      .catch(() => setMode('dummy'))
  }, [order])

  // Auto-poll the real transaction status while live & waiting.
  useEffect(() => {
    if (mode !== 'live' || !midId) return
    let t = null
    const check = () => pollStatus(true)
    const start = () => { if (!t) { check(); t = setInterval(check, 8000) } } // 8 dtk
    const stop = () => { clearInterval(t); t = null }
    const onVis = () => (document.hidden ? stop() : start()) // jeda saat tab tak aktif; balik → langsung cek
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, midId])

  if (!order) return <Navigate to="/app/cabang" replace />
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  const finishPaid = () => { markPaid(order.id); navigate(`/app/sukses/${order.id}`) }

  const pollStatus = (silent) => {
    if (!midId) return
    if (!silent) { setChecking(true); setStatusMsg('') }

    // Mode supabase: cek field `paid` dari DB via get_my_order (webhook yang meng-update-nya).
    // Tak perlu hit Midtrans API dari klien; lebih aman & webhook sudah otoritatif.
    // Mode local: poll /api/midtrans/status seperti biasa.
    if (isSupabase() && order?.pin) {
      refreshMyOrder(order.id, order.pin)
        .then((o) => {
          if (o?.paid) finishPaid()
          else if (!silent) setStatusMsg('Belum lunas. Bayar dulu via QRIS ya.')
        })
        .catch(() => { if (!silent) setStatusMsg('Gagal cek status. Coba lagi.') })
        .finally(() => { if (!silent) setChecking(false) })
      return
    }

    fetch(`/api/midtrans/status?order_id=${encodeURIComponent(midId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (PAID_STATUSES.includes(d.transaction_status)) finishPaid()
        else if (!silent) setStatusMsg(`Status: ${d.transaction_status || 'pending'} — belum lunas. Bayar dulu di simulator ya.`)
      })
      .catch(() => { if (!silent) setStatusMsg('Gagal cek status. Coba lagi.') })
      .finally(() => { if (!silent) setChecking(false) })
  }

  const copyQr = async () => {
    try { await navigator.clipboard.writeText(qrUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
  }

  const cekStatus = () => { mode === 'live' ? pollStatus(false) : finishPaid() }
  const batal = () => { cancelOrder(order.id); navigate(`/app/katalog/${order.branchId}`) }

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-8">
      <header className="sticky top-0 bg-surface flex items-center px-4 h-[64px] z-50">
        <button onClick={() => navigate(`/app/katalog/${order.branchId}`)} className="mr-2 p-2 text-primary rounded-full active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md text-primary">Pembayaran QRIS</h1>
      </header>

      <main className="px-6 max-w-md mx-auto">
        <section className="flex flex-col items-center py-6 text-center">
          <p className="font-label-md text-on-surface-variant mb-1">Total Pembayaran</p>
          <h2 className="font-display-lg text-display-lg text-primary tracking-tight">{fmtRp(order.total)}</h2>
          {order.method === 'maxim' && <div className="mt-2 px-4 py-1.5 bg-surface-container-low rounded-full"><p className="text-on-surface-variant font-label-md text-[12px]">Harga produk · ongkir Maxim dibayar terpisah</p></div>}
        </section>

        {/* QR card */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_4px_16px_rgba(26,26,26,0.08)] flex flex-col items-center mb-4">
          <div className="w-full aspect-square bg-white p-4 rounded-xl border border-surface-variant mb-4 flex items-center justify-center relative overflow-hidden">
            {mode === 'live' && qrUrl ? (
              <img src={qrUrl} alt="QRIS" className="w-full h-full object-contain" />
            ) : (
              <>
                <Icon name="qr_code_2" className="!text-[180px] text-on-surface" />
                <span className="absolute bottom-2 text-[10px] text-on-surface-variant bg-white/80 px-2 rounded">{mode === 'loading' ? 'Membuat QR…' : 'QR contoh (dummy)'}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="font-bold text-sm">QRIS</span><span className="opacity-40">·</span>
            <span className="text-sm">{mode === 'live' ? 'Sandbox Midtrans' : 'diproses oleh Midtrans'}</span>
          </div>
        </div>

        {/* Live testing helpers — copy qr_string + open simulator */}
        {mode === 'live' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 space-y-3">
            <div className="flex items-start gap-2">
              <Icon name="science" className="text-amber-600 !text-[18px] shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-900 leading-snug"><strong>Mode testing (sandbox):</strong> salin <strong>URL QR</strong> di bawah, buka Simulator, tempel di kolomnya, lalu Submit. Status update otomatis. (Jangan tempel qr_string — itu yang bikin "unparsable".)</p>
            </div>
            {qrUrl && (
              <div className="bg-white rounded-lg border border-amber-200 p-2">
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">URL QR (untuk simulator)</p>
                <p className="text-[11px] font-mono break-all leading-snug text-on-surface max-h-20 overflow-y-auto">{qrUrl}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={copyQr} className="flex-1 h-11 rounded-lg bg-amber-500 text-white font-label-lg flex items-center justify-center gap-2 active:scale-95">
                <Icon name={copied ? 'check' : 'content_copy'} className="!text-[18px]" /> {copied ? 'Tersalin!' : 'Salin URL QR'}
              </button>
              <a href={SIMULATOR_URL} target="_blank" rel="noreferrer" className="flex-1 h-11 rounded-lg border border-amber-500 text-amber-700 font-label-lg flex items-center justify-center gap-2 active:scale-95">
                <Icon name="open_in_new" className="!text-[18px]" /> Simulator
              </a>
            </div>
          </div>
        )}

        {/* Status row */}
        <div className="bg-surface-container-low border border-surface-variant rounded-full px-5 py-3 flex items-center justify-between shadow-sm mb-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-on-surface-variant font-label-md">Menunggu pembayaran…</span>
          </div>
          <div className="flex items-center gap-1.5"><Icon name="timer" className="text-primary !text-[18px]" /><span className="text-primary font-bold tabular-nums">{mm}:{ss}</span></div>
        </div>

        {statusMsg && <p className="text-[13px] text-center text-on-surface-variant mb-4 px-2">{statusMsg}</p>}

        <div className="flex flex-col gap-3">
          <button onClick={cekStatus} disabled={checking} className="w-full h-[52px] bg-primary text-on-primary font-headline-md rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-60">
            {checking ? 'Mengecek…' : 'Sudah bayar? Cek status'}
          </button>
          <button onClick={batal} className="w-full h-[52px] bg-surface-container text-on-surface-variant font-label-lg rounded-xl active:scale-[0.98] transition-all">Batalkan Pesanan</button>
          {import.meta.env.DEV && (
            <button onClick={finishPaid} className="w-full py-3 rounded-xl border border-dashed border-primary text-primary text-sm flex items-center justify-center gap-2 active:scale-95">
              <Icon name="bolt" className="!text-[18px]" /> Simulasi Bayar (testing) — tandai LUNAS
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-5 text-center px-4">
          <Icon name="verified_user" className="text-tertiary-container !text-[18px]" />
          <p className="text-[12px] text-tertiary leading-tight">Pembayaran diproses aman oleh <strong>Midtrans</strong>. CORNEY tidak menyimpan data e-wallet kamu.</p>
        </div>
      </main>
    </div>
  )
}
