import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PARENT_FILLINGS, BRANCHES, DUMMY_DAILY_WAGE, lowestVariantPrice, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, soldByParentAll, saveReconStock, breakageByParent } from '../../store/day.js'

// Step 1A.9 — CLS-02 Rekonsiliasi Stok (v56, URUTAN WAJIB). Per isian induk,
// record explained reductions IN ORDER: (1) Patah → (2) Garansi → (3) Promo →
// (4) Sisa bagus → (5) Hilang auto. This replaces the old separate
// match-remaining + breakage screens (their order was wrong).
//
//   hilang  = awal − terjual − patah − garansi − promo − sisa bagus
//   potong  = (patah + garansi + hilang) × harga terendah varian   (promo TIDAK)
//   capped at 100% daily wage (Rp 0 floor). Sisa bagus → besok "sisa kemarin".
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>
const n = (v) => { const x = parseInt(v, 10); return Number.isFinite(x) && x >= 0 ? x : 0 }

// Neutral labels — no wage-deduction wording shown to the kasir (less stress).
// Plain Indonesian descriptions (kasir = SMP graduate). "Langkah N" avoids
// confusion vs raw numbers. The deduction value is still stored for the Owner.
const STEPS = [
  { key: 'patah', label: 'Patah', desc: 'Stok Patah' },
  { key: 'garansi', label: 'Garansi', desc: 'ganti karena komplain' },
  { key: 'promo', label: 'Promo', desc: 'gratis dari promo' },
  { key: 'sisa', label: 'Sisa bagus', desc: 'hitung yang masih bagus di freezer/kulkas' },
]

export default function ClosingRecon() {
  const day = useDay()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  const sold = soldByParentAll() // walk-in + online → "terjual" akurat (online bukan "hilang")
  const [vals, setVals] = useState(() => {
    const logged = breakageByParent() // patah tercatat saat jualan → prefill
    return PARENT_FILLINGS.reduce((a, p) => {
      const prev = day?.closing?.recon?.rows?.find((r) => r.parentId === p.id)
      a[p.id] = {
        patah: String(prev?.patah ?? logged[p.id] ?? 0), garansi: String(prev?.garansi ?? 0),
        promo: String(prev?.promo ?? 0), sisa: prev ? String(prev.sisaBagus) : '',
      }
      return a
    }, {})
  })
  const wage = DUMMY_DAILY_WAGE

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />

  const rows = PARENT_FILLINGS.map((p) => {
    const v = vals[p.id]
    const opening = day.openingStock?.[p.id] ?? 0
    const jual = sold[p.id] ?? 0
    const patah = n(v.patah), garansi = n(v.garansi), promo = n(v.promo)
    const filled = v.sisa !== ''
    const sisaBagus = filled ? n(v.sisa) : null
    const hilang = filled ? Math.max(0, opening - jual - patah - garansi - promo - sisaBagus) : null
    const harga = lowestVariantPrice(p.id)
    const potongan = filled ? (patah + garansi + hilang) * harga : 0
    return { p, opening, jual, patah, garansi, promo, filled, sisaBagus, hilang, harga, potongan }
  })

  const allFilled = rows.every((r) => r.filled)
  const selisihTotal = rows.reduce((s, r) => s + r.potongan, 0) // value of patah+garansi+hilang (Owner reads as deduction)

  function set(id, key, val) {
    setVals((s) => ({ ...s, [id]: { ...s[id], [key]: val.replace(/[^\d]/g, '') } }))
  }
  function lanjut() {
    if (!allFilled) return
    saveReconStock(
      rows.map((r) => ({ parentId: r.p.id, opening: r.opening, sold: r.jual, patah: r.patah, garansi: r.garansi, promo: r.promo, sisaBagus: r.sisaBagus, hilang: r.hilang, hargaTerendah: r.harga, potongan: r.potongan })),
      wage,
    )
    navigate('/ops/kasir/closing/urgent')
  }

  return (
    <div className="bg-surface-bright text-on-surface h-screen flex flex-col overflow-hidden">
      <header className="shrink-0 bg-primary shadow-md flex items-center gap-4 px-gutter-grid py-4">
        <button onClick={() => navigate('/ops/kasir/closing/belanja')} className="active:scale-95 transition-transform text-on-primary"><Icon name="arrow_back" /></button>
        <div className="flex flex-col">
          <h1 className="font-headline-md text-headline-md text-on-primary">Tutup Toko — Rekonsiliasi Stok</h1>
          <p className="font-label-md text-label-md text-on-primary/80">{branch.name} · Langkah 2/5 · isi urut 1 → 4</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-margin-page py-6">
        <div className="max-w-3xl mx-auto space-y-stack-gap">
          <div className="p-4 bg-secondary-container text-on-secondary-container rounded-xl flex gap-3 items-start border-l-4 border-secondary">
            <Icon name="rule" />
            <p className="text-body-md leading-snug">Isi tiap kotak <b>urut dari 1 ke 4</b>. Tulis dulu yang <b>ada sebabnya</b> (patah, ganti komplain, gratis promo), baru hitung sisa yang masih bagus. Yang <b>tidak ketemu &amp; tanpa sebab = "hilang"</b>.</p>
          </div>

          {rows.map((r) => (
            <section key={r.p.id} className="bg-surface-container-lowest rounded-xl p-padding-card shadow-[0_4px_16px_rgba(26,26,26,0.08)]">
              <div className="flex justify-between items-baseline mb-3">
                <h2 className="font-headline-md text-headline-md">{r.p.name}</h2>
                <span className="text-label-md text-on-surface-variant">Awal {r.opening} · Terjual {r.jual}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {STEPS.map((st, i) => (
                  <div key={st.key}>
                    <label className="block mb-1">
                      <span className="block text-[10px] font-bold text-primary uppercase tracking-wide">Urut {i + 1}</span>
                      <span className="block text-[13px] font-bold text-on-surface leading-tight">{st.label}</span>
                      <span className="block text-[10px] text-on-surface-variant leading-tight">{st.desc}</span>
                    </label>
                    <input
                      type="number" inputMode="numeric"
                      value={vals[r.p.id][st.key]}
                      onChange={(e) => set(r.p.id, st.key, e.target.value)}
                      placeholder={st.key === 'sisa' ? '—' : '0'}
                      className={`w-full h-12 text-center font-headline-md rounded-lg border outline-none transition-all ${st.key === 'sisa' ? 'border-2 border-primary' : 'border-outline-variant'} focus:ring-2 focus:ring-primary`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-dashed border-outline-variant flex flex-wrap items-center justify-between gap-2">
                {r.filled ? (
                  <>
                    <span className={`font-label-lg ${r.hilang > 0 ? 'text-primary font-bold' : 'text-green-700'}`}>Hilang: {r.hilang}</span>
                    <span className="text-body-md text-on-surface-variant">Selisih: <span className="font-bold text-primary">{fmtRp(r.potongan)}</span></span>
                  </>
                ) : (
                  <span className="text-on-surface-variant italic">Isi sisa bagus untuk menghitung hilang & potongan</span>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="shrink-0 bg-surface border-t border-outline-variant shadow-[0_-4px_16px_rgba(0,0,0,0.05)] p-margin-page">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-headline-lg font-headline-lg text-primary mb-1">Total selisih: {fmtRp(selisihTotal)}</h2>
            <p className="text-[12px] text-on-surface-variant/80 italic">Selisih tercatat otomatis &amp; dilaporkan ke Owner. Sisa bagus jadi "sisa kemarin" untuk Opening besok.</p>
          </div>
          <button onClick={lanjut} disabled={!allFilled} className="h-min-tap-target px-8 bg-primary text-on-primary rounded-[14px] font-bold text-body-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 shrink-0">
            Lanjut: Tunai &amp; Channel <Icon name="arrow_forward" />
          </button>
        </div>
      </footer>
    </div>
  )
}
