import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtRp } from '../../data/menu.js'
import { useDeposits } from '../../store/useDeposits.js'

// 3.2 — AUD-02 Telusur Titik Selisih. Ported from Stitch "trace_discrepancy_point_auditor_mobile".
// Pinpoints WHICH handoff a selisih appeared at, via the 2-sided confirm amounts.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function AuditorTrace() {
  const navigate = useNavigate()
  const deposits = (useDeposits() || []).filter((d) => d.status !== 'menunggu')
  // Prefer a deposit that actually has a discrepancy somewhere in the chain.
  const flagged = deposits.find((d) => (d.selisih || 0) !== 0 || (d.auditorSelisih || 0) !== 0)
  const [selId, setSelId] = useState((flagged || deposits[0])?.id)
  const d = deposits.find((x) => x.id === selId) || deposits[0]

  if (!d) {
    return (
      <div className="bg-background min-h-screen flex flex-col">
        <Header navigate={navigate} />
        <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-10 text-center"><Icon name="travel_explore" className="!text-6xl opacity-30" /><p className="mt-3 font-label-lg">Belum ada setoran untuk ditelusur.</p></div>
      </div>
    )
  }

  const opsDiff = (d.opsAmount ?? d.kasirAmount) - d.kasirAmount
  const audDiff = d.auditorAmount != null ? d.auditorAmount - (d.opsAmount ?? d.kasirAmount) : 0
  // Which junction(s) carry a discrepancy — even if the net nets out to zero.
  const points = [opsDiff !== 0 && 'Kasir → Operasional', audDiff !== 0 && 'Operasional → Auditor'].filter(Boolean)
  const anyDiff = points.length > 0
  const totalDiff = (d.auditorAmount ?? d.opsAmount ?? d.kasirAmount) - d.kasirAmount

  const nodes = [
    { who: 'Kasir · Laporan Closing', val: d.kasirAmount, icon: 'point_of_sale', state: 'ok' },
    { who: 'Operasional Menerima', val: d.opsAmount ?? d.kasirAmount, icon: 'local_shipping', state: opsDiff !== 0 ? 'bad' : 'ok', diff: opsDiff },
    { who: 'Auditor Hitung Ulang Fisik', val: d.auditorAmount, icon: 'verified', state: d.auditorAmount == null ? 'pending' : audDiff !== 0 ? 'bad' : 'ok', diff: audDiff },
    { who: 'Owner Review', val: null, icon: 'star', state: 'pending' },
  ]

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <style>{`@keyframes pulse-red {0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <Header navigate={navigate} />
      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-5">
        {/* deposit picker */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {deposits.map((x) => (
            <button key={x.id} onClick={() => setSelId(x.id)} className={`whitespace-nowrap px-4 py-2 rounded-full font-label-md transition-all ${x.id === selId ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant'}`}>{x.branchName.replace('CORNEY ', '')}</button>
          ))}
        </div>

        {/* summary */}
        <div className={`rounded-2xl p-5 ${!anyDiff ? 'bg-green-50 border border-green-200' : 'bg-error-container border border-error/20'}`}>
          {!anyDiff ? (
            <p className="font-headline-md text-green-700 flex items-center gap-2"><Icon name="check_circle" fill /> Rantai cocok — tidak ada selisih.</p>
          ) : (
            <>
              <p className="text-on-error-container">Selisih muncul di titik <strong>{points.join(' & ')}</strong></p>
              <p className="text-[12px] text-on-error-container/80 mt-1">Net akhir vs laporan kasir: {totalDiff > 0 ? '+' : ''}{fmtRp(totalDiff)}{totalDiff === 0 ? ' (saling menutup — tetap perlu ditelusur)' : ''}</p>
            </>
          )}
        </div>

        {/* timeline */}
        <section className="relative pl-2">
          {nodes.map((n, i) => {
            const last = i === nodes.length - 1
            const color = n.state === 'bad' ? '#ba1a1a' : n.state === 'pending' ? '#9ca3af' : '#22c55e'
            return (
              <div key={i} className="flex gap-4 pb-6 relative">
                {!last && <div className="absolute left-[15px] top-8 w-0.5 h-full" style={{ background: '#e6bdb7' }} />}
                <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: color, animation: n.state === 'bad' ? 'pulse-red 1.6s ease-in-out infinite' : undefined }}>
                  <Icon name={n.icon} fill className="!text-[18px]" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="font-label-lg leading-tight">{n.who}</p>
                  <p className={`font-headline-md ${n.state === 'bad' ? 'text-error' : n.state === 'pending' ? 'text-on-surface-variant' : 'text-on-surface'}`}>{n.val == null ? (n.state === 'pending' ? 'Menunggu' : '—') : fmtRp(n.val)}</p>
                  {n.state === 'ok' && i > 0 && <span className="text-[11px] text-green-600 font-bold">Cocok dengan titik sebelumnya</span>}
                  {n.state === 'bad' && <div className="mt-1 inline-block bg-error text-on-error text-[11px] font-bold px-2 py-1 rounded">Selisih {n.diff > 0 ? '+' : ''}{fmtRp(n.diff)} muncul DI SINI</div>}
                </div>
              </div>
            )
          })}
        </section>

        <p className="text-[12px] text-on-surface-variant/70 leading-relaxed flex items-start gap-1.5"><Icon name="info" className="!text-[16px] shrink-0 mt-0.5" /> Sistem hanya menunjukkan <strong>di titik mana</strong> selisih muncul, bukan penyebabnya. Tindak lanjut lewat klarifikasi netral ke pihak terkait.</p>
      </main>
    </div>
  )
}

function Header({ navigate }) {
  return (
    <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <button onClick={() => navigate('/ops/auditor')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><span className="material-symbols-outlined">arrow_back</span></button>
        <div><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><span className="material-symbols-outlined">travel_explore</span> Telusur Titik Selisih</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Auditor</p></div>
      </div>
    </header>
  )
}
