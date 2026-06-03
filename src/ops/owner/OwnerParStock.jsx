import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS } from '../../data/menu.js'
import { useParStock } from '../../store/useParStock.js'
import { setPar, parOf } from '../../store/parstock.js'
import { latestSisaByBranch } from '../../store/aggregate.js'
import { useStockDaily } from '../../store/useStockDaily.js'

// Owner — Atur Stok Standar (par) per CABANG × per ISIAN. Angka ini dipakai
// Operasional: Kirim = Stok Standar − Sisa Aktual (Master Laporan).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OwnerParStock() {
  const navigate = useNavigate()
  useParStock() // subscribe → re-render saat angka diubah
  useStockDaily() // untuk tampilkan sisa terkini sebagai konteks

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Atur Stok Standar</h1>
      </header>

      <main className="flex-1 w-full p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-2 text-blue-900">
          <Icon name="info" className="shrink-0" />
          <p className="text-label-md leading-snug"><b>Stok Standar</b> = jumlah stok yang harus ada tiap pagi siap jual, per cabang. Operasional pakai ini untuk mengirim: <b>Kirim = Stok Standar − Sisa Aktual</b>. Ubah angkanya, tersimpan otomatis.</p>
        </div>

        {BRANCHES.map((b) => {
          const par = parOf(b.id)
          const sisa = latestSisaByBranch(b.id)
          return (
            <section key={b.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] overflow-hidden">
              <div className="px-4 py-3 bg-surface-container-low font-headline-md text-headline-md flex items-center gap-2"><Icon name="storefront" className="text-primary !text-[20px]" /> {b.name.replace('CORNEY ', '')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                {PARENT_FILLINGS.map((p) => {
                  const val = par[p.id] || 0
                  const s = sisa ? (sisa[p.id] ?? null) : null
                  return (
                    <div key={p.id} className="border border-outline-variant/40 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-label-lg">{p.name}</span>
                        {s != null && <span className="text-[11px] text-on-surface-variant">sisa kini: <b>{s}</b></span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPar(b.id, p.id, val - 1)} className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center active:scale-90 shrink-0"><Icon name="remove" /></button>
                        <input inputMode="numeric" value={val ? val.toLocaleString('id-ID') : ''} onChange={(e) => setPar(b.id, p.id, Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="0" className="flex-1 h-11 text-center rounded-xl border border-outline focus:border-primary outline-none font-headline-md bg-surface" />
                        <button onClick={() => setPar(b.id, p.id, val + 1)} className="w-11 h-11 rounded-xl bg-primary-container text-white flex items-center justify-center active:scale-90 shrink-0"><Icon name="add" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
        <p className="text-[12px] text-on-surface-variant/70 flex items-center gap-1.5"><Icon name="info" className="!text-[16px]" /> "Sisa kini" diambil dari closing terakhir di Master Laporan, hanya sebagai gambaran saat kamu menyetel angka.</p>
      </main>
    </div>
  )
}
