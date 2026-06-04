// Util kecil bersama TAHAP 4.

// Konversi tanggal: store pakai 'DD/MM/YYYY', tabel Postgres pakai 'YYYY-MM-DD' (date).
export const ddToISO = (s) => { const [d, m, y] = (s || '').split('/'); return y ? `${y}-${m}-${d}` : null }
export const isoToDD = (s) => { const [y, m, d] = (s || '').split('-'); return d ? `${d}/${m}/${y}` : '' }

// Debounce: tunda panggilan fn sampai berhenti dipanggil selama ms. Dipakai untuk
// menggabung (coalesce) tindakan beruntun (hydrate realtime, flush outbox) → hemat
// read/write TANPA mengubah hasil (data tetap benar, cuma lebih jarang dipanggil).
export function debounce(fn, ms = 500) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

// UUID v4 untuk id baris di mode supabase (tabel id uuid). Math.random OK di runtime app.
export function genUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
