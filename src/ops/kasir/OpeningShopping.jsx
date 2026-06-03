import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BRANCHES } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, setBelanjaDatang } from '../../store/day.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { useShoppingItems } from '../../store/useShoppingItems.js'
import { useSupplierFulfilled } from '../../store/useSupplierFulfilled.js'

// OPN-03 — Checklist Belanjaan Datang. Sumber = tab Belanjaan Owner: yang
// DIPENUHI Supplier + yang dibeli di luar (entri pemenuhan terbaru cabang ini).
// Kasir centang yang benar-benar datang + sesuaikan jumlah; yang tidak datang
// tercatat (data untuk Owner). Fallback ke pesanan kasir bila supplier belum proses.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const dnum = (t) => { const [d, m, y] = (t || '').split('/'); return Number(y) * 10000 + Number(m) * 100 + Number(d) }

export default function OpeningShopping() {
  const navigate = useNavigate()
  const day = useDay()
  const sales = useSalesDaily() || []
  const shopItems = useShoppingItems() || []
  const fulfilled = useSupplierFulfilled() || []

  const itemName = (id) => shopItems.find((i) => i.id === id)?.name || id
  // Sumber utama = tab Belanjaan Owner: entri pemenuhan terbaru cabang ini →
  // item yang DIPENUHI supplier + yang DIBELI DI LUAR. Itu yang akan datang.
  let fe = null
  fulfilled.forEach((e) => { if (e.branchId !== day?.branchId) return; if (!fe || (e.at || '') > (fe.at || '')) fe = e })
  let pesanan = []
  let sumber = 'pemenuhan supplier + beli di luar'
  if (fe) {
    fe.items.forEach((it) => {
      if (it.ready) pesanan.push({ id: it.uid || it.id, name: it.name, qtyPesan: it.qty, tag: 'supplier' })
      else if (it.luar) pesanan.push({ id: it.uid || it.id, name: it.name, qtyPesan: it.luar.qty, tag: 'luar' })
    })
  } else {
    // Fallback: supplier belum memproses → pakai pesanan kasir (Master Laporan).
    let latest = null
    sales.forEach((r) => { if (r.branchId !== day?.branchId) return; if (!latest || dnum(r.tgl) > dnum(latest.tgl)) latest = r })
    pesanan = Object.entries(latest?.belanja || {}).filter(([, q]) => q > 0).map(([id, q]) => ({ id, name: itemName(id), qtyPesan: q, tag: 'pesan' }))
    sumber = 'pesanan kasir (supplier belum proses)'
  }

  const [rows, setRows] = useState(() => pesanan.reduce((a, p) => { a[p.id] = { datang: true, qty: String(p.qtyPesan) }; return a }, {}))

  if (!day) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase !== PHASE.BELANJA) return <Navigate to="/ops/kasir" replace />

  const branch = BRANCHES.find((b) => b.id === day.branchId)
  const toggle = (id) => setRows((r) => ({ ...r, [id]: { ...r[id], datang: !r[id].datang } }))
  const setQty = (id, v) => setRows((r) => ({ ...r, [id]: { ...r[id], qty: v.replace(/\D/g, '') } }))
  const datangCount = pesanan.filter((p) => rows[p.id]?.datang).length
  const kurang = pesanan.length - datangCount

  const lanjut = () => {
    const received = {}
    pesanan.forEach((p) => { received[p.id] = { datang: !!rows[p.id]?.datang, qty: Number(rows[p.id]?.qty) || 0, qtyPesan: p.qtyPesan } })
    setBelanjaDatang(received)
    navigate('/ops/kasir', { replace: true })
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-28">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto">
          <p className="font-label-md opacity-90 uppercase tracking-wider">Langkah 3 dari 4</p>
          <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2 mt-1"><Icon name="inventory_2" /> Belanjaan Datang</h1>
          <p className="font-label-md opacity-90 mt-1 flex items-center gap-1.5"><Icon name="storefront" className="!text-[16px]" /> {branch?.name} · yang dipesan kemarin</p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900">
          <Icon name="info" className="!text-[18px] shrink-0 mt-0.5" />
          <p className="text-label-md leading-snug">Daftar dari <b>tab Belanjaan Owner</b> ({sumber}). Centang yang <b>benar-benar datang</b> & sesuaikan jumlahnya. Yang tidak datang biarkan tidak tercentang — tercatat untuk Owner.</p>
        </div>

        {pesanan.length === 0 ? (
          <div className="bg-surface-container-low rounded-2xl p-6 text-center text-on-surface-variant border border-outline-variant/30">
            <Icon name="receipt_long" className="!text-5xl opacity-30" />
            <p className="mt-2 font-label-lg">Tidak ada pesanan kemarin.</p>
            <p className="text-label-md opacity-70">Belanjaan muncul kalau closing kemarin mengisi daftar belanja.</p>
          </div>
        ) : (
          <>
            <div className="bg-error-container border-2 border-error rounded-2xl p-4 flex items-start gap-3">
              <Icon name="warning" fill className="!text-[32px] text-error shrink-0" />
              <div>
                <p className="font-headline-md text-headline-md text-on-error-container leading-tight">Hilangkan centang untuk barang yang TIDAK datang!</p>
                <p className="text-label-lg text-on-error-container/90 mt-1">Kalau salah centang, <b>laporanmu jadi rusak</b>. Pastikan benar.</p>
              </div>
            </div>
            <div className={`rounded-2xl p-4 flex items-start gap-3 ${kurang > 0 ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-green-100 text-green-800'}`}>
              <Icon name={kurang > 0 ? 'pending_actions' : 'check_circle'} fill className="!text-[26px] shrink-0" />
              <p className="font-label-lg leading-snug">{datangCount}/{pesanan.length} item ditandai datang{kurang > 0 ? ` · ${kurang} belum datang` : ' · lengkap'}</p>
            </div>

            <div className="space-y-2">
              {pesanan.map((p) => {
                const r = rows[p.id] || { datang: false, qty: '0' }
                return (
                  <div key={p.id} className={`rounded-2xl border-2 p-3 flex items-center gap-3 ${r.datang ? 'border-green-300 bg-green-50' : 'border-outline-variant/40 bg-surface-container-lowest'}`}>
                    <button onClick={() => toggle(p.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.datang ? 'bg-green-600 text-white' : 'border-2 border-outline-variant text-transparent'}`}><Icon name="check" className="!text-[20px]" /></button>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-lg leading-tight flex items-center gap-1.5">{p.name}{p.tag === 'luar' && <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1 py-0.5 rounded">beli luar</span>}</p>
                      <p className="text-label-md text-on-surface-variant">{p.tag === 'luar' ? 'dibeli di luar' : 'dipesan'} {p.qtyPesan}</p>
                    </div>
                    {r.datang ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setQty(p.id, String(Math.max(0, (Number(r.qty) || 0) - 1)))} className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center active:scale-90"><Icon name="remove" className="!text-[18px]" /></button>
                        <input inputMode="numeric" value={r.qty} onChange={(e) => setQty(p.id, e.target.value)} className="w-10 h-8 text-center rounded-lg border border-primary font-bold bg-surface min-w-0" size={1} />
                        <button onClick={() => setQty(p.id, String((Number(r.qty) || 0) + 1))} className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center active:scale-90"><Icon name="add" className="!text-[18px]" /></button>
                      </div>
                    ) : (
                      <span className="text-label-md text-error font-bold shrink-0">belum datang</span>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        <button onClick={lanjut} className="max-w-2xl mx-auto w-full min-h-[52px] bg-primary text-on-primary rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg">
          {pesanan.length === 0 ? 'Lewati & Lanjut' : 'Konfirmasi & Lanjut'} <Icon name="arrow_forward" />
        </button>
      </div>
    </div>
  )
}
