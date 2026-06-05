import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
// Muat master di awal: menyinkronkan daftar cabang tersimpan (master.branches)
// ke konstanta BRANCHES yang dipakai seluruh app, sebelum layar apa pun render.
import './store/master.js'
// Tangkap event install PWA sedini mungkin (untuk tombol "Instal Aplikasi").
import './lib/pwaInstall.js'
// Manifest dinamis: start_url = halaman saat ini → PWA instal dari /ops/owner/login
// membuka /ops/owner/login (berlaku semua halaman).
import { applyDynamicManifest } from './lib/dynamicManifest.js'

applyDynamicManifest()
// Splash screen native (hanya aktif di APK Capacitor; no-op di web/PWA).
import { hideSplashWhenReady } from './lib/nativeSplash.js'
// Perbaikan reflow WebView saat rotasi layar (cegah header meluber di portrait
// setelah dari landscape).
import { installOrientationReflow } from './lib/orientationReflow.js'

installOrientationReflow()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// Sembunyikan splash native setelah app render. Pengaman native (launchAutoHide)
// tetap menutup splash sendiri walau baris ini gagal — app tak pernah terkunci.
hideSplashWhenReady()
