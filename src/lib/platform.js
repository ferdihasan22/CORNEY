// Deteksi platform/browser/webview untuk alur instal PWA Customer.
// Dipakai InstallPrompt untuk memilih perilaku: install langsung (Chromium),
// tutorial iOS (Safari/Chrome), atau "buka di browser" (webview in-app IG/FB).

function ua() { try { return navigator.userAgent || '' } catch { return '' } }

export function isAndroid() { return /android/i.test(ua()) }

export function isIOS() {
  const u = ua()
  if (/iPhone|iPad|iPod/i.test(u)) return true
  // iPadOS 13+ menyamar sebagai Macintosh; deteksi via touch.
  return /Macintosh/i.test(u) && typeof document !== 'undefined' && 'ontouchend' in document
}

// Browser yang dipakai DI iOS (semua memakai WebKit, tapi cara install beda):
//   'safari'  → bisa Tambah ke Layar Utama (PWA standalone penuh)
//   'chrome'  → CriOS (Add to Home Screen ada, tapi sering shortcut)
//   'firefox' / 'edge' / 'other'
export function iosBrowser() {
  const u = ua()
  if (/CriOS/i.test(u)) return 'chrome'
  if (/FxiOS/i.test(u)) return 'firefox'
  if (/EdgiOS/i.test(u)) return 'edge'
  if (/Safari/i.test(u) && /Version\//i.test(u)) return 'safari'
  return 'other'
}

// Webview in-app (Instagram, Facebook, Messenger, Line, TikTok, dll) — TAK BISA
// memasang PWA. Solusi: buka di browser default.
export function isInAppBrowser() {
  const u = ua()
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|Messenger|MicroMessenger|TikTok|musical_ly|Twitter|Snapchat|Pinterest/i.test(u)
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true
}

// Coba buka URL di BROWSER DEFAULT (keluar dari webview in-app).
//   Android → intent:// (andal; Android memilih browser default user).
//   iOS     → TAK BISA dipaksa keluar webview → return false (caller tampilkan
//             instruksi: menu ••• → "Buka di Browser Eksternal").
// Mengembalikan true bila percobaan dilakukan, false bila harus pakai instruksi.
export function openInDefaultBrowser(url) {
  if (isAndroid()) {
    try {
      const noScheme = url.replace(/^https?:\/\//, '')
      window.location.href = `intent://${noScheme}#Intent;scheme=https;end`
      return true
    } catch { /* fallback */ }
    try { window.open(url, '_blank'); return true } catch { /* noop */ }
    return false
  }
  if (isIOS()) {
    // iOS: buka Safari LANGSUNG ke URL pakai skema `x-safari-https://` (navigasi
    // ke halaman, BUKAN pencarian — beda dari x-web-search yang malah cari di
    // Google). Tak dijamin semua iOS; gagal → instruksi •••→Buka di Browser tampil.
    try { window.location.href = url.replace(/^https?:\/\//, 'x-safari-https://') } catch { /* noop */ }
    return false
  }
  try { window.open(url, '_blank'); return true } catch { /* noop */ }
  return false
}
