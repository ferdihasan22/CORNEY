// Util kecil bersama TAHAP 4.

// Konversi tanggal: store pakai 'DD/MM/YYYY', tabel Postgres pakai 'YYYY-MM-DD' (date).
export const ddToISO = (s) => { const [d, m, y] = (s || '').split('/'); return y ? `${y}-${m}-${d}` : null }
export const isoToDD = (s) => { const [y, m, d] = (s || '').split('-'); return d ? `${d}/${m}/${y}` : '' }

// UUID v4 untuk id baris di mode supabase (tabel id uuid). Math.random OK di runtime app.
export function genUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
