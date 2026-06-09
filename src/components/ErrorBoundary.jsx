import { Component } from 'react'

// Penjaga GLOBAL: tanpa ini, sekali ada komponen crash ATAU chunk lazy gagal dimuat,
// React melepas seluruh pohon → layar BLANK diam-diam (sulit didiagnosa di HP).
// - Error CHUNK (bundle berubah karena deploy baru, tab masih versi lama) → muat ulang
//   OTOMATIS sekali ambil versi terbaru (guard sessionStorage cegah loop).
// - Error lain → tampilkan pesan jelas + tombol Muat Ulang (kegagalan terlihat, bukan blank).
const isChunkError = (e) => {
  const m = (e && (e.message || String(e))) || ''
  return (
    e?.name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(m) ||
    /Failed to fetch dynamically imported module/i.test(m) ||
    /error loading dynamically imported module/i.test(m) ||
    /Importing a module script failed/i.test(m)
  )
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    if (isChunkError(error) && typeof window !== 'undefined') {
      try {
        const KEY = 'corney_chunk_reload_at'
        const last = Number(sessionStorage.getItem(KEY) || 0)
        // Reload sekali per 10 dtk → kalau memang versi baru, sekali reload beres;
        // kalau error menetap, berhenti reload & tampilkan UI (cegah loop tak henti).
        if (Date.now() - last > 10000) {
          sessionStorage.setItem(KEY, String(Date.now()))
          window.location.reload()
        }
      } catch { /* sessionStorage diblok → biarkan UI tampil */ }
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunk = isChunkError(error)
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-8 text-center gap-3">
        <span className="material-symbols-outlined text-[56px] text-error/70">{chunk ? 'sync_problem' : 'error'}</span>
        <p className="text-headline-md font-headline-md">{chunk ? 'Memuat versi terbaru…' : 'Terjadi kesalahan'}</p>
        <p className="text-on-surface-variant max-w-sm">
          {chunk
            ? 'Aplikasi baru saja diperbarui. Halaman akan dimuat ulang otomatis. Jika tidak, tekan tombol di bawah.'
            : 'Maaf, layar ini gagal ditampilkan. Coba muat ulang. Jika masih bermasalah, beri tahu kami pesan di bawah.'}
        </p>
        {!chunk && error?.message && (
          <p className="text-[11px] text-on-surface-variant/70 max-w-sm break-words font-mono bg-surface-container rounded-lg px-3 py-2">{String(error.message).slice(0, 200)}</p>
        )}
        <button
          onClick={() => { try { sessionStorage.removeItem('corney_chunk_reload_at') } catch { /* ignore */ } window.location.reload() }}
          className="mt-2 h-11 px-6 rounded-xl bg-primary text-on-primary font-bold active:scale-95 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">refresh</span> Muat Ulang
        </button>
      </div>
    )
  }
}
