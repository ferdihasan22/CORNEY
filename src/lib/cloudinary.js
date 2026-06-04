// CORNEY — Upload gambar ke Cloudinary via UNSIGNED upload preset (TAHAP 4 FASE 7).
// API Secret TIDAK di browser — preset unsigned membatasi folder/format/ukuran.
// Env: VITE_CLOUDINARY_CLOUD (nama cloud akunmu), VITE_CLOUDINARY_PRESET (=corney_unsigned).
// Nilai publik ditanam sebagai default (preset unsigned aman di browser) → upload
// gambar jalan di produksi tanpa set env. Env VITE_* tetap bisa menimpa.
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD || 'ddw6hisvn'
const PRESET = import.meta.env.VITE_CLOUDINARY_PRESET || 'corney_unsigned'

export const cloudinaryReady = () => !!(CLOUD && PRESET)

// Unggah satu File → kembalikan secure_url (URL HTTPS gambar). Dipakai mengganti
// input URL manual di OwnerMenus/OwnerBanners (upload dari perangkat).
export async function uploadImage(file) {
  if (!CLOUD || !PRESET) throw new Error('Cloudinary belum dikonfigurasi (VITE_CLOUDINARY_CLOUD/PRESET).')
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', PRESET)
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error('Upload gambar gagal (HTTP ' + r.status + ')')
  const d = await r.json()
  return d.secure_url
}
