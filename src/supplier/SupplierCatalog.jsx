import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { fmtRp } from '../data/menu.js'
import { useSupplier } from '../store/useSupplier.js'
import { setItemPrice, SUP_CATS } from '../store/supplier.js'
import SupplierNav from './SupplierNav.jsx'

// 3.1 — SUP-02 Katalog (2 kategori). Ported from Stitch "manage_catalog_category_2_dough_ingredients".
// K1 Kebutuhan Cabang · K2 Bahan Adonan. Supplier mengatur harga; perubahan harga
// otomatis memberi tahu Owner (lihat Riwayat Harga).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function SupplierCatalog() {
  const navigate = useNavigate()
  const sup = useSupplier()
  const [cat, setCat] = useState('K2')
  const [edit, setEdit] = useState(null) // { id, name, price }

  if (!localStorage.getItem('corney_supplier_session')) return <Navigate to="/supplier" replace />
  const items = (sup?.catalog || []).filter((i) => i.category === cat)
  const save = () => { setItemPrice(edit.id, edit.price); setEdit(null) }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="storefront" /> Katalog</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Supplier</p></div>
          <button onClick={() => { localStorage.removeItem('corney_supplier_session'); navigate('/supplier') }} className="w-10 h-10 rounded-full bg-on-primary-container/10 flex items-center justify-center active:scale-95"><Icon name="logout" /></button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Category tabs */}
        <div className="flex border-b border-outline-variant">
          {Object.entries(SUP_CATS).map(([k, lbl]) => (
            <button key={k} onClick={() => setCat(k)} className={`flex-1 pb-2 font-label-lg transition-all border-b-2 ${cat === k ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}>{k === 'K1' ? '1' : '2'} · {lbl}</button>
          ))}
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900"><Icon name="info" className="!text-[18px] shrink-0 mt-0.5" /><p className="text-label-md leading-snug">Checklist kategori tersimpan & muncul lagi besok — kebutuhan rutin, tinggal pakai ulang.</p></div>

        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className={`bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center justify-between gap-3 ${it.available ? '' : 'opacity-75'}`}>
              <div className="min-w-0">
                <h3 className="font-headline-md text-headline-md leading-tight">{it.name}</h3>
                <p className="text-label-md text-on-surface-variant">{fmtRp(it.price)}/{it.unit}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${it.available ? 'bg-green-100 text-green-700' : 'bg-surface-container-highest text-on-surface-variant'}`}>{it.available ? 'Tersedia' : 'Kosong'}</span>
                <button onClick={() => setEdit({ id: it.id, name: it.name, price: it.price })} className="text-primary font-label-md underline underline-offset-4">Ubah</button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {edit && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEdit(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl space-y-4">
            <h2 className="font-headline-md text-headline-md">Ubah Harga · {edit.name}</h2>
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-headline-md text-on-surface-variant">Rp</span><input inputMode="numeric" autoFocus value={Number(edit.price).toLocaleString('id-ID')} onChange={(e) => setEdit((s) => ({ ...s, price: Number(e.target.value.replace(/\D/g, '')) || 0 }))} className="w-full h-[56px] pl-12 pr-4 rounded-xl border-2 border-primary outline-none font-headline-md bg-surface" /></div>
            <p className="text-[12px] text-on-surface-variant">Perubahan harga otomatis memberi tahu Owner CORNEY (satu arah).</p>
            <div className="flex gap-3"><button onClick={() => setEdit(null)} className="flex-1 h-[52px] rounded-xl border border-outline text-on-surface-variant font-label-lg">Batal</button><button onClick={save} className="flex-[2] h-[52px] rounded-xl bg-primary text-on-primary font-headline-md shadow-lg active:scale-[0.98]">Simpan Harga</button></div>
          </div>
        </div>
      )}

      <SupplierNav />
    </div>
  )
}
