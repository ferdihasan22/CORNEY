import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtRp } from '../../data/menu.js'
import { useMaster } from '../../store/useMaster.js'
import { addMenu, updateMenu, toggleMenuActive, activeParents, parentNameById } from '../../store/master.js'
import ImageUploadButton from '../../app/ImageUploadButton.jsx'

// 1B.3 — OW-02 (2-4) Master Data · Menu & Varian. No dedicated Stitch ref;
// designed consistent with the Isian Induk screen (1B.2). Each menu links 1:1
// to a parent filling and has a category that enforces the topping rule:
// Sweet = glaze (NO sauce), Savory = sauce allowed. PRD #8: deactivate ≠ delete.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const CatBadge = ({ category }) => (
  category === 'sweet' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-700 font-bold text-xs"><Icon name="icecream" className="!text-sm" /> Sweet</span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-xs"><Icon name="lunch_dining" className="!text-sm" /> Savory</span>
  )
)
const StatusBadge = ({ active }) => (
  active ? (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold text-xs"><span className="w-2 h-2 rounded-full bg-green-500" /> AKTIF</span>
  ) : (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant font-bold text-xs"><span className="w-2 h-2 rounded-full bg-on-surface-variant" /> NONAKTIF</span>
  )
)

const Thumb = ({ src, alt }) => (
  <div className="w-12 h-12 rounded-xl bg-surface-container overflow-hidden shrink-0">
    {src ? <img src={src} alt={alt} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-on-surface-variant"><Icon name="image" /></div>}
  </div>
)

const EMPTY = { name: '', parent: '', category: 'savory', price: '', label: '', img: '' }

export default function OwnerMenus() {
  const navigate = useNavigate()
  const master = useMaster()
  const menus = master?.menus || []
  const parents = activeParents()

  const [editing, setEditing] = useState(null) // null | {} new | {id,...} edit
  const [form, setForm] = useState(EMPTY)

  const openNew = () => { setForm({ ...EMPTY, parent: parents[0]?.id || '' }); setEditing({}) }
  const openEdit = (m) => { setForm({ name: m.name, parent: m.parent, category: m.category, price: String(m.price), label: m.label, img: m.img }); setEditing(m) }
  const close = () => setEditing(null)

  const save = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.parent) return
    if (editing?.id) updateMenu(editing.id, form)
    else addMenu(form)
    close()
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[64px] max-w-6xl mx-auto">
          <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <div className="min-w-0">
            <p className="text-[11px] text-on-primary/70 leading-none">Master Data</p>
            <h1 className="font-headline-md text-headline-md leading-tight">Menu &amp; Varian</h1>
          </div>
          <button onClick={openNew} className="ml-auto bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all shrink-0">
            <Icon name="add" /> <span className="hidden sm:inline">Tambah Menu</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="bg-primary-container/10 border border-primary-container/20 p-4 rounded-xl flex gap-3 items-start mb-stack-gap">
          <Icon name="info" className="text-primary shrink-0" />
          <p className="font-label-md text-on-surface leading-snug">
            Tiap menu <strong className="text-primary">tertaut 1:1 ke satu isian induk</strong> (stok dipotong dari sana).{' '}
            <span className="text-on-surface-variant font-normal"><strong>Sweet</strong> = pakai glaze, tanpa saus. <strong>Savory</strong> = boleh saus. Menu dinonaktifkan, bukan dihapus.</span>
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-surface-container-lowest rounded-2xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] overflow-hidden border border-outline-variant">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant">Menu</th>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant">Isian Induk</th>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant text-center">Kategori</th>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant text-right">Harga</th>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant text-center">Status</th>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {menus.map((m) => (
                <tr key={m.id} className={`transition-colors ${m.active ? 'hover:bg-surface-container-low/50' : 'bg-surface-container-low/30 opacity-70'}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Thumb src={m.img} alt={m.name} />
                      <div>
                        <div className="font-bold text-on-surface leading-tight">{m.name}</div>
                        {m.label && <span className="text-[11px] font-bold text-primary bg-primary-container/10 px-2 py-0.5 rounded-full">{m.label}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{parentNameById(m.parent)}</td>
                  <td className="px-6 py-4 text-center"><CatBadge category={m.category} /></td>
                  <td className="px-6 py-4 text-right font-bold text-on-surface">{fmtRp(m.price)}</td>
                  <td className="px-6 py-4 text-center"><StatusBadge active={m.active} /></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(m)} title="Edit" className="p-2 rounded-lg hover:bg-surface-variant text-on-surface-variant transition-colors"><Icon name="edit" /></button>
                      <button onClick={() => toggleMenuActive(m.id)} title={m.active ? 'Nonaktifkan' : 'Aktifkan'} className={`p-2 rounded-lg transition-colors ${m.active ? 'hover:bg-red-50 text-error' : 'hover:bg-green-50 text-green-600'}`}>
                        <Icon name={m.active ? 'visibility_off' : 'check_circle'} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {menus.map((m) => (
            <div key={m.id} className={`bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 shadow-sm ${m.active ? '' : 'opacity-70'}`}>
              <div className="flex gap-3">
                <Thumb src={m.img} alt={m.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-on-surface leading-tight">{m.name}</span>
                    <StatusBadge active={m.active} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    <CatBadge category={m.category} />
                    {m.label && <span className="text-[11px] font-bold text-primary bg-primary-container/10 px-2 py-0.5 rounded-full">{m.label}</span>}
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-on-surface-variant">{parentNameById(m.parent)}</span>
                    <span className="font-bold text-on-surface">{fmtRp(m.price)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-outline-variant">
                <button onClick={() => openEdit(m)} className="flex-1 min-h-[44px] border border-outline rounded-xl font-bold text-on-surface flex items-center justify-center gap-2 active:scale-95"><Icon name="edit" className="!text-base" /> Edit</button>
                <button onClick={() => toggleMenuActive(m.id)} className={`flex-1 min-h-[44px] rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 ${m.active ? 'border border-error/40 text-error' : 'border border-green-600/40 text-green-600'}`}>
                  <Icon name={m.active ? 'visibility_off' : 'check_circle'} className="!text-base" /> {m.active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add / Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-stretch justify-center sm:justify-end" onClick={close}>
          <div className="w-full sm:w-[460px] h-full bg-surface shadow-2xl p-6 sm:p-8 flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-headline-md text-headline-md text-on-surface">{editing.id ? 'Edit Menu' : 'Tambah Menu'}</h2>
              <button onClick={close} className="p-2 rounded-full hover:bg-surface-variant"><Icon name="close" /></button>
            </div>

            <form onSubmit={save} className="flex-grow flex flex-col gap-5">
              {/* Photo preview + url */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-surface-container overflow-hidden shrink-0">
                  {form.img ? <img src={form.img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-on-surface-variant"><Icon name="add_a_photo" /></div>}
                </div>
                <div className="flex-1">
                  <label className="font-label-md text-on-surface-variant">URL Foto</label>
                  <input value={form.img} onChange={(e) => setForm((f) => ({ ...f, img: e.target.value }))} placeholder="https://…" type="url" className="w-full h-[44px] border border-outline rounded-xl px-3 mt-1 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface-container-lowest text-sm" />
                  <div className="mt-2"><ImageUploadButton value={form.img} onChange={(url) => setForm((f) => ({ ...f, img: url }))} /></div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant">Nama Menu</label>
                <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Mozza Ori" type="text" className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface-container-lowest" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant">Isian Induk (tertaut 1:1)</label>
                <select value={form.parent} onChange={(e) => setForm((f) => ({ ...f, parent: e.target.value }))} className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface-container-lowest">
                  {parents.length === 0 && <option value="">(tidak ada isian aktif)</option>}
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant">Kategori</label>
                <div className="grid grid-cols-2 gap-2">
                  {[['savory', 'Savory', 'lunch_dining', 'boleh saus'], ['sweet', 'Sweet', 'icecream', 'glaze, tanpa saus']].map(([val, lbl, ic, hint]) => (
                    <button key={val} type="button" onClick={() => setForm((f) => ({ ...f, category: val }))} className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all ${form.category === val ? 'border-primary bg-primary-container/10' : 'border-outline-variant'}`}>
                      <span className="flex items-center gap-2 font-bold"><Icon name={ic} className="!text-lg" /> {lbl}</span>
                      <span className="text-[11px] text-on-surface-variant">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-on-surface-variant">Harga</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">Rp</span>
                    <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="17000" type="number" min="0" className="w-full h-[52px] border border-outline rounded-xl pl-10 pr-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface-container-lowest" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-on-surface-variant">Label <span className="text-on-surface-variant/60">(opsional)</span></label>
                  <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Best Seller" type="text" className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface-container-lowest" />
                </div>
              </div>

              {editing.id && (
                <div className="bg-surface-container rounded-xl p-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-on-surface">Status</span>
                    <span className="text-xs text-on-surface-variant">{editing.active ? 'Aktif — dijual di kasir & katalog' : 'Nonaktif — disembunyikan'}</span>
                  </div>
                  <button type="button" onClick={() => { toggleMenuActive(editing.id); setEditing((m) => ({ ...m, active: !m.active })) }} className={`relative w-14 h-8 rounded-full transition-colors ${editing.active ? 'bg-primary' : 'bg-surface-variant'}`}>
                    <span className={`absolute top-1 h-6 w-6 bg-white rounded-full shadow transition-all ${editing.active ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              )}

              <div className="mt-auto flex gap-4 pt-6 border-t border-outline-variant">
                <button type="button" onClick={close} className="flex-1 h-[52px] border border-outline rounded-xl font-bold text-on-surface-variant hover:bg-surface-variant active:opacity-80 transition-all">Batal</button>
                <button type="submit" className="flex-1 h-[52px] bg-primary text-on-primary rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-md">Simpan Menu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
