import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { useMaster } from '../../store/useMaster.js'
import { setOpeningCash, PHASE } from '../../store/day.js'

// Step 1A.3 — OPN-02 Buka Kas. UI ported from Stitch "Buka Kas - Buka Toko".
// Opening cash float feeds "Kas seharusnya" at closing. Confirming unlocks selling.
const Icon = ({ name, className = '', style }) => <span style={style} className={`material-symbols-outlined ${className}`}>{name}</span>
const CHIPS = [50000, 100000, 200000, 500000]

export default function OpeningCash() {
  const day = useDay()
  const master = useMaster()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  // Standar uang kembalian per cabang (di-set Owner) → default modal laci.
  const stdKembalian = (master?.branches || []).find((b) => b.id === day?.branchId)?.kembalian ?? 100000
  const [amount, setAmount] = useState(stdKembalian)

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase !== PHASE.CASH) return <Navigate to="/ops/kasir" replace />

  function handleConfirm() {
    setOpeningCash(amount)
    navigate('/ops/kasir', { replace: true })
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 h-[80px] bg-primary-container text-on-primary-container flex justify-between items-center px-margin-page z-50">
        <div className="flex items-center gap-4">
          <Icon name="store" className="!text-[32px]" />
          <span className="font-headline-md text-headline-md">Cabang: {branch.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-label-lg text-label-lg bg-white/20 px-4 py-2 rounded-full">Buka Toko · Langkah 2 dari 4</span>
          <button onClick={() => navigate('/ops/kasir/opening')} className="material-symbols-outlined p-2 hover:bg-white/10 rounded-full transition-colors">close</button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow pt-[80px] pb-[140px] flex flex-col items-center px-margin-page">
        <div className="w-full max-w-[480px] mt-12 mb-8 text-center">
          <h1 className="font-display-md text-display-md text-on-surface mb-2">Buka Kas</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Masukkan modal laci awal sebagai titik mula perhitungan kas.</p>
          <p className="mt-2 text-label-md text-on-surface-variant inline-flex items-center gap-1.5 bg-surface-container px-3 py-1.5 rounded-full"><Icon name="savings" className="!text-[18px] text-primary" /> Standar cabang ini: <b className="text-on-surface">{fmtRp(stdKembalian)}</b> (sudah terisi)</p>
        </div>

        <div className="w-full max-w-[480px] bg-white rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] p-8 border border-surface-container">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-label-md text-on-surface-variant px-1">Modal Laci Awal (Rp)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <span className="font-display-md text-display-md text-outline">Rp</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount ? amount.toLocaleString('id-ID') : ''}
                  onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)}
                  placeholder="0"
                  className="w-full h-[88px] pl-20 pr-6 rounded-xl border-2 border-outline-variant bg-surface-container-low font-display-md text-display-md text-on-surface focus:border-primary focus:ring-0 transition-all text-right outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {CHIPS.map((v) => {
                const active = amount === v
                return (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className={`h-min-tap-target border-2 border-secondary-container text-on-secondary-container font-label-lg text-label-lg rounded-xl transition-all active:scale-95 ${active ? 'bg-secondary-container' : 'hover:bg-secondary-fixed'}`}
                  >
                    {v.toLocaleString('id-ID')}
                  </button>
                )
              })}
            </div>

            <div className="flex items-start gap-3 bg-surface-container-low p-4 rounded-lg">
              <Icon name="info" className="text-secondary" />
              <p className="font-body-md text-body-md text-on-surface-variant">Uang kembalian tunai yang ada di laci saat mulai jualan.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom recap */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-outline-variant p-6 z-50">
        <div className="max-w-[1024px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Icon name="check_circle" className="text-green-600" style={{ fontVariationSettings: "'FILL' 1" }} />
              <span className="font-label-lg text-label-lg text-on-surface">Stok isian: <span className="text-green-600 font-bold">✓ Dikonfirmasi</span></span>
            </div>
            <div className="h-8 w-px bg-outline-variant hidden md:block" />
            <div className="flex items-center gap-2">
              <Icon name="account_balance_wallet" className="text-primary" />
              <span className="font-label-lg text-label-lg text-on-surface">Modal laci: <span className="font-bold text-primary">{fmtRp(amount)}</span></span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <button onClick={() => navigate('/ops/kasir/opening')} className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary underline px-4 py-2 transition-colors">
              Kembali ke Konfirmasi Stok
            </button>
            <button
              onClick={handleConfirm}
              className="bg-primary hover:bg-primary-container text-on-primary font-headline-md text-headline-md h-[64px] px-12 rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all w-full md:w-auto flex items-center justify-center gap-2"
            >
              <span>Mulai Jualan</span>
              <Icon name="rocket_launch" />
            </button>
          </div>
        </div>
      </footer>

      {/* Decorative brand blob (matches Stitch reference, opacity-5) */}
      <div className="fixed -bottom-20 -left-20 w-80 h-80 opacity-5 pointer-events-none">
        <div className="w-full h-full rounded-full bg-on-surface" />
      </div>
    </div>
  )
}
