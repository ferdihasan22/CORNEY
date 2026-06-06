import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtRp } from '../../data/menu.js'
import { useMaster } from '../../store/useMaster.js'
import ImageUploadButton from '../../app/ImageUploadButton.jsx'
import {
  addParent, updateParent, toggleParentActive, linkedMenuCount,
  addMenu, updateMenu, toggleMenuActive,
} from '../../store/master.js'

// OW-02 gabungan — Kelola Stok Isian & Menu dalam SATU layar: tiap isian induk
// jadi kartu, varian/menu-nya tampil & dikelola di bawahnya (tertaut 1:1). Lebih
// mudah: lihat stok induk + menunya sekaligus. PRD #8: nonaktif ≠ hapus.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const Status = ({ active }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${active ? 'bg-green-100 text-green-700' : 'bg-surface-variant text-on-surface-variant'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-on-surface-variant'}`} /> {active ? 'AKTIF' : 'NONAKTIF'}
  </span>
)
const CatBadge = ({ category }) => (
  category === 'sweet'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-bold text-[10px]"><Icon name="icecream" className="!text-[13px]" /> Sweet</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]"><Icon name="lunch_dining" className="!text-[13px]" /> Savory</span>
)
const P_EMPTY = { name: '', threshold: '' }
const M_EMPTY = { name: '', parent: '', category: 'savory', price: '', label: '', img: '' }

export default function OwnerCatalog() {
  const navigate = useNavigate()
  const master = useMaster()
  const parents = master?.parents || []
  const menus = master?.menus || []

  const [pEdit, setPEdit] = useState(null) // isian drawer: null | {} | {id,...}
  const [pForm, setPForm] = useState(P_EMPTY)
  const [mEdit, setMEdit] = useState(null) // menu drawer
  const [mForm, setMForm] = useState(M_EMPTY)

  const openNewParent = () => { setPForm(P_EMPTY); setPEdit({}) }
  const openEditParent = (p) => { setPForm({ name: p.name, threshold: String(p.threshold) }); setPEdit(p) }
  const savePar = (e) => { e.preventDefault(); if (!pForm.name.trim()) return; if (pEdit?.id) updateParent(pEdit.id, pForm); else addParent(pForm); setPEdit(null) }

  const openNewMenu = (parentId) => { setMForm({ ...M_EMPTY, parent: parentId || parents[0]?.id || '' }); setMEdit({}) }
  const openEditMenu = (m) => { setMForm({ name: m.name, parent: m.parent, category: m.category, price: String(m.price), label: m.label || '', img: m.img || '' }); setMEdit(m) }
  const saveMenu = (e) => { e.preventDefault(); if (!mForm.name.trim() || !mForm.parent) return; if (mEdit?.id) updateMenu(mEdit.id, mForm); else addMenu(mForm); setMEdit(null) }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[64px] max-w-4xl mx-auto">
          <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-on-primary/70 leading-none">Master Data</p>
            <h1 className="font-headline-md text-headline-md leading-tight">Stok Isian & Menu</h1>
          </div>
          <button onClick={openNewParent} className="bg-secondary-container text-on-secondary-container px-3 py-2.5 rounded-xl font-bold flex items-center gap-1.5 active:scale-95 shrink-0"><Icon name="add" /> <span className="hidden sm:inline">Isian</span></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 max-w-4xl mx-auto w-full space-y-4">
        <div className="bg-primary-container/10 border border-primary-container/20 p-3 rounded-xl flex gap-2 items-start">
          <Icon name="info" className="text-primary shrink-0 !text-[20px]" />
          <p className="text-label-md text-on-surface leading-snug"><strong className="text-primary">Isian induk</strong> = stok yang dipotong saat menu laku. Tiap <strong>menu/varian</strong> tertaut ke satu isian. Atur keduanya di sini. Nonaktif ≠ hapus.</p>
        </div>

        {parents.map((p) => {
          const items = menus.filter((m) => m.parent === p.id)
          return (
            <section key={p.id} className={`rounded-2xl border-2 overflow-hidden shadow-[0_4px_16px_rgba(26,26,26,0.06)] ${p.active ? 'border-outline-variant/50 bg-surface-container-lowest' : 'border-outline-variant/40 bg-surface-container-low/40 opacity-80'}`}>
            {/* Isian induk header */}
            <div className="p-4 bg-surface-container-low/60 border-b border-outline-variant/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2"><Icon name="inventory_2" className="text-primary !text-[20px]" /> {p.name}</h2>
                    <Status active={p.active} />
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1">{linkedMenuCount(p.id)} menu · ambang stok menipis {p.threshold}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEditParent(p)} title="Edit isian" className="w-9 h-9 rounded-lg hover:bg-surface-variant text-on-surface-variant flex items-center justify-center"><Icon name="edit" className="!text-[20px]" /></button>
                  <button onClick={() => toggleParentActive(p.id)} title={p.active ? 'Nonaktifkan' : 'Aktifkan'} className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.active ? 'hover:bg-red-50 text-error' : 'hover:bg-green-50 text-green-600'}`}><Icon name={p.active ? 'visibility_off' : 'check_circle'} className="!text-[20px]" /></button>
                </div>
              </div>
            </div>

            {/* Menu/varian di bawah isian */}
            <div className="divide-y divide-outline-variant/30">
              {items.length === 0 ? (
                <p className="px-4 py-3 text-label-md text-on-surface-variant italic">Belum ada menu untuk isian ini.</p>
              ) : items.map((m) => (
                <div key={m.id} className={`px-4 py-3 flex items-center gap-3 ${m.active ? '' : 'opacity-60'}`}>
                  <div className="w-11 h-11 rounded-lg bg-surface-container overflow-hidden shrink-0">
                    {m.img ? <img src={m.img} alt={m.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-on-surface-variant"><Icon name="image" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-on-surface leading-tight">{m.name}</span>
                      <CatBadge category={m.category} />
                      {!m.active && <span className="text-[10px] font-bold text-on-surface-variant">(nonaktif)</span>}
                    </div>
                    <span className="text-label-md text-primary font-bold">{fmtRp(m.price)}</span>{m.label && <span className="ml-2 text-[10px] font-bold text-primary bg-primary-container/10 px-1.5 py-0.5 rounded-full">{m.label}</span>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditMenu(m)} title="Edit menu" className="w-9 h-9 rounded-lg hover:bg-surface-variant text-on-surface-variant flex items-center justify-center"><Icon name="edit" className="!text-[18px]" /></button>
                    <button onClick={() => toggleMenuActive(m.id)} title={m.active ? 'Nonaktifkan' : 'Aktifkan'} className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.active ? 'hover:bg-red-50 text-error' : 'hover:bg-green-50 text-green-600'}`}><Icon name={m.active ? 'visibility_off' : 'check_circle'} className="!text-[18px]" /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => openNewMenu(p.id)} className="w-full px-4 py-2.5 text-primary font-bold flex items-center gap-2 hover:bg-primary/5 active:scale-[.99]"><Icon name="add" className="!text-[18px]" /> Tambah menu di {p.name}</button>
            </div>
            </section>
          )
        })}
        {parents.length === 0 && <p className="text-center text-on-surface-variant py-8">Belum ada isian induk. Tekan "+ Isian" untuk menambah.</p>}
      </main>

      {/* Drawer: Isian induk */}
      {pEdit && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-stretch justify-center sm:justify-end" onClick={() => setPEdit(null)}>
          <div className="w-full sm:w-[440px] h-full bg-surface shadow-2xl p-6 flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6"><h2 className="font-headline-md text-headline-md">{pEdit.id ? 'Edit Isian Induk' : 'Tambah Isian Induk'}</h2><button onClick={() => setPEdit(null)} className="p-2 rounded-full hover:bg-surface-variant"><Icon name="close" /></button></div>
            <form onSubmit={savePar} className="flex-grow flex flex-col gap-5">
              <div className="flex flex-col gap-2"><label className="font-label-md text-on-surface-variant">Nama Isian</label><input autoFocus value={pForm.name} onChange={(e) => setPForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Sosis Premium" className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest" /></div>
              <div className="flex flex-col gap-2"><label className="font-label-md text-on-surface-variant">Ambang Peringatan Stok Menipis</label><div className="relative"><input value={pForm.threshold} onChange={(e) => setPForm((f) => ({ ...f, threshold: e.target.value }))} placeholder="10" type="number" min="0" className="w-full h-[52px] border border-outline rounded-xl px-4 pr-14 focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-label-md">Unit</span></div></div>
              <div className="p-3 rounded-xl border border-dashed border-outline-variant flex gap-2"><Icon name="shield" className="text-secondary shrink-0" /><p className="text-label-md text-on-surface-variant">Nonaktif menyembunyikan isian dari operasional tanpa menghapus histori.</p></div>
              <div className="mt-auto flex gap-3 pt-4 border-t border-outline-variant"><button type="button" onClick={() => setPEdit(null)} className="flex-1 h-[52px] border border-outline rounded-xl font-bold text-on-surface-variant">Batal</button><button type="submit" className="flex-1 h-[52px] bg-primary text-on-primary rounded-xl font-bold shadow-md">Simpan Isian</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer: Menu */}
      {mEdit && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-stretch justify-center sm:justify-end" onClick={() => setMEdit(null)}>
          <div className="w-full sm:w-[460px] h-full bg-surface shadow-2xl p-6 flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5"><h2 className="font-headline-md text-headline-md">{mEdit.id ? 'Edit Menu' : 'Tambah Menu'}</h2><button onClick={() => setMEdit(null)} className="p-2 rounded-full hover:bg-surface-variant"><Icon name="close" /></button></div>
            <form onSubmit={saveMenu} className="flex-grow flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-surface-container overflow-hidden shrink-0">{mForm.img ? <img src={mForm.img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-on-surface-variant"><Icon name="add_a_photo" /></div>}</div>
                <div className="flex-1"><label className="font-label-md text-on-surface-variant">URL Foto (opsional)</label><input value={mForm.img} onChange={(e) => setMForm((f) => ({ ...f, img: e.target.value }))} placeholder="https://…" type="url" className="w-full h-[44px] border border-outline rounded-xl px-3 mt-1 focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest text-sm" /></div>
              </div>
              {/* Upload foto LANGSUNG dari perangkat (Cloudinary) — tak perlu URL */}
              <ImageUploadButton value={mForm.img} onChange={(url) => setMForm((f) => ({ ...f, img: url }))} label="Upload Foto dari Perangkat" />
              <div className="flex flex-col gap-1.5"><label className="font-label-md text-on-surface-variant">Nama Menu</label><input autoFocus value={mForm.name} onChange={(e) => setMForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Mozza Ori" className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest" /></div>
              <div className="flex flex-col gap-1.5"><label className="font-label-md text-on-surface-variant">Isian Induk (tertaut 1:1)</label><select value={mForm.parent} onChange={(e) => setMForm((f) => ({ ...f, parent: e.target.value }))} className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest">{parents.length === 0 && <option value="">(tidak ada isian)</option>}{parents.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? '' : ' (nonaktif)'}</option>)}</select></div>
              <div className="flex flex-col gap-1.5"><label className="font-label-md text-on-surface-variant">Kategori</label><div className="grid grid-cols-2 gap-2">{[['savory', 'Savory', 'lunch_dining', 'boleh saus'], ['sweet', 'Sweet', 'icecream', 'glaze, tanpa saus']].map(([val, lbl, ic, hint]) => (<button key={val} type="button" onClick={() => setMForm((f) => ({ ...f, category: val }))} className={`flex flex-col items-start gap-0.5 p-3 rounded-xl border-2 ${mForm.category === val ? 'border-primary bg-primary-container/10' : 'border-outline-variant'}`}><span className="flex items-center gap-1.5 font-bold"><Icon name={ic} className="!text-[18px]" /> {lbl}</span><span className="text-[10px] text-on-surface-variant">{hint}</span></button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5"><label className="font-label-md text-on-surface-variant">Harga</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">Rp</span><input value={mForm.price} onChange={(e) => setMForm((f) => ({ ...f, price: e.target.value }))} placeholder="17000" type="number" min="0" className="w-full h-[52px] border border-outline rounded-xl pl-10 pr-3 focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest" /></div></div>
                <div className="flex flex-col gap-1.5"><label className="font-label-md text-on-surface-variant">Label <span className="opacity-60">(opsional)</span></label><input value={mForm.label} onChange={(e) => setMForm((f) => ({ ...f, label: e.target.value }))} placeholder="Best Seller" className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest" /></div>
              </div>
              <div className="mt-auto flex gap-3 pt-4 border-t border-outline-variant"><button type="button" onClick={() => setMEdit(null)} className="flex-1 h-[52px] border border-outline rounded-xl font-bold text-on-surface-variant">Batal</button><button type="submit" className="flex-1 h-[52px] bg-primary text-on-primary rounded-xl font-bold shadow-md">Simpan Menu</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
