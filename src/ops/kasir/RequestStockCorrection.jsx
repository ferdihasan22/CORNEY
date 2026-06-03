import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PARENT_FILLINGS, BRANCHES, OWNER_WA } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, requestCorrection } from '../../store/day.js'

// Step 1A.8 — BHN-06 Ajukan Koreksi Stok. UI ported from Stitch
// "request_stock_correction_corney_pos", stripped of the standalone mobile
// bottom-nav + history icon. Kasir PROPOSES only; Owner approves & executes
// (separation of duties). Submitting never changes stock.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const STATUS = {
  pending: { label: 'Menunggu Owner', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Disetujui', cls: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Ditolak', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
}

export default function RequestStockCorrection() {
  const day = useDay()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)

  const [parentId, setParentId] = useState(PARENT_FILLINGS[0].id)
  const systemQty = day?.stock?.[parentId] ?? 0
  const [physical, setPhysical] = useState(systemQty)
  const [reason, setReason] = useState('')

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />

  const delta = physical - systemQty
  const parentName = (id) => PARENT_FILLINGS.find((p) => p.id === id)?.name ?? id
  const corrections = day.corrections || []

  function pickParent(id) {
    setParentId(id)
    setPhysical(day?.stock?.[id] ?? 0) // reset physical to that item's system stock
  }

  function submit() {
    if (!reason.trim()) return
    requestCorrection({ parentId, physicalQty: physical, reason })
    setReason('')
  }

  function sendWA() {
    const text = `Halo Owner, mohon koreksi stok *${parentName(parentId)}* di ${branch.name}:\nSistem ${systemQty} → fisik ${physical} (${delta >= 0 ? '+' : ''}${delta}).\nAlasan: ${reason.trim() || '-'}`
    window.open(`https://wa.me/${OWNER_WA}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-10">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-primary text-on-primary shadow-md flex items-center gap-4 px-4 h-[64px]">
        <button onClick={() => navigate('/ops/kasir/jualan')} className="active:scale-95 transition-transform flex items-center justify-center w-10 h-10 hover:bg-on-primary/10 rounded-full">
          <Icon name="arrow_back" />
        </button>
        <div className="flex flex-col">
          <h1 className="font-headline-md text-headline-md leading-tight">Ajukan Koreksi Stok</h1>
          <span className="text-xs text-on-primary/80">{branch.name}</span>
        </div>
      </header>

      <main className="mt-20 px-4 max-w-lg mx-auto space-y-6">
        {/* Form */}
        <section className="bg-surface-container-lowest shadow-[0_4px_16px_rgba(26,26,26,0.08)] rounded-xl p-5 border border-outline-variant/30">
          <div className="bg-surface-container-low p-4 rounded-lg mb-6 flex gap-3 items-start border-l-4 border-secondary-container">
            <Icon name="info" className="text-secondary-fixed-dim" />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Kasir hanya <b>mengajukan</b>. Owner yang menyetujui &amp; mengeksekusi dari jauh. Semua tercatat berjejak.
            </p>
          </div>

          <div className="space-y-5">
            {/* Select item */}
            <div className="space-y-2">
              <label className="font-label-md text-on-surface-variant block">Pilih item</label>
              <div className="relative">
                <select
                  value={parentId}
                  onChange={(e) => pickParent(e.target.value)}
                  className="w-full h-min-tap-target px-4 bg-surface border border-outline rounded-xl appearance-none focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  {PARENT_FILLINGS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* System stock */}
            <div className="bg-surface-container-high/50 p-4 rounded-xl flex justify-between items-center">
              <span className="font-label-md text-on-surface-variant">Stok sistem saat ini</span>
              <span className="font-headline-md text-on-surface">{systemQty}</span>
            </div>

            {/* Physical input */}
            <div className="space-y-2">
              <label className="font-label-md text-on-surface-variant block">Stok fisik sebenarnya</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setPhysical((v) => Math.max(0, v - 1))} className="w-min-tap-target h-min-tap-target bg-surface-container border border-outline rounded-xl flex items-center justify-center active:scale-90 transition-all">
                  <Icon name="remove" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={physical}
                  onChange={(e) => setPhysical(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="flex-1 h-min-tap-target text-center font-display-md bg-surface border-2 border-primary rounded-xl focus:outline-none"
                />
                <button onClick={() => setPhysical((v) => v + 1)} className="w-min-tap-target h-min-tap-target bg-surface-container border border-outline rounded-xl flex items-center justify-center active:scale-90 transition-all">
                  <Icon name="add" />
                </button>
              </div>
            </div>

            {/* Delta */}
            <div className="flex items-center justify-center py-2">
              <div className={`font-bold px-6 py-2 rounded-full flex items-center gap-2 ${delta === 0 ? 'bg-surface-container text-on-surface-variant' : 'bg-secondary-container text-on-secondary-container'}`}>
                <Icon name={delta > 0 ? 'trending_up' : delta < 0 ? 'trending_down' : 'remove'} className="text-sm" />
                <span>Koreksi: {systemQty} → {physical} ({delta >= 0 ? '+' : ''}{delta})</span>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="font-label-md text-on-surface-variant block">Alasan koreksi *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows="3"
                placeholder="contoh: salah hitung saat opening"
                className="w-full p-4 bg-surface border border-outline rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none outline-none"
              />
            </div>

            <div className="inline-flex items-center gap-2 bg-tertiary-container/10 text-tertiary px-3 py-2 rounded-lg">
              <Icon name="info" className="text-sm" />
              <span className="text-[10px] leading-tight">Stok boleh minus sebagai sinyal tidak sinkron — bukan diblok.</span>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                onClick={submit}
                disabled={!reason.trim()}
                className="w-full h-min-tap-target bg-primary text-on-primary font-headline-md rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Icon name="send" /> Kirim Pengajuan ke Owner
              </button>
              <button
                onClick={sendWA}
                className="w-full h-min-tap-target bg-transparent border-2 border-[#25D366] text-[#25D366] font-label-lg rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Icon name="chat" /> Kirim WA ke Owner (teks otomatis)
              </button>
              <p className="text-center text-[10px] text-tertiary italic">tinggal tekan kirim</p>
            </div>
          </div>
        </section>

        {/* Waiting list */}
        <section className="space-y-4">
          <h3 className="font-headline-md text-on-surface">Pengajuan Menunggu</h3>
          {corrections.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Belum ada pengajuan.</p>
          ) : (
            <div className="space-y-3">
              {corrections.map((c) => {
                const st = STATUS[c.status] || STATUS.pending
                return (
                  <div key={c.id} className="bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between border border-outline-variant/30 shadow-[0_4px_16px_rgba(26,26,26,0.08)]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-secondary-container/20 rounded-lg flex items-center justify-center">
                        <Icon name="restaurant_menu" className="text-secondary" />
                      </div>
                      <div>
                        <p className="font-label-lg text-on-surface">{parentName(c.parentId)}</p>
                        <p className="text-xs text-on-surface-variant">
                          {c.systemQty} → {c.physicalQty} ({c.delta >= 0 ? '+' : ''}{c.delta}) ·{' '}
                          {new Date(c.ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${st.cls}`}>{st.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
