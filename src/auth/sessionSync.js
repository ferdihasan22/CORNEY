// CORNEY — Sinkronisasi flag sesi LOKAL dengan sesi SUPABASE nyata.
//
// Masalah yang dijaga (lihat audit "Ingat login"):
//   #1 Flag lokal ada (AuthGate izinkan masuk) TAPI sesi Supabase HILANG
//      (refresh token kedaluwarsa/dicabut, password staf diubah Owner, idle lama)
//      → user "tampak login" tapi semua operasi DB ditolak RLS. Di sini: bersihkan
//      flag + paksa re-login bersih.
//   #2 Sesi Supabase ADA tapi TAK ada flag sama sekali (mis. sisa login "jangan
//      ingat" yang sudah ditutup) → token nyangkut di perangkat. Di sini: signOut.
//
// Hanya aktif di mode Supabase. Mode local (tanpa Supabase) → flag lokal adalah
// satu-satunya auth → JANGAN diutak-atik.
import { supabase } from '../lib/supabase.js'
import { isSupabase } from '../lib/backend.js'

const FLAG_KEYS = [
  'corney_sess_owner', 'corney_sess_operasional', 'corney_sess_produksi', 'corney_sess_auditor',
  'corney_kasir_branch', 'corney_supplier_session',
]

function anyFlag() {
  try { return FLAG_KEYS.some((k) => localStorage.getItem(k) || sessionStorage.getItem(k)) } catch { return false }
}
function clearFlags() {
  try { FLAG_KEYS.forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k) }) } catch { /* noop */ }
}
function onProtected() {
  try {
    const p = window.location.pathname
    return (p.startsWith('/ops/') && !p.endsWith('/login')) || (p.startsWith('/supplier') && p !== '/supplier')
  } catch { return false }
}
function forceRelogin() {
  clearFlags()
  // Reload supaya AuthGate evaluasi ulang (flag sudah bersih → arahkan ke login).
  // Hanya bila sedang di area terlindungi, agar tak mengganggu halaman login/publik.
  if (onProtected()) { try { window.location.reload() } catch { /* noop */ } }
}

export function installSessionSync() {
  if (!isSupabase() || !supabase) return

  // Sekali saat start: rekonsiliasi awal.
  supabase.auth.getSession().then(({ data }) => {
    const session = data && data.session
    if (!session && anyFlag()) {
      forceRelogin() // #1: flag basi, sesi Supabase hilang
    } else if (session && !anyFlag()) {
      supabase.auth.signOut().catch(() => {}) // #2: token sisa tanpa flag → bersihkan
    }
  }).catch(() => {})

  // Mid-session: token dicabut / refresh gagal → SIGNED_OUT. (SIGNED_IN sengaja
  // diabaikan agar tak balapan dengan alur login yang men-set flag SETELAH signIn.)
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !session && anyFlag()) forceRelogin()
  })
}
