import { useState } from 'react'
import { SAUCES, FREE_SAUCE_MAX, fmtRp } from '../../data/menu.js'

// Step 1A.5 — WLK-02 Tambah Saus. Ref Stitch: "Add Sauce Modal - CORNEY POS".
// Rules: only for SAVORY (sweet/glaze never reaches here). Free sauces (price 0)
// capped at Owner setting (FREE_SAUCE_MAX); paid sauces add to total, no cap.
export default function AddSauceModal({ menu, onConfirm, onClose }) {
  const [picked, setPicked] = useState([]) // sauce ids

  const freePicked = picked.filter((id) => (SAUCES.find((s) => s.id === id)?.price ?? 0) === 0)
  const extra = picked.reduce((sum, id) => sum + (SAUCES.find((s) => s.id === id)?.price ?? 0), 0)

  function toggle(s) {
    setPicked((p) => {
      if (p.includes(s.id)) return p.filter((x) => x !== s.id)
      // Block selecting more free sauces than the Owner-set cap.
      if (s.price === 0 && freePicked.length >= FREE_SAUCE_MAX) return p
      return [...p, s.id]
    })
  }

  function confirm() {
    const sauces = picked.map((id) => {
      const s = SAUCES.find((x) => x.id === id)
      return { id: s.id, name: s.name, price: s.price }
    })
    onConfirm(sauces)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-corney-ink">Tambah Saus</h2>
            <p className="text-sm text-gray-500">{menu.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none px-1">×</button>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Gratis maks <b>{FREE_SAUCE_MAX}</b> · saus berbayar menambah total.
        </p>

        <div className="mt-3 space-y-2">
          {SAUCES.map((s) => {
            const on = picked.includes(s.id)
            const freeFull = s.price === 0 && !on && freePicked.length >= FREE_SAUCE_MAX
            return (
              <button
                key={s.id}
                onClick={() => toggle(s)}
                disabled={freeFull}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  on ? 'border-corney bg-corney-light' : 'border-gray-200 bg-white'
                } ${freeFull ? 'opacity-40' : 'active:scale-[.99]'}`}
              >
                <span className="font-medium text-corney-ink">
                  {s.name}
                  <span className="ml-2 text-xs text-gray-500">{s.price === 0 ? 'gratis' : '+' + fmtRp(s.price)}</span>
                </span>
                <span
                  className={`h-5 w-5 rounded-md border-2 flex items-center justify-center ${
                    on ? 'border-corney bg-corney text-white' : 'border-gray-300'
                  }`}
                >
                  {on && '✓'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">Tambahan saus</span>
          <span className="font-bold text-corney-ink">{extra > 0 ? '+' + fmtRp(extra) : 'Gratis'}</span>
        </div>

        <div className="mt-3 flex gap-3">
          <button onClick={onClose} className="px-5 py-3 rounded-lg border border-gray-300 font-semibold text-gray-600">
            Batal
          </button>
          <button onClick={confirm} className="flex-1 corney-swirl text-white font-bold py-3 rounded-lg shadow active:scale-[.99]">
            Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  )
}
