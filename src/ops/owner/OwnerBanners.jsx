import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMaster } from '../../store/useMaster.js'
import { addBanner, updateBanner, toggleBannerActive, deleteBanner, moveBanner, activeBanners } from '../../store/master.js'

// 2.6 — CUS-06 / OWN-09 Kelola Banner. Ported from Stitch
// "manage_customer_pwa_banners_mobile" (sidebar stripped). Banners are global
// (same all branches), manual on/off, array order = carousel order on the
// customer home. Drag-reorder is replaced by up/down buttons (no drag lib).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const EMPTY = { title: '', img: '' }

export default function OwnerBanners() {
  const navigate = useNavigate()
  const master = useMaster()
  const banners = master?.banners || []
  const live = activeBanners()
  const [preview, setPreview] = useState(0)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  // Auto-advance the preview so it mirrors the live customer carousel (4s).
  useEffect(() => {
    if (live.length <= 1) return
    const t = setInterval(() => setPreview((p) => (p + 1) % live.length), 4000)
    return () => clearInterval(t)
  }, [live.length])

  const openNew = () => { setForm(EMPTY); setEditing({}) }
  const openEdit = (b) => { setForm({ title: b.title, img: b.img }); setEditing(b) }
  const close = () => setEditing(null)
  const save = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (editing?.id) updateBanner(editing.id, form)
    else addBanner(form)
    close()
  }
  const heroBanner = live[Math.min(preview, Math.max(0, live.length - 1))]

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container shadow-md shrink-0">
        <div className="flex items-center justify-between px-4 sm:px-6 h-[72px] max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
            <div className="min-w-0">
              <p className="text-[11px] opacity-80 leading-none">PWA Customer</p>
              <h1 className="font-headline-md text-headline-md leading-tight">Kelola Banner</h1>
            </div>
          </div>
          <button onClick={openNew} className="bg-white text-primary px-4 py-2.5 rounded-xl font-label-lg flex items-center gap-2 active:scale-95 transition-transform shadow-sm shrink-0">
            <Icon name="add_circle" className="text-[20px]" /> <span className="hidden sm:inline">Tambah Banner</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-8">
        {/* Live preview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-headline-md text-headline-md text-on-surface-variant flex items-center gap-2"><Icon name="visibility" /> Live Preview</h2>
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full flex items-center gap-1"><Icon name="crop" className="!text-[14px]" /> Rekomendasi 1280×512 px · rasio 5:2</span>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant flex justify-center">
            <div className="w-[260px] h-[520px] bg-black rounded-[40px] p-3 shadow-2xl relative border-[6px] border-neutral-800">
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-full z-20" />
              {/* Mirrors the real customer catalog (header → banner → chips → grid) */}
              <div className="w-full h-full bg-background rounded-[28px] overflow-hidden flex flex-col">
                <div className="h-12 bg-surface flex items-end px-3 pb-1.5 justify-between border-b border-surface-container shrink-0">
                  <span className="font-black text-primary text-[13px] tracking-tighter">CORNEY</span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold"><Icon name="location_on" className="!text-[12px] text-primary" />Sepinggan</span>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-600" />LIVE</span>
                </div>
                <div className="px-3 mt-3">
                  <div className="relative w-full aspect-[5/2] rounded-xl overflow-hidden">
                    {heroBanner ? (
                      <>
                        <img src={heroBanner.img} alt={heroBanner.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <p className="absolute bottom-2 left-3 right-3 text-white font-bold text-[13px] leading-tight">{heroBanner.title}</p>
                        {live.length > 1 && (
                          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                            {live.map((b, i) => <span key={b.id} className={`h-1.5 rounded-full ${i === preview ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full bg-surface-container flex items-center justify-center text-on-surface-variant text-xs">Tidak ada banner aktif</div>
                    )}
                  </div>
                </div>
                <div className="px-3 mt-3 flex gap-1.5">
                  <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[9px] font-bold">Semua</span>
                  <span className="px-2.5 py-1 rounded-full border border-outline-variant text-on-surface-variant text-[9px]">Sweet</span>
                  <span className="px-2.5 py-1 rounded-full border border-outline-variant text-on-surface-variant text-[9px]">Savory</span>
                </div>
                <div className="px-3 mt-3 grid grid-cols-2 gap-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-xl bg-surface-container-lowest border border-outline-variant/50 overflow-hidden">
                      <div className="aspect-square bg-surface-container" />
                      <div className="p-2 space-y-1.5">
                        <div className="h-2 w-2/3 bg-surface-container rounded-full" />
                        <div className="h-2 w-1/3 bg-primary/30 rounded-full" />
                        <div className="h-4 w-full bg-primary/80 rounded-md mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Banner list */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface-variant flex items-center gap-2"><Icon name="view_list" /> Daftar Banner</h2>
            <span className="text-label-md text-primary bg-primary/10 px-3 py-1 rounded-full">{banners.length} Banner</span>
          </div>

          {banners.length === 0 ? (
            <div className="bg-surface-container-low rounded-xl border border-dashed border-outline-variant p-10 text-center text-on-surface-variant"><Icon name="image" className="!text-5xl opacity-30" /><p className="mt-2">Belum ada banner. Tambah untuk tampil di app customer.</p></div>
          ) : (
            <div className="space-y-3">
              {banners.map((b, i) => (
                <div key={b.id} className={`p-4 rounded-xl shadow-sm border border-outline-variant flex gap-3 sm:gap-4 items-center ${b.active ? 'bg-surface-container-lowest' : 'bg-surface-container opacity-80'}`}>
                  <div className="flex flex-col">
                    <button onClick={() => moveBanner(b.id, 'up')} disabled={i === 0} className="text-on-surface-variant disabled:opacity-20 active:scale-90"><Icon name="keyboard_arrow_up" /></button>
                    <button onClick={() => moveBanner(b.id, 'down')} disabled={i === banners.length - 1} className="text-on-surface-variant disabled:opacity-20 active:scale-90"><Icon name="keyboard_arrow_down" /></button>
                  </div>
                  <div className={`w-28 h-18 sm:w-32 sm:h-20 rounded-lg overflow-hidden shrink-0 ${b.active ? '' : 'grayscale'}`}>
                    {b.img ? <img src={b.img} alt={b.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-container flex items-center justify-center"><Icon name="image" className="text-on-surface-variant" /></div>}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-label-lg text-on-surface truncate">{b.title}</h3>
                      <span className="bg-tertiary-fixed text-[10px] font-bold px-1.5 py-0.5 rounded text-on-tertiary-fixed-variant uppercase tracking-wider">Global</span>
                    </div>
                    <button onClick={() => toggleBannerActive(b.id)} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-bold ${b.active ? 'bg-green-100 text-green-700' : 'bg-surface-variant text-on-surface-variant'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.active ? 'bg-green-500' : 'bg-on-surface-variant'}`} /> {b.active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(b)} className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full"><Icon name="edit" /></button>
                    <button onClick={() => { if (confirm(`Hapus banner "${b.title}"?`)) deleteBanner(b.id) }} className="p-2 text-error hover:bg-error-container rounded-full"><Icon name="delete" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-secondary-fixed/30 border border-secondary p-5 rounded-xl flex gap-4 items-start">
          <Icon name="info" className="text-secondary shrink-0" />
          <div className="space-y-1">
            <p className="font-label-lg text-on-secondary-fixed">Catatan Pengelolaan Banner</p>
            <p className="text-on-secondary-fixed-variant text-label-md leading-relaxed">Banner berlaku sama untuk semua cabang. Aktif/nonaktif manual saat promo mulai/selesai — tanpa jadwal otomatis. Urutan (panah atas/bawah) langsung memengaruhi urutan tampil di app customer.</p>
          </div>
        </section>
      </main>

      {/* Add / Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-stretch justify-center sm:justify-end" onClick={close}>
          <div className="w-full sm:w-[420px] h-full bg-surface shadow-2xl flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-outline-variant flex justify-between items-center sticky top-0 bg-surface z-10">
              <h2 className="font-headline-md text-headline-md text-on-surface">{editing.id ? 'Edit Banner' : 'Tambah Banner'}</h2>
              <button onClick={close} className="p-2 hover:bg-surface-variant rounded-full"><Icon name="close" /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-5 flex-1">
              {/* Preview — same 5:2 crop as the customer carousel */}
              <div>
                <div className="w-full aspect-[5/2] rounded-xl overflow-hidden bg-surface-container relative">
                  {form.img ? <img src={form.img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant gap-1"><Icon name="add_photo_alternate" className="!text-4xl" /><span className="text-[11px]">Pratinjau crop 5:2</span></div>}
                  {form.title && <><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /><p className="absolute bottom-2 left-3 right-3 text-white font-bold leading-tight">{form.title}</p></>}
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1.5 text-center">Beginilah banner tampil & terpotong di app customer.</p>
              </div>
              <div className="space-y-2">
                <label className="font-label-md text-on-surface-variant">Judul Banner</label>
                <input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Contoh: Promo Beli 2 Gratis 1" className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-surface-container-lowest" />
              </div>
              <div className="space-y-2">
                <label className="font-label-md text-on-surface-variant">URL Gambar</label>
                <input value={form.img} onChange={(e) => setForm((f) => ({ ...f, img: e.target.value }))} placeholder="https://…" type="url" className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest text-sm" />
                <p className="text-xs text-on-surface-variant italic">Ukuran ideal <strong>1280×512 px (rasio 5:2)</strong>, min lebar 1000px. Gambar otomatis dipotong rata tengah (object-cover) — bagian penting taruh di tengah. Banner baru langsung Aktif & tampil paling bawah carousel.</p>
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
