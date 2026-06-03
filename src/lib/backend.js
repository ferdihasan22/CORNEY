// Saklar backend global untuk migrasi TAHAP 4 (lihat docs/TAHAP4-SUPABASE.md §5).
//   'local'    -> semua store pakai localStorage (perilaku Fase 1/2, DEFAULT aman)
//   'supabase' -> store yang SUDAH dimigrasi baca/tulis ke Supabase
// Dibaca dari env VITE_BACKEND; default 'local' bila kosong.
//
// Dipakai tiap store-adapter untuk memilih implementasi tanpa mengubah komponen
// (antarmuka get/subscribe/commit tetap sama). Migrasi bisa di-rollback dengan
// mengganti flag ini → localStorage tetap jadi jaring pengaman tiap fase.
export const BACKEND = (import.meta.env.VITE_BACKEND || 'local').toLowerCase()

export const isSupabase = () => BACKEND === 'supabase'
export const isLocal = () => !isSupabase()
