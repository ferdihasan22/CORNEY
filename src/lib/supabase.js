import { createClient } from '@supabase/supabase-js'

// Client Supabase tunggal untuk browser.
//
// URL + ANON key AMAN di sini karena SEMUA tabel dilindungi RLS
// (lihat docs/TAHAP4-SUPABASE.md & ingatan corney-supabase-security).
// Kunci rahasia — service_role & Midtrans Server Key — TIDAK PERNAH ada di
// browser; hanya di Supabase Edge Function. Jangan pernah meng-import kunci
// rahasia ke modul ini.
//
// Client hanya dibuat bila env terisi. Kalau kosong (mode 'local' murni tanpa
// project), export `null` supaya import tidak meledak selama backend masih
// localStorage.
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && anon)
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

if (!supabase && import.meta.env.DEV) {
  console.info('[supabase] VITE_SUPABASE_URL/ANON_KEY kosong → client tidak dibuat (mode local).')
}
