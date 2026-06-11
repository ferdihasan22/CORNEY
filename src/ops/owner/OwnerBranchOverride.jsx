import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useMaster } from '../../store/useMaster.js'
import { setBranchOverride } from '../../store/master.js'

// 2.3 — Override Harga/Menu per Cabang (BranchProduct). Owner sets a local price
// and/or hides a menu for one branch; the customer catalog/detail/cart use the
// effective price. Empty price = pakai harga master. (Akses 2 lapis = RLS TAHAP 4.)
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OwnerBranchOverride() {
  const navigate = useNavigate()
  const master = useMaster()
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const menus = (master?.menus || []).filter((m) => m.active)
  const ov = (master?.branchOverrides || {})[branchId] || {}

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Harga & Menu per Cabang</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3 h-12 font-label-lg outline-none">
          {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900"><Icon name="info" className="!text-[18px] shrink-0 mt-0.5" /><p className="text-label-md leading-snug"><b>Walk-in</b> = harga di kasir. <b>Online</b> = harga di app Customer. Kosongkan = pakai harga master. Online kosong = ikut harga walk-in.</p></div>

        <div className="space-y-2">
          {menus.map((m) => {
            const o = ov[m.id] || {}
            const off = !!o.off
            return (
              <div key={m.id} className={`bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center gap-3 ${off ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <h3 className="font-headline-md text-headline-md leading-tight">{m.name}</h3>
                  <p className="text-[11px] text-on-surface-variant">Walk-in {fmtRp(m.price)}{o.price != null && <span className="text-primary font-bold"> → {fmtRp(o.price)}</span>} · Online {m.onlinePrice != null ? fmtRp(m.onlinePrice) : '(= walk-in)'}{o.onlinePrice != null && <span className="text-primary font-bold"> → {fmtRp(o.onlinePrice)}</span>}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 leading-none">Walk-in</p>
                    <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-on-surface-variant">Rp</span>
                      <input inputMode="numeric" value={o.price != null ? o.price : ''} onChange={(e) => setBranchOverride(branchId, m.id, { price: e.target.value.replace(/\D/g, '') })} placeholder={String(m.price)} className="w-24 h-9 pl-7 pr-2 rounded-lg border border-outline focus:border-primary outline-none text-label-md bg-surface" /></div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 leading-none">Online</p>
                    <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-on-surface-variant">Rp</span>
                      <input inputMode="numeric" value={o.onlinePrice != null ? o.onlinePrice : ''} onChange={(e) => setBranchOverride(branchId, m.id, { onlinePrice: e.target.value.replace(/\D/g, '') })} placeholder={m.onlinePrice != null ? String(m.onlinePrice) : String(m.price)} className="w-24 h-9 pl-7 pr-2 rounded-lg border border-outline focus:border-primary outline-none text-label-md bg-surface" /></div>
                  </div>
                </div>
                <button onClick={() => setBranchOverride(branchId, m.id, { off: !off })} title={off ? 'Aktifkan' : 'Sembunyikan'} className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${off ? 'bg-error-container text-error' : 'bg-green-100 text-green-700'}`}>
                  <Icon name={off ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
