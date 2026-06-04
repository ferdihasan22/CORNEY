// CORNEY — Adapter login Supabase Auth (TAHAP 4, FASE 2 frontend).
//
// Dipakai oleh layar login HANYA saat VITE_BACKEND=supabase. Mode 'local' tetap
// memakai roleAuth.js (kredensial localStorage) tanpa perubahan perilaku.
//
// Email staf SINTETIS (lihat docs/TAHAP4-SUPABASE.md §8):
//   owner@corney.app, ops@corney.app, produksi@corney.app, auditor@corney.app,
//   supplier@corney.app, kasir.<branchId>@corney.app
//
// Setiap login memverifikasi role + status aktif dari tabel `profiles` (otoritatif),
// dan menolak (lalu sign-out) bila role/cabang tak cocok atau akun dinonaktifkan.

import { supabase } from '../lib/supabase.js'
import { isSupabase } from '../lib/backend.js'

const ROLE_EMAIL = {
  owner: 'owner@corney.app',
  operasional: 'ops@corney.app',
  produksi: 'produksi@corney.app',
  auditor: 'auditor@corney.app',
  supplier: 'supplier@corney.app',
}
export const roleEmail = (role) => ROLE_EMAIL[role] || `${role}@corney.app`
export const kasirEmail = (branchId) => `kasir.${branchId}@corney.app`

function mapAuthError(error) {
  const m = (error?.message || '').toLowerCase()
  if (m.includes('invalid login') || m.includes('credentials')) return 'Username atau password salah.'
  if (m.includes('email not confirmed')) return 'Akun belum dikonfirmasi.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Tidak ada koneksi ke server.'
  return error?.message || 'Gagal masuk.'
}

async function signInExpectRole(email, password, expectedRole, expectedBranch) {
  if (!supabase) return { ok: false, error: 'Backend Supabase belum siap.' }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: mapAuthError(error) }

  // Otoritatif: ambil role/branch/active dari profiles (self-read diizinkan RLS).
  const { data: prof, error: pe } = await supabase
    .from('profiles').select('role, branch_id, active').eq('id', data.user.id).maybeSingle()
  if (pe || !prof) { await supabase.auth.signOut(); return { ok: false, error: 'Profil akun tidak ditemukan.' } }
  if (prof.active === false) { await supabase.auth.signOut(); return { ok: false, error: 'Akun dinonaktifkan Owner.' } }
  if (expectedRole && prof.role !== expectedRole) { await supabase.auth.signOut(); return { ok: false, error: `Akun ini bukan ${expectedRole}.` } }
  if (expectedBranch && prof.branch_id !== expectedBranch) { await supabase.auth.signOut(); return { ok: false, error: 'Akun kasir bukan untuk cabang ini.' } }
  return { ok: true, role: prof.role, branchId: prof.branch_id }
}

export function signInRole(role, password) {
  return signInExpectRole(roleEmail(role), password, role, null)
}

// KANTOR (back-office): SATU login tanpa pilih peran → deteksi otomatis. Coba password
// ke tiap email peran yang diizinkan; yang berhasil auth → role diambil dari `profiles`
// (otoritatif). Tiap peran punya password beda → tepat satu yang cocok.
export async function signInAuto(password, allowedRoles) {
  if (!supabase) return { ok: false, error: 'Backend Supabase belum siap.' }
  let lastErr = 'Username atau password salah.'
  for (const role of allowedRoles) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: roleEmail(role), password })
    if (error) { lastErr = mapAuthError(error); continue } // bukan peran ini → coba berikutnya
    const { data: prof } = await supabase.from('profiles').select('role, active').eq('id', data.user.id).maybeSingle()
    if (!prof) { await supabase.auth.signOut(); continue }
    if (prof.active === false) { await supabase.auth.signOut(); return { ok: false, error: 'Akun dinonaktifkan Owner.' } }
    if (!allowedRoles.includes(prof.role)) { await supabase.auth.signOut(); continue }
    return { ok: true, role: prof.role }
  }
  return { ok: false, error: lastErr }
}
export function signInKasir(branchId, password) {
  return signInExpectRole(kasirEmail(branchId), password, 'kasir', branchId)
}
export function signInSupplier(password) {
  return signInExpectRole(roleEmail('supplier'), password, 'supplier', null)
}

// Dipanggil dari fungsi clear-session terpusat → semua tombol "Keluar" ikut.
// No-op di mode local (atau bila client tak ada).
export function signOutSupabase() {
  if (isSupabase() && supabase) supabase.auth.signOut().catch(() => {})
}
