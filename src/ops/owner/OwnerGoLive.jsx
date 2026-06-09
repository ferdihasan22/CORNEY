import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resetGoLive } from '../../store/reset.js'

// OWN — Mulai Bersih (Onboarding Go-Live). Untuk usaha yang sudah berjalan sebelum
// app dibuat: hapus semua data contoh agar laporan mulai dari nol, lalu pandu owner
// mengisi data awal nyata. Bukan reset bulanan (itu di Laporan Stok).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const STEPS = [
  { n: 1, icon: 'storefront', label: 'Data cabang nyata', desc: 'Nama, alamat, nomor WA, link Google Maps, jam tutup, modal laci (kembalian).', to: '/ops/owner/cabang' },
  { n: 2, icon: 'badge', label: 'Akun staff per cabang', desc: 'Buat akun kasir, operasional, produksi, auditor. Ganti user contoh.', to: '/ops/owner/users' },
  { n: 3, icon: 'inventory_2', label: 'Stok Standar (par) tiap isian', desc: 'Jumlah ideal mozza/sosis/jumbo/mix tiap pagi. Dipakai untuk hitung kiriman.', to: '/ops/owner/stok-standar' },
  { n: 4, icon: 'ac_unit', label: 'Stok Awal freezer rumah', desc: 'Hitung fisik isian di freezer rumah sekarang (per cabang) + set Min alarm. Stok kulkas cabang dihitung kasir saat Buka Toko.', to: '/ops/owner/stok-awal' },
  { n: 5, icon: 'sell', label: 'Harga belanja (Supplier)', desc: 'Supplier isi harga tiap item via "Atur Harga". Tanpa ini total belanja = Rp0.', to: '/supplier/harga' },
  { n: 6, icon: 'science', label: 'Takaran porsi bahan', desc: 'Berapa gram/pcs bahan per porsi (glaze, kentang, saus) → deteksi boros bahan.', to: '/ops/owner/analisa-bahan' },
  { n: 7, icon: 'paid', label: 'Biaya tetap & % Bagi Hasil investor', desc: 'Sewa, gaji bulanan, value, persentase investor per cabang (sekarang tersimpan).', to: '/ops/owner/bagihasil' },
]

export default function OwnerGoLive() {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-teal-700 text-white px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="rocket_launch" fill /> Mulai Bersih (Go-Live)</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-5">
        <section className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
          <p className="font-bold text-amber-900 flex items-center gap-2"><Icon name="info" fill /> Untuk usaha yang sudah jalan sebelum app ini</p>
          <p className="text-[13px] text-amber-900/90 mt-1 leading-relaxed">App ini awalnya berisi <b>data contoh</b> (penjualan, stok, belanja Juni 2026). Sebelum dipakai sungguhan, <b>hapus dulu</b> semua data contoh itu agar laporan tidak campur angka palsu — lalu isi data nyata di 8 langkah di bawah.</p>
        </section>

        {/* Langkah 1: hapus data contoh */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 border-2 border-error/30">
          <p className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="mop" className="text-error" /> Langkah 1 — Hapus Data Contoh</p>
          <p className="text-[13px] text-on-surface-variant mt-1 leading-relaxed"><b>Dihapus:</b> penjualan, stok harian, uang belanja, pemakaian uang, setoran, produksi, kiriman, opname, koreksi & audit stok, pesanan online, permintaan/pengiriman supplier, jejak audit, kunci bulan, freezer, stok standar (par), dan <b>SEMUA CABANG beserta akun kasir-nya</b> (kamu tambah cabang manual satu per satu setelah ini). <b>Tetap aman:</b> menu & varian, saus, promo, banner, gambar landing, item belanja, takaran bahan, dan akun <b>Owner/Operasional/Produksi/Auditor/Supplier</b>.</p>
          {!confirm ? (
            <button onClick={() => setConfirm(true)} className="w-full mt-3 h-12 rounded-xl bg-error text-on-error font-bold flex items-center justify-center gap-2 active:scale-[0.98]"><Icon name="delete_sweep" /> Hapus Semua Data Contoh</button>
          ) : (
            <div className="mt-3 bg-error-container/30 border border-error/40 rounded-xl p-3 space-y-2">
              <p className="text-[13px] font-bold text-error">Yakin? Tindakan ini <b>tidak bisa dibatalkan</b> & menghapus seluruh riwayat transaksi (termasuk kunci bulan). Ketik <b>MULAI BERSIH</b> untuk konfirmasi.</p>
              <input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder="Ketik MULAI BERSIH" className="w-full h-11 px-3 rounded-lg border border-error/50 focus:border-error outline-none font-bold text-center bg-surface" />
              <div className="flex gap-2">
                <button onClick={() => { setConfirm(false); setTyped('') }} className="flex-1 h-11 rounded-xl border border-outline text-on-surface-variant font-bold">Batal</button>
                <button onClick={resetGoLive} disabled={typed !== 'MULAI BERSIH'} className="flex-1 h-11 rounded-xl bg-error text-on-error font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"><Icon name="check" /> Hapus & Mulai</button>
              </div>
            </div>
          )}
        </section>

        {/* Langkah 2: isi data awal */}
        <section className="space-y-2">
          <p className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="checklist" className="text-primary" /> Langkah 2 — Isi Data Awal</p>
          <p className="text-[13px] text-on-surface-variant -mt-1">Buka tiap layar, isi data nyata. Urut dari atas.</p>
          {STEPS.map((s) => (
            <button key={s.n} onClick={() => navigate(s.to)} className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest hover:border-primary active:scale-[0.99] text-left transition-all">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">{s.n}</div>
              <Icon name={s.icon} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">{s.label}</p>
                <p className="text-[12px] text-on-surface-variant leading-snug">{s.desc}</p>
              </div>
              <Icon name="chevron_right" className="text-on-surface-variant/50 shrink-0" />
            </button>
          ))}
        </section>

        <section className="bg-surface-container-low rounded-2xl p-4 text-[12px] text-on-surface-variant flex items-start gap-2">
          <Icon name="key" className="!text-[16px] mt-0.5 shrink-0" />
          <p><b>Catatan teknis:</b> untuk QRIS online sungguhan, kunci Midtrans harus diisi di server (.env.local) — di luar app ini. Tanpa itu, pembayaran online jatuh ke mode percobaan.</p>
        </section>

        <section className="bg-green-50 border border-green-200 rounded-2xl p-4 text-[12px] text-green-900 flex items-start gap-2">
          <Icon name="tips_and_updates" fill className="!text-[16px] mt-0.5 shrink-0 text-green-600" />
          <p><b>Stok kemarin (carryover):</b> setelah data contoh dihapus, hari pertama kasir Buka Toko akan mode "hari pertama" — kasir tinggal <b>menghitung sisa fisik</b> isi kulkas saat itu. Tidak perlu diisi di sini.</p>
        </section>
      </main>
    </div>
  )
}
