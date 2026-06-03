import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS } from '../../data/menu.js'
import { useFreezer } from '../../store/useFreezer.js'
import { setFreezerLevel } from '../../store/freezer.js'
import { useFreezerCorrections } from '../../store/useFreezerCorrections.js'
import { createFreezerCorrection } from '../../store/freezerCorrections.js'

// 2.5 — PRD-02 Stok Freezer per Cabang. Hanya MIN (tanpa target). Produksi atur
// Min langsung; SISA hanya bisa diubah lewat pengajuan koreksi → persetujuan Owner.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const nameOf = (p) => PARENT_FILLINGS.find((x) => x.id === p)?.name || p

function statusOf(f) {
  if (f.sisa < f.min) return { label: 'Di bawah minimum — isi ulang', bar: 'bg-error', text: 'text-error', pulse: true }
  if (f.sisa < Math.round(f.min * 1.3)) return { label: 'Mendekati minimum', bar: 'bg-amber-500', text: 'text-amber-600', pulse: false }
  return { label: 'Aman', bar: 'bg-green-500', text: 'text-green-600', pulse: false }
}

export default function ProduksiFreezer() {
  const navigate = useNavigate()
  const freezer = useFreezer() || {}
  const corrections = useFreezerCorrections() || []
  const [edit, setEdit] = useState(null) // { branchId, parent, current, minVal, proposed, reason }
  const [toast, setToast] = useState('')

  const pendingOf = (branchId, parent) => corrections.find((c) => c.status === 'pending' && c.branchId === branchId && c.parent === parent)

  const alerts = []
  BRANCHES.forEach((b) => PARENT_FILLINGS.forEach((p) => { const f = (freezer[b.id] || {})[p.id]; if (f && f.sisa < f.min) alerts.push(`${b.name.replace('CORNEY ', '')} ${p.name}`) }))

  const openEdit = (branchId, parent) => { const f = (freezer[branchId] || {})[parent] || { sisa: 0, min: 0 }; setEdit({ branchId, parent, current: f.sisa, minVal: String(f.min), proposed: String(f.sisa), reason: '' }) }
  const num = (v) => Math.max(0, Number(String(v).replace(/\D/g, '')) || 0)
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }
  const saveMin = () => { setFreezerLevel(edit.branchId, edit.parent, { min: num(edit.minVal) }); flash('Minimum disimpan.'); setEdit(null) }
  const ajukan = () => {
    const b = BRANCHES.find((x) => x.id === edit.branchId)
    createFreezerCorrection({ branchId: edit.branchId, branchName: b?.name, parent: edit.parent, parentName: nameOf(edit.parent), current: edit.current, proposed: num(edit.proposed), reason: edit.reason })
    flash('Koreksi sisa diajukan ke Owner.'); setEdit(null)
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <style>{`@keyframes pulse-red {0%,100%{opacity:1}50%{opacity:.55}}`}</style>
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/produksi')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="ac_unit" /> Stok Freezer per Cabang</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Produksi</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        {alerts.length > 0 && (
          <div className="bg-error text-on-error rounded-xl px-4 py-3 flex items-center gap-2" style={{ animation: 'pulse-red 2s ease-in-out infinite' }}>
            <Icon name="warning" fill className="shrink-0" />
            <p className="font-label-md leading-snug"><strong>{alerts.length} perlu diisi ulang:</strong> {alerts.join(', ')}</p>
          </div>
        )}

        {BRANCHES.map((b) => {
          const branchF = freezer[b.id] || {}
          const branchAlert = PARENT_FILLINGS.some((p) => { const f = branchF[p.id]; return f && f.sisa < f.min })
          return (
            <div key={b.id} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="storefront" className="!text-[18px] text-primary" /> {b.name}</h2>
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${branchAlert ? 'bg-error-container text-on-error-container' : 'bg-green-100 text-green-700'}`}>{branchAlert ? 'Butuh Re-stock' : 'Semua Aman'}</span>
              </div>
              <div className="space-y-4">
                {PARENT_FILLINGS.map((p) => {
                  const f = branchF[p.id] || { sisa: 0, min: 0 }
                  const st = statusOf(f)
                  const base = f.min > 0 ? f.min * 2 : Math.max(1, f.sisa)
                  const pct = Math.min(100, Math.round((f.sisa / base) * 100))
                  const minPct = f.min > 0 ? 50 : 0
                  const pend = pendingOf(b.id, p.id)
                  return (
                    <div key={p.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-label-lg flex items-center gap-2">{p.name}
                          <button onClick={() => openEdit(b.id, p.id)} className="text-on-surface-variant hover:text-primary"><Icon name="edit" className="!text-[16px]" /></button>
                          {pend && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">koreksi menunggu</span>}
                        </span>
                        <span className={`font-headline-md ${f.sisa < f.min ? 'text-error' : 'text-on-surface'}`}>{f.sisa} <span className="text-label-md text-on-surface-variant">pcs</span></span>
                      </div>
                      <div className="relative h-3 bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full ${st.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        {minPct > 0 && <div className="absolute top-0 bottom-0 w-0.5 bg-error/70" style={{ left: `${minPct}%` }} title="Min" />}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className={`text-[11px] font-bold ${st.text}`} style={st.pulse ? { animation: 'pulse-red 2s ease-in-out infinite' } : undefined}>{st.label}</span>
                        <span className="text-[11px] text-on-surface-variant">Min {f.min}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <p className="text-[12px] text-on-surface-variant/70 text-center pt-2 flex items-center justify-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Produksi atur <b>Minimum</b> langsung. Sisa berubah otomatis (produksi +, kirim −); koreksi manual sisa <b>perlu persetujuan Owner</b>.</p>
      </main>

      {edit && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-blur-overlay p-4" onClick={() => setEdit(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl">
            <h2 className="font-headline-md text-headline-md">{nameOf(edit.parent)}</h2>
            <p className="text-label-md text-on-surface-variant mb-4">{BRANCHES.find((b) => b.id === edit.branchId)?.name} · sisa sekarang <b className="text-on-surface">{edit.current}</b></p>

            {/* Min — langsung */}
            <label className="text-[11px] font-bold text-on-surface-variant uppercase">Minimum (alarm)</label>
            <div className="flex gap-2 mt-1">
              <input inputMode="numeric" value={edit.minVal} onChange={(e) => setEdit((s) => ({ ...s, minVal: e.target.value.replace(/\D/g, '') }))} className="flex-1 h-12 text-center rounded-xl border border-outline focus:border-primary outline-none font-headline-md bg-surface-container-lowest min-w-0" />
              <button onClick={saveMin} className="px-4 rounded-xl bg-primary text-on-primary font-label-lg active:scale-95">Simpan Min</button>
            </div>

            {/* Sisa — perlu approval */}
            <div className="mt-5 pt-4 border-t border-outline-variant">
              <p className="text-[11px] font-bold text-on-surface-variant uppercase flex items-center gap-1"><Icon name="lock" className="!text-[14px]" /> Koreksi Sisa (perlu persetujuan Owner)</p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div><label className="text-[10px] text-on-surface-variant">Sisa baru</label><input inputMode="numeric" value={edit.proposed} onChange={(e) => setEdit((s) => ({ ...s, proposed: e.target.value.replace(/\D/g, '') }))} className="w-full h-11 text-center rounded-xl border border-amber-300 focus:border-primary outline-none font-bold bg-surface-container-lowest min-w-0" /></div>
                <div><label className="text-[10px] text-on-surface-variant">Alasan</label><input value={edit.reason} onChange={(e) => setEdit((s) => ({ ...s, reason: e.target.value }))} placeholder="opname, rusak, dll." className="w-full h-11 px-3 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest min-w-0" /></div>
              </div>
              <button onClick={ajukan} className="w-full mt-2 h-11 rounded-xl border-2 border-amber-400 text-amber-700 font-bold active:scale-95 flex items-center justify-center gap-1.5"><Icon name="send" className="!text-[18px]" /> Ajukan Koreksi ke Owner</button>
            </div>

            <button onClick={() => setEdit(null)} className="w-full mt-4 h-11 rounded-xl text-on-surface-variant font-label-lg">Tutup</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-on-surface text-surface px-5 py-3 rounded-full shadow-xl flex items-center gap-2 font-label-lg whitespace-nowrap">
          <Icon name="check_circle" fill className="!text-[20px] text-green-400" /> {toast}
        </div>
      )}
    </div>
  )
}
