import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useLoyalty } from '../store/useLoyalty.js'
import { redeemReward } from '../store/loyalty.js'

// 2.7 — CUS-05 Member Dashboard. Ported from Stitch "corney_rewards_member_dashboard".
// Points balance, progress to top reward, reward cards (redeem), txn history.
// Redemption is validated kasir-side in real ops; here it deducts points locally.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const REWARDS = [
  { id: 'saus', label: 'Gratis Saus Premium', cost: 50, icon: 'water_drop' },
  { id: 'diskon', label: 'Diskon Rp 5.000', cost: 100, icon: 'sell' },
  { id: 'corndog', label: 'Gratis 1 Corndog', cost: 400, icon: 'lunch_dining', popular: true },
]
const TOP = 400
const maskWa = (wa) => { const s = wa || ''; return s.length > 7 ? `${s.slice(0, 4)}-****-${s.slice(-4)}` : s }
const fmtTime = (iso) => { try { return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

export default function CustomerRewards() {
  const navigate = useNavigate()
  const member = useLoyalty()
  const [toast, setToast] = useState('')

  if (!member) return <Navigate to="/app/join" replace />
  const pct = Math.min(100, Math.round((member.points / TOP) * 100))
  const need = Math.max(0, TOP - member.points)

  const tukar = (r) => {
    const ok = redeemReward(r.cost, r.label)
    setToast(ok ? `🎉 ${r.label} ditukar! Tunjukkan ke kasir.` : `Poin kurang ${r.cost - member.points} lagi untuk ${r.label}.`)
    setTimeout(() => setToast(''), 2600)
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-10">
      <header className="sticky top-0 z-40 bg-surface shadow-sm flex items-center gap-3 px-4 h-[64px]">
        <button onClick={() => navigate('/app')} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md text-primary">CORNEY Rewards</h1>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto p-6 space-y-6">
        {/* Points hero */}
        <section className="bg-primary-container text-on-primary-container rounded-[24px] p-6 relative overflow-hidden text-center">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full" />
          <p className="font-label-md uppercase tracking-widest opacity-90 relative">Total Poin Kamu</p>
          <div className="font-display-lg text-[56px] leading-none font-extrabold my-1 relative flex items-center justify-center gap-2"><Icon name="stars" fill className="!text-[36px] text-secondary-container" /> {member.points}</div>
          <p className="text-on-primary-container/80 relative">{maskWa(member.wa)}</p>
        </section>

        {/* Progress */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40">
          <p className="font-label-lg mb-2">{need === 0 ? 'Poinmu cukup untuk Gratis 1 Corndog! 🎉' : <><strong className="text-primary">{need} poin</strong> lagi menuju Gratis 1 Corndog</>}</p>
          <div className="h-3 bg-surface-container rounded-full overflow-hidden"><div className="h-full bg-secondary-container rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
        </section>

        {/* Rewards */}
        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md">Tukar Poin</h2>
          {REWARDS.map((r) => {
            const can = member.points >= r.cost
            return (
              <div key={r.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0"><Icon name={r.icon} fill /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><h3 className="font-label-lg leading-tight">{r.label}</h3>{r.popular && <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Populer</span>}</div>
                  <p className="text-label-md text-on-surface-variant">{r.cost} poin</p>
                </div>
                <button onClick={() => tukar(r)} disabled={!can} className="h-10 px-5 rounded-full bg-primary text-on-primary font-bold active:scale-95 disabled:opacity-40">Tukar</button>
              </div>
            )
          })}
        </section>

        {/* History */}
        <section className="space-y-2">
          <h2 className="font-headline-md text-headline-md">Riwayat Poin</h2>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 divide-y divide-outline-variant/30">
            {member.txns.map((t, i) => (
              <div key={i} className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${t.delta >= 0 ? 'bg-green-100 text-green-700' : 'bg-error-container text-error'}`}><Icon name={t.delta >= 0 ? 'add' : 'redeem'} className="!text-[18px]" /></div>
                  <div className="min-w-0"><p className="font-label-lg truncate">{t.label}</p><p className="text-label-md text-on-surface-variant">{fmtTime(t.at)}</p></div>
                </div>
                <span className={`font-bold shrink-0 ${t.delta >= 0 ? 'text-green-600' : 'text-error'}`}>{t.delta >= 0 ? '+' : ''}{t.delta}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-on-surface text-surface px-5 py-3 rounded-full shadow-xl font-label-lg text-center max-w-[90%]">{toast}</div>}
    </div>
  )
}
