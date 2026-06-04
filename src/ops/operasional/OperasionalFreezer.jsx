import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS } from '../../data/menu.js'
import { useFreezer } from '../../store/useFreezer.js'

// OPS — Stok Freezer (LIHAT). Tabel stok freezer per cabang (sisa + status), SAMA
// seperti yang dilihat Produksi/Owner, tapi READ-ONLY: operasional hanya melihat,
// tak bisa edit min / ajukan koreksi (itu hak Produksi/Owner). Sumber: tabel freezer
// (RLS sudah izinkan operasional baca).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
function statusOf(f) {
  if (f.sisa < f.min) return { label: 'Di bawah minimum — perlu isi ulang', bar: 'bg-error', text: 'text-error', pulse: true }
  if (f.sisa < Math.round(f.min * 1.3)) return { label: 'Mendekati minimum', bar: 'bg-amber-500', text: 'text-amber-600', pulse: false }
  return { label: 'Aman', bar: 'bg-green-500', text: 'text-green-600', pulse: false }
}

export default function OperasionalFreezer() {
  const navigate = useNavigate()
  const freezer = useFreezer() || {}

  const alerts = []
  BRANCHES.forEach((b) => PARENT_FILLINGS.forEach((p) => { const f = (freezer[b.id] || {})[p.id]; if (f && f.sisa < f.min) alerts.push(`${b.name.replace('CORNEY ', '')} ${p.name}`) }))

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <style>{`@keyframes pulse-red {0%,100%{opacity:1}50%{opacity:.55}}`}</style>
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/operasional')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="ac_unit" /> Stok Freezer per Cabang</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Operasional · hanya lihat</p>
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
                  return (
                    <div key={p.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-label-lg">{p.name}</span>
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

        <p className="text-[12px] text-on-surface-variant/70 text-center pt-2 flex items-center justify-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Tampilan <b>hanya lihat</b>. Atur Minimum & koreksi sisa dilakukan di <b>Produksi</b> (disetujui Owner). Untuk mengambil stok, pakai menu <b>Ambil Stok Freezer</b>.</p>
      </main>
    </div>
  )
}
