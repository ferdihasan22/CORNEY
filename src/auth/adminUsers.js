// CORNEY — Klien untuk Edge Function `admin-users` (TAHAP 4, FASE 2).
//
// Dipakai layar Owner (Manajemen User, Kelola Cabang) untuk mengelola akun staf
// di Supabase Auth. `supabase.functions.invoke` otomatis menyertakan JWT sesi
// owner di Authorization → Edge memverifikasi pemanggil adalah owner.
//
// HANYA relevan saat VITE_BACKEND=supabase. Di mode local, layar tetap memakai
// kredensial localStorage seperti biasa.

import { supabase } from '../lib/supabase.js'
import { roleEmail, kasirEmail } from './supabaseAuth.js'

export { roleEmail, kasirEmail }

// Aturan server Supabase Auth: panjang password minimal 6.
export const MIN_PASSWORD = 6

async function invokeAdmin(body) {
  if (!supabase) return { ok: false, error: 'Supabase belum siap.' }
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // Non-2xx → coba baca pesan {error} dari body respons fungsi.
    let msg = error.message || 'Gagal memanggil server.'
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* abaikan */ }
    return { ok: false, error: msg }
  }
  if (data?.error) return { ok: false, error: data.error }
  return { ok: true, data }
}

export function adminResetPasswordRole(role, password) {
  return invokeAdmin({ action: 'reset_password', email: roleEmail(role), password })
}
export function adminResetPasswordKasir(branchId, password) {
  return invokeAdmin({ action: 'reset_password', email: kasirEmail(branchId), password })
}
export function adminSetActiveRole(role, active) {
  return invokeAdmin({ action: 'set_active', email: roleEmail(role), active })
}
export function adminListUsers() {
  return invokeAdmin({ action: 'list' })
}
