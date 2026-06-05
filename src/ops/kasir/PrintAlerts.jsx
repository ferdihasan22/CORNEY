import { useEffect, useSyncExternalStore } from 'react'
import { subscribePending, pendingCount, retryPending, clearPending } from './autoprint.js'
import { useBtPrinter } from './useBtPrinter.js'
import { btAutoReconnect, refreshConnection } from './btprinter.js'

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
)

// Global (App): (1) jaga printer tetap tersambung — reconnect saat app cold-start
// & saat kembali ke depan (buka-tutup app); (2) auto-cetak-ulang struk tertunda
// saat printer nyambung; (3) banner peringatan bila ada struk belum tercetak.
export default function PrintAlerts() {
  const count = useSyncExternalStore(subscribePending, pendingCount)
  const connected = useBtPrinter()

  // Reconnect awal + saat app kembali ke depan (penting agar printer tetap
  // tersambung walau aplikasi dibuka-tutup / sempat di-background).
  useEffect(() => {
    btAutoReconnect()
    const onResume = () => { if (!document.hidden) refreshConnection() }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('focus', onResume)
    return () => {
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('focus', onResume)
    }
  }, [])

  // Saat printer (kembali) tersambung → coba cetak semua yang tertunda.
  useEffect(() => { if (connected) retryPending() }, [connected])

  if (count <= 0) return null

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[110] w-[92%] max-w-md">
      <div className="bg-amber-500 text-black rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
        <Icon name="print_disabled" className="!text-2xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold leading-tight">{count} struk belum tercetak</p>
          <p className="text-[12px] leading-tight opacity-90">
            {connected ? 'Mencoba cetak ulang…' : 'Periksa printer & kertas, lalu nyalakan/sambungkan.'}
          </p>
        </div>
        <button onClick={() => retryPending()} className="shrink-0 bg-black/85 text-white text-[13px] font-bold px-3 py-1.5 rounded-lg active:scale-95">
          Cetak Ulang
        </button>
        <button onClick={() => clearPending()} title="Abaikan" className="shrink-0 p-1 rounded-lg hover:bg-black/10"><Icon name="close" /></button>
      </div>
    </div>
  )
}
