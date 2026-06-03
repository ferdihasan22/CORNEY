import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS } from '../../data/menu.js'
import { useFreezer } from '../../store/useFreezer.js'
import { useFreezerCorrections } from '../../store/useFreezerCorrections.js'
import { resolveFreezerCorrection } from '../../store/freezerCorrections.js'

// OWN — Persetujuan Koreksi Sisa Freezer (diajukan Produksi). Owner setuju →
// sisa freezer diubah; tolak → tidak berubah. Pemisahan tugas: yang pegang
// barang tak bisa ubah angka sendiri.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

const freezerStatus = (f) => {
  if (f.sisa < f.min) return { lbl: 'Di bawah min', cls: 'bg-error-container text-error', row: 'bg-error-container/30' }
  if (f.sisa < Math.round(f.min * 1.3)) return { lbl: 'Mendekati', cls: 'bg-amber-100 text-amber-700', row: '' }
  return { lbl: 'Aman', cls: 'bg-green-100 text-green-700', row: '' }
}

export default function OwnerFreezerApproval() {
  const navigate = useNavigate()
  const list = useFreezerCorrections() || []
  const freezer = useFreezer() || {}
  const pending = list.filter((c) => c.status === 'pending')
  const resolved = list.filter((c) => c.status !== 'pending').slice(0, 12)
  // Baris stok freezer aktual (cabang × isian).
  const stokRows = []
  BRANCHES.forEach((b) => PARENT_FILLINGS.forEach((p) => { const f = (freezer[b.id] || {})[p.id] || { sisa: 0, min: 0 }; stokRows.push({ branch: b.name.replace('CORNEY ', ''), isian: p.name, ...f }) }))
  const belowMin = stokRows.filter((r) => r.sisa < r.min).length

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="ac_unit" /> Koreksi Sisa Freezer</h1>
        {pending.length > 0 && <span className="ml-auto bg-secondary-container text-on-secondary-container px-3 py-0.5 rounded-full font-label-md text-label-md">{pending.length} menunggu</span>}
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Stok freezer aktual + status aman/tidak */}
        <section className="space-y-2">
          <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="ac_unit" className="text-primary" /> Stok Freezer Saat Ini</h2>
          <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2 ${belowMin > 0 ? 'bg-error-container text-error' : 'bg-green-100 text-green-800'}`}>
            <Icon name={belowMin > 0 ? 'warning' : 'verified'} fill className="!text-[18px] shrink-0" />
            <p className="font-label-md">{belowMin > 0 ? `${belowMin} isian di bawah minimum — perlu diproduksi / isi ulang.` : 'Semua stok freezer aman.'}</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            <table className="text-[12px] border-collapse min-w-max">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th rowSpan={2} className="px-3 py-2 text-left border-r border-white/30 sticky left-0 bg-primary z-10">Isian</th>
                  {BRANCHES.map((b) => <th key={b.id} colSpan={3} className="px-3 py-2 text-center border-r border-white/30 whitespace-nowrap">{b.name.replace('CORNEY ', '')}</th>)}
                </tr>
                <tr className="bg-primary text-on-primary/90 text-[10px] uppercase">
                  {BRANCHES.map((b) => (
                    <Fragment key={b.id}>
                      <th className="px-2 py-1 text-right">Sisa</th>
                      <th className="px-2 py-1 text-right">Min</th>
                      <th className="px-2 py-1 text-center border-r border-white/30">Status</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PARENT_FILLINGS.map((p, i) => {
                  const stripe = i % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'
                  return (
                    <tr key={p.id} className={i % 2 ? 'bg-surface-container-low' : ''}>
                      <td className={`px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/30 sticky left-0 z-10 ${stripe}`}>{p.name}</td>
                      {BRANCHES.map((b) => {
                        const f = (freezer[b.id] || {})[p.id] || { sisa: 0, min: 0 }
                        const st = freezerStatus(f)
                        return (
                          <Fragment key={b.id}>
                            <td className={`px-2 py-2 text-right tabular-nums font-bold border-r border-outline-variant/15 ${f.sisa < f.min ? 'text-error' : ''}`}>{f.sisa}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant border-r border-outline-variant/15">{f.min}</td>
                            <td className="px-2 py-2 text-center border-r border-outline-variant/30"><span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${st.cls}`}>{st.lbl}</span></td>
                          </Fragment>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="bg-secondary-fixed text-on-secondary-fixed p-4 rounded-2xl flex gap-3 items-start">
          <Icon name="security" fill className="text-secondary !text-2xl shrink-0" />
          <p className="text-label-md leading-relaxed">Produksi mengajukan, <b>Owner yang menyetujui</b> — agar yang memegang stok tidak bisa mengubah angka sisa sendiri.</p>
        </div>

        <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="pending_actions" className="text-primary" /> Menunggu</h2>
        {pending.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-8 text-center text-on-surface-variant"><Icon name="task_alt" className="!text-5xl opacity-30" /><p className="mt-2">Tidak ada koreksi menunggu.</p></div>
        ) : pending.map((c) => {
          const delta = c.proposed - c.current
          return (
            <div key={c.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-headline-md text-headline-md">{c.parentName}</h3>
                  <p className="text-label-md text-on-surface-variant">{(c.branchName || '').replace('CORNEY ', '')} · {fmtTime(c.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display-md text-display-md leading-none">{c.current} <span className="text-on-surface-variant/50">→</span> {c.proposed}</p>
                  <p className={`font-bold ${delta >= 0 ? 'text-green-600' : 'text-error'}`}>({delta > 0 ? '+' : ''}{delta})</p>
                </div>
              </div>
              <div className="bg-surface-container rounded-lg p-2.5 mt-3 text-label-md"><Icon name="notes" className="!text-[16px] align-middle" /> Alasan: <i>{c.reason || '(tanpa alasan)'}</i></div>
              <div className="flex gap-3 mt-3">
                <button onClick={() => resolveFreezerCorrection(c.id, true)} className="flex-1 min-h-[48px] bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95"><Icon name="check_circle" fill /> Setujui</button>
                <button onClick={() => resolveFreezerCorrection(c.id, false)} className="flex-1 min-h-[48px] border-2 border-primary text-primary rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95"><Icon name="cancel" /> Tolak</button>
              </div>
            </div>
          )
        })}

        {/* Tabel detail semua koreksi (gaya Master Laporan) */}
        <section className="space-y-2 pt-2">
          <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="table_chart" className="text-primary" /> Rincian Koreksi</h2>
          <p className="text-label-md text-on-surface-variant -mt-1">Semua pengajuan. Kolom <b>Selisih</b> menyala bila stok fisik berbeda dari sistem.</p>
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            <table className="w-full text-[12px] border-collapse min-w-max">
              <thead><tr className="bg-primary text-on-primary">
                <th className="px-3 py-2 text-left border-r border-white/20">Waktu</th>
                <th className="px-3 py-2 text-left border-r border-white/20">Cabang</th>
                <th className="px-3 py-2 text-left border-r border-white/20">Isian</th>
                <th className="px-3 py-2 text-right border-r border-white/20">Sistem</th>
                <th className="px-3 py-2 text-right border-r border-white/20">Diajukan</th>
                <th className="px-3 py-2 text-center border-r border-white/20">Selisih</th>
                <th className="px-3 py-2 text-left border-r border-white/20">Alasan</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr></thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={8} className="px-3 py-5 text-center text-on-surface-variant">Belum ada koreksi.</td></tr>}
                {list.map((c, i) => {
                  const sel = c.proposed - c.current
                  const selCls = sel < 0 ? 'text-error bg-error-container font-bold' : sel > 0 ? 'text-amber-700 bg-amber-50 font-bold' : 'text-on-surface-variant'
                  const stBadge = c.status === 'pending' ? 'bg-secondary-container text-on-secondary-container' : c.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  const stLbl = c.status === 'pending' ? 'Menunggu' : c.status === 'approved' ? 'Disetujui' : 'Ditolak'
                  return (
                    <tr key={c.id} className={i % 2 ? 'bg-surface-container-low' : ''}>
                      <td className="px-3 py-2 whitespace-nowrap border-r border-outline-variant/30">{fmtTime(c.createdAt)}</td>
                      <td className="px-3 py-2 text-primary font-bold whitespace-nowrap border-r border-outline-variant/30">{(c.branchName || '').replace('CORNEY ', '')}</td>
                      <td className="px-3 py-2 border-r border-outline-variant/30">{c.parentName}</td>
                      <td className="px-3 py-2 text-right tabular-nums border-r border-outline-variant/30">{c.current}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold border-r border-outline-variant/30">{c.proposed}</td>
                      <td className={`px-3 py-2 text-center tabular-nums border-r border-outline-variant/30 ${selCls}`}>{sel === 0 ? '0' : `${sel > 0 ? '+' : ''}${sel}`}</td>
                      <td className="px-3 py-2 border-r border-outline-variant/30 max-w-[160px] truncate" title={c.reason}>{c.reason || '—'}</td>
                      <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${stBadge}`}>{stLbl}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-on-surface-variant/70 flex items-start gap-1.5"><Icon name="info" className="!text-[15px] shrink-0 mt-0.5" /> <span><b className="text-error">Merah</b> = fisik kurang dari sistem (mungkin terambil/hilang). <b className="text-amber-700">Kuning</b> = fisik lebih. Setujui/tolak di kartu atas.</span></p>
        </section>
      </main>
    </div>
  )
}
