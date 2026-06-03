import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useDay } from '../../store/useDay.js'
import { PHASE, finishReminder } from '../../store/day.js'

// OPN-04 — Reminder wajib baca. 6 kotak penting. Tidak bisa ditutup manual;
// otomatis lanjut ke jualan setelah 2 menit (ada hitung mundur).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const CARDS = [
  { icon: 'policy', title: 'Semua Kecurangan Terlacak', body: 'Aplikasi ini berbasis data, AI, dan terhubung ke semua laporan. Segala kecurangan — membawa pulang glaze, minyak, kentang, atau stok — bisa dilacak. Membawa stok sendiri dari rumah pun langsung terdeteksi.', hd: 'bg-error-container', ic: 'text-error', bd: 'border-error/40' },
  { icon: 'ac_unit', title: 'Susun Stok dengan Benar', body: 'Setelah menerima stok, taruh stok yang BARU datang di paling bawah freezer dan bungkus/lapisi plastik. Naikkan stok lama ke atas stok baru. Ini mencegah stok tidak beku dan patah.', hd: 'bg-blue-100', ic: 'text-blue-600', bd: 'border-blue-300' },
  { icon: 'warning', title: 'Jangan Sampai Patah / Hilang', body: 'Pilih stok yang benar-benar beku dulu. Saat membuat corndog jangan sampai patah. Jika patah atau hilang, itu sepenuhnya tanggung jawab kasir dan kebijakan pengurangan gaji berlaku.', hl: 'pengurangan gaji berlaku', hd: 'bg-amber-100', ic: 'text-amber-700', bd: 'border-amber-300' },
  { icon: 'lunch_dining', title: 'Bentuk Corndog', body: 'Perhatikan kematangan dan bentuknya: corndog memanjang, tidak gemuk, dan tidak terlalu besar. Pastikan adonan tidak terlalu tebal.', hd: 'bg-green-100', ic: 'text-green-700', bd: 'border-green-300' },
  { icon: 'restaurant', title: 'Ketebalan Adonan', body: 'Adonan yang terlalu tebal berisiko bagian dalam tidak matang dan lama matangnya. Pakai adonan secukupnya saja.', hd: 'bg-teal-100', ic: 'text-teal-700', bd: 'border-teal-300' },
  { icon: 'volunteer_activism', title: 'Berdoa Sebelum Bekerja', body: 'Berdoalah sebelum mulai bekerja. Semoga semua dilancarkan dan kebaikan selalu datang kepada kita. 🤲', hd: 'bg-purple-100', ic: 'text-purple-700', bd: 'border-purple-300' },
]

export default function OpeningReminder() {
  const navigate = useNavigate()
  const day = useDay()
  const [left, setLeft] = useState(120) // detik

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (left <= 0) { finishReminder(); navigate('/ops/kasir', { replace: true }) }
  }, [left, navigate])

  if (!day) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase !== PHASE.REMINDER) return <Navigate to="/ops/kasir" replace />

  // Render body dgn frasa penting (hl) jadi merah-tebal.
  const renderBody = (c) => {
    if (!c.hl || !c.body.includes(c.hl)) return c.body
    const [before, after] = c.body.split(c.hl)
    return <>{before}<span className="text-error font-bold">{c.hl}</span>{after}</>
  }

  const mm = String(Math.max(0, Math.floor(left / 60))).padStart(2, '0')
  const ss = String(Math.max(0, left % 60)).padStart(2, '0')
  const pct = Math.max(0, Math.min(100, (left / 120) * 100))

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      {/* Header + hitung mundur (sticky, tidak ada tombol tutup) */}
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 py-4 shadow-md">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-label-md opacity-90 uppercase tracking-wider">Langkah 4 dari 4 · Wajib dibaca</p>
              <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2 mt-1"><Icon name="campaign" fill /> Pengingat Kasir</h1>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display-md text-display-md leading-none tabular-nums">{mm}:{ss}</p>
              <p className="text-[11px] opacity-90">otomatis lanjut</p>
            </div>
          </div>
          <div className="h-1.5 bg-white/25 rounded-full mt-3 overflow-hidden"><div className="h-full bg-white rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} /></div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-3">
        <div className="bg-surface-container-low border border-outline-variant/40 rounded-xl p-3 flex items-start gap-2 text-on-surface-variant">
          <Icon name="lock_clock" className="!text-[18px] shrink-0 mt-0.5 text-primary" />
          <p className="text-label-md leading-snug">Halaman ini <b>tidak bisa ditutup manual</b>. Bacalah baik-baik — akan tertutup sendiri & jualan terbuka otomatis dalam <b>{mm}:{ss}</b>.</p>
        </div>

        {CARDS.map((c, i) => (
          <div key={i} className={`bg-surface-container-lowest rounded-2xl border-2 ${c.bd} shadow-[0_4px_16px_rgba(26,26,26,0.06)] overflow-hidden`}>
            <div className={`${c.hd} px-4 py-2.5 flex items-center gap-2.5`}>
              <div className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center shrink-0"><Icon name={c.icon} fill className={`!text-[22px] ${c.ic}`} /></div>
              <span className="font-bold text-[11px] uppercase text-on-surface-variant">No. {i + 1}</span>
              <h3 className="font-headline-md text-headline-md leading-tight flex-1">{c.title}</h3>
            </div>
            <p className="p-4 font-body-md text-body-md text-on-surface leading-relaxed">{renderBody(c)}</p>
          </div>
        ))}

        <p className="text-center text-label-md text-on-surface-variant py-4">Tunggu hitung mundur selesai untuk mulai jualan… <b>{mm}:{ss}</b></p>
      </main>
    </div>
  )
}
