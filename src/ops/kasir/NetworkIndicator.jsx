import { useState, useEffect, useRef } from 'react'
import { pendingCount, subscribe as subscribeOutbox } from '../../store/outbox.js'

// Indikator jaringan di header kasir: kekuatan sinyal + online/offline + jumlah
// data belum tersinkron. BISA DIKETUK → gelembung pesan (instruksi cek
// jaringan/kuota) + tombol OK. Otomatis muncul saat jaringan lemah/offline.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

function PendingBadge({ count }) {
  if (!count) return null
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold bg-amber-400/90 text-amber-950 px-1.5 py-0.5 rounded-full">
      <Icon name="sync" className="!text-[13px]" /> {count}
    </span>
  )
}

export default function NetworkIndicator() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [eff, setEff] = useState(navigator?.connection?.effectiveType || '')
  const [pending, setPending] = useState(pendingCount())
  const [open, setOpen] = useState(false)
  const prevBad = useRef(false)

  useEffect(() => {
    const onl = () => setOnline(navigator.onLine)
    window.addEventListener('online', onl)
    window.addEventListener('offline', onl)
    const conn = navigator.connection
    const ch = () => { setEff(conn?.effectiveType || ''); setOnline(navigator.onLine) }
    conn?.addEventListener?.('change', ch)
    const offOutbox = subscribeOutbox(() => setPending(pendingCount()))
    return () => { window.removeEventListener('online', onl); window.removeEventListener('offline', onl); conn?.removeEventListener?.('change', ch); offOutbox() }
  }, [])

  const weak = online && (eff === 'slow-2g' || eff === '2g')
  const bad = !online || weak

  // Otomatis munculkan gelembung tiap BARU jadi buruk (offline / lemah).
  useEffect(() => {
    if (bad && !prevBad.current) setOpen(true)
    prevBad.current = bad
  }, [bad])

  const level = !online ? 0 : eff === 'slow-2g' ? 1 : eff === '2g' ? 2 : eff === '3g' ? 3 : 4
  const label = !online ? 'Offline' : (eff ? eff.toUpperCase() : 'Online')

  // Isi gelembung — bahasa sederhana untuk karyawan.
  const msg = !online
    ? { tone: 'red', icon: 'wifi_off', title: 'Tidak ada internet', body: 'Coba cek WiFi atau kuota internetmu ya. Tenang — semua data AMAN tersimpan & otomatis terkirim begitu internet kembali.' }
    : weak
      ? { tone: 'amber', icon: 'signal_wifi_statusbar_connected_no_internet_4', title: 'Jaringan lemah', body: 'Sinyal/kuota internetmu kecil, pengiriman bisa lambat. Coba dekat ke WiFi atau cek sisa kuota.' }
      : { tone: 'green', icon: 'wifi', title: 'Internet lancar', body: 'Koneksi bagus. Semua data terkirim normal.' }
  const toneCls = { red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-800', green: 'bg-green-50 text-green-700' }[msg.tone]

  return (
    <div className="relative">
      {/* Pemicu (icon di header) — bisa diketuk */}
      <button onClick={() => setOpen((o) => !o)} title={`Internet: ${label} — ketuk untuk info`} className="flex items-center gap-1.5 active:scale-95 transition-transform">
        {!online ? (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-200"><Icon name="wifi_off" className="!text-[18px]" /> <span className="hidden sm:inline">Offline</span></span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="flex items-end gap-[2px] h-4">
              {[1, 2, 3, 4].map((b) => (
                <span key={b} className={`w-[3px] rounded-sm ${b <= level ? 'bg-on-primary' : 'bg-on-primary/30'}`} style={{ height: `${b * 25}%` }} />
              ))}
            </span>
            <span className="hidden sm:inline text-[10px] font-bold opacity-80">{label}</span>
          </span>
        )}
        <PendingBadge count={pending} />
        {/* titik berkedip saat jaringan buruk → ajak ketuk */}
        {bad && <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />}
      </button>

      {/* Gelembung pesan (chat bubble) */}
      {open && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-3 z-[151] w-72 max-w-[85vw]">
            {/* panah ke atas (ke icon) */}
            <div className="absolute -top-2 right-4 w-4 h-4 bg-white rotate-45 shadow-[-2px_-2px_4px_rgba(0,0,0,0.04)]" />
            <div className="relative bg-white rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.18)] overflow-hidden text-on-surface">
              <div className={`px-4 py-3 flex items-center gap-2 ${toneCls}`}>
                <Icon name={msg.icon} className="!text-[22px]" />
                <p className="font-bold leading-tight">{msg.title}</p>
              </div>
              <div className="p-4">
                <p className="text-[13px] leading-snug text-on-surface-variant">{msg.body}</p>
                {pending > 0 && (
                  <p className="mt-2 text-[12px] font-bold text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                    <Icon name="sync" className="!text-[15px]" /> {pending} data menunggu — aman, tak hilang
                  </p>
                )}
                <button onClick={() => setOpen(false)} className="mt-3 w-full h-11 rounded-xl bg-primary text-on-primary font-bold active:scale-[0.98]">
                  OK, mengerti
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
