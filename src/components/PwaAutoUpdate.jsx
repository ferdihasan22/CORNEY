// ⚠️ SEMENTARA (untuk testing) — auto-update PWA instan.
// Cek versi baru tiap 20 dtk; mode `autoUpdate` (vite.config) langsung skipWaiting +
// reload halaman sendiri saat ada build baru → kasir tak perlu refresh/clear data.
// HAPUS file ini + barisnya di App.jsx setelah selesai testing.
import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PwaAutoUpdate() {
  const [updating, setUpdating] = useState(false)
  useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (!r) return
      // Cek update berkala selama app terbuka (SPA tak reload sendiri).
      setInterval(() => { r.update().catch(() => {}) }, 20000)
    },
    onNeedRefresh() {
      // autoUpdate akan menerapkan + reload otomatis; tampilkan toast sekilas.
      setUpdating(true)
    },
  })
  if (!updating) return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-primary text-on-primary px-4 py-2 rounded-full shadow-lg text-sm font-bold flex items-center gap-2">
      <span className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
      Memuat versi terbaru…
    </div>
  )
}
