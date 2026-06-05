import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShoppingItems } from '../../store/useShoppingItems.js'
import { addShoppingItem, updateShoppingItem, removeShoppingItem } from '../../store/shopping.js'

// Kelola DAFTAR ITEM BELANJA (checklist). Dipakai Kasir (Opening/Closing centang),
// Operasional (belanja), Supplier (harga). Owner tambah/edit/hapus di sini →
// tersinkron realtime ke semua (tabel shopping_items).
const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OwnerShoppingItems() {
  const navigate = useNavigate()
  const items = useShoppingItems() || []
  const [name, setName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const add = (e) => {
    e.preventDefault()
    const nm = name.trim()
    if (!nm) return
    addShoppingItem(nm)
    setName('')
  }
  const startEdit = (i) => { setEditId(i.id); setEditName(i.name) }
  const saveEdit = () => { if (editName.trim()) updateShoppingItem(editId, editName); setEditId(null); setEditName('') }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container shadow-md shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[72px] max-w-3xl mx-auto">
          <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <div className="min-w-0">
            <p className="text-[11px] opacity-80 leading-none">Kasir · Operasional · Supplier</p>
            <h1 className="font-headline-md text-headline-md leading-tight">Daftar Belanja</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-4">
        <div className="p-3 rounded-xl border border-dashed border-outline-variant flex gap-2">
          <Icon name="info" className="text-secondary shrink-0" />
          <p className="text-label-md text-on-surface-variant">Item di sini muncul sebagai <strong>checklist belanja</strong> di Kasir (Buka/Tutup Hari), dipakai Operasional saat belanja, & Supplier untuk harga. Perubahan tersinkron <strong>realtime</strong>.</p>
        </div>

        {/* Tambah item */}
        <form onSubmit={add} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama item belanja (mis. Kentang)" className="flex-1 h-[52px] px-4 rounded-xl border border-outline focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest" />
          <button type="submit" className="px-5 h-[52px] rounded-xl bg-primary text-on-primary font-label-lg flex items-center gap-2 active:scale-95 shrink-0"><Icon name="add" /> Tambah</button>
        </form>

        {items.length === 0 && <p className="text-center text-on-surface-variant py-8">Belum ada item. Tambah di atas.</p>}

        <div className="flex flex-col gap-2">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant bg-surface-container-lowest">
              <Icon name="shopping_basket" className="text-on-surface-variant shrink-0" />
              {editId === i.id ? (
                <>
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} className="flex-1 h-10 px-3 rounded-lg border border-outline focus:ring-2 focus:ring-primary outline-none bg-surface" />
                  <button onClick={saveEdit} className="px-3 h-10 rounded-lg bg-primary text-on-primary font-bold active:scale-95">Simpan</button>
                  <button onClick={() => setEditId(null)} className="px-2 h-10 rounded-lg text-on-surface-variant">Batal</button>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-0 font-medium truncate">{i.name}</span>
                  <button onClick={() => startEdit(i)} title="Edit" className="w-9 h-9 rounded-lg hover:bg-surface-variant text-on-surface-variant flex items-center justify-center"><Icon name="edit" className="!text-[20px]" /></button>
                  <button onClick={() => { if (confirm(`Hapus item "${i.name}"?`)) removeShoppingItem(i.id) }} title="Hapus" className="w-9 h-9 rounded-lg hover:bg-error-container text-error flex items-center justify-center"><Icon name="delete" className="!text-[20px]" /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
