import { useSyncExternalStore, useState } from 'react'
import { subscribe, deadCount, deadItems, retryDead, discardDead } from '../store/outbox.js'

// Peringatan GLOBAL saat ada tulisan yang GAGAL tersimpan ke server (karantina
// outbox). Tanpa ini, kegagalan permanen "diam-diam" & perubahan lokal bisa balik
// saat hydrate. Muncul otomatis (deadCount>0), null saat bersih. Aman utk semua
// peran (customer anon tak punya outbox → tak pernah muncul).
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

// Label tabel → bahasa manusia (biar user paham apa yang gagal).
const LABEL = {
  branches: 'Cabang', menus: 'Menu', parents: 'Isian', sauces: 'Saus', promos: 'Promo',
  banners: 'Banner', landing_cards: 'Gambar Landing', shopping_items: 'Daftar Belanja',
  sales_daily: 'Laporan Penjualan', stock_daily: 'Laporan Stok', usage: 'Pemakaian Kas',
  expense: 'Uang Belanjaan', deposits: 'Setoran', shipments: 'Kiriman', par_stock: 'Stok Standar',
  branch_status: 'Status Buka', branch_overrides: 'Harga per Cabang', branch_sauce_overrides: 'Saus per Cabang',
  supplier_requests: 'Request Belanja', supplier_fulfilled: 'Belanja Supplier', ops_belanja: 'Belanja Operasional',
}
const human = (op) => LABEL[op?.table] || op?.table || (op?.fn ? `Aksi: ${op.fn}` : 'Data')

export default function OutboxDeadBanner() {
  const n = useSyncExternalStore(subscribe, deadCount, deadCount)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!n) return null
  const items = deadItems()
  const retry = () => { setBusy(true); retryDead(); setTimeout(() => setBusy(false), 1800) }
  const discard = () => { if (window.confirm('Buang perubahan yang gagal ini? Tidak bisa dikembalikan.')) { discardDead(); setOpen(false) } }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] pointer-events-none flex justify-center p-3">
      <div className="pointer-events-auto w-full max-w-lg bg-white rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.22)] border border-error/40 overflow-hidden">
        <div className="bg-error-container/60 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-error text-on-error flex items-center justify-center shrink-0"><Icon name="cloud_off" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-error leading-tight">{n} perubahan gagal tersimpan ke server</p>
            <p className="text-[12px] text-on-surface-variant leading-snug">Data ini BELUM masuk ke server. Coba kirim ulang setelah koneksi/akses stabil.</p>
          </div>
          <button onClick={() => setOpen((o) => !o)} className="shrink-0 w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center active:scale-95"><Icon name={open ? 'expand_more' : 'expand_less'} /></button>
        </div>

        {open && (
          <div className="px-4 py-2 max-h-44 overflow-y-auto border-b border-outline-variant">
            {items.map((op, i) => (
              <div key={op.id || i} className="py-2 flex items-start gap-2 text-[12px] border-b border-outline-variant/50 last:border-0">
                <Icon name="error" className="!text-[15px] text-error shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-on-surface">{human(op)} <span className="font-normal text-on-surface-variant">· {op.kind}</span></p>
                  {op.error && <p className="text-on-surface-variant break-words leading-snug">{op.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-3 flex gap-2">
          <button onClick={retry} disabled={busy} className="flex-1 h-11 rounded-xl bg-primary text-on-primary font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
            <Icon name={busy ? 'sync' : 'cloud_upload'} className={busy ? '!text-[18px] animate-spin' : '!text-[18px]'} /> {busy ? 'Mengirim…' : 'Coba Kirim Ulang'}
          </button>
          <button onClick={discard} className="px-4 h-11 rounded-xl border border-outline text-on-surface-variant font-bold active:scale-95">Buang</button>
        </div>
      </div>
    </div>
  )
}
