import { Navigate } from 'react-router-dom'
import { fmtRp } from '../data/menu.js'
import { useSupplierReq } from '../store/useSupplierReq.js'
import { useSupplierPrices } from '../store/useSupplierPrices.js'
import { priceOfSup } from '../store/supplierPrices.js'
import { removeRequest } from '../store/supplierReq.js'
import { getSupplierSession } from './session.js'
import SupplierNav from './SupplierNav.jsx'

// SUP Riwayat Request — request selesai, DIKELOMPOKKAN per tanggal. Satu tombol
// "Kirim Ulang" per tanggal (gabungan semua cabang tanggal itu). Fase 1 lokal.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) } catch { return iso } }
const WA_OWNER = '62895341869458'

export default function SupplierHistory() {
  const orders = useSupplierReq() || []
  useSupplierPrices()
  if (!getSupplierSession()) return <Navigate to="/supplier" replace />

  const selesai = orders.filter((o) => o.status === 'selesai')
  // Kelompokkan per tanggal (hari dikirim/diselesaikan).
  const groups = {}
  selesai.forEach((o) => { const key = (o.createdAt || '').slice(0, 10) || 'lain'; (groups[key] = groups[key] || []).push(o) })
  const groupList = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))

  const waTextGroup = (list) => {
    const lines = ['*Belanja CORNEY*']
    let grand = 0
    list.forEach((o) => {
      const siap = o.items.filter((it) => it.ready)
      if (siap.length === 0) return
      let tq = 0, sub = 0
      lines.push('', `*${o.branchName}*${o.tgl ? ` (${o.tgl})` : ''}`)
      siap.forEach((it) => { const h = priceOfSup(it.id); const s = h * it.qty; tq += it.qty; sub += s; lines.push(`- ${it.name}: ${it.qty}${h > 0 ? ` x ${fmtRp(h)} = ${fmtRp(s)}` : ''}`) })
      lines.push(`Total qty: ${tq}`, `Total: ${fmtRp(sub)}`)
      grand += sub
    })
    lines.push('', `*TOTAL SEMUA: ${fmtRp(grand)}*`)
    return encodeURIComponent(lines.join('\n'))
  }
  const kirimUlang = (list) => window.open(`https://wa.me/${WA_OWNER}?text=${waTextGroup(list)}`, '_blank')

  return (
    <div className="bg-background text-on-surface min-h-screen pb-28">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto"><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="history" /> Riwayat Request</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Supplier · per tanggal</p></div>
      </header>

      <main className="max-w-2xl mx-auto w-full p-5 space-y-6">
        {selesai.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant">
            <Icon name="history_toggle_off" className="!text-6xl opacity-30" />
            <p className="mt-3 font-headline-md">Belum ada riwayat</p>
            <p className="text-label-md opacity-70">Request yang sudah ditandai selesai akan muncul di sini.</p>
          </div>
        ) : groupList.map(([key, list]) => {
          const grand = list.reduce((s, o) => s + o.items.filter((it) => it.ready).reduce((x, it) => x + priceOfSup(it.id) * it.qty, 0), 0)
          return (
            <section key={key} className="space-y-2">
              {/* Header tanggal + satu tombol Kirim Ulang utk semua cabang tgl ini */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-headline-md text-headline-md flex items-center gap-1.5"><Icon name="event" className="!text-[18px] text-primary" /> {fmtDate(list[0]?.createdAt)}</h2>
                  <p className="text-label-md text-on-surface-variant">{list.length} cabang · Total {fmtRp(grand)}</p>
                </div>
                <button onClick={() => kirimUlang(list)} className="shrink-0 h-11 px-4 rounded-xl text-white font-bold flex items-center gap-1.5 active:scale-95 shadow-md" style={{ backgroundColor: '#25D366' }}><Icon name="send" className="!text-[18px]" /> Kirim Ulang</button>
              </div>

              {list.map((o) => {
                const siap = o.items.filter((it) => it.ready)
                const kosong = o.items.length - siap.length
                const total = siap.reduce((s, it) => s + priceOfSup(it.id) * it.qty, 0)
                const totalQty = siap.reduce((s, it) => s + it.qty, 0)
                return (
                  <div key={o.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] overflow-hidden">
                    <div className="bg-surface-container-low px-4 py-2.5 flex items-center justify-between gap-2 border-b border-outline-variant/30">
                      <p className="font-headline-md text-headline-md flex items-center gap-1.5 min-w-0"><Icon name="storefront" className="!text-[18px] text-primary" /> {o.branchName} {o.tgl && <span className="text-label-md text-on-surface-variant font-normal">· {o.tgl}</span>}</p>
                      <span className="text-label-md text-on-surface-variant shrink-0">{fmtTime(o.createdAt)}</span>
                    </div>
                    <div className="p-4 space-y-1">
                      {siap.map((it) => { const h = priceOfSup(it.id); return (
                        <div key={it.uid} className="flex justify-between text-label-lg gap-2">
                          <span className="text-on-surface-variant min-w-0 truncate">{it.name} <span className="text-on-surface font-bold">×{it.qty}</span></span>
                          <span className="shrink-0">{h > 0 ? fmtRp(h * it.qty) : '—'}</span>
                        </div>
                      ) })}
                      {kosong > 0 && <p className="text-[11px] text-error font-bold pt-1">{kosong} item stok kosong (tidak dikirim).</p>}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-outline-variant/40">
                        <span className="text-label-md text-on-surface-variant">Total qty: <strong className="text-on-surface">{totalQty}</strong> · Total: <strong className="text-primary">{fmtRp(total)}</strong></span>
                        <button onClick={() => removeRequest(o.id)} className="h-9 px-3 rounded-lg bg-surface-container-high text-on-surface-variant font-label-md flex items-center gap-1 active:scale-95"><Icon name="delete" className="!text-[16px]" /> Hapus</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
      </main>

      <SupplierNav />
    </div>
  )
}
