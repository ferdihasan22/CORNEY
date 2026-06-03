import { Navigate, useNavigate } from 'react-router-dom'
import { fmtRp } from '../data/menu.js'
import { useSupplierReq } from '../store/useSupplierReq.js'
import { useSupplierPrices } from '../store/useSupplierPrices.js'
import { priceOfSup } from '../store/supplierPrices.js'
import { toggleReqItem, setReqItemQty, setReqStatus, removeRequest } from '../store/supplierReq.js'
import { addFulfilled } from '../store/supplierFulfilled.js'
import { getSupplierSession } from './session.js'
import SupplierNav from './SupplierNav.jsx'

// 3.1 — SUP Request Belanja Masuk (per cabang). Operasional mengirim rekap;
// tiap cabang jadi 1 kartu. Supplier proses checklist (centang=siap / un-centang=
// stok kosong), sesuaikan jumlah, harga otomatis dari Atur Harga → subtotal &
// total per cabang. Fase 1 lokal.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const STATUS = {
  baru: { label: 'Baru', cls: 'bg-error text-on-error' },
  diproses: { label: 'Diproses', cls: 'bg-amber-100 text-amber-700' },
  selesai: { label: 'Selesai', cls: 'bg-green-100 text-green-700' },
}

export default function SupplierRequest() {
  const navigate = useNavigate()
  const orders = useSupplierReq() || []
  useSupplierPrices() // re-render saat harga berubah
  if (!getSupplierSession()) return <Navigate to="/supplier" replace />

  const priceOf = (id) => priceOfSup(id)
  const aktif = orders.filter((o) => o.status !== 'selesai')

  // WA Owner — pesan rekap otomatis dari semua request aktif (hanya item siap).
  const WA_OWNER = '62895341869458'
  const anyReady = aktif.some((o) => o.items.some((it) => it.ready))
  const grandAll = aktif.reduce((s, o) => s + o.items.filter((it) => it.ready).reduce((x, it) => x + priceOf(it.id) * it.qty, 0), 0)
  const waText = () => {
    const lines = ['*Belanja CORNEY*']
    aktif.forEach((o) => {
      const siap = o.items.filter((it) => it.ready)
      if (siap.length === 0) return
      let tq = 0, sub = 0
      lines.push('', `*${o.branchName}*${o.tgl ? ` (${o.tgl})` : ''}`)
      siap.forEach((it) => { const h = priceOf(it.id); const s = h * it.qty; tq += it.qty; sub += s; lines.push(`- ${it.name}: ${it.qty}${h > 0 ? ` x ${fmtRp(h)} = ${fmtRp(s)}` : ''}`) })
      lines.push(`Total qty: ${tq}`, `Total: ${fmtRp(sub)}`)
    })
    lines.push('', `*TOTAL SEMUA: ${fmtRp(grandAll)}*`)
    return encodeURIComponent(lines.join('\n'))
  }
  const selesaikan = () => {
    if (!anyReady) return
    window.open(`https://wa.me/${WA_OWNER}?text=${waText()}`, '_blank')
    const at = new Date().toISOString()
    aktif.forEach((o) => {
      // Catat hasil pemenuhan (permanen) → dibaca Owner di tab Belanjaan.
      addFulfilled({
        id: `${o.id}-F`, at, tgl: o.tgl, branchId: o.branchId, branchName: o.branchName,
        items: o.items.map((it) => ({ uid: it.uid, id: it.id, name: it.name, src: it.src, reqQty: it.reqQty ?? it.qty, qty: it.qty, ready: it.ready, price: priceOf(it.id) })),
      })
      setReqStatus(o.id, 'selesai')
    })
  }

  const renderOrder = (o) => {
    const st = STATUS[o.status] || STATUS.baru
    const locked = o.status === 'selesai'
    const siap = o.items.filter((it) => it.ready)
    const kosong = o.items.length - siap.length
    const total = siap.reduce((s, it) => s + priceOf(it.id) * it.qty, 0)
    return (
      <div key={o.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] overflow-hidden">
        <div className="bg-surface-container-low px-4 py-3 flex items-center justify-between gap-2 border-b border-outline-variant/30">
          <div className="min-w-0">
            <p className="font-headline-md text-headline-md flex items-center gap-1.5"><Icon name="storefront" className="!text-[18px] text-primary" /> {o.branchName}</p>
            <p className="text-label-md text-on-surface-variant">{o.tgl ? `closing ${o.tgl} · ` : ''}dikirim {fmtTime(o.createdAt)}</p>
          </div>
          <span className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold uppercase ${st.cls}`}>{st.label}</span>
        </div>

        <div className="p-4 space-y-1.5">
          {o.items.map((it) => {
            const harga = priceOf(it.id)
            const sub = harga * it.qty
            const adjusted = it.reqQty != null && it.qty !== it.reqQty
            return (
              <div key={it.uid} className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 ${it.ready ? 'border-green-300 bg-green-50' : 'border-error/40 bg-error-container/40'}`}>
                <button onClick={() => !locked && toggleReqItem(o.id, it.uid)} disabled={locked} className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 active:scale-90 ${it.ready ? 'bg-green-600 text-white' : 'border-2 border-error text-error'}`}><Icon name={it.ready ? 'check' : 'close'} className="!text-[18px]" /></button>
                <div className="flex-1 min-w-0">
                  <p className="font-label-lg leading-tight flex items-center gap-1.5">{it.name}{it.src === 'ops' && <span className="text-[9px] font-bold uppercase bg-primary-fixed text-primary px-1 py-0.5 rounded">+ops</span>}</p>
                  {it.ready ? (
                    <p className="text-label-md text-on-surface-variant">{harga > 0 ? <>{fmtRp(harga)} × {it.qty} = <strong className="text-on-surface">{fmtRp(sub)}</strong></> : <span className="text-amber-700 font-bold">harga belum diatur</span>}{adjusted && <span className="text-amber-700 font-bold"> · diminta {it.reqQty}</span>}</p>
                  ) : (
                    <p className="text-label-md text-error font-bold">Stok kosong</p>
                  )}
                </div>
                {it.ready ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => !locked && setReqItemQty(o.id, it.uid, it.qty - 1)} disabled={locked} className="w-7 h-7 rounded-lg bg-white border border-outline-variant flex items-center justify-center active:scale-90"><Icon name="remove" className="!text-[16px]" /></button>
                    <input inputMode="numeric" value={it.qty} disabled={locked} onChange={(e) => setReqItemQty(o.id, it.uid, e.target.value.replace(/\D/g, ''))} className="w-9 h-7 text-center rounded-lg border border-outline-variant font-bold bg-white min-w-0" size={1} />
                    <button onClick={() => !locked && setReqItemQty(o.id, it.uid, it.qty + 1)} disabled={locked} className="w-7 h-7 rounded-lg bg-green-600 text-white flex items-center justify-center active:scale-90"><Icon name="add" className="!text-[16px]" /></button>
                  </div>
                ) : (
                  <span className="font-headline-md text-headline-md text-on-surface-variant/40 line-through shrink-0">{it.reqQty ?? it.qty}</span>
                )}
              </div>
            )
          })}

          {/* Total per cabang */}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-outline-variant/40">
            <p className="text-label-md text-on-surface-variant"><span className="text-green-700 font-bold">{siap.length} siap</span>{kosong > 0 && <> · <span className="text-error font-bold">{kosong} kosong</span></>}</p>
            <p className="font-headline-md text-headline-md">Total: <span className="text-primary">{fmtRp(total)}</span></p>
          </div>

          {locked && (
            <div className="flex justify-end pt-1">
              <button onClick={() => removeRequest(o.id)} className="h-10 px-4 rounded-xl bg-surface-container-high text-on-surface-variant font-label-lg flex items-center gap-1.5 active:scale-95"><Icon name="delete" className="!text-[18px]" /> Hapus</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-48">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="assignment" /> Request Masuk</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Supplier · per cabang</p></div>
          <button onClick={() => navigate('/supplier/harga')} className="h-10 px-4 rounded-full bg-on-primary-container/15 hover:bg-on-primary-container/25 flex items-center gap-1.5 font-label-md active:scale-95"><Icon name="sell" className="!text-[18px]" /> Atur Harga</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full p-5 space-y-4">
        {aktif.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant">
            <Icon name="inbox" className="!text-6xl opacity-30" />
            <p className="mt-3 font-headline-md">Tidak ada request aktif</p>
            <p className="text-label-md opacity-70">Request baru muncul setelah Operasional menekan "Kirim ke Supplier". Yang sudah selesai ada di tab <strong>Riwayat</strong>.</p>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900">
              <Icon name="info" className="!text-[18px] shrink-0 mt-0.5" />
              <p className="text-label-md leading-snug">Bisa <strong>sesuaikan jumlah</strong> (−/+) jika stok tidak cukup, atau <strong>hapus centang</strong> item jika stok kosong — item kosong cukup dikosongkan, <strong>pengadaannya diurus Owner</strong>. Harga & total ikut <strong>Atur Harga</strong>.</p>
            </div>
            {aktif.map(renderOrder)}
          </>
        )}
      </main>

      {aktif.length > 0 && (
        <div className="fixed bottom-[68px] left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 mb-2">
            <span className="text-label-md text-on-surface-variant">{aktif.length} cabang siap dikirim</span>
            <span className="font-headline-md">Total: <span className="text-primary">{fmtRp(grandAll)}</span></span>
          </div>
          <button onClick={selesaikan} disabled={!anyReady} className="max-w-2xl mx-auto w-full min-h-[52px] rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg text-white disabled:opacity-40" style={{ backgroundColor: '#25D366' }}>
            <Icon name="task_alt" /> Tandai Selesai & Kirim WA Owner
          </button>
        </div>
      )}

      <SupplierNav />
    </div>
  )
}
