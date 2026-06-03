import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { INGREDIENTS, fmtRp } from '../../data/menu.js'
import { useMaster } from '../../store/useMaster.js'
import { getRecipe, saveRecipe, recipeHpp, ingredientById } from '../../store/master.js'

// 1B.4 — OW-02 Master Data · Resep / BOM. UI ported from Stitch
// "master_data_resep_bom_desktop", made responsive (table + insight sidebar on
// desktop, stacked cards on mobile). Sidebar nav + the fake multi-outlet low
// stock alert are stripped; the "Setelan Saus" / "Bahan Cair" tabs are kept as
// PRD-planned placeholders (Fase 2). HPP is an estimate (PRD: "perkiraan").
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OwnerRecipes() {
  const navigate = useNavigate()
  const master = useMaster()
  const menus = master?.menus || []

  const [menuId, setMenuId] = useState('')
  const [rows, setRows] = useState([])
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  // Default to the first menu; load its recipe whenever the selection changes.
  useEffect(() => {
    if (!menuId && menus.length) setMenuId(menus[0].id)
  }, [menus, menuId])
  useEffect(() => {
    if (menuId) { setRows(getRecipe(menuId)); setDirty(false) }
  }, [menuId])

  const menu = menus.find((m) => m.id === menuId)
  const hpp = recipeHpp(rows)
  const price = menu?.price || 0
  const laba = price - hpp
  const margin = price > 0 ? Math.round((laba / price) * 100) : 0
  const marginTone = margin >= 55 ? 'Sehat' : margin >= 35 ? 'Cukup' : 'Tipis'

  const setRow = (i, patch) => { setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); setDirty(true); setSaved(false) }
  const delRow = (i) => { setRows((rs) => rs.filter((_, idx) => idx !== i)); setDirty(true); setSaved(false) }
  const addRow = () => {
    const used = new Set(rows.map((r) => r.ingredientId))
    const next = INGREDIENTS.find((i) => !used.has(i.id)) || INGREDIENTS[0]
    setRows((rs) => [...rs, { ingredientId: next.id, qty: 1 }]); setDirty(true); setSaved(false)
  }
  const onSave = () => { saveRecipe(menuId, rows); setDirty(false); setSaved(true) }

  const IngredientSelect = ({ value, onChange }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 bg-surface border border-outline-variant rounded-lg px-2 font-body-md focus:ring-2 focus:ring-primary outline-none max-w-full">
      {INGREDIENTS.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
  )

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[64px] max-w-6xl mx-auto">
          <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <div className="min-w-0">
            <p className="text-[11px] text-on-primary/70 leading-none">Master Data</p>
            <h1 className="font-headline-md text-headline-md leading-tight">Resep / BOM</h1>
          </div>
          <button onClick={onSave} disabled={!dirty} className={`ml-auto px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shrink-0 ${dirty ? 'bg-secondary-container text-on-secondary-container active:scale-95' : 'bg-white/15 text-on-primary/50'}`}>
            <Icon name={saved ? 'check' : 'save'} className="!text-lg" /> <span className="hidden sm:inline">{saved ? 'Tersimpan' : 'Simpan'}</span>
          </button>
        </div>
        {/* Planned tabs (Fase 2 placeholders) */}
        <div className="flex gap-1 px-4 sm:px-6 max-w-6xl mx-auto">
          <span className="px-4 py-2 text-sm font-bold border-b-2 border-secondary-container">Resep / BOM</span>
          <span className="px-4 py-2 text-sm text-on-primary/50">Setelan Saus <span className="text-[10px]">(2.5)</span></span>
          <span className="px-4 py-2 text-sm text-on-primary/50 hidden sm:inline">Bahan Cair &amp; Reorder <span className="text-[10px]">(2.5)</span></span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        {/* Product selector */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant mb-stack-gap">
          <label className="block font-label-md text-on-surface-variant mb-2">Pilih Produk</label>
          <div className="relative">
            <select value={menuId} onChange={(e) => setMenuId(e.target.value)} className="w-full h-[52px] bg-surface-container-low border border-outline rounded-xl px-4 pr-10 appearance-none focus:ring-2 focus:ring-primary focus:border-primary outline-none font-body-md">
              {menus.map((m) => <option key={m.id} value={m.id}>{m.name}{m.active ? '' : ' (nonaktif)'}</option>)}
            </select>
            <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-gutter-grid">
          {/* BOM table */}
          <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant overflow-hidden">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-headline-md text-on-surface">Bill of Materials</h3>
              <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-label-md text-[12px]">{rows.length} bahan</span>
            </div>

            {/* Desktop table */}
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="p-4 font-label-lg text-on-surface-variant">Bahan</th>
                  <th className="p-4 font-label-lg text-on-surface-variant">Takaran</th>
                  <th className="p-4 font-label-lg text-on-surface-variant">Harga Satuan</th>
                  <th className="p-4 font-label-lg text-on-surface-variant text-right">Sub-total</th>
                  <th className="p-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {rows.map((r, i) => {
                  const ing = ingredientById(r.ingredientId)
                  const sub = (ing?.unitPrice || 0) * (Number(r.qty) || 0)
                  return (
                    <tr key={i} className="hover:bg-surface-bright transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0"><Icon name={ing?.icon || 'help'} className="text-primary" /></div>
                          <IngredientSelect value={r.ingredientId} onChange={(v) => setRow(i, { ingredientId: v })} />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} className="w-20 h-10 bg-surface border border-outline-variant rounded-lg text-center font-body-md focus:ring-2 focus:ring-primary outline-none" />
                          <span className="text-on-surface-variant">{ing?.unit}</span>
                        </div>
                      </td>
                      <td className="p-4 font-body-md text-on-surface-variant">{fmtRp(ing?.unitPrice || 0)} / {ing?.unit}</td>
                      <td className="p-4 font-label-lg text-right">{fmtRp(sub)}</td>
                      <td className="p-4 text-right"><button onClick={() => delRow(i)} className="text-on-surface-variant hover:text-error transition-colors"><Icon name="delete" /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-outline-variant">
              {rows.map((r, i) => {
                const ing = ingredientById(r.ingredientId)
                const sub = (ing?.unitPrice || 0) * (Number(r.qty) || 0)
                return (
                  <div key={i} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0"><Icon name={ing?.icon || 'help'} className="text-primary !text-lg" /></div>
                      <IngredientSelect value={r.ingredientId} onChange={(v) => setRow(i, { ingredientId: v })} />
                      <button onClick={() => delRow(i)} className="ml-auto text-on-surface-variant hover:text-error"><Icon name="delete" /></button>
                    </div>
                    <div className="flex items-center justify-between mt-3 pl-12">
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} className="w-20 h-10 bg-surface border border-outline-variant rounded-lg text-center focus:ring-2 focus:ring-primary outline-none" />
                        <span className="text-on-surface-variant text-sm">{ing?.unit} · {fmtRp(ing?.unitPrice || 0)}/{ing?.unit}</span>
                      </div>
                      <span className="font-bold">{fmtRp(sub)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-5 bg-surface-container-low flex items-center justify-between flex-wrap gap-3">
              <button onClick={addRow} className="flex items-center gap-2 font-label-lg text-primary hover:underline active:scale-95"><Icon name="add" /> Tambah bahan</button>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold uppercase tracking-wider rounded">perkiraan</span>
                  <p className="font-label-lg text-on-surface-variant">Total Estimasi HPP</p>
                </div>
                <h4 className="font-display-md text-display-md text-on-surface">{fmtRp(hpp)}</h4>
              </div>
            </div>
          </div>

          {/* Insight sidebar */}
          <div className="w-full lg:w-[340px] space-y-4">
            <div className="bg-primary-container text-on-primary-container rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
              <p className="font-label-lg opacity-80 mb-1">Wawasan Bisnis</p>
              <h3 className="font-headline-lg mb-5">Analisa Margin (Estimasi)</h3>
              <div className="flex items-end gap-3 mb-4">
                <span className="font-display-lg text-display-lg leading-none">{margin}%</span>
                <span className="font-label-lg bg-white/20 px-2 py-1 rounded-md mb-1">{marginTone}</span>
              </div>
              <div className="space-y-3 pt-4 border-t border-white/20">
                <div className="flex justify-between items-center"><span className="opacity-80">Harga Jual</span><span className="font-label-lg">{fmtRp(price)}</span></div>
                <div className="flex justify-between items-center"><span className="opacity-80">Estimasi HPP</span><span className="font-label-lg">{fmtRp(hpp)}</span></div>
                <div className="flex justify-between items-center text-secondary-container"><span className="font-label-lg">Laba Kotor / pcs</span><span className="font-headline-md">{fmtRp(laba)}</span></div>
              </div>
            </div>

            {menu && (
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-md border border-outline-variant">
                {menu.img && <img src={menu.img} alt={menu.name} className="w-full h-[180px] object-cover" />}
                <div className="p-5">
                  <h4 className="font-headline-md mb-1">{menu.name}</h4>
                  <p className="text-sm text-on-surface-variant capitalize">{menu.category} · tertaut ke {master?.parents?.find((p) => p.id === menu.parent)?.name}</p>
                </div>
              </div>
            )}

            <div className="bg-secondary-container/50 rounded-2xl p-4 flex items-start gap-3 border border-on-secondary-container/10">
              <Icon name="info" className="text-on-secondary-container shrink-0" />
              <p className="text-sm text-on-secondary-container/90">HPP ini <strong>perkiraan</strong> dari harga beli bahan. Angka nyata mengikuti Buku Besar Pembelian supplier (Fase 2).</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
