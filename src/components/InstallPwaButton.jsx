import { useState, useSyncExternalStore } from 'react'
import { canInstall, subscribeInstall, promptInstall, isStandalone, isIOS } from '../lib/pwaInstall.js'

// Tombol "Instal Aplikasi" — install PWA ASLI (Chrome/Android/Desktop) lewat
// beforeinstallprompt. iOS Safari → petunjuk Bagikan→Tambah ke Layar Utama.
// Otomatis SEMBUNYI bila sudah terinstall (dibuka sebagai app) atau browser tak dukung.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

export default function InstallPwaButton({ label = 'Instal Aplikasi', className = '' }) {
  const installable = useSyncExternalStore(subscribeInstall, canInstall, canInstall)
  const [iosHint, setIosHint] = useState(false)

  if (isStandalone()) return null

  const baseCls = `w-full h-12 rounded-xl border-2 border-primary text-primary font-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${className}`

  if (installable) {
    return (
      <button type="button" onClick={() => promptInstall()} className={baseCls}>
        <Icon name="install_mobile" /> {label}
      </button>
    )
  }
  if (isIOS()) {
    return (
      <div className="w-full">
        <button type="button" onClick={() => setIosHint((s) => !s)} className={baseCls}>
          <Icon name="install_mobile" /> {label}
        </button>
        {iosHint && (
          <div className="mt-2 text-[12px] text-on-surface-variant bg-surface-container-low rounded-xl p-3 leading-snug flex items-start gap-2">
            <Icon name="ios_share" className="!text-[18px] text-primary shrink-0" />
            <p><b>iPhone/iPad (Safari):</b> ketuk tombol <b>Bagikan</b> (kotak panah ke atas) → pilih <b>Tambah ke Layar Utama</b>.</p>
          </div>
        )}
      </div>
    )
  }
  return null
}
