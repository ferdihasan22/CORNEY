import { useState } from 'react'
import { uploadImage, cloudinaryReady } from '../lib/cloudinary.js'

// CORNEY — Tombol upload gambar ke Cloudinary (unsigned, TAHAP 4 FASE 7).
// value = URL saat ini; onChange(url) dipanggil setelah upload sukses.
// Auto-SEMBUNYI bila Cloudinary belum dikonfigurasi (VITE_CLOUDINARY_CLOUD kosong)
// → input URL manual yang sudah ada tetap berfungsi sebagai fallback.
export default function ImageUploadButton({ value, onChange, label = 'Upload Foto' }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!cloudinaryReady()) return null

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(''); setBusy(true)
    try {
      const url = await uploadImage(file)
      onChange(url)
    } catch (x) {
      setErr(x?.message || 'Upload gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className="w-12 h-12 rounded-lg object-cover border border-outline-variant" /> : null}
        <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-on-primary text-[13px] font-bold cursor-pointer active:scale-95 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
          <span className="material-symbols-outlined !text-[18px]">{busy ? 'hourglass_top' : 'photo_camera'}</span>
          {busy ? 'Mengunggah…' : label}
          <input type="file" accept="image/*" onChange={pick} disabled={busy} className="hidden" />
        </label>
      </div>
      {err && <p className="text-[12px] text-error">{err}</p>}
    </div>
  )
}
