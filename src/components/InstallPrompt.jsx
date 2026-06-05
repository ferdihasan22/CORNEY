import { useState, useSyncExternalStore } from 'react'
import { canInstall, subscribeInstall, promptInstall } from '../lib/pwaInstall.js'
import { isStandalone, isIOS, iosBrowser, isInAppBrowser, openInDefaultBrowser } from '../lib/platform.js'

// Tombol instal PWA SADAR-PLATFORM untuk Customer.
//   • Android/Desktop Chromium (prompt siap) → install LANGSUNG (1 klik).
//   • iPhone Safari/Chrome → dropdown tutorial (logo + langkah + ikon Bagikan).
//   • Webview in-app (Instagram/FB/dll) → "Buka di Browser":
//       Android = paksa browser default ke /install; iOS = instruksi menu •••.
//   • Sudah terinstal (standalone) → tombol HILANG.
// Logo tutorial = /favicon.svg. Halaman /install = versi minimal (hanya tombol).
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

const INSTALL_URL = (() => {
  try { return window.location.origin + '/install' } catch { return '/install' }
})()

const Logo = () => (
  <img src="/favicon.svg" alt="CORNEY" className="w-12 h-12 rounded-xl shadow-sm shrink-0" />
)

function Tutorial({ mode }) {
  // Kartu petunjuk yang muncul di bawah tombol.
  const box = 'mt-2 bg-surface-container-low border border-outline-variant rounded-2xl p-4 text-on-surface text-left animate-[fadeIn_.15s_ease-out]'
  const step = 'flex items-start gap-2 text-[13px] leading-snug'
  if (mode === 'ios-safari') {
    return (
      <div className={box}>
        <div className="flex items-center gap-3 mb-3"><Logo /><div><p className="font-bold leading-tight">Pasang di iPhone (Safari)</p><p className="text-[12px] text-on-surface-variant">3 langkah cepat</p></div></div>
        <div className="flex flex-col gap-2">
          <p className={step}><Icon name="ios_share" className="!text-[18px] text-primary shrink-0" /><span>1. Ketuk ikon <b>Bagikan</b> (kotak panah ke atas) di bilah bawah Safari.</span></p>
          <p className={step}><Icon name="add_box" className="!text-[18px] text-primary shrink-0" /><span>2. Gulir, pilih <b>"Tambah ke Layar Utama"</b>.</span></p>
          <p className={step}><Icon name="check_circle" className="!text-[18px] text-primary shrink-0" /><span>3. Ketuk <b>"Tambah"</b> — selesai, ikon CORNEY muncul di layar utama.</span></p>
        </div>
      </div>
    )
  }
  if (mode === 'ios-chrome') {
    return (
      <div className={box}>
        <div className="flex items-center gap-3 mb-3"><Logo /><div><p className="font-bold leading-tight">Pasang di iPhone (Chrome)</p><p className="text-[12px] text-on-surface-variant">Untuk hasil terbaik, buka di Safari</p></div></div>
        <div className="flex flex-col gap-2">
          <p className={step}><Icon name="ios_share" className="!text-[18px] text-primary shrink-0" /><span>1. Ketuk ikon <b>Bagikan</b> di kanan atas Chrome.</span></p>
          <p className={step}><Icon name="add_box" className="!text-[18px] text-primary shrink-0" /><span>2. Pilih <b>"Tambah ke Layar Utama"</b>.</span></p>
          <p className={step}><Icon name="info" className="!text-[18px] text-tertiary shrink-0" /><span>Tip: agar jadi aplikasi penuh, buka <b>corney.id di Safari</b> lalu ulangi langkahnya.</span></p>
        </div>
      </div>
    )
  }
  if (mode === 'ios-other') {
    return (
      <div className={box}>
        <div className="flex items-center gap-3 mb-3"><Logo /><div><p className="font-bold leading-tight">Pasang di iPhone</p></div></div>
        <p className={step}><Icon name="open_in_browser" className="!text-[18px] text-primary shrink-0" /><span>Buka <b>corney.id di Safari</b>, lalu ketuk <b>Bagikan ⎙ → Tambah ke Layar Utama</b>.</span></p>
      </div>
    )
  }
  if (mode === 'inapp-ios') {
    return (
      <div className={box}>
        <div className="flex items-center gap-3 mb-3"><Logo /><div><p className="font-bold leading-tight">Buka di Browser dulu</p><p className="text-[12px] text-on-surface-variant">Kamu sedang di dalam aplikasi (mis. Instagram)</p></div></div>
        <div className="flex flex-col gap-2">
          <p className={step}><Icon name="more_horiz" className="!text-[18px] text-primary shrink-0" /><span>1. Ketuk <b>•••</b> di kanan atas.</span></p>
          <p className={step}><Icon name="open_in_browser" className="!text-[18px] text-primary shrink-0" /><span>2. Pilih <b>"Buka di Browser Eksternal"</b> (Safari).</span></p>
          <p className={step}><Icon name="install_mobile" className="!text-[18px] text-primary shrink-0" /><span>3. Di Safari, ketuk <b>Bagikan → Tambah ke Layar Utama</b>.</span></p>
        </div>
      </div>
    )
  }
  // generic (Android/Desktop tanpa prompt siap)
  return (
    <div className={box}>
      <div className="flex items-center gap-3 mb-3"><Logo /><div><p className="font-bold leading-tight">Pasang aplikasi</p></div></div>
      <p className={step}><Icon name="more_vert" className="!text-[18px] text-primary shrink-0" /><span>Buka menu browser (<b>⋮</b>) lalu pilih <b>"Instal aplikasi"</b> / <b>"Tambahkan ke Layar Utama"</b>.</span></p>
    </div>
  )
}

export default function InstallPrompt({ label = 'Instal Aplikasi', sublabel = '', className = '' }) {
  const installable = useSyncExternalStore(subscribeInstall, canInstall, canInstall)
  const [open, setOpen] = useState(false)

  if (isStandalone()) return null // sudah terinstal → sembunyi

  const inApp = isInAppBrowser()
  const ios = isIOS()

  // Tentukan mode tampilan & aksi.
  let label2 = label
  let icon = 'install_mobile'
  let tutorialMode = 'generic'
  if (inApp) { label2 = 'Buka di Browser'; icon = 'open_in_browser'; tutorialMode = ios ? 'inapp-ios' : 'generic' }
  else if (ios) { tutorialMode = iosBrowser() === 'safari' ? 'ios-safari' : iosBrowser() === 'chrome' ? 'ios-chrome' : 'ios-other' }

  const onClick = () => {
    // 1) Webview in-app → coba buka browser default; gagal (iOS) → tutorial.
    if (inApp) {
      const opened = openInDefaultBrowser(INSTALL_URL)
      if (!opened) setOpen((s) => !s)
      return
    }
    // 2) Chromium siap → install langsung.
    if (installable) { promptInstall(); return }
    // 3) iOS / belum siap → buka/tutup tutorial.
    setOpen((s) => !s)
  }

  const baseCls = className || 'w-full h-12 rounded-xl border-2 border-primary text-primary font-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all'

  return (
    <div className="w-full">
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
      <button type="button" onClick={onClick} className={baseCls}>
        <Icon name={icon} className="text-[24px]" />
        <span className="flex flex-col items-start leading-tight">
          <span className="font-bold">{label2}</span>
          {sublabel ? <span className="text-[11px] font-normal opacity-80">{sublabel}</span> : null}
        </span>
      </button>
      {open && <Tutorial mode={tutorialMode} />}
    </div>
  )
}
