import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { fmtRp } from '../data/menu.js'
import { useShoppingItems } from '../store/useShoppingItems.js'
import { addShoppingItem } from '../store/shopping.js'
import { useSupplierPrices } from '../store/useSupplierPrices.js'
import { updateItemPrice, priceOfSup, trendOfSup } from '../store/supplierPrices.js'
import { OPS_ITEMS } from '../store/opsbelanja.js'
import { getSupplierSession } from './session.js'
import SupplierNav from './SupplierNav.jsx'

// SUP Atur Harga — supplier isi harga lalu tekan "Update Harga" untuk simpan.
// Tiap update merekam harga lama → indikator NAIK/TURUN tampil di dashboard Owner.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function SupplierPrices() {
  const navigate = useNavigate()
  const shopItems = useShoppingItems() || []
  useSupplierPrices() // re-render saat harga tersimpan berubah
  const [draft, setDraft] = useState({}) // { [id]: string } perubahan belum disimpan
  const [saved, setSaved] = useState(false)
  const [newItem, setNewItem] = useState('')
  if (!getSupplierSession()) return <Navigate to="/supplier" replace />

  const kasir = shopItems.map((i) => ({ id: i.id, name: i.name }))
  const opsOnly = OPS_ITEMS.filter((o) => !shopItems.some((i) => i.id === o.id))
  const groups = [
    { key: 'kasir', label: 'Item Kasir', dot: 'bg-primary', items: kasir },
    { key: 'ops', label: 'Tambahan Operasional', dot: 'bg-secondary-container', items: opsOnly },
  ]
  const allItems = [...kasir, ...opsOnly]

  const valOf = (id) => (draft[id] !== undefined ? draft[id] : (priceOfSup(id) ? String(priceOfSup(id)) : ''))
  const isDirty = (id) => draft[id] !== undefined && Number(draft[id] || 0) !== priceOfSup(id)
  const dirtyIds = allItems.filter((i) => isDirty(i.id)).map((i) => i.id)
  const filled = allItems.filter((i) => priceOfSup(i.id) > 0).length

  const updateAll = () => {
    dirtyIds.forEach((id) => updateItemPrice(id, draft[id]))
    setDraft({}); setSaved(true); setTimeout(() => setSaved(false), 2200)
  }
  const addNew = () => { addShoppingItem(newItem); setNewItem('') }

  const renderRow = (it) => {
    const stored = priceOfSup(it.id)
    const dirty = isDirty(it.id)
    const trend = trendOfSup(it.id)
    return (
      <div key={it.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${dirty ? 'border-primary bg-primary-fixed/30' : stored > 0 ? 'border-outline-variant/40 bg-surface-container-lowest' : 'border-amber-300 bg-amber-50'}`}>
        <div className="flex-1 min-w-0">
          <p className="font-label-lg leading-tight flex items-center gap-1.5">{it.name}
            {trend && <span className={`text-[10px] font-bold flex items-center ${trend === 'naik' ? 'text-error' : 'text-green-600'}`}><Icon name={trend === 'naik' ? 'trending_up' : 'trending_down'} className="!text-[14px]" />{trend}</span>}
          </p>
          {dirty && <p className="text-[11px] text-primary font-bold">belum disimpan</p>}
        </div>
        <div className="relative shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md">Rp</span>
          <input inputMode="numeric" value={valOf(it.id) ? Number(valOf(it.id)).toLocaleString('id-ID') : ''} onChange={(e) => setDraft((d) => ({ ...d, [it.id]: e.target.value.replace(/\D/g, '') }))} placeholder="0" className="w-32 h-10 pl-9 pr-3 text-right rounded-lg border border-outline focus:border-primary outline-none font-bold bg-surface" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-48">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/supplier/request')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1"><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="sell" /> Atur Harga Item</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Supplier · {filled}/{allItems.length} terisi</p></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full p-5 space-y-5">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900">
          <Icon name="info" className="!text-[18px] shrink-0 mt-0.5" />
          <p className="text-label-md leading-snug">Isi/ubah harga lalu tekan <strong>Update Harga</strong> untuk menyimpan. Tiap perubahan tercatat (naik/turun) & muncul di dashboard Owner. Harga dipakai menghitung subtotal & total per cabang di Request.</p>
        </div>

        {/* Tambah item baru → ikut muncul di checklist Kasir & Operasional */}
        <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/40 space-y-2">
          <h2 className="font-label-lg flex items-center gap-2"><Icon name="add_circle" className="text-primary" /> Tambah Item Belanja</h2>
          <div className="flex gap-2">
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNew()} placeholder="Nama item baru (mis. Saus Padang)" className="flex-1 h-11 px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface min-w-0" />
            <button onClick={addNew} disabled={!newItem.trim()} className="px-4 rounded-xl bg-primary text-on-primary font-label-lg flex items-center gap-1 active:scale-95 disabled:opacity-40 shrink-0"><Icon name="add" /> Tambah</button>
          </div>
          <p className="text-[11px] text-on-surface-variant flex items-start gap-1.5"><Icon name="info" className="!text-[15px] shrink-0 mt-0.5" /> Item baru otomatis muncul di checklist belanja <strong>Kasir</strong> (saat closing) & <strong>Operasional</strong>.</p>
        </div>

        {groups.map((g) => g.items.length > 0 && (
          <section key={g.key} className="space-y-2">
            <h2 className="font-label-lg text-on-surface-variant flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${g.dot}`} /> {g.label} <span className="font-normal">({g.items.length})</span></h2>
            <div className="space-y-1.5">{g.items.map(renderRow)}</div>
          </section>
        ))}
      </main>

      <div className="fixed bottom-[68px] left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        <button onClick={updateAll} disabled={dirtyIds.length === 0} className={`max-w-2xl mx-auto w-full min-h-[52px] rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-40 ${saved ? 'bg-green-600 text-white' : 'bg-primary text-on-primary'}`}>
          <Icon name={saved ? 'check' : 'save'} /> {saved ? 'Harga Tersimpan' : `Update Harga${dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ''}`}
        </button>
      </div>

      <SupplierNav />
    </div>
  )
}
