import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS, INGREDIENTS, fmtRp } from '../../data/menu.js'
import { useDeposits } from '../../store/useDeposits.js'
import { useFreezer } from '../../store/useFreezer.js'
import { useMaterials } from '../../store/useMaterials.js'
import { useAudits } from '../../store/useAudits.js'
import { auditDelta } from '../../store/audits.js'
import { useOpname } from '../../store/useOpname.js'
import { useSupplier } from '../../store/useSupplier.js'

// 2.6 — OWN-04 Notifikasi & Peringatan. Ported from Stitch "notifications_alerts_corney_owner".
// Aggregates LIVE signals from the stores (deposit selisih, freezer below-min,
// material reorder, audit/opname discrepancy) + filter chips. Read state is local.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const SEV = {
  urgent: { border: 'border-error', badge: 'bg-error text-on-error', label: 'Urgent' },
  warn: { border: 'border-amber-400', badge: 'bg-amber-100 text-amber-700', label: 'Perhatian' },
  good: { border: 'border-green-500', badge: 'bg-green-100 text-green-700', label: 'Info' },
}
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name || id || ''
const parentName = (id) => PARENT_FILLINGS.find((p) => p.id === id)?.name || id
const matName = (id) => INGREDIENTS.find((i) => i.id === id)?.name || id
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

const FILTERS = ['Semua', 'Stok', 'Kas', 'Mencurigakan', 'Target']

export default function OwnerNotifications() {
  const navigate = useNavigate()
  const deposits = useDeposits() || []
  const freezer = useFreezer() || {}
  const materials = useMaterials() || {}
  const audits = useAudits() || []
  const opnames = useOpname() || []
  const supplier = useSupplier()
  const [filter, setFilter] = useState('Semua')
  const [read, setRead] = useState(false)

  const notifs = []
  // Kas — selisih setoran leg Kasir→Operasional
  deposits.filter((d) => d.status === 'selisih').forEach((d) => notifs.push({ id: d.id, cat: 'Kas', sev: 'urgent', icon: 'payments', title: `Selisih setoran (Kasir→Operasional) — ${d.branchName}`, desc: `Operasional terima ${fmtRp(d.opsAmount)} vs kasir ${fmtRp(d.kasirAmount)} (${d.selisih > 0 ? '+' : ''}${fmtRp(d.selisih)})`, time: fmtTime(d.confirmedAt) }))
  // Kas — selisih verifikasi leg Operasional→Auditor
  deposits.filter((d) => d.auditorStatus === 'selisih').forEach((d) => notifs.push({ id: d.id + '-aud', cat: 'Kas', sev: 'urgent', icon: 'fact_check', title: `Selisih audit (Operasional→Auditor) — ${d.branchName}`, desc: `Auditor hitung ${fmtRp(d.auditorAmount)} vs operasional ${fmtRp(d.opsAmount)} (${d.auditorSelisih > 0 ? '+' : ''}${fmtRp(d.auditorSelisih)})`, time: fmtTime(d.auditedAt) }))
  // Stok — freezer below min
  BRANCHES.forEach((b) => PARENT_FILLINGS.forEach((p) => { const f = (freezer[b.id] || {})[p.id]; if (f && f.sisa < f.min) notifs.push({ id: `frz-${b.id}-${p.id}`, cat: 'Stok', sev: 'warn', icon: 'ac_unit', title: `Stok freezer menipis: ${parentName(p.id)}`, desc: `Sisa ${f.sisa} pcs di ${branchName(b.id)} (min ${f.min}). Segera isi ulang.`, time: '' }) }))
  // Stok — material reorder
  Object.entries(materials).forEach(([id, m]) => { if (m.sisa < m.threshold && !m.reorderedAt) notifs.push({ id: `mat-${id}`, cat: 'Stok', sev: 'urgent', icon: 'inventory', title: `Bahan perlu dipesan: ${matName(id)}`, desc: `Sisa ${m.sisa} di bawah ambang ${m.threshold}. Reorder sebelum habis.`, time: '' }) })
  // Mencurigakan — audit lapangan beda (detail isian + mode dadakan + catatan)
  audits.filter((a) => !a.allCocok).slice(0, 5).forEach((a) => { const d = auditDelta(a); notifs.push({ id: a.id, cat: 'Mencurigakan', sev: 'urgent', icon: 'fact_check', title: `Audit beda — ${a.branchName}${d.dadakan ? ' · DADAKAN' : ''}`, desc: `${d.text || 'cek fisik ≠ sistem'}${d.catatan ? ` — “${d.catatan}”` : ''}`, time: fmtTime(a.createdAt) }) })
  // Mencurigakan — jejak audit COCOK (bukti operasional turun ke lapangan)
  audits.filter((a) => a.allCocok).slice(0, 5).forEach((a) => { const d = auditDelta(a); notifs.push({ id: a.id, cat: 'Mencurigakan', sev: 'good', icon: 'verified', title: `Audit cocok — ${a.branchName}${d.dadakan ? ' · DADAKAN' : ''}`, desc: `Operasional cek fisik, semua isian sesuai sistem.${d.catatan ? ` “${d.catatan}”` : ''}`, time: fmtTime(a.createdAt) }) })
  // Mencurigakan — opname selisih
  opnames.filter((o) => o.totalSelisih !== 0).slice(0, 5).forEach((o) => notifs.push({ id: o.id, cat: 'Mencurigakan', sev: 'warn', icon: 'inventory_2', title: `Selisih opname freezer — ${o.branchName}`, desc: `Total selisih ${o.totalSelisih} pcs. Kemungkinan pengambilan tak tercatat.`, time: fmtTime(o.createdAt) }))
  // Stok — supplier one-way signals (price up + out of stock)
  ;(supplier?.catalog || []).forEach((it) => {
    if (it.price > it.prevPrice) notifs.push({ id: `sup-up-${it.id}`, cat: 'Stok', sev: 'warn', icon: 'trending_up', title: `Harga supplier naik: ${it.name}`, desc: `${fmtRp(it.prevPrice)} → ${fmtRp(it.price)} per ${it.unit}. Pertimbangkan ulang HPP.`, time: it.lastPriceAt })
    if (!it.available) notifs.push({ id: `sup-out-${it.id}`, cat: 'Stok', sev: 'info', icon: 'inventory', title: `Supplier kosong: ${it.name}`, desc: 'Item ini sedang tidak tersedia di supplier — tidak otomatis masuk pesanan berikutnya.', time: '' })
  })
  // Target — sample achievement (positive)
  notifs.push({ id: 'tgt-1', cat: 'Target', sev: 'good', icon: 'celebration', title: 'Target omzet harian tercapai 🎉', desc: `${branchName('sepinggan')} melampaui target hari ini.`, time: '14:20' })

  const shown = filter === 'Semua' ? notifs : notifs.filter((n) => n.cat === filter)
  const urgentCount = notifs.filter((n) => n.sev === 'urgent').length

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <h1 className="font-headline-md text-headline-md">Notifikasi & Peringatan</h1>
        </div>
        <button onClick={() => setRead(true)} className="text-label-md underline underline-offset-4 opacity-90">Tandai dibaca</button>
      </header>

      <div className="sticky top-[64px] z-30 bg-background px-4 py-3 border-b border-outline-variant/30 flex gap-2 overflow-x-auto hide-scrollbar">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap px-4 py-1.5 rounded-full font-label-md transition-all ${filter === f ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant'}`}>{f}</button>
        ))}
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-3">
        {!read && urgentCount > 0 && <p className="text-label-md text-on-surface-variant px-1">{urgentCount} peringatan butuh perhatian.</p>}
        {shown.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant"><Icon name="notifications_off" className="!text-5xl opacity-30" /><p className="mt-2">Tidak ada notifikasi di kategori ini.</p></div>
        ) : (
          shown.map((n) => {
            const sv = SEV[n.sev]
            return (
              <div key={n.id} className={`bg-surface-container-lowest rounded-xl p-4 border-l-4 ${sv.border} border-y border-r border-outline-variant/30 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex gap-3 ${read ? 'opacity-70' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0"><Icon name={n.icon} className="text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-label-lg leading-tight">{n.title}</h3>
                    {n.time && <span className="text-[11px] text-on-surface-variant shrink-0">{n.time}</span>}
                  </div>
                  <p className="text-label-md text-on-surface-variant mt-0.5 leading-snug">{n.desc}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sv.badge}`}>{n.cat}</span>
                </div>
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
