import { useNavigate } from 'react-router-dom'
import { useMaster } from '../../store/useMaster.js'
import { useDay } from '../../store/useDay.js'
import { resolveSaucesForBranch } from '../../store/master.js'
import { toggleSauce } from '../../store/day.js'
import { fmtRp } from '../../data/menu.js'

// Kasir — "Saus Habis": tandai saus yang habis HARI INI di cabang ini. Saus yang
// dimatikan → customer cabang ini tak bisa memilihnya (lewat branch_status.
// availability.sauceOff, realtime). Reset otomatis saat tutup hari.
// Saus yang dimatikan permanen oleh Owner (per cabang) tak ditampilkan di sini.
const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function KasirSauces() {
  const navigate = useNavigate()
  const master = useMaster()
  const day = useDay()
  const branchId = day?.branchId || ''
  const sauceOff = day?.sauceOff || []
  // Sembunyikan yang di-OFF permanen oleh Owner (cabang ini memang tak menawarkan).
  const list = resolveSaucesForBranch(master, branchId, sauceOff).filter((s) => !s.ownerOff)

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md shrink-0">
        <div className="flex items-center gap-3 px-4 h-[64px] max-w-2xl mx-auto">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <div className="min-w-0">
            <p className="text-[11px] opacity-80 leading-none">Kasir · {branchId}</p>
            <h1 className="font-headline-md text-headline-md leading-tight">Saus Habis</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 flex flex-col gap-3">
        <div className="p-3 rounded-xl border border-dashed border-outline-variant flex gap-2">
          <Icon name="info" className="text-secondary shrink-0" />
          <p className="text-label-md text-on-surface-variant">Matikan saus yang <strong>habis</strong> → otomatis tak bisa dipilih customer di cabang ini. Aktif lagi kapan saja. Reset otomatis saat <strong>Tutup Hari</strong>.</p>
        </div>

        {list.length === 0 && <p className="text-center text-on-surface-variant py-10">Belum ada saus.</p>}

        {list.map((s) => (
          <div key={s.id} className={`flex items-center gap-3 p-4 rounded-2xl border ${s.habis ? 'border-outline-variant bg-surface-container-low/50 opacity-70' : 'border-outline-variant bg-surface-container-lowest'}`}>
            <div className="w-11 h-11 rounded-xl bg-primary-container/40 flex items-center justify-center shrink-0">
              <Icon name="water_drop" className={s.habis ? 'text-on-surface-variant' : 'text-primary'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-on-surface truncate">{s.name}</p>
              <p className="text-sm text-on-surface-variant">{(s.price ?? 0) === 0 ? 'Gratis' : fmtRp(s.price)}{s.habis ? ' · Habis' : ''}</p>
            </div>
            {/* Toggle ON/OFF (habis) */}
            <button
              onClick={() => toggleSauce(s.id)}
              title={s.habis ? 'Aktifkan saus' : 'Tandai habis'}
              className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${s.habis ? 'bg-surface-variant' : 'bg-primary'}`}
            >
              <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${s.habis ? 'left-1' : 'left-7'}`} />
            </button>
          </div>
        ))}
      </main>
    </div>
  )
}
