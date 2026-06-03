import { useNavigate } from 'react-router-dom'
import { clearRoleSession } from '../../auth/roleAuth.js'
import { useDeposits } from '../../store/useDeposits.js'

// 3.2 — CORNEY Ops · Auditor landing (AUD-03 Cakupan & Jejak). Auditor melihat
// SEMUA cabang; setoran dirutekan ke Auditor/Owner. Verifikasi uang, TIDAK
// mengeksekusi koreksi stok. Decorative nav stripped.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function AuditorLanding() {
  const navigate = useNavigate()
  const deposits = useDeposits() || []
  const toVerify = deposits.filter((d) => d.status !== 'menunggu' && d.forwarded && !d.auditedAt).length

  const items = [
    { to: '/ops/auditor/setoran', icon: 'verified', label: 'Terima & Verifikasi Setoran', desc: 'Hitung ulang fisik, cocokkan vs Operasional → Owner', badge: toVerify, ready: true },
    { to: '/ops/auditor/telusur', icon: 'travel_explore', label: 'Telusur Titik Selisih', desc: 'Pinpoint di mana selisih muncul (Kasir/Ops/Auditor)', ready: true },
    { to: '/ops/auditor/log', icon: 'gpp_good', label: 'Jejak Audit (Audit Log)', desc: 'Log permanen: siapa/apa/kapan, tak bisa diubah', ready: true },
  ]

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="bg-primary-container text-on-primary-container px-6 py-7 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display-md text-display-md leading-none">AUDITOR</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Semua cabang · pengawas uang</p>
          </div>
          <button onClick={() => { clearRoleSession('auditor'); navigate('/ops/auditor/login') }} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95" title="Keluar"><Icon name="logout" /></button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-3">
        {items.map((it) => (
          <button key={it.label} onClick={() => navigate(it.to)} className="w-full text-left bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center gap-4 active:scale-[0.99] hover:border-primary/30 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center shrink-0"><Icon name={it.icon} fill className="!text-[28px]" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><h2 className="font-headline-md text-headline-md">{it.label}</h2>{it.badge > 0 && <span className="bg-primary text-on-primary text-[11px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full">{it.badge}</span>}</div>
              <p className="text-label-md text-on-surface-variant mt-0.5 leading-snug">{it.desc}</p>
            </div>
            <Icon name="chevron_right" className="text-on-surface-variant shrink-0" />
          </button>
        ))}
        <p className="text-[12px] text-on-surface-variant/70 text-center pt-2 flex items-center justify-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Auditor memverifikasi uang — eksekusi koreksi stok tetap Owner.</p>
      </main>
    </div>
  )
}
