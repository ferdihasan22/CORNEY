// Tangkap event `beforeinstallprompt` SEDINI MUNGKIN (di-import di main.jsx) agar
// tombol "Instal Aplikasi" bisa memicu install PWA ASLI (bukan pintasan layar).
// Chrome/Android/Desktop punya event ini; iOS Safari TIDAK → hanya via Bagikan →
// Tambah ke Layar Utama (kita beri petunjuk).
let deferred = null
const subs = new Set()
const emit = () => subs.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit() })
  window.addEventListener('appinstalled', () => { deferred = null; emit() })
}

export function canInstall() { return !!deferred }
export function subscribeInstall(fn) { subs.add(fn); return () => subs.delete(fn) }

export async function promptInstall() {
  if (!deferred) return 'unavailable'
  deferred.prompt()
  let outcome = 'dismissed'
  try { const r = await deferred.userChoice; outcome = r?.outcome || 'dismissed' } catch { /* abaikan */ }
  deferred = null; emit()
  return outcome // 'accepted' | 'dismissed'
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true
}
export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}
