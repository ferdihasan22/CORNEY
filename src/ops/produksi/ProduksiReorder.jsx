import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INGREDIENTS } from '../../data/menu.js'
import { useMaterials } from '../../store/useMaterials.js'
import { setThreshold, markReordered } from '../../store/materials.js'

// 2.5 — PRD-03 Reorder Bahan Mentah. Ported from Stitch "raw_material_reorder_produksi_mobile".
// Order ~3 days before run-out (threshold-based). Buy-path separate from branch
// shopping requests. Below threshold = urgent; near = warning.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const statusOf = (m) => {
  if (m.sisa < m.threshold) return { key: 'urgent', label: 'Perlu dipesan', bar: 'bg-error', border: 'border-error', text: 'text-error' }
  if (m.sisa < Math.round(m.threshold * 1.3)) return { key: 'warn', label: 'Mendekati ambang', bar: 'bg-amber-500', border: 'border-amber-400', text: 'text-amber-600' }
  return { key: 'safe', label: 'Aman', bar: 'bg-green-500', border: 'border-green-200', text: 'text-green-600' }
}

export default function ProduksiReorder() {
  const navigate = useNavigate()
  const mats = useMaterials() || {}
  const [edits, setEdits] = useState({})

  const rows = INGREDIENTS.map((i) => ({ ...i, ...(mats[i.id] || { sisa: 0, threshold: 0, reorderedAt: null }) }))
  const urgent = rows.filter((r) => r.sisa < r.threshold && !r.reorderedAt)

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <style>{`@keyframes pulse-red {0%,100%{opacity:1}50%{opacity:.55}}`}</style>
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/produksi')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="inventory" /> Reorder Bahan Mentah</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Produksi</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-3">
        {urgent.length > 0 && (
          <div className="bg-error text-on-error rounded-xl px-4 py-3 flex items-center gap-2" style={{ animation: 'pulse-red 2s ease-in-out infinite' }}>
            <Icon name="warning" fill className="shrink-0" />
            <p className="font-label-md"><strong>{urgent.length} bahan perlu dipesan:</strong> {urgent.map((u) => u.name).join(', ')}</p>
          </div>
        )}

        {rows.map((m) => {
          const st = statusOf(m)
          const pct = m.threshold > 0 ? Math.round((m.sisa / m.threshold) * 100) : 100
          const thr = edits[m.id] != null ? edits[m.id] : m.threshold
          return (
            <div key={m.id} className={`bg-surface-container-lowest rounded-2xl p-4 border-l-4 ${st.border} border-y border-r border-outline-variant/30 shadow-[0_4px_16px_rgba(26,26,26,0.06)]`}>
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2"><Icon name={m.icon} className="text-on-surface-variant" /><div><h3 className="font-headline-md text-headline-md leading-tight">{m.name}</h3><p className="text-[11px] text-on-surface-variant">{m.sub}</p></div></div>
                <div className="text-right"><p className={`font-headline-md ${st.key === 'urgent' ? 'text-error' : 'text-on-surface'}`}>{m.sisa} <span className="text-label-md text-on-surface-variant">{m.unit}</span></p><p className="text-[11px] text-on-surface-variant">ambang {m.threshold} {m.unit}</p></div>
              </div>
              <div className="h-2.5 bg-surface-container rounded-full overflow-hidden my-2"><div className={`h-full ${st.bar} rounded-full`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-bold ${st.text}`} style={st.key === 'urgent' ? { animation: 'pulse-red 2s ease-in-out infinite' } : undefined}>{st.label} · {pct}%</span>
                <div className="flex items-center gap-2">
                  <input inputMode="numeric" value={thr} onChange={(e) => setEdits((s) => ({ ...s, [m.id]: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) }))} onBlur={() => edits[m.id] != null && setThreshold(m.id, edits[m.id])} className="w-20 h-9 px-2 text-center rounded-lg border border-outline focus:border-primary outline-none text-label-md bg-surface" title="Ambang reorder" />
                  {m.reorderedAt ? (
                    <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1"><Icon name="check" className="!text-[16px]" /> Sudah dipesan</span>
                  ) : (
                    <button onClick={() => markReordered(m.id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold ${st.key === 'safe' ? 'bg-surface-variant text-on-surface-variant' : 'bg-primary text-on-primary'}`}>Tandai dipesan</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <p className="text-[12px] text-on-surface-variant/70 text-center pt-2 flex items-center justify-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Jalur beli bahan produksi terpisah dari Request Belanja cabang.</p>
      </main>
    </div>
  )
}
