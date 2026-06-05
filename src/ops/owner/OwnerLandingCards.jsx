import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMaster } from '../../store/useMaster.js'
import { addLandingCard, updateLandingCard, toggleLandingCardActive, deleteLandingCard, moveLandingCard, activeLandingCards } from '../../store/master.js'
import ImageUploadButton from '../../app/ImageUploadButton.jsx'

// Kelola GAMBAR CARD landing Customer (hero linktree, tumpukan kartu) — TERPISAH
// dari Banner katalog. Kosong → landing fallback ke banner/foto menu. Rasio 4:5.
const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
)
const EMPTY = { title: '', img: '' }

export default function OwnerLandingCards() {
  const navigate = useNavigate()
  const master = useMaster()
  const cards = master?.landingCards || []
  const live = activeLandingCards()
  const [preview, setPreview] = useState(0)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (live.length <= 1) return
    const t = setInterval(() => setPreview((p) => (p + 1) % live.length), 4000)
    return () => clearInterval(t)
  }, [live.length])

  const openNew = () => { setForm(EMPTY); setEditing({}) }
  const openEdit = (c) => { setForm({ title: c.title, img: c.img }); setEditing(c) }
  const close = () => setEditing(null)
  const save = (e) => {
    e.preventDefault()
    if (!form.img.trim()) return
    if (editing?.id) updateLandingCard(editing.id, form)
    else addLandingCard(form)
    close()
  }
  const hero = live[Math.min(preview, Math.max(0, live.length - 1))]

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container shadow-md shrink-0">
        <div className="flex items-center justify-between px-4 sm:px-6 h-[72px] max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
            <div className="min-w-0">
              <p className="text-[11px] opacity-80 leading-none">PWA Customer · Landing</p>
              <h1 className="font-headline-md text-headline-md leading-tight">Gambar Landing</h1>
            </div>
          </div>
          <button onClick={openNew} className="bg-white text-primary px-4 py-2.5 rounded-xl font-label-lg flex items-center gap-2 active:scale-95 transition-transform shadow-sm shrink-0">
            <Icon name="add_circle" className="text-[20px]" /> <span className="hidden sm:inline">Tambah Gambar</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-8">
        {/* Preview hero landing (kartu 4:5) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-headline-md text-headline-md text-on-surface-variant flex items-center gap-2"><Icon name="visibility" /> Pratinjau Landing</h2>
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full flex items-center gap-1"><Icon name="crop" className="!text-[14px]" /> Rasio 4:5 (mis. 1080×1350)</span>
          </div>
          <div className="bg-primary-container/40 p-6 rounded-xl border border-outline-variant flex justify-center">
            <div className="w-[220px] aspect-[4/5] rounded-[24px] overflow-hidden shadow-2xl bg-surface-container relative">
              {hero ? (
                <>
                  <img src={hero.img} alt={hero.title} className="w-full h-full object-cover" />
                  {hero.title && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3"><p className="text-white font-bold text-sm leading-tight">{hero.title}</p></div>}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-xs text-center px-4">Belum ada gambar landing.<br />Landing pakai banner / foto menu sebagai cadangan.</div>
              )}
            </div>
          </div>
        </section>

        {/* Daftar */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface-variant flex items-center gap-2"><Icon name="view_list" /> Daftar Gambar</h2>
            <span className="text-label-md text-primary bg-primary/10 px-3 py-1 rounded-full">{cards.length} Gambar</span>
          </div>
          {cards.length === 0 ? (
            <div className="bg-surface-container-low rounded-xl border border-dashed border-outline-variant p-10 text-center text-on-surface-variant"><Icon name="image" className="!text-5xl opacity-30" /><p className="mt-2">Belum ada gambar landing. Selama kosong, landing memakai banner / foto menu.</p></div>
          ) : (
            <div className="space-y-3">
              {cards.map((c, i) => (
                <div key={c.id} className={`p-4 rounded-xl shadow-sm border border-outline-variant flex gap-3 sm:gap-4 items-center ${c.active ? 'bg-surface-container-lowest' : 'bg-surface-container opacity-80'}`}>
                  <div className="flex flex-col">
                    <button onClick={() => moveLandingCard(c.id, 'up')} disabled={i === 0} className="text-on-surface-variant disabled:opacity-20 active:scale-90"><Icon name="keyboard_arrow_up" /></button>
                    <button onClick={() => moveLandingCard(c.id, 'down')} disabled={i === cards.length - 1} className="text-on-surface-variant disabled:opacity-20 active:scale-90"><Icon name="keyboard_arrow_down" /></button>
                  </div>
                  <div className={`w-16 h-20 rounded-lg overflow-hidden shrink-0 ${c.active ? '' : 'grayscale'}`}>
                    {c.img ? <img src={c.img} alt={c.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-container flex items-center justify-center"><Icon name="image" className="text-on-surface-variant" /></div>}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="font-label-lg text-on-surface truncate">{c.title || '(tanpa judul)'}</h3>
                    <button onClick={() => toggleLandingCardActive(c.id)} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-bold ${c.active ? 'bg-green-100 text-green-700' : 'bg-surface-variant text-on-surface-variant'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-green-500' : 'bg-on-surface-variant'}`} /> {c.active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(c)} className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full"><Icon name="edit" /></button>
                    <button onClick={() => { if (confirm('Hapus gambar landing ini?')) deleteLandingCard(c.id) }} className="p-2 text-error hover:bg-error-container rounded-full"><Icon name="delete" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {editing && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-stretch justify-center sm:justify-end" onClick={close}>
          <div className="w-full sm:w-[420px] h-full bg-surface shadow-2xl flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-outline-variant flex justify-between items-center sticky top-0 bg-surface z-10">
              <h2 className="font-headline-md text-headline-md text-on-surface">{editing.id ? 'Edit Gambar' : 'Tambah Gambar'}</h2>
              <button onClick={close} className="p-2 hover:bg-surface-variant rounded-full"><Icon name="close" /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-5 flex-1">
              <div>
                <div className="w-40 mx-auto aspect-[4/5] rounded-xl overflow-hidden bg-surface-container relative">
                  {form.img ? <img src={form.img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant gap-1"><Icon name="add_photo_alternate" className="!text-4xl" /><span className="text-[11px]">Pratinjau 4:5</span></div>}
                  {form.title && <><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /><p className="absolute bottom-2 left-3 right-3 text-white font-bold text-sm leading-tight">{form.title}</p></>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-label-md text-on-surface-variant">Judul (opsional)</label>
                <input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Contoh: Corndog Mozza" className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-surface-container-lowest" />
              </div>
              <div className="space-y-2">
                <label className="font-label-md text-on-surface-variant">URL Gambar</label>
                <input value={form.img} onChange={(e) => setForm((f) => ({ ...f, img: e.target.value }))} placeholder="https://…" type="url" className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest text-sm" />
                <ImageUploadButton value={form.img} onChange={(url) => setForm((f) => ({ ...f, img: url }))} />
                <p className="text-xs text-on-surface-variant italic">Rasio ideal <strong>4:5 (potret)</strong>. Dipotong rata tengah; objek penting taruh di tengah. Gambar baru langsung Aktif & tampil paling bawah.</p>
              </div>
            </form>
            <div className="p-5 border-t border-outline-variant grid grid-cols-2 gap-4 sticky bottom-0 bg-surface">
              <button type="button" onClick={close} className="h-[52px] border border-outline text-on-surface-variant rounded-xl font-label-lg hover:bg-surface-variant transition-colors">Batal</button>
              <button onClick={save} className="h-[52px] bg-primary text-on-primary rounded-xl font-label-lg shadow-lg active:scale-95 transition-all">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
