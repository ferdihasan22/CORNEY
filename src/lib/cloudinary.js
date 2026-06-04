// CORNEY — Upload gambar ke Cloudinary via UNSIGNED upload preset (TAHAP 4 FASE 7).
// API Secret TIDAK di browser — preset unsigned membatasi folder/format/ukuran.
// Env: VITE_CLOUDINARY_CLOUD (nama cloud akunmu), VITE_CLOUDINARY_PRESET (=corney_unsigned).
import { supabase } from './supabase.js'
import { isSupabase } from './backend.js'
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

// Ekstrak public_id dari secure_url Cloudinary (untuk hapus). Format:
// .../upload/[transformasi/]v<versi>/<public_id>.<ext>
export function publicIdFromUrl(url) {
  try {
    const m = String(url).match(/\/upload\/(?:.*\/)?v\d+\/(.+)\.[a-zA-Z0-9]+$/)
    if (m) return m[1]
    const m2 = String(url).match(/\/upload\/(?:.*\/)?([^/]+)\.[a-zA-Z0-9]+$/)
    return m2 ? m2[1] : null
  } catch { return null }
}

// Hapus gambar LAMA di Cloudinary (anti-sampah) saat diganti — lewat Edge Function
// (server, pakai API Secret). HANYA untuk URL Cloudinary akun ini + mode supabase.
// URL manual (bukan Cloudinary) TIDAK disentuh. Gagal → diam (gambar lama jadi
// orphan, tak fatal; biasanya karena Edge secret Cloudinary belum di-set).
export async function deleteImageByUrl(oldUrl) {
  if (!oldUrl || !isSupabase() || !supabase) return
  if (!String(oldUrl).includes('res.cloudinary.com')) return
  const publicId = publicIdFromUrl(oldUrl)
  if (!publicId) return
  try {
    await supabase.functions.invoke('cloudinary-delete', { body: { publicId } })
  } catch (e) { console.warn('[cloudinary] hapus gambar lama gagal:', e?.message || e) }
}
