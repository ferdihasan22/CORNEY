import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS } from '../../data/menu.js'
import { useFreezer } from '../../store/useFreezer.js'
import { takeFreezer } from '../../store/freezer.js'

// 2.5 — PRD-04 (sisi Operasional) Pengambilan Freezer. Operasional self-inputs
// "ambil X" with NO per-take confirmation; sisa decreases instantly. Safety net =
// periodic opname by Produksi. Mobile-first; no decorative nav.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OperasionalAmbil() {
  const navigate = useNavigate()
  const freezer = useFreezer() || {}
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const [qty, setQty] = useState({})
  const [toast, setToast] = useState('')

  const branchF = freezer[branchId] || {}
  const setQ = (p, v) => setQty((m) => ({ ...m, [p]: Math.max(0, Number(String(v).replace(/\D/g, '')) || 0) }))
  const ambil = (p, name) => {
    const n = qty[p] || 0
    if (n <= 0) return
    takeFreezer(branchId, p, n)
    setQty((m) => ({ ...m, [p]: 0 }))
    setToast(`Ambil ${n} ${name}`)
    setTimeout(() => setToast(''), 2000)
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/operasional')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="ac_unit" /> Ambil Stok Freezer</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Operasional</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3 h-12 font-label-lg outline-none">
          {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900"><Icon name="info" className="!text-[18px] shrink-0 mt-0.5" /><p className="text-label-md leading-snug">Pengambilan langsung mengurangi sisa freezer (tanpa konfirmasi). Opname Produksi sebagai jaring pengaman.</p></div>

        {PARENT_FILLINGS.map((p) => {
          const f = branchF[p.id] || { sisa: 0, min: 0 }
          const low = f.sisa < f.min
          return (
            <div key={p.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center gap-3">
              <div className="flex-1">
                <h3 className="font-headline-md text-headline-md">{p.name}</h3>
                <p className={`text-label-md ${low ? 'text-error font-bold' : 'text-on-surface-variant'}`}>Sisa {f.sisa} pcs{low ? ' · di bawah min' : ''}</p>
              </div>
              <input inputMode="numeric" value={qty[p.id] || ''} onChange={(e) => setQ(p.id, e.target.value)} placeholder="0" className="w-20 h-12 text-center rounded-xl border border-outline focus:border-primary outline-none font-headline-md bg-surface" />
              <button onClick={() => ambil(p.id, p.name)} disabled={!(qty[p.id] > 0)} className="h-12 px-4 rounded-xl bg-primary text-on-primary font-bold active:scale-95 disabled:opacity-40">Ambil</button>
            </div>
          )
        })}
      </main>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-on-surface text-surface px-5 py-3 rounded-full shadow-xl flex items-center gap-2 font-label-lg whitespace-nowrap"><Icon name="check_circle" fill className="!text-[20px] text-green-400" /> {toast}</div>}
    </div>
  )
}
