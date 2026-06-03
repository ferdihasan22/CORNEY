import { useState } from 'react'
import { fmtRp } from '../../data/menu.js'

// Step 1A.6 — WLK-03 "Bayar Sekarang" + §6.7 lima channel pembayaran.
// UI ported from Stitch "payment_modal_corney_pos". Modal over the Walk-in
// screen. Channels: Tunai (kembalian), QRIS Midtrans (utama/auto), QRIS GoPay
// (cadangan/manual), GoFood, GrabFood (dicatat saja).
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

export default function PaymentModal({ total, onClose, onComplete }) {
  const [method, setMethod] = useState('tunai')
  const [cash, setCash] = useState(0)

  const change = cash - total
  const cashOk = method !== 'tunai' || cash >= total

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

          {/* Context per channel */}
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

          {(method === 'qris_midtrans' || method === 'qris_gopay') && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-44 h-44 rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-center">
                <Icon name="qr_code_2" className="!text-[120px] text-on-surface" />
              </div>
              <p className="font-body-md text-on-surface-variant text-center">
                {method === 'qris_midtrans'
                  ? 'QR dinamis Midtrans — verifikasi otomatis saat pelanggan bayar.'
                  : 'QR statis GoPay — pelanggan scan, lalu kasir tandai sudah bayar (manual).'}
              </p>
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
          <button
            onClick={complete}
            disabled={!cashOk}
            className="w-full h-min-tap-target bg-primary-container text-white font-headline-md rounded-xl shadow-[0_8px_16px_rgba(218,41,28,0.25)] hover:bg-primary transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Icon name="check_circle" fill /> {completeLabel}
          </button>
          <button onClick={onClose} className="w-full py-3 text-on-surface-variant font-label-lg hover:text-on-surface transition-colors">Batal</button>
        </div>
      </div>
    </div>
  )
}
