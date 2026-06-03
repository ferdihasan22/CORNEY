import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMaster } from '../../store/useMaster.js'
import { addParent, updateParent, toggleParentActive, linkedMenuCount } from '../../store/master.js'

// 1B.2 — OW-02 (1) Master Data · Isian Induk. UI ported from Stitch
// "manage_parent_fillings_desktop", made responsive (table on desktop, cards on
// mobile) and wired to the master-data store. The desktop reference's left
// sidebar is replaced with the app's standard owner top-header + back (the
// sidebar links to owner sections not built yet — kept off to avoid dead nav).
// PRD #8: deactivate ≠ delete — historical transactions keep their reference.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const StatusBadge = ({ active }) => (
  active ? (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold text-xs">
      <span className="w-2 h-2 rounded-full bg-green-500" /> AKTIF
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant font-bold text-xs">
      <span className="w-2 h-2 rounded-full bg-on-surface-variant" /> NONAKTIF
    </span>
  )
)

export default function OwnerParentFillings() {
  const navigate = useNavigate()
  const master = useMaster()
  const parents = master?.parents || []

  const [editing, setEditing] = useState(null) // null = closed; {} = new; {id,...} = edit
  const [form, setForm] = useState({ name: '', threshold: '' })

  const openNew = () => { setForm({ name: '', threshold: '' }); setEditing({}) }
  const openEdit = (p) => { setForm({ name: p.name, threshold: String(p.threshold) }); setEditing(p) }
  const close = () => setEditing(null)

  const save = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (editing?.id) updateParent(editing.id, { name: form.name, threshold: form.threshold })
    else addParent({ name: form.name, threshold: form.threshold })
    close()
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[64px] max-w-6xl mx-auto">
          <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <div className="min-w-0">
            <p className="text-[11px] text-on-primary/70 leading-none">Master Data</p>
            <h1 className="font-headline-md text-headline-md leading-tight">Isian Induk</h1>
          </div>
          <button onClick={openNew} className="ml-auto bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all shrink-0">
            <Icon name="add" /> <span className="hidden sm:inline">Tambah Isian</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        {/* Info note */}
        <div className="bg-primary-container/10 border border-primary-container/20 p-4 rounded-xl flex gap-3 items-start mb-stack-gap">
          <Icon name="info" className="text-primary shrink-0" />
          <p className="font-label-md text-on-surface leading-snug">
            <strong className="text-primary">Isian induk</strong> = unit stok yang dipotong saat menu terjual.{' '}
            <span className="text-on-surface-variant font-normal">Data tidak dihapus permanen, hanya dinonaktifkan untuk menjaga keutuhan histori transaksi.</span>
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-surface-container-lowest rounded-2xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] overflow-hidden border border-outline-variant">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant">Nama Isian</th>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant text-center">Status</th>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant">Menu Tertaut</th>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant">Ambang Peringatan</th>
                <th className="px-6 py-4 font-label-lg text-on-surface-variant text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {parents.map((p) => (
                <tr key={p.id} className={`transition-colors ${p.active ? 'hover:bg-surface-container-low/50' : 'bg-surface-container-low/30 opacity-70'}`}>
                  <td className="px-6 py-5"><span className={`font-bold text-lg ${p.active ? 'text-on-surface' : 'text-on-surface-variant'}`}>{p.name}</span></td>
                  <td className="px-6 py-5 text-center"><StatusBadge active={p.active} /></td>
                  <td className="px-6 py-5"><span className="font-bold text-on-surface">{linkedMenuCount(p.id)}</span> <span className="text-on-surface-variant text-sm">item menu</span></td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1 bg-secondary-container/20 text-secondary border border-secondary-container rounded-lg inline-block font-bold">{p.threshold} Unit</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(p)} title="Edit" className="p-2 rounded-lg hover:bg-surface-variant text-on-surface-variant transition-colors"><Icon name="edit" /></button>
                      <button onClick={() => toggleParentActive(p.id)} title={p.active ? 'Nonaktifkan' : 'Aktifkan'} className={`p-2 rounded-lg transition-colors ${p.active ? 'hover:bg-red-50 text-error' : 'hover:bg-green-50 text-green-600'}`}>
                        <Icon name={p.active ? 'visibility_off' : 'check_circle'} />
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
          {parents.map((p) => (
            <div key={p.id} className={`bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 shadow-sm ${p.active ? '' : 'opacity-70'}`}>
              <div className="flex justify-between items-start gap-2">
                <span className={`font-bold text-lg ${p.active ? 'text-on-surface' : 'text-on-surface-variant'}`}>{p.name}</span>
                <StatusBadge active={p.active} />
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="text-on-surface-variant"><Icon name="restaurant_menu" className="!text-base align-middle" /> <span className="font-bold text-on-surface">{linkedMenuCount(p.id)}</span> menu</span>
                <span className="px-2.5 py-0.5 bg-secondary-container/20 text-secondary border border-secondary-container rounded-lg font-bold text-xs">Ambang {p.threshold}</span>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-outline-variant">
                <button onClick={() => openEdit(p)} className="flex-1 min-h-[44px] border border-outline rounded-xl font-bold text-on-surface flex items-center justify-center gap-2 active:scale-95"><Icon name="edit" className="!text-base" /> Edit</button>
                <button onClick={() => toggleParentActive(p.id)} className={`flex-1 min-h-[44px] rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 ${p.active ? 'border border-error/40 text-error' : 'border border-green-600/40 text-green-600'}`}>
                  <Icon name={p.active ? 'visibility_off' : 'check_circle'} className="!text-base" /> {p.active ? 'Nonaktifkan' : 'Aktifkan'}
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
              <h2 className="font-headline-md text-headline-md text-on-surface">{editing.id ? 'Edit Isian Induk' : 'Tambah Isian Induk'}</h2>
              <button onClick={close} className="p-2 rounded-full hover:bg-surface-variant"><Icon name="close" /></button>
            </div>

            <form onSubmit={save} className="flex-grow flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant">Nama Isian</label>
                <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Sosis Premium" type="text" className="w-full h-[52px] border border-outline rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface-container-lowest" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant">Ambang Peringatan Stok Menipis</label>
                <div className="relative">
                  <input value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} placeholder="10" type="number" min="0" className="w-full h-[52px] border border-outline rounded-xl px-4 pr-16 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface-container-lowest" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md">Unit</span>
                </div>
                <p className="text-xs text-on-surface-variant italic">Sistem memberi notifikasi bila sisa stok isian turun di bawah angka ini.</p>
              </div>

              {editing.id && (
                <div className="bg-surface-container rounded-xl p-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-on-surface">Status</span>
                    <span className="text-xs text-on-surface-variant">{editing.active ? 'Aktif — tampil di operasional harian' : 'Nonaktif — disembunyikan'}</span>
                  </div>
                  <button type="button" onClick={() => { toggleParentActive(editing.id); setEditing((p) => ({ ...p, active: !p.active })) }} className={`relative w-14 h-8 rounded-full transition-colors ${editing.active ? 'bg-primary' : 'bg-surface-variant'}`}>
                    <span className={`absolute top-1 h-6 w-6 bg-white rounded-full shadow transition-all ${editing.active ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              )}

              <div className="p-4 rounded-xl border border-dashed border-outline-variant flex gap-3">
                <Icon name="shield" className="text-secondary shrink-0" />
                <p className="text-sm text-on-surface-variant"><strong>Keamanan Data:</strong> menonaktifkan isian menyembunyikannya dari operasional harian tanpa menghapus data historisnya.</p>
              </div>

              <div className="mt-auto flex gap-4 pt-6 border-t border-outline-variant">
                <button type="button" onClick={close} className="flex-1 h-[52px] border border-outline rounded-xl font-bold text-on-surface-variant hover:bg-surface-variant active:opacity-80 transition-all">Batal</button>
                <button type="submit" className="flex-1 h-[52px] bg-primary text-on-primary rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-md">Simpan Isian</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
