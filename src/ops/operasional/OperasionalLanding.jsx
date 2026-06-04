import { useNavigate } from 'react-router-dom'
import { clearRoleSession } from '../../auth/roleAuth.js'
import { useDeposits } from '../../store/useDeposits.js'

// 2.4 — CORNEY Ops · Operasional landing (PRD §7.3). Akses: semua cabang, ambil
// setoran, isi stok ke par, audit lapangan (propose-only stock corrections).
// Stripped of decorative nav; only built features are tappable.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OperasionalLanding() {
  const navigate = useNavigate()
  const deposits = useDeposits() || []
  const pending = deposits.filter((d) => d.status === 'menunggu').length

  const items = [
    { to: '/ops/operasional/setoran', icon: 'payments', label: 'Ambil Setoran Tunai', desc: 'Terima & konfirmasi setoran dari kasir (2 sisi)', badge: pending, ready: true },
    { to: '/ops/operasional/stok', icon: 'local_shipping', label: 'Isi Stok ke Standar', desc: 'Kirim stok isian ke cabang sesuai Stok Standar', ready: true },
    { to: '/ops/operasional/audit', icon: 'fact_check', label: 'Audit Lapangan', desc: 'Hitung fisik vs sistem — bisa audit dadakan saat kasir jualan', ready: true },
    { to: '/ops/operasional/cek-selisih', icon: 'rule', label: 'Cek Selisih Stok', desc: 'Tabel stok: seharusnya vs aktual vs selisih (hilang) per cabang', ready: true },
    { to: '/ops/operasional/belanja', icon: 'shopping_cart', label: 'Rekap Request Belanja', desc: 'Gabungan request semua cabang → PWA Supplier', ready: true },
    { to: '/ops/operasional/analisa', icon: 'science', label: 'Cek Bahan vs Jualan', desc: 'Lihat glaze/saus/kentang wajar atau perlu ditanya ke kasir', ready: true },
  ]

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="bg-primary-container text-on-primary-container px-6 py-7 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display-md text-display-md leading-none">OPERASIONAL</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Semua cabang · CORNEY Ops</p>
          </div>
          <button onClick={() => { clearRoleSession('operasional'); navigate('/ops/operasional/login') }} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95" title="Keluar"><Icon name="logout" /></button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-3">
        {items.map((it) => (
          <button
            key={it.label}
            disabled={!it.ready}
            onClick={() => it.to && navigate(it.to)}
            className={`w-full text-left bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center gap-4 transition-all ${it.ready ? 'active:scale-[0.99] hover:border-primary/30' : 'opacity-60 cursor-not-allowed'}`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${it.ready ? 'bg-primary-fixed text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
              <Icon name={it.icon} fill={it.ready} className="!text-[28px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-headline-md text-headline-md">{it.label}</h2>
                {it.ready && it.badge > 0 && <span className="bg-primary text-on-primary text-[11px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full">{it.badge}</span>}
                {!it.ready && <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Segera</span>}
              </div>
              <p className="text-label-md text-on-surface-variant mt-0.5 leading-snug">{it.desc}</p>
            </div>
            {it.ready && <Icon name="chevron_right" className="text-on-surface-variant shrink-0" />}
          </button>
        ))}

        <p className="text-[12px] text-on-surface-variant/70 text-center pt-4 flex items-center justify-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Operasional mengusulkan koreksi stok — eksekusi tetap oleh Owner.</p>
      </main>
    </div>
  )
}
