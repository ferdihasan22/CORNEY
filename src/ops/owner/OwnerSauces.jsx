import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMaster } from '../../store/useMaster.js'
import { addSauce, updateSauce, deleteSauce } from '../../store/master.js'
import { FREE_SAUCE_MAX, fmtRp } from '../../data/menu.js'

// Kelola Saus (global). Saus tersimpan di tabel `sauces` (id, name, price) dan
// disinkron ke const SAUCES yang dipakai Customer (SauceSheet, ProductDetail) &
// Kasir (AddSauceModal). Edit di sini → otomatis berlaku di seluruh app saat
// master di-refresh (buka app / tab kembali aktif) — tanpa reinstall APK.
// Harga 0 = saus GRATIS (maks FREE_SAUCE_MAX gratis per corndog).
const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
)

const EMPTY = { name: '', price: '' }

export default function OwnerSauces() {
  const navigate = useNavigate()
  const master = useMaster()
  const sauces = master?.sauces || []
  const [editing, setEditing] = useState(null) // null | {} | {id,...}
  const [form, setForm] = useState(EMPTY)

  const openNew = () => { setForm(EMPTY); setEditing({}) }
  const openEdit = (s) => { setForm({ name: s.name, price: String(s.price ?? 0) }); setEditing(s) }
  const close = () => setEditing(null)
  const save = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const data = { name: form.name, price: form.price }
    if (editing?.id) updateSauce(editing.id, data)
    else addSauce(data)
    close()
  }
  const remove = (s) => {
    if (window.confirm(`Hapus saus "${s.name}"? Struk lama tetap menyimpan nama saus ini.`)) deleteSauce(s.id)
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container shadow-md shrink-0">
        <div className="flex items-center justify-between px-4 sm:px-6 h-[72px] max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
            <div className="min-w-0">
              <p className="text-[11px] opacity-80 leading-none">Customer &amp; Kasir</p>
              <h1 className="font-headline-md text-headline-md leading-tight">Kelola Saus</h1>
            </div>
          </div>
          <button onClick={openNew} className="bg-white text-primary px-4 py-2.5 rounded-xl font-label-lg flex items-center gap-2 active:scale-95 transition-transform shadow-sm shrink-0">
            <Icon name="add_circle" className="text-[20px]" /> <span className="hidden sm:inline">Tambah Saus</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-4">
        <div className="p-3 rounded-xl border border-dashed border-outline-variant flex gap-2">
          <Icon name="info" className="text-secondary shrink-0" />
          <p className="text-label-md text-on-surface-variant">
            Harga <strong>Rp 0</strong> = saus <strong>gratis</strong> (maks {FREE_SAUCE_MAX} gratis per corndog; selebihnya berbayar). Saus berlaku untuk menu <strong>savory</strong> saja. Perubahan otomatis tampil di Customer &amp; Kasir.
          </p>
        </div>

        {sauces.length === 0 && (
          <p className="text-center text-on-surface-variant py-10">Belum ada saus. Tekan "Tambah Saus".</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sauces.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-4 rounded-2xl border border-outline-variant bg-surface-container-lowest">
              <div className="w-11 h-11 rounded-xl bg-primary-container/40 flex items-center justify-center shrink-0">
                <Icon name="water_drop" className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface truncate">{s.name}</p>
                <p className={`text-sm font-bold ${(s.price ?? 0) === 0 ? 'text-green-700' : 'text-on-surface-variant'}`}>
                  {(s.price ?? 0) === 0 ? 'Gratis' : fmtRp(s.price)}
                </p>
              </div>
              <button onClick={() => openEdit(s)} title="Edit" className="w-9 h-9 rounded-lg hover:bg-surface-variant text-on-surface-variant flex items-center justify-center"><Icon name="edit" className="!text-[20px]" /></button>
              <button onClick={() => remove(s)} title="Hapus" className="w-9 h-9 rounded-lg hover:bg-error-container text-error flex items-center justify-center"><Icon name="delete" className="!text-[20px]" /></button>
            </div>
          ))}
        </div>
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={close}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl p-5 flex flex-col gap-4">
            <h2 className="font-headline-md text-headline-md">{editing?.id ? 'Edit Saus' : 'Tambah Saus'}</h2>
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-on-surface-variant">Nama Saus</label>
              <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="mis. Saus Keju" className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-on-surface-variant">Harga (Rp) — 0 = gratis</label>
              <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value.replace(/[^0-9]/g, '') }))}
                inputMode="numeric" placeholder="0" className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest" />
            </div>
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={close} className="flex-1 h-[52px] rounded-xl border border-outline font-label-lg active:scale-95">Batal</button>
              <button type="submit" className="flex-1 h-[52px] rounded-xl bg-primary text-on-primary font-label-lg active:scale-95">Simpan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
