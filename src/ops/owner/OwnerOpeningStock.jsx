import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS } from '../../data/menu.js'
import { useFreezer } from '../../store/useFreezer.js'
import { setFreezerLevel } from '../../store/freezer.js'

// OWN — Stok Awal (Go-Live). Untuk usaha yang sudah berjalan: isi jumlah FISIK isian
// yang ADA SEKARANG di freezer rumah (per cabang), sebagai titik mulai. Stok di
// kulkas tiap cabang TIDAK di sini — dihitung kasir saat Buka Toko hari pertama.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const short = (n) => (n || '').replace('CORNEY ', '')
const onlyNum = (v) => Math.max(0, Number(String(v).replace(/\D/g, '')) || 0)

export default function OwnerOpeningStock() {
  const navigate = useNavigate()
  const freezer = useFreezer() || {}

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-teal-700 text-white px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner/mulai-bersih')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="inventory" fill /> Stok Awal</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-5">
        <section className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-[13px] text-teal-900 leading-relaxed">
          <p className="font-bold flex items-center gap-2"><Icon name="info" fill /> Foto keadaan SEKARANG</p>
          <p className="mt-1">Hitung fisik yang benar-benar ada hari ini, lalu ketik di bawah. Angka tersimpan otomatis. Stok di <b>kulkas cabang</b> tidak diisi di sini — dihitung kasir saat <b>Buka Toko hari pertama</b>.</p>
        </section>

        {/* Freezer rumah per cabang */}
        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="ac_unit" className="text-primary" /> Freezer Rumah (isian)</h2>
          {BRANCHES.map((b) => {
            const bf = freezer[b.id] || {}
            return (
              <div key={b.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40">
                <p className="font-bold text-primary mb-2 flex items-center gap-1.5"><Icon name="storefront" className="!text-[18px]" /> {short(b.name)}</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {PARENT_FILLINGS.map((p) => {
                    const f = bf[p.id] || { sisa: 0, min: 0 }
                    return (
                      <div key={p.id} className="bg-surface-container rounded-xl p-2.5">
                        <p className="text-[12px] font-bold mb-1">{p.name}</p>
                        <div className="flex gap-1.5">
                          <label className="flex-1">
                            <span className="text-[10px] text-on-surface-variant">Stok awal (pcs)</span>
                            <input inputMode="numeric" value={f.sisa || ''} placeholder="0" onChange={(e) => setFreezerLevel(b.id, p.id, { sisa: onlyNum(e.target.value) })} className="w-full h-10 text-center rounded-lg border border-outline focus:border-primary outline-none font-bold bg-surface" />
                          </label>
                          <label className="w-16">
                            <span className="text-[10px] text-on-surface-variant">Min</span>
                            <input inputMode="numeric" value={f.min || ''} placeholder="0" onChange={(e) => setFreezerLevel(b.id, p.id, { min: onlyNum(e.target.value) })} className="w-full h-10 text-center rounded-lg border border-outline focus:border-primary outline-none bg-surface" />
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>

        <button onClick={() => navigate('/ops/owner/mulai-bersih')} className="w-full h-12 rounded-2xl bg-primary text-on-primary font-bold flex items-center justify-center gap-2 active:scale-[0.98]"><Icon name="check" /> Selesai — kembali ke checklist</button>
        <p className="text-[12px] text-on-surface-variant/80 text-center flex items-center justify-center gap-1.5"><Icon name="lightbulb" className="!text-[15px]" /> Tersimpan otomatis. Bisa diubah kapan saja lewat layar Freezer.</p>
      </main>
    </div>
  )
}
