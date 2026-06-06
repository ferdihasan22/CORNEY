import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { fmtRp } from '../data/menu.js'
import { getOrder, markPaid, cancelOrder, refreshMyOrder, extendPayDeadline } from '../store/orders.js'
import { clearCart } from '../store/cart.js'
import { isSupabase } from '../lib/backend.js'
import { onlineNo } from '../lib/util.js'
import TurnstileWidget from '../components/TurnstileWidget.jsx'
import { turnstileEnabled, takeTurnstileToken, setTurnstileToken } from '../lib/turnstile.js'
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

const PAID_STATUSES = ['settlement', 'capture']

export default function CustomerQris() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const order = getOrder(orderId)
  const QR_TTL = 15 * 60 // detik — selaras dgn custom_expiry Midtrans (15 menit)
  const [secs, setSecs] = useState(QR_TTL)
  const [expired, setExpired] = useState(false)
  const [mode, setMode] = useState('loading') // 'loading' | 'live' | 'dummy'
  const [qrString, setQrString] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [midId, setMidId] = useState('') // midtrans order_id (unique per charge)
  const [checking, setChecking] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('') // notif kecil hasil unduh QR
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3800) }
  const [regenReady, setRegenReady] = useState(false) // token Turnstile siap utk "Buat QR Baru"
  const charged = useRef(false)

  // Countdown — saat habis: tandai kedaluwarsa (QR Midtrans ikut expire 15 menit).
  useEffect(() => {
    if (secs <= 0) { setExpired(true); return }
    const t = setInterval(() => setSecs((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [secs])

  // Order sudah dibuat → bersihkan keranjang di sini (dipindah dari checkout untuk
  // cegah race guard "cart kosong → pilih cabang" yang menyalip navigasi ke QRIS).
  useEffect(() => { if (order) clearCart() }, [order?.id])

  // Buat (atau buat-ulang) transaksi QRIS. order_id Midtrans unik tiap charge → QR baru.
  const runCharge = () => {
    if (!order) return
    extendPayDeadline(order.id) // tiap buat/buat-ulang QR → perpanjang tenggat 15 mnt (cegah ke-sweep saat aktif)
    const mid = `${order.id}-${Date.now().toString(36)}`
    setMidId(mid)
    setMode('loading'); setStatusMsg('')
    const cf = takeTurnstileToken() // token Turnstile (null bila fitur mati)

    // Mode supabase: panggil Edge Function (Server Key di server, aman).
    // Mode local: panggil Vite dev middleware /api/midtrans/charge (Server Key via Vite).
    const chargePromise = isSupabase() && supabase
      ? supabase.functions.invoke('midtrans-charge', { body: { orderId: mid, gross: order.total, cf } })
          .then(({ data, error }) => { if (error) throw error; return data })
      : fetch('/api/midtrans/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: mid, gross: order.total, cf }),
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
  }

  // Charge QRIS once on mount (ref guard survives StrictMode double-invoke).
  useEffect(() => {
    if (!order || charged.current) return
    charged.current = true
    runCharge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  // Batalkan transaksi QRIS lama di Midtrans (best-effort) → QR lama (mis. screenshot)
  // tak bisa dibayar lagi setelah buat yang baru (cegah dobel bayar, G3).
  const cancelOldCharge = (mid) => {
    if (!mid || !isSupabase() || !supabase) return
    supabase.functions.invoke('midtrans-cancel', { body: { orderId: mid } }).catch(() => {})
  }

  // "Buat QR Baru" setelah waktu habis → batalkan QR lama, charge ulang + reset mundur.
  const buatQrBaru = () => {
    if (turnstileEnabled() && !regenReady) { setStatusMsg('Selesaikan verifikasi keamanan dulu.'); return }
    cancelOldCharge(midId)
    setQrUrl(''); setQrString('')
    setExpired(false); setSecs(QR_TTL); setRegenReady(false)
    runCharge()
  }

  // Auto-poll the real transaction status while live & waiting.
  useEffect(() => {
    if (mode !== 'live' || !midId) return
    if (expired) { pollStatus(true); return } // habis → cek sekali lagi lalu berhenti
    let t = null
    const check = () => pollStatus(true)
    const start = () => { if (!t) { check(); t = setInterval(check, 3000) } } // 3 dtk (responsif)
    const stop = () => { clearInterval(t); t = null }
    const onVis = () => (document.hidden ? stop() : start()) // jeda saat tab tak aktif; balik → langsung cek
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, midId, expired])

  if (!order) return <Navigate to="/app/cabang" replace />
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  const finishPaid = () => { markPaid(order.id); navigate(`/app/sukses/${order.id}`) }

  const pollStatus = (silent) => {
    if (!midId) return
    if (!silent) { setChecking(true); setStatusMsg('') }

    // Mode supabase: cek DUA sumber PARALEL supaya cepat (tak nunggu webhook + 8 dtk):
    //  (a) midtrans-status langsung ke Midtrans (sama seperti kasir) → settlement seketika.
    //  (b) paid DB via get_my_order (di-set webhook) → jaring pengaman bila (a) gagal.
    // Sukses bila salah satu konfirmasi LUNAS. paid DB tetap otoritatif (di-set webhook)
    // untuk catatan & kasir; customer hanya melihat layar sukses lebih cepat.
    if (isSupabase() && supabase) {
      Promise.all([
        supabase.functions.invoke('midtrans-status', { body: { orderId: midId } })
          .then(({ data, error }) => (error ? null : data)).catch(() => null),
        order?.pin ? refreshMyOrder(order.id, order.pin).catch(() => null) : Promise.resolve(null),
      ])
        .then(([mid, o]) => {
          if ((mid && PAID_STATUSES.includes(mid.transaction_status)) || o?.paid) finishPaid()
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
        else if (!silent) setStatusMsg(`Status: ${d.transaction_status || 'pending'} — belum lunas. Selesaikan pembayaran dulu ya.`)
      })
      .catch(() => { if (!silent) setStatusMsg('Gagal cek status. Coba lagi.') })
      .finally(() => { if (!silent) setChecking(false) })
  }

  // Unduh/simpan gambar QR ke galeri → customer bayar lewat m-banking / e-wallet
  // lain (scan dari galeri). Strategi berlapis biar JALAN di webview & iOS:
  //   1) Web Share file → share sheet "Simpan Gambar" (paling andal di HP/webview)
  //   2) Unduh blob (browser desktop & sebagian webview Android)
  //   3) CORS/gagal → buka gambar di tab baru, user tahan & "Simpan" manual
  const downloadQr = async () => {
    if (!qrUrl) return
    setSaving(true)
    const fileName = `QRIS-CORNEY-${onlineNo(order.no)}.png`
    try {
      const res = await fetch(qrUrl)
      const blob = await res.blob()
      const file = new File([blob], fileName, { type: blob.type || 'image/png' })

      // 1) Web Share (HP modern & banyak in-app browser) → "Simpan ke Galeri/Foto".
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'QRIS CORNEY' })
          showToast('Pilih "Simpan Gambar / Save Image" untuk menyimpan ke galeri ✅')
          return
        } catch (e) {
          if (e?.name === 'AbortError') { return } // user batal → jangan unduh ganda
        }
      }

      // 2) Unduh blob.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      showToast('QRIS tersimpan ke galeri/unduhan ✅')
    } catch {
      window.open(qrUrl, '_blank', 'noopener') // CORS → buka tab, simpan manual
      showToast('QR dibuka di tab baru — tahan gambar lalu "Simpan ke Foto" 📷')
    } finally { setSaving(false) }
  }

  // KEAMANAN: di mode supabase, JANGAN pernah tandai lunas dari sisi klien (status
  // LUNAS hanya dari webhook Midtrans). 'dummy' (Edge gagal) hanya boleh auto-LUNAS
  // di mode lokal/testing. Mode supabase + dummy → minta buat QR baru, bukan finishPaid.
  const cekStatus = () => {
    if (mode === 'live') return pollStatus(false)
    if (isSupabase()) return setStatusMsg('Pembayaran belum bisa diproses. Coba "Buat QR Baru" atau ulangi sebentar lagi.')
    finishPaid() // hanya mode lokal/dummy non-supabase
  }
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
              <img src={qrUrl} alt="QRIS" className={`w-full h-full object-contain transition ${expired ? 'blur-[3px] opacity-40' : ''}`} />
            ) : (
              <>
                <Icon name="qr_code_2" className={`!text-[180px] text-on-surface ${expired ? 'opacity-30' : ''}`} />
                <span className="absolute bottom-2 text-[10px] text-on-surface-variant bg-white/80 px-2 rounded">{mode === 'loading' ? 'Membuat QR…' : 'QR contoh (dummy)'}</span>
              </>
            )}
            {expired && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/40">
                <Icon name="timer_off" className="!text-[44px] text-error" />
                <span className="bg-error text-on-error font-bold text-sm px-3 py-1 rounded-full shadow">Waktu habis</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="font-bold text-sm">QRIS</span><span className="opacity-40">·</span>
            <span className="text-sm">diproses oleh Midtrans</span>
          </div>
        </div>

        {/* Bayar pakai aplikasi lain — unduh / screenshot QR lalu scan dari galeri */}
        {qrUrl && !expired && (
          <div className="bg-surface-container-lowest rounded-2xl p-4 mb-4 shadow-[0_2px_8px_rgba(26,26,26,0.06)] space-y-3">
            <div className="flex items-start gap-2">
              <Icon name="account_balance_wallet" className="text-primary !text-[20px] shrink-0 mt-0.5" />
              <p className="text-[13px] text-on-surface leading-snug">
                <strong>Mau bayar lewat aplikasi lain?</strong> <strong>Screenshot</strong> layar ini atau <strong>unduh</strong> QR di bawah, lalu buka <strong>m-banking / e-wallet</strong> (DANA, OVO, GoPay, ShopeePay, BCA, dll) → menu <strong>Scan / QRIS</strong> → pilih <strong>“dari galeri”</strong>.
              </p>
            </div>
            <button onClick={downloadQr} disabled={saving} className="w-full h-12 rounded-xl bg-primary text-on-primary font-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60">
              <Icon name="download" className="!text-[20px]" /> {saving ? 'Menyimpan…' : 'Unduh QRIS'}
            </button>
            <div className="flex items-start gap-1.5 text-on-surface-variant">
              <Icon name="photo_camera" className="!text-[16px] shrink-0 mt-0.5" />
              <p className="text-[11px] leading-snug">Tips: kamu juga bisa <strong>screenshot</strong> halaman ini — hasilnya sama, tinggal scan dari galeri. Setelah bayar, status di sini akan otomatis jadi <strong>LUNAS</strong>.</p>
            </div>
          </div>
        )}

        {/* Status row — menunggu vs waktu habis */}
        {expired ? (
          <div className="bg-error-container/40 border border-error/40 rounded-2xl px-5 py-4 flex items-start gap-3 shadow-sm mb-4">
            <Icon name="timer_off" className="text-error !text-[22px] shrink-0 mt-0.5" />
            <div>
              <p className="font-label-lg text-error">Waktu pembayaran habis</p>
              <p className="text-[13px] text-on-surface-variant leading-snug">QR ini sudah tidak berlaku. Pesananmu <strong>masih tersimpan</strong> — buat QR baru untuk membayar, atau batalkan.</p>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-low border border-surface-variant rounded-full px-5 py-3 flex items-center justify-between shadow-sm mb-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-on-surface-variant font-label-md">Menunggu pembayaran…</span>
            </div>
            <div className="flex items-center gap-1.5"><Icon name="timer" className="text-primary !text-[18px]" /><span className="text-primary font-bold tabular-nums">{mm}:{ss}</span></div>
          </div>
        )}

        {statusMsg && <p className="text-[13px] text-center text-on-surface-variant mb-4 px-2">{statusMsg}</p>}

        <div className="flex flex-col gap-3">
          {expired ? (
            <>
              {turnstileEnabled() && <TurnstileWidget onToken={(t) => { setTurnstileToken(t); setRegenReady(!!t) }} />}
              <button onClick={buatQrBaru} disabled={turnstileEnabled() && !regenReady} className="w-full h-[52px] bg-primary text-on-primary font-headline-md rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                <Icon name="refresh" className="!text-[20px]" /> Buat QR Baru
              </button>
            </>
          ) : (
            <button onClick={cekStatus} disabled={checking} className="w-full h-[52px] bg-primary text-on-primary font-headline-md rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-60">
              {checking ? 'Mengecek…' : 'Sudah bayar? Cek status'}
            </button>
          )}
          <button onClick={batal} className="w-full h-[52px] bg-surface-container text-on-surface-variant font-label-lg rounded-xl active:scale-[0.98] transition-all">Batalkan Pesanan</button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-5 text-center px-4">
          <Icon name="verified_user" className="text-tertiary-container !text-[18px]" />
          <p className="text-[12px] text-tertiary leading-tight">Pembayaran diproses aman oleh <strong>Midtrans</strong>. CORNEY tidak menyimpan data e-wallet kamu.</p>
        </div>
      </main>

      {/* Toast kecil: hasil unduh/simpan QR */}
      {toast && (
        <div className="fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4 pointer-events-none">
          <div className="max-w-sm w-fit bg-on-surface text-surface text-[13px] font-medium px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-[fadeIn_.2s_ease-out]">
            <Icon name="check_circle" className="!text-[18px] text-green-400 shrink-0" />
            <span className="leading-snug">{toast}</span>
          </div>
        </div>
      )}
    </div>
  )
}
