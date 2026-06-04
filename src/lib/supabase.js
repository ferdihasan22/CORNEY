import { createClient } from '@supabase/supabase-js'

// Client Supabase tunggal untuk browser.
//
// URL + ANON key AMAN di sini karena SEMUA tabel dilindungi RLS
// (lihat docs/TAHAP4-SUPABASE.md & ingatan corney-supabase-security).
// Kunci rahasia — service_role & Midtrans Server Key — TIDAK PERNAH ada di
// browser; hanya di Supabase Edge Function. Jangan pernah meng-import kunci
// rahasia ke modul ini.
//
// URL + anon key ditanam sebagai DEFAULT (publik, aman karena RLS aktif) supaya
// produksi online tanpa perlu set env Cloudflare. Env VITE_* tetap bisa menimpa
// (mis. ganti project). Client SELALU dibuat → app online by default.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://cajjvmnenxypcolriesf.supabase.co'
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhamp2bW5lbnh5cGNvbHJpZXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODQwMTYsImV4cCI6MjA5NjA2MDAxNn0.9RRmAtRqknWB1LR3vRmvXd4PHzY_XKW9jIRoXk0H2MA'

export const supabase = (url && anon)
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

if (!supabase && import.meta.env.DEV) {
  console.info('[supabase] VITE_SUPABASE_URL/ANON_KEY kosong → client tidak dibuat (mode local).')
}
