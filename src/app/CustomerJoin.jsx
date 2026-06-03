import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useLoyalty } from '../store/useLoyalty.js'
import { registerMember } from '../store/loyalty.js'

// 2.7 — CUS-05 Join CORNEY Rewards. Ported from Stitch "join_corney_rewards_registration".
// Light register via phone; MANDATORY data consent before register (§10). OTP is
// dummy in Fase 1 (real OTP = TAHAP 4).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const BENEFITS = [
  { icon: 'stars', text: 'Kumpulkan poin tiap beli' },
  { icon: 'local_offer', text: 'Tukar poin jadi diskon & gratisan' },
  { icon: 'cake', text: 'Kejutan spesial buat member' },
]

export default function CustomerJoin() {
  const navigate = useNavigate()
  const member = useLoyalty()
  const [wa, setWa] = useState('')
  const [consent, setConsent] = useState(false)

  if (member) return <Navigate to="/app/rewards" replace />
  const digits = wa.replace(/\D/g, '')
  const valid = consent && digits.length >= 8

  const join = () => { if (!valid) return; registerMember(digits); navigate('/app/rewards') }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface shadow-sm flex items-center gap-3 px-4 h-[64px]">
        <button onClick={() => navigate('/app')} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md text-primary">CORNEY Rewards</h1>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto p-6 space-y-6">
        <section className="bg-primary-container text-on-primary-container rounded-[24px] p-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          <h2 className="font-headline-lg text-headline-lg leading-tight relative">Kumpulkan poin tiap beli, dapat hadiah! 🌟</h2>
          <p className="text-on-primary-container/90 mt-1 relative">Gabung jadi member Sobat Corney sekarang.</p>
          <div className="mt-4 space-y-2 relative">
            {BENEFITS.map((b) => <div key={b.icon} className="flex items-center gap-3"><span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"><Icon name={b.icon} fill /></span><span className="font-label-lg">{b.text}</span></div>)}
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-[24px] p-5 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] space-y-4">
          <div>
            <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1">Nomor WhatsApp</label>
            <div className="relative mt-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-headline-md text-on-surface-variant">+62</span>
              <input value={wa} onChange={(e) => setWa(e.target.value)} type="tel" inputMode="numeric" placeholder="812 3456 7890" className="w-full h-[56px] pl-14 pr-4 rounded-xl border border-outline focus:border-primary outline-none font-headline-md bg-surface" />
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-5 h-5 accent-primary rounded mt-0.5 shrink-0" />
            <span className="text-label-md text-on-surface-variant leading-snug">Saya setuju data saya dipakai untuk program loyalty CORNEY (sesuai Kebijakan Privasi).</span>
          </label>
          <button onClick={join} disabled={!valid} className="w-full h-[56px] rounded-full flex items-center justify-center gap-2 text-white font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-40" style={{ backgroundColor: valid ? '#25D366' : '#9ca3af' }}>
            <Icon name="chat" fill /> Daftar dengan WhatsApp
          </button>
          <p className="text-[11px] text-on-surface-variant/70 text-center">Fase uji: tanpa OTP. Nomor langsung terdaftar di perangkat ini.</p>
        </section>
      </main>
    </div>
  )
}
