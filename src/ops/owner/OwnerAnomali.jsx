import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS, INGREDIENTS, fmtRp } from '../../data/menu.js'
import { useDeposits } from '../../store/useDeposits.js'
import { useFreezer } from '../../store/useFreezer.js'
import { useOpname } from '../../store/useOpname.js'
import { useAudits } from '../../store/useAudits.js'
import { auditDelta } from '../../store/audits.js'
import { useMaterials } from '../../store/useMaterials.js'
import { useStockDaily } from '../../store/useStockDaily.js'
import { stockHilang } from '../../store/stockdaily.js'

// 3.3 — OWN-07 Laporan Anomali Terpusat. Ported from Stitch "laporan_anomali_corney_pos".
// ALL anomalies in one view, grouped by severity, each with branch/who/value +
// a NEUTRAL suggested clarifying question (suggestion only — no auto-send).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const branch = (id) => BRANCHES.find((b) => b.id === id)
const branchName = (id) => branch(id)?.name?.replace('CORNEY ', '') || id
const parentName = (id) => PARENT_FILLINGS.find((p) => p.id === id)?.name || id
const matName = (id) => INGREDIENTS.find((i) => i.id === id)?.name || id
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const GROUPS = {
  tindakan: { label: 'Perlu Tindakan', dot: 'bg-error', badge: 'bg-error-container text-on-error-container' },
  selidiki: { label: 'Perlu Diselidiki', dot: 'bg-amber-500', badge: 'bg-secondary-container text-on-secondary-container' },
  info: { label: 'Info', dot: 'bg-on-surface-variant', badge: 'bg-surface-container-highest text-on-surface-variant' },
}

export default function OwnerAnomali() {
  const navigate = useNavigate()
  const deposits = useDeposits() || []
  const freezer = useFreezer() || {}
  const opnames = useOpname() || []
  const audits = useAudits() || []
  const materials = useMaterials() || {}
  useStockDaily() // subscribe: anomali ikut update saat Owner koreksi Laporan Stok

  const items = []
  // Stok hilang dari Laporan Stok (SATU SUMBER KEBENARAN) — selisih > 0.
  stockHilang().forEach((h) => items.push({ sev: 'selidiki', type: `Stok hilang: ${h.parentLabel}`, branchId: h.branchId, who: 'Kasir', value: `${h.qty} porsi`, cash: 0, q: `Cek rekonsiliasi stok closing ${h.tgl} & Laporan Stok cabang ini.` }))
  deposits.filter((d) => d.status === 'selisih').forEach((d) => items.push({ sev: 'tindakan', type: 'Selisih Kas (Operasional)', branchId: d.branchId, who: 'Kasir/Operasional', value: `${d.selisih > 0 ? '+' : ''}${fmtRp(d.selisih)}`, cash: Math.abs(d.selisih), q: 'Tanya ke: kasir & operasional cabang — apa ada uang urgent belum dicatat?' }))
  deposits.filter((d) => d.auditorStatus === 'selisih').forEach((d) => items.push({ sev: 'tindakan', type: 'Selisih Kas (Auditor)', branchId: d.branchId, who: 'Operasional', value: `${d.auditorSelisih > 0 ? '+' : ''}${fmtRp(d.auditorSelisih)}`, cash: Math.abs(d.auditorSelisih), q: 'Tanya ke: operasional — selisih muncul antara serah-terima ke auditor.' }))
  opnames.filter((o) => o.totalSelisih !== 0).forEach((o) => items.push({ sev: 'selidiki', type: 'Stok freezer tidak sinkron', branchId: o.branchId, who: 'Operasional/Produksi', value: `${o.totalSelisih} pcs`, cash: 0, q: 'Cek data: log pengambilan freezer oleh operasional.' }))
  audits.filter((a) => !a.allCocok).forEach((a) => { const d = auditDelta(a); items.push({ sev: 'selidiki', type: `Audit lapangan beda${d.dadakan ? ' (dadakan)' : ''}`, branchId: a.branchId, who: 'Operasional', value: d.text || 'fisik ≠ sistem', cash: 0, q: d.catatan ? `Catatan operasional: “${d.catatan}”. Cek rekonsiliasi stok cabang.` : d.dadakan ? 'Audit saat kasir jualan — fisik < sistem bisa berarti penjualan tak tercatat. Tanya kasir baik-baik.' : 'Cek: rekonsiliasi stok closing kasir hari itu.', detail: d.beda }) })
  BRANCHES.forEach((b) => PARENT_FILLINGS.forEach((p) => { const f = (freezer[b.id] || {})[p.id]; if (f && f.sisa < f.min) items.push({ sev: 'info', type: `Freezer di bawah min: ${parentName(p.id)}`, branchId: b.id, who: 'Produksi', value: `sisa ${f.sisa}/${f.min}`, cash: 0, q: 'Saran: jadwalkan isi ulang freezer cabang ini.' }) }))
  Object.entries(materials).forEach(([id, m]) => { if (m.sisa < m.threshold && !m.reorderedAt) items.push({ sev: 'info', type: `Bahan perlu dipesan: ${matName(id)}`, branchId: '', who: 'Produksi', value: `sisa ${m.sisa}/${m.threshold}`, cash: 0, q: 'Saran: reorder bahan sebelum kehabisan.' }) })

  const affected = new Set(items.map((i) => i.branchId).filter(Boolean)).size
  const totalCash = items.reduce((s, i) => s + (i.cash || 0), 0)
  const order = ['tindakan', 'selidiki', 'info']

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Laporan Anomali</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-5">
        {/* Summary bento */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 text-center"><p className="text-[11px] text-on-surface-variant">Total Anomali</p><p className="font-display-md text-on-surface">{items.length}</p></div>
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 text-center"><p className="text-[11px] text-on-surface-variant">Cabang Terdampak</p><p className="font-display-md text-on-surface">{affected}</p></div>
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 text-center"><p className="text-[11px] text-on-surface-variant">Nilai Selisih</p><p className="font-headline-md text-error mt-1">{fmtRp(totalCash)}</p></div>
        </div>

        {items.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant"><Icon name="verified" className="!text-6xl opacity-30 text-green-500" /><p className="mt-3 font-headline-md">Tidak ada anomali 🎉</p><p className="text-sm opacity-70">Semua data tersinkron.</p></div>
        ) : order.map((sev) => {
          const group = items.filter((i) => i.sev === sev)
          if (group.length === 0) return null
          const g = GROUPS[sev]
          return (
            <section key={sev} className="space-y-2">
              <h2 className="font-headline-md text-headline-md flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${g.dot}`} /> {g.label} <span className="text-on-surface-variant font-normal">({group.length})</span></h2>
              {group.map((it, idx) => {
                const b = branch(it.branchId)
                return (
                  <div key={idx} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)]">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h3 className="font-label-lg leading-tight">{it.type}</h3>
                        <p className="text-label-md text-on-surface-variant">{it.branchId ? branchName(it.branchId) : 'Pusat'} · {it.who}</p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${g.badge}`}>{it.value}</span>
                    </div>
                    {it.detail?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {it.detail.map((l, i) => (
                          <div key={i} className="flex items-center justify-between text-[12px] bg-surface-container rounded-lg px-2.5 py-1.5">
                            <span className="font-bold">{l.name}</span>
                            <span className="text-on-surface-variant">sistem {l.sys} → fisik {l.riil} <span className={l.selisih < 0 ? 'text-error font-bold' : 'text-amber-700 font-bold'}>({l.selisih > 0 ? '+' : ''}{l.selisih})</span></span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 bg-surface-container-low rounded-lg p-2.5 flex items-start gap-2"><Icon name="lightbulb" className="text-secondary !text-[18px] shrink-0 mt-0.5" /><p className="text-[12px] text-on-surface-variant leading-snug">{it.q}</p></div>
                    {b?.wa && (
                      <a href={`https://wa.me/${b.wa}?text=${encodeURIComponent(`Halo ${b.name}, mau klarifikasi: ${it.type} (${it.value}).`)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-primary font-label-md"><Icon name="chat" className="!text-[16px]" /> Hubungi Cabang</a>
                    )}
                  </div>
                )
              })}
            </section>
          )
        })}
        {/* Jejak audit lapangan yang COCOK — bukti operasional turun ke lapangan */}
        {audits.filter((a) => a.allCocok).length > 0 && (
          <section className="space-y-2">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="verified" fill className="text-green-600" /> Audit Lapangan Terverifikasi <span className="text-on-surface-variant font-normal">({audits.filter((a) => a.allCocok).length})</span></h2>
            {audits.filter((a) => a.allCocok).slice(0, 8).map((a) => { const d = auditDelta(a); return (
              <div key={a.id} className="bg-green-50 border border-green-200 rounded-2xl p-3.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0"><Icon name="check" fill /></div>
                <div className="min-w-0">
                  <p className="font-label-lg text-green-900 leading-tight">{branchName(a.branchId)}{d.dadakan ? ' · dadakan' : ''} — semua isian cocok</p>
                  <p className="text-label-md text-green-800/80">{fmtTime(a.createdAt)} · operasional cek fisik, sesuai sistem</p>
                  {d.catatan && <p className="text-[12px] text-green-800/80 italic mt-0.5">“{d.catatan}”</p>}
                </div>
              </div>
            ) })}
          </section>
        )}
        <p className="text-[11px] text-on-surface-variant/70 text-center leading-relaxed">Pertanyaan klarifikasi bersifat <strong>saran netral</strong> — tidak terkirim otomatis. Anomali ≠ tuduhan.</p>
      </main>
    </div>
  )
}
