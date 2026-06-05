import { useState } from 'react'
import { SAUCES, FREE_SAUCE_MAX, fmtRp } from '../data/menu.js'

// 2.1 — Shared sauce picker bottom-sheet. Used by the catalog quick-add ("+") for
// savory menus and by the cart's per-line "Ubah saus". Sweet menus never open it
// (they have no sauce). Rule (PRD): free sauces capped at FREE_SAUCE_MAX, premium
// sauces add to the price. Starts from `initial` (sauce ids) — empty for a fresh
// quick-add, pre-filled when editing an existing cart line.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function SauceSheet({ title, subtitle, initial = [], confirmLabel = 'Tambah', onCancel, onConfirm, sauces }) {
  // `sauces` = daftar ter-resolve per cabang [{id,name,price,ownerOff,habis}].
  // Tanpa prop → fallback global (mode lama). owner-off disembunyikan; habis disable.
  const list = (Array.isArray(sauces) ? sauces : SAUCES).filter((s) => !s.ownerOff)
  const [picked, setPicked] = useState(initial)
  const priceOf = (id) => list.find((s) => s.id === id)?.price || 0
  const freeUsed = picked.filter((id) => priceOf(id) === 0).length
  const toggle = (s) => {
    if (s.habis) return // saus habis → tak bisa dipilih
    setPicked((cur) => {
      if (cur.includes(s.id)) return cur.filter((x) => x !== s.id)
      if (s.price === 0 && freeUsed >= FREE_SAUCE_MAX) return cur // free cap
      return [...cur, s.id]
    })
  }
  const paid = picked.reduce((sum, id) => sum + priceOf(id), 0)

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <style>{`@keyframes sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-background rounded-t-3xl p-5 pb-7 shadow-2xl" style={{ animation: 'sheet-up 0.28s ease-out' }}>
        <div className="w-10 h-1.5 bg-outline-variant rounded-full mx-auto mb-4" />
        <div className="flex justify-between items-end mb-4">
          <div className="min-w-0">
            <h2 className="font-headline-md text-headline-md text-on-surface truncate">{title}</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">{subtitle || `Gratis maks ${FREE_SAUCE_MAX}, saus premium +harga`}</p>
          </div>
          <span className="shrink-0 bg-surface-container-high px-3 py-1 rounded-lg font-label-md text-label-md text-primary">Gratis {freeUsed}/{FREE_SAUCE_MAX}</span>
        </div>

        <div className="flex flex-col gap-2.5 max-h-[42vh] overflow-y-auto">
          {list.map((s) => {
            const checked = picked.includes(s.id)
            const isFree = s.price === 0
            const capped = isFree && !checked && freeUsed >= FREE_SAUCE_MAX
            const disabled = capped || s.habis
            return (
              <button key={s.id} onClick={() => toggle(s)} disabled={disabled} className={`flex items-center justify-between p-4 bg-white rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.06)] border transition-all text-left ${checked ? 'border-primary ring-2 ring-primary/40' : 'border-surface-container-high'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[.99]'}`}>
                <div className="flex items-center gap-4">
                  <span className={`w-6 h-6 rounded-md border flex items-center justify-center ${checked ? 'bg-primary border-primary text-white' : 'border-outline'}`}>{checked && <Icon name="check" className="!text-[18px]" />}</span>
                  <span className="font-label-lg text-label-lg">{s.name}</span>
                </div>
                <span className={`font-label-md text-label-md ${s.habis ? 'text-on-surface-variant' : isFree ? 'text-green-700' : 'text-amber-700'}`}>{s.habis ? 'Habis' : isFree ? 'Gratis' : `+${fmtRp(s.price)}`}</span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 h-[52px] rounded-xl border border-outline text-on-surface-variant font-label-lg active:scale-[0.98]">Batal</button>
          <button onClick={() => onConfirm(picked)} className="flex-[2] h-[52px] rounded-xl bg-primary text-white font-headline-md shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
            <Icon name="shopping_basket" className="!text-[20px]" /> {confirmLabel}{paid > 0 ? ` · +${fmtRp(paid)}` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
