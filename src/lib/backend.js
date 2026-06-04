// Saklar backend global (TAHAP 4 selesai → DEFAULT 'supabase' = online).
//   'supabase' -> baca/tulis ke Supabase (DEFAULT — produksi online penuh)
//   'local'    -> localStorage saja (hanya bila SENGAJA set VITE_BACKEND=local)
// Dibaca dari env VITE_BACKEND; kosong = 'supabase'. Jadi produksi (Cloudflare)
// otomatis online tanpa perlu set env apa pun.
export const BACKEND = (import.meta.env.VITE_BACKEND || 'supabase').toLowerCase()

export const isSupabase = () => BACKEND === 'supabase'
export const isLocal = () => !isSupabase()
