import { useNavigate } from 'react-router-dom'
import { clearRoleSession } from '../../auth/roleAuth.js'
import { useFreezer } from '../../store/useFreezer.js'

// 2.5 — CORNEY Ops · Produksi landing (PRD §7.2, upstream P0-critical). Produksi
// makes frozen stock & oversees the central freezer; sees standar/min (not branch
// remainder). Stripped of decorative nav; only built features are tappable.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function ProduksiLanding() {
  const navigate = useNavigate()
  const freezer = useFreezer() || {}
  // Count below-minimum fillings across branches (alert badge).
  let belowMin = 0
  Object.values(freezer).forEach((b) => Object.values(b).forEach((f) => { if (f.sisa < f.min) belowMin++ }))

  const items = [
    { to: '/ops/produksi/produksi', icon: 'factory', label: 'Catat Hasil Produksi', desc: 'Jumlah jadi + susut & alasan per sesi', ready: true },
    { to: '/ops/produksi/freezer', icon: 'ac_unit', label: 'Stok Freezer per Cabang', desc: 'Standar/min per cabang, alarm di bawah minimum', badge: belowMin, ready: true },
    { to: '/ops/produksi/rusak', icon: 'dangerous', label: 'Catat Rusak Freezer', desc: 'Stok freezer rusak (mis. pecah saat dipisah) → sisa langsung berkurang', ready: true },
    { to: '/ops/produksi/opname', icon: 'inventory_2', label: 'Opname Freezer', desc: 'Hitung ulang berkala (tiap isi / mingguan)', ready: true },
  ]

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="bg-primary-container text-on-primary-container px-6 py-7 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display-md text-display-md leading-none">PRODUKSI</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Freezer pusat · CORNEY Ops</p>
          </div>
          <button onClick={() => { clearRoleSession('produksi'); navigate('/ops/produksi/login') }} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95" title="Keluar"><Icon name="logout" /></button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-3">
        {items.map((it) => (
          <button key={it.label} disabled={!it.ready} onClick={() => it.to && navigate(it.to)}
            className={`w-full text-left bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center gap-4 transition-all ${it.ready ? 'active:scale-[0.99] hover:border-primary/30' : 'opacity-60 cursor-not-allowed'}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${it.ready ? 'bg-primary-fixed text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
              <Icon name={it.icon} fill={it.ready} className="!text-[28px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-headline-md text-headline-md">{it.label}</h2>
                {it.ready && it.badge > 0 && <span className="bg-error text-on-error text-[11px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full">{it.badge}</span>}
                {!it.ready && <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Segera</span>}
              </div>
              <p className="text-label-md text-on-surface-variant mt-0.5 leading-snug">{it.desc}</p>
            </div>
            {it.ready && <Icon name="chevron_right" className="text-on-surface-variant shrink-0" />}
          </button>
        ))}
      </main>
    </div>
  )
}
