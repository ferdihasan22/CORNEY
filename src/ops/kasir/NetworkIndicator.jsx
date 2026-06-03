import { useState, useEffect } from 'react'

// Indikator jaringan: kekuatan sinyal (dari Network Information API) + status
// online/offline. Ringan, hanya event listener.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function NetworkIndicator() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [eff, setEff] = useState(navigator?.connection?.effectiveType || '')

  useEffect(() => {
    const onl = () => setOnline(navigator.onLine)
    window.addEventListener('online', onl)
    window.addEventListener('offline', onl)
    const conn = navigator.connection
    const ch = () => { setEff(conn?.effectiveType || ''); setOnline(navigator.onLine) }
    conn?.addEventListener?.('change', ch)
    return () => { window.removeEventListener('online', onl); window.removeEventListener('offline', onl); conn?.removeEventListener?.('change', ch) }
  }, [])

  if (!online) {
    return <span className="flex items-center gap-1 text-[11px] font-bold text-red-200" title="Tidak ada internet"><Icon name="wifi_off" className="!text-[18px]" /> <span className="hidden sm:inline">Offline</span></span>
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
    </div>
  )
}
