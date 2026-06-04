import { useState, useEffect, useRef } from 'react'
import { pendingCount, subscribe as subscribeOutbox, flush } from '../store/outbox.js'

// Indikator sinkron GLOBAL untuk SEMUA PWA staf (Kasir, Operasional, Produksi,
// Auditor, Supplier, Owner). Bahasa sengaja sederhana (karyawan SMP):
//   • Sedang kirim (online)      → "Mengirim data…"
//   • Internet mati + ada antre  → "Internet mati. Data AMAN, nanti terkirim sendiri."
//   • Baru selesai terkirim      → "Beres! Data sudah terkirim." (hilang sendiri)
//   • Offline tanpa antre        → chip kecil "Tidak ada internet"
// Digerakkan oleh outbox (antrean sinkron) → otomatis benar di semua layar tanpa
// menyentuh tiap tombol.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

export default function SyncStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pending, setPending] = useState(pendingCount())
  const [justSynced, setJustSynced] = useState(false)
  const prev = useRef(pendingCount())
  const sawOffline = useRef(false) // pernah offline saat ada antrean? → baru tampilkan "Beres terkirim"

  useEffect(() => {
    const upd = () => {
      setOnline(navigator.onLine)
      if (!navigator.onLine && pendingCount() > 0) sawOffline.current = true
    }
    window.addEventListener('online', upd)
    window.addEventListener('offline', upd)
    const off = subscribeOutbox(() => {
      const n = pendingCount()
      if (n > 0 && typeof navigator !== 'undefined' && !navigator.onLine) sawOffline.current = true
      // Transisi "ada antre" → "kosong". Konfirmasi HANYA bila tadi sempat offline
      // (biar simpan online instan tak munculkan toast tiap ketik = tak berisik).
      if (prev.current > 0 && n === 0) {
        if (sawOffline.current) {
          setJustSynced(true)
          setTimeout(() => setJustSynced(false), 3000)
        }
        sawOffline.current = false
      }
      prev.current = n
      setPending(n)
    })
    return () => {
      window.removeEventListener('online', upd)
      window.removeEventListener('offline', upd)
      off()
    }
  }, [])

  // "Mengirim…" hanya tampil bila pengiriman >0.8 dtk (simpan online instan = senyap).
  const [showSending, setShowSending] = useState(false)
  useEffect(() => {
    if (online && pending > 0) {
      const t = setTimeout(() => setShowSending(true), 800)
      return () => clearTimeout(t)
    }
    setShowSending(false)
  }, [online, pending])

  const wrap = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-4 w-full max-w-md pointer-events-none'

  // 1) KONFIRMASI: baru selesai terkirim (muncul sebentar lalu hilang sendiri).
  if (justSynced && pending === 0) {
    return (
      <div className={wrap}>
        <div className="pointer-events-auto bg-green-600 text-white rounded-2xl shadow-lg px-5 py-3 flex items-center gap-3 animate-[fadeIn_0.2s_ease]">
          <Icon name="check_circle" className="!text-[26px]" />
          <p className="font-bold leading-tight">Beres! Semua data sudah terkirim.</p>
        </div>
      </div>
    )
  }

  // 2) INTERNET MATI + masih ada yang belum terkirim → paling penting, jelas & menenangkan.
  if (!online && pending > 0) {
    return (
      <div className={wrap}>
        <div className="pointer-events-auto bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 shrink-0 bg-amber-100 rounded-full flex items-center justify-center">
              <Icon name="wifi_off" className="!text-[24px] text-amber-700" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-amber-900 leading-tight">Internet sedang mati</p>
              <p className="text-[13px] text-amber-900/90 leading-snug mt-0.5">Tenang, data kamu <b>AMAN tersimpan</b>. Begitu internet ada lagi, langsung terkirim sendiri. Coba cek WiFi/paket data ya.</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pl-14">
            <span className="text-[12px] font-bold text-amber-800 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> {pending} data menunggu</span>
            <button onClick={() => flush()} className="pointer-events-auto h-9 px-4 rounded-lg bg-amber-500 text-white font-bold text-[13px] flex items-center gap-1.5 active:scale-95"><Icon name="sync" className="!text-[16px]" /> Coba lagi</button>
          </div>
        </div>
      </div>
    )
  }

  // 3) ONLINE tapi masih proses kirim (lebih dari sesaat) → info ringan.
  if (showSending && pending > 0) {
    return (
      <div className={wrap}>
        <div className="pointer-events-auto bg-white border border-outline-variant rounded-full shadow-lg px-4 py-2 flex items-center gap-2.5 w-fit mx-auto">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] font-bold text-on-surface">Mengirim data… ({pending})</span>
        </div>
      </div>
    )
  }

  // 4) OFFLINE tanpa antrean → chip kecil biar karyawan tahu lagi tak ada internet.
  if (!online) {
    return (
      <div className={wrap}>
        <div className="pointer-events-auto bg-on-surface/80 text-white rounded-full shadow px-3 py-1.5 flex items-center gap-1.5 w-fit mx-auto">
          <Icon name="wifi_off" className="!text-[16px]" />
          <span className="text-[12px] font-bold">Tidak ada internet</span>
        </div>
      </div>
    )
  }

  return null
}
