import { useState, useEffect, useRef } from 'react'
import { fmtRp } from '../../data/menu.js'
import { isSupabase } from '../../lib/backend.js'
import { supabase } from '../../lib/supabase.js'
import { playSfx } from '../../lib/sfx.js'
import { useDay } from '../../store/useDay.js'
import { useMaster } from '../../store/useMaster.js'

// Step 1A.6 — WLK-03 "Bayar Sekarang" + §6.7 lima channel pembayaran.
// QRIS Midtrans = DINAMIS ASLI (charge server-side via Edge midtrans-charge →
// QR asli → auto-cek status via Edge midtrans-status → lunas → selesai otomatis).
// Sandbox: tombol salin URL QR + buka Simulator. Tunai/GoPay/GoFood/Grab = seperti
// semula (GoPay manual, GoFood/Grab dicatat saja).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const CHANNELS = [
  { id: 'tunai', label: 'Tunai', icon: 'payments' },
  { id: 'qris_midtrans', label: 'QRIS Midtrans', icon: 'qr_code_2', badge: 'Utama', badgeCls: 'bg-green-600', note: 'Auto-verified' },
  { id: 'qris_gopay', label: 'QRIS GoPay', icon: 'qr_code_scanner', badge: 'Cadangan', badgeCls: 'bg-amber-500', note: 'Manual' },
  { id: 'gofood', label: 'GoFood', icon: 'delivery_dining', note: 'Dicatat saja' },
  { id: 'grabfood', label: 'GrabFood', icon: 'moped', note: 'Dicatat saja' },
]

const PAID_STATUSES = ['settlement', 'capture']

export default function PaymentModal({ total, onClose, onComplete }) {
  const day = useDay()
  const master = useMaster()
  // Gambar QRIS GoPay statis cabang ini (di-upload Owner di Kelola Cabang).
  const qrisGopayImg = (master?.branches || []).find((b) => b.id === day?.branchId)?.qrisImg || ''
  const [method, setMethod] = useState('tunai')
  const [cash, setCash] = useState(0)
  // QRIS Midtrans dinamis
  const [qmode, setQmode] = useState('idle') // idle | loading | live | dummy
  const [qrUrl, setQrUrl] = useState('')
  const [midId, setMidId] = useState('')
  const [checking, setChecking] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [paid, setPaid] = useState(false)
  const charged = useRef(false)
  const done = useRef(false)

  const change = cash - total
  const cashOk = method !== 'tunai' || cash >= total

  // Charge SEKALI saat kasir pilih QRIS Midtrans.
  useEffect(() => {
    if (method !== 'qris_midtrans' || charged.current) return
    charged.current = true
    const mid = `KASIR-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`
    setMidId(mid)
    setQmode('loading')
    const p = isSupabase() && supabase
      ? supabase.functions.invoke('midtrans-charge', { body: { orderId: mid, gross: total } }).then(({ data, error }) => { if (error) throw error; return data })
      : fetch('/api/midtrans/charge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: mid, gross: total }) }).then((r) => r.json())
    p.then((d) => {
      const qrAction = (d.actions || []).find((a) => a.name === 'generate-qr-code')
      if (qrAction) { setQrUrl(qrAction.url); setQmode('live') }
      else { setStatusMsg(d.error || d.status_message || 'QR gagal dibuat — pakai manual.'); setQmode('dummy') }
    }).catch(() => setQmode('dummy'))
  }, [method, total])

  // Auto-poll status saat QR live (jeda saat tab tak aktif).
  useEffect(() => {
    if (qmode !== 'live' || !midId || paid) return
    let t = null
    const start = () => { if (!t) t = setInterval(() => pollStatus(true), 8000) }
    const stop = () => { clearInterval(t); t = null }
    const onVis = () => (document.hidden ? stop() : start())
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qmode, midId, paid])

  function finishPaid() {
    if (done.current) return
    done.current = true
    setPaid(true)
    playSfx('qris', 1) // QRIS Midtrans walk-in LUNAS → suara "qris masuk"
    onComplete({ method: 'qris_midtrans', cashReceived: null })
  }

  function pollStatus(silent) {
    if (!midId) return
    if (!silent) { setChecking(true); setStatusMsg('') }
    const p = isSupabase() && supabase
      ? supabase.functions.invoke('midtrans-status', { body: { orderId: midId } }).then(({ data, error }) => { if (error) throw error; return data })
      : fetch(`/api/midtrans/status?order_id=${encodeURIComponent(midId)}`).then((r) => r.json())
    p.then((d) => {
      if (PAID_STATUSES.includes(d.transaction_status)) finishPaid()
      else if (!silent) setStatusMsg(`Status: ${d.transaction_status || 'pending'} — belum lunas. Pelanggan selesaikan pembayaran dulu ya.`)
    }).catch(() => { if (!silent) setStatusMsg('Gagal cek status. Coba lagi.') })
      .finally(() => { if (!silent) setChecking(false) })
  }


  function complete() {
    if (!cashOk) return
    onComplete({ method, cashReceived: method === 'tunai' ? cash : null })
  }

  const completeLabel =
    method === 'qris_gopay' ? 'Tandai Sudah Bayar' : method === 'gofood' || method === 'grabfood' ? 'Catat Transaksi' : 'Selesaikan Pembayaran'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-blur-overlay p-4" onClick={onClose}>
      <div
        className="w-full max-w-[560px] bg-white rounded-xl shadow-[0_16px_32px_rgba(26,26,26,0.12)] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-margin-page pb-4 border-b border-surface-container-highest">
          <h2 className="font-body-md text-on-surface-variant mb-1">Pembayaran</h2>
          <div className="flex justify-between items-end">
            <h3 className="font-display-md text-display-md text-primary-container">Total {fmtRp(total)}</h3>
            <span className="font-label-md text-on-surface-variant opacity-60">Pilih metode pembayaran</span>
          </div>
        </div>

        <div className="p-margin-page space-y-8">
          {/* Channels */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CHANNELS.map((c) => {
              const on = method === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setMethod(c.id)}
                  className={`relative p-4 rounded-xl flex flex-col items-center justify-center gap-1 min-h-[96px] transition-all ${
                    on ? 'border-2 border-primary-container bg-on-primary-container' : 'bg-surface-container-low border border-outline-variant hover:bg-surface-container-high'
                  }`}
                >
                  {c.badge && (
                    <span className={`absolute top-1 right-1 px-1.5 py-0.5 ${c.badgeCls} text-[10px] text-white rounded font-bold uppercase tracking-wider`}>{c.badge}</span>
                  )}
                  <Icon name={c.icon} className={on ? 'text-primary' : 'text-on-surface-variant'} />
                  <span className={`font-label-md ${on ? 'text-primary' : ''}`}>{c.label}</span>
                  {c.note && <span className="text-[10px] text-on-surface-variant/60 font-medium">{c.note}</span>}
                </button>
              )
            })}
          </div>

          {/* Tunai */}
          {method === 'tunai' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="font-label-lg text-on-surface">Uang Diterima (Rp)</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cash === 0 ? '' : cash.toLocaleString('id-ID')}
                    onChange={(e) => setCash(Number(e.target.value.replace(/\D/g, '')) || 0)}
                    placeholder="Masukkan jumlah uang..."
                    className="w-full h-min-tap-target bg-surface-container-lowest border border-outline rounded-xl px-6 text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary transition-all text-on-surface outline-none"
                  />
                  <button onClick={() => setCash(0)} className="absolute right-4 top-1/2 -translate-y-1/2 text-outline">
                    <Icon name="backspace" />
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCash(50000)} className="flex-1 h-12 rounded-full border border-outline-variant font-label-lg hover:bg-secondary-container hover:border-secondary-container transition-all active:scale-95">50rb</button>
                <button onClick={() => setCash(100000)} className="flex-1 h-12 rounded-full border border-outline-variant font-label-lg hover:bg-secondary-container hover:border-secondary-container transition-all active:scale-95">100rb</button>
                <button onClick={() => setCash(total)} className="flex-1 h-12 rounded-full border border-secondary font-label-lg text-secondary bg-secondary-container/20 hover:bg-secondary-container transition-all active:scale-95">Uang Pas</button>
              </div>
              {cash > 0 && (
                change >= 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                    <span className="font-body-md text-green-800">Kembalian:</span>
                    <span className="font-headline-md text-green-700">{fmtRp(change)}</span>
                  </div>
                ) : (
                  <div className="bg-error-container border border-error/30 rounded-xl p-4 flex items-center justify-between">
                    <span className="font-body-md text-on-error-container">Kurang:</span>
                    <span className="font-headline-md text-error">{fmtRp(-change)}</span>
                  </div>
                )
              )}
            </div>
          )}

          {/* QRIS Midtrans — DINAMIS ASLI */}
          {method === 'qris_midtrans' && (
            <div className="flex flex-col items-center gap-3 py-1">
              <div className="w-48 h-48 rounded-xl bg-white border border-outline-variant flex items-center justify-center overflow-hidden p-2 relative">
                {qmode === 'live' && qrUrl ? (
                  <img src={qrUrl} alt="QRIS Midtrans" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                    <Icon name="qr_code_2" className="!text-[100px]" />
                    <span className="text-[11px]">{qmode === 'loading' ? 'Membuat QR…' : qmode === 'dummy' ? 'QR gagal — pakai manual' : ''}</span>
                  </div>
                )}
              </div>
              <p className="font-body-md text-on-surface-variant text-center text-[13px]">QR dinamis Midtrans — pelanggan scan &amp; bayar, lunas terdeteksi otomatis.</p>


              <div className="flex items-center gap-2 text-on-surface-variant">
                {paid ? (
                  <span className="text-green-700 font-bold flex items-center gap-1.5"><Icon name="check_circle" fill /> Lunas! Menyelesaikan…</span>
                ) : qmode === 'live' ? (
                  <span className="flex items-center gap-2 text-[13px]"><span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Menunggu pembayaran…</span>
                ) : null}
              </div>
              {statusMsg && <p className="text-[12px] text-center text-on-surface-variant px-2">{statusMsg}</p>}
            </div>
          )}

          {/* QRIS GoPay — gambar statis per cabang (di-upload Owner di Kelola Cabang) */}
          {method === 'qris_gopay' && (
            <div className="flex flex-col items-center gap-3 py-2">
              {qrisGopayImg ? (
                <div className="w-56 h-56 rounded-xl bg-white border border-outline-variant p-2 flex items-center justify-center overflow-hidden">
                  <img src={qrisGopayImg} alt="QRIS GoPay" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-44 h-44 rounded-xl bg-surface-container-low border border-dashed border-outline-variant flex flex-col items-center justify-center gap-1 text-center px-3">
                  <Icon name="qr_code_2" className="!text-[64px] text-on-surface-variant/50" />
                  <p className="text-[11px] text-on-surface-variant leading-snug">Gambar QRIS GoPay belum di-set. Owner upload di <strong>Kelola Cabang</strong>.</p>
                </div>
              )}
              <p className="font-body-md text-on-surface-variant text-center">Pelanggan scan QR di atas, lalu kasir tandai sudah bayar (manual).</p>
            </div>
          )}

          {(method === 'gofood' || method === 'grabfood') && (
            <div className="flex items-start gap-3 bg-surface-container-low p-4 rounded-xl">
              <Icon name="info" className="text-secondary" />
              <p className="font-body-md text-on-surface-variant">
                Tidak ada pembayaran di booth — transaksi hanya <b>dicatat</b> sebagai channel {method === 'gofood' ? 'GoFood' : 'GrabFood'}.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-margin-page pt-0 flex flex-col gap-3">
          {method === 'qris_midtrans' ? (
            <>
              <button
                onClick={() => pollStatus(false)}
                disabled={qmode !== 'live' || checking || paid}
                className="w-full h-min-tap-target bg-primary-container text-white font-headline-md rounded-xl shadow-[0_8px_16px_rgba(218,41,28,0.25)] hover:bg-primary transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Icon name={paid ? 'check_circle' : 'sync'} fill={paid} /> {paid ? 'Lunas ✓' : checking ? 'Mengecek…' : 'Sudah bayar? Cek status'}
              </button>
              {qmode === 'dummy' && (
                <button onClick={() => onComplete({ method: 'qris_midtrans', cashReceived: null })} className="w-full py-3 rounded-xl border border-outline text-on-surface-variant font-label-lg active:scale-95">Tandai Lunas (manual)</button>
              )}
            </>
          ) : (
            <button
              onClick={complete}
              disabled={!cashOk}
              className="w-full h-min-tap-target bg-primary-container text-white font-headline-md rounded-xl shadow-[0_8px_16px_rgba(218,41,28,0.25)] hover:bg-primary transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Icon name="check_circle" fill /> {completeLabel}
            </button>
          )}
          <button onClick={onClose} className="w-full py-3 text-on-surface-variant font-label-lg hover:text-on-surface transition-colors">Batal</button>
        </div>
      </div>
    </div>
  )
}
