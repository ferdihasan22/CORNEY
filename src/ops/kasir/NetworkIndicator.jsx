import { useState, useEffect } from 'react'
import { pendingCount, subscribe as subscribeOutbox } from '../../store/outbox.js'

// Indikator jaringan: kekuatan sinyal (dari Network Information API) + status
// online/offline + jumlah data yang BELUM tersinkron ke server (outbox).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

// Lencana "belum tersinkron": muncul saat ada tulisan menunggu naik ke server
// (offline / sinyal jelek). Hilang otomatis begitu antrean kosong (terkirim).
function PendingBadge({ count }) {
  if (!count) return null
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold bg-amber-400/90 text-amber-950 px-1.5 py-0.5 rounded-full" title={`${count} data menunggu tersinkron ke server — aman, otomatis terkirim saat internet stabil`}>
      <Icon name="sync" className="!text-[13px]" /> {count}
    </span>
  )
}

export default function NetworkIndicator() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [eff, setEff] = useState(navigator?.connection?.effectiveType || '')
  const [pending, setPending] = useState(pendingCount())

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

  if (!online) {
    return <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-200" title="Tidak ada internet"><Icon name="wifi_off" className="!text-[18px]" /> <span className="hidden sm:inline">Offline</span><PendingBadge count={pending} /></span>
  }
  const level = eff === 'slow-2g' ? 1 : eff === '2g' ? 2 : eff === '3g' ? 3 : 4 // '4g'/unknown → penuh
  const label = eff ? eff.toUpperCase() : 'Online'
  return (
    <div className="flex items-center gap-1.5" title={`Internet: ${label}`}>
      <div className="flex items-end gap-[2px] h-4">
        {[1, 2, 3, 4].map((b) => (
          <span key={b} className={`w-[3px] rounded-sm ${b <= level ? 'bg-on-primary' : 'bg-on-primary/30'}`} style={{ height: `${b * 25}%` }} />
        ))}
      </div>
      <span className="hidden sm:inline text-[10px] font-bold opacity-80">{label}</span>
      <PendingBadge count={pending} />
    </div>
  )
}
