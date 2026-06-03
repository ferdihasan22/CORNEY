import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES } from '../../data/menu.js'
import { useAuditLog } from '../../store/useAuditLog.js'

// 3.2 — AUD-04 Jejak Audit (Audit Log). Ported from Stitch "audit_log_immutable_trail_mobile".
// APPEND-ONLY: no edit/delete by anyone (incl Owner). Covers refund, correction,
// void, cash handoff. Real immutability (no UPDATE/DELETE grant) in TAHAP 4.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const TYPE = {
  Stok: 'bg-green-100 text-green-700', Refund: 'bg-secondary-container text-on-secondary-container',
  Void: 'bg-error-container text-on-error-container', Settlement: 'bg-blue-100 text-blue-700',
}
const FILTERS = ['Semua', 'Stok', 'Refund', 'Void', 'Settlement']
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name?.replace('CORNEY ', '') || '—'
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return iso } }

export default function AuditorLog() {
  const navigate = useNavigate()
  const log = useAuditLog() || []
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('Semua')

  const shown = log.filter((e) => (filter === 'Semua' || e.type === filter) && (q === '' || `${e.who} ${e.note} ${branchName(e.branchId)} ${e.type}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/auditor')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1"><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="gpp_good" /> Jejak Audit</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider flex items-center gap-1"><Icon name="lock" className="!text-[14px]" /> Immutable</p></div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-3">
        <div className="bg-inverse-surface text-inverse-on-surface rounded-xl p-4 flex items-start gap-3"><Icon name="shield_lock" className="shrink-0" /><div><p className="font-label-lg">Integritas Data Absolut</p><p className="text-[12px] opacity-80 leading-snug">Log ini permanen. Tidak ada tombol edit atau hapus — bahkan untuk Owner.</p></div></div>

        <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari aktivitas, user, atau cabang…" className="w-full pl-10 pr-4 h-11 rounded-xl border border-outline focus:border-primary outline-none bg-surface text-label-md" /></div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap px-4 py-1.5 rounded-full font-label-md transition-all ${filter === f ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant'}`}>{f}</button>)}
        </div>

        <div className="space-y-2">
          {shown.length === 0 ? <p className="text-on-surface-variant italic text-center py-10">Tidak ada entri.</p> : shown.map((e) => (
            <div key={e.id} className="bg-surface-container-lowest rounded-xl p-4 border-l-4 border-primary border-y border-r border-outline-variant/30 shadow-[0_4px_16px_rgba(26,26,26,0.06)]">
              <div className="flex justify-between items-start gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${TYPE[e.type] || 'bg-surface-container text-on-surface-variant'}`}>{e.type}</span>
                <span className="text-[11px] text-on-surface-variant">{fmtTime(e.at)}</span>
              </div>
              <p className="font-label-lg leading-tight">{e.who} <span className="text-on-surface-variant font-normal">· {branchName(e.branchId)}</span></p>
              <div className="my-2 bg-surface-container rounded-lg px-3 py-2 font-mono text-[13px] flex items-center gap-2 flex-wrap"><span className="text-on-surface-variant">{e.oldVal}</span><Icon name="arrow_forward" className="!text-[16px] text-primary" /><span className="font-bold">{e.newVal}</span></div>
              {e.note && <p className="text-[12px] text-on-surface-variant italic">"{e.note}"</p>}
              <p className="text-[10px] font-mono text-on-surface-variant/60 mt-1">{e.hash}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
