import { useState } from 'react'
import { PARENT_FILLINGS } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { recordBreakage } from '../../store/day.js'

// Quick "Catat Patah" — kasir records breakage the moment it happens. Stock
// drops immediately and it's logged; the closing recon prefills patah from this.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>
const pname = (id) => PARENT_FILLINGS.find((p) => p.id === id)?.name ?? id

export default function BreakageModal({ onClose }) {
  const day = useDay()
  const [parentId, setParentId] = useState(PARENT_FILLINGS[0].id)
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')

  const stok = day?.stock?.[parentId] ?? 0
  const log = day?.breakageLog || []
  const max = stok
  const canSave = qty > 0 && qty <= max

  function catat() {
    if (!canSave) return
    recordBreakage(parentId, qty, reason)
    setQty(1)
    setReason('')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-blur-overlay p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-outline-variant flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-on-surface flex items-center gap-2"><Icon name="report" className="text-error" /> Catat Stok Patah</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Patah langsung mengurangi stok & tercatat untuk Owner.</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant text-2xl leading-none px-1">×</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Pilih isian */}
          <div>
            <label className="block text-label-md text-on-surface-variant mb-2">Isian yang patah</label>
            <div className="grid grid-cols-2 gap-2">
              {PARENT_FILLINGS.map((p) => {
                const on = parentId === p.id
                return (
                  <button key={p.id} onClick={() => { setParentId(p.id); setQty(1) }} className={`px-3 py-3 rounded-xl border-2 text-left transition-all ${on ? 'border-primary bg-corney-light' : 'border-outline-variant'}`}>
                    <span className="font-bold text-on-surface block leading-tight">{p.name}</span>
                    <span className="text-xs text-on-surface-variant">stok {day?.stock?.[p.id] ?? 0}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Jumlah patah */}
          <div>
            <label className="block text-label-md text-on-surface-variant mb-2">Jumlah patah (stok sekarang: {stok})</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-12 h-12 rounded-xl border border-outline flex items-center justify-center active:scale-90"><Icon name="remove" /></button>
              <input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(Math.min(max, Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)))} className="flex-1 h-12 text-center font-display-md text-primary border-2 border-primary rounded-xl outline-none" />
              <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} className="w-12 h-12 rounded-xl border border-outline flex items-center justify-center active:scale-90 disabled:opacity-30"><Icon name="add" /></button>
            </div>
            {max === 0 && <p className="text-xs text-error mt-1">Stok 0 — tidak bisa catat patah.</p>}
          </div>

          {/* Alasan opsional */}
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sebab (opsional): mis. gosong / jatuh" className="w-full h-11 px-4 rounded-xl border border-outline focus:ring-2 focus:ring-primary outline-none text-sm" />

          {/* Catatan patah hari ini */}
          {log.length > 0 && (
            <div className="pt-2 border-t border-outline-variant">
              <p className="text-label-md text-on-surface-variant mb-2">Patah hari ini</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {log.map((e) => (
                  <div key={e.id} className="flex justify-between text-sm">
                    <span className="text-on-surface">{e.qty}× {pname(e.parentId)} {e.reason && <span className="text-on-surface-variant">· {e.reason}</span>}</span>
                    <span className="text-on-surface-variant">{new Date(e.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-outline-variant flex gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-3 rounded-lg border border-outline-variant text-on-surface-variant font-semibold">Selesai</button>
          <button onClick={catat} disabled={!canSave} className="flex-1 h-12 bg-error text-on-error rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40">
            <Icon name="report" /> Catat Patah −{qty}
          </button>
        </div>
      </div>
    </div>
  )
}
