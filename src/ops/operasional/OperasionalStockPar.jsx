import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS, DUMMY_STOCK } from '../../data/menu.js'
import { useShipments } from '../../store/useShipments.js'
import { createShipment } from '../../store/shipments.js'
import { takeFreezer } from '../../store/freezer.js'
import { useStockDaily } from '../../store/useStockDaily.js'
import { useParStock } from '../../store/useParStock.js'
import { parOf } from '../../store/parstock.js'
import { latestSisaByBranch } from '../../store/aggregate.js'

// 2.4 — OPS-01 Isi Stok ke Par. Ported from Stitch "fill_stock_to_par_operasional_mobile".
// Kirim = par (standar Owner) − Sisa Aktual TERBARU dari MASTER LAPORAN (sumber
// kebenaran; closing kasir terakhir). Operasional boleh ubah bila fisik beda.
// Shipment → Opening Day cabang → kasir konfirmasi (serah-terima dua sisi).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const STATUS = {
  menunggu: { label: 'Menunggu konfirmasi kasir', cls: 'bg-secondary-fixed text-on-secondary-fixed-variant' },
  diterima: { label: 'Diterima (cocok)', cls: 'bg-green-100 text-green-700' },
  selisih: { label: 'Selisih kirim-terima', cls: 'bg-error-container text-on-error-container' },
}
// Tema warna per isian induk — biar tiap kartu beda & gampang dibedakan sekilas.
const THEME = {
  mozza: { bd: 'border-amber-300', hd: 'bg-amber-100', ic: 'text-amber-700', tx: 'text-amber-900' },
  sosis: { bd: 'border-rose-300', hd: 'bg-rose-100', ic: 'text-rose-700', tx: 'text-rose-900' },
  jumbo: { bd: 'border-violet-300', hd: 'bg-violet-100', ic: 'text-violet-700', tx: 'text-violet-900' },
  mix: { bd: 'border-teal-300', hd: 'bg-teal-100', ic: 'text-teal-700', tx: 'text-teal-900' },
}
const DEFAULT_THEME = { bd: 'border-outline-variant/50', hd: 'bg-surface-container', ic: 'text-primary', tx: 'text-on-surface' }

export default function OperasionalStockPar() {
  const navigate = useNavigate()
  const shipments = useShipments() || []
  useStockDaily() // subscribe → Sisa Aktual dari Master Laporan, ikut update
  useParStock() // subscribe → Stok Standar yang diatur Owner, ikut update
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const [edits, setEdits] = useState({})
  const [toast, setToast] = useState('')

  const branch = BRANCHES.find((b) => b.id === branchId)
  const par = parOf(branchId) // Stok Standar (diatur Owner), bukan lagi hardcode
  // Sisa = Sisa Aktual TERBARU dari Master Laporan (closing kasir terakhir).
  // Fallback ke data contoh hanya bila cabang belum punya baris stok sama sekali.
  const masterSisa = latestSisaByBranch(branchId)
  const sisa = masterSisa || DUMMY_STOCK[branchId] || {}
  const sisaTgl = masterSisa?.tgl || null
  const kirimDefault = (p) => Math.max(0, (par[p] || 0) - (sisa[p] || 0))

  // Reset edits when the branch changes.
  useEffect(() => { setEdits({}) }, [branchId])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t) }, [toast])

  const qtyOf = (p) => (edits[p] != null ? edits[p] : kirimDefault(p))
  const setQty = (p, v) => setEdits((m) => ({ ...m, [p]: Math.max(0, Number(v.replace(/\D/g, '')) || 0) }))
  const totalKirim = PARENT_FILLINGS.reduce((s, p) => s + qtyOf(p.id), 0)

  const todays = shipments.filter((s) => s.branchId === branchId)
  // Cegah kirim ganda: kalau masih ada kiriman MENUNGGU konfirmasi kasir, kunci tombol.
  const pending = todays.some((s) => s.status === 'menunggu')

  const kirim = () => {
    if (pending) return
    const items = PARENT_FILLINGS.map((p) => ({ parent: p.id, parentName: p.name, qty: qtyOf(p.id) }))
    const made = createShipment({ branchId, branchName: branch?.name, items })
    if (made.length) {
      // Ambil dari freezer rumah (per cabang) → stok freezer berkurang.
      items.forEach((it) => { if (it.qty > 0) takeFreezer(branchId, it.parent, it.qty) })
      setToast(`${made.length} isian dikirim ke ${branch?.name} (freezer berkurang)`); setEdits({})
    }
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-28">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/operasional')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="font-headline-md text-headline-md leading-tight flex items-center gap-2"><Icon name="local_shipping" /> Isi Stok ke Standar</h1>
            <p className="font-label-lg opacity-95 mt-1 flex items-center gap-1.5 truncate"><Icon name="storefront" className="!text-[18px]" /> <b>{branch?.name || '—'}</b></p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-5">
        {/* Branch selector — kartu besar & jelas biar tidak salah cabang */}
        <div>
          <p className="font-label-lg text-on-surface flex items-center gap-2 mb-2"><Icon name="storefront" className="text-primary" /> Pilih Cabang Tujuan Kiriman</p>
          <div className={`grid gap-3 ${BRANCHES.length >= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
            {BRANCHES.map((b) => {
              const active = b.id === branchId
              return (
                <button key={b.id} onClick={() => setBranchId(b.id)} className={`relative p-4 rounded-2xl border-2 text-left transition-all active:scale-[.98] ${active ? 'border-primary bg-primary text-on-primary shadow-lg' : 'border-outline-variant bg-surface-container-lowest hover:border-primary'}`}>
                  {active && <span className="absolute top-2.5 right-2.5"><Icon name="check_circle" fill className="!text-[22px]" /></span>}
                  <Icon name="storefront" className={`!text-[30px] ${active ? 'text-on-primary' : 'text-primary'}`} />
                  <p className={`font-headline-md text-headline-md leading-tight mt-1 ${active ? '' : 'text-on-surface'}`}>{b.name.replace('CORNEY ', '')}</p>
                  <p className={`text-[11px] ${active ? 'opacity-90' : 'text-on-surface-variant'}`}>{active ? 'Cabang dipilih' : 'Ketuk untuk pilih'}</p>
                </button>
              )
            })}
          </div>
          {/* Konfirmasi cabang terpilih — mencolok biar dicek dulu */}
          <div className="mt-3 bg-secondary-container text-on-secondary-container rounded-xl px-4 py-3 flex items-center gap-3">
            <Icon name="local_shipping" className="shrink-0" />
            <p className="text-label-lg leading-snug">Kiriman masuk ke: <b className="font-headline-md">{branch?.name}</b>. <span className="text-label-md">Pastikan benar sebelum kirim!</span></p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900">
          <Icon name="info" className="!text-[18px] shrink-0 mt-0.5" />
          <p className="text-label-md leading-snug">Kirim = <strong>Stok Standar − Sisa Aktual</strong>. Stok Standar diatur Owner; Sisa diambil dari <strong>Master Laporan</strong> {sisaTgl ? <>(closing terakhir <strong>{sisaTgl}</strong>)</> : <>(belum ada closing — sementara pakai data contoh)</>}. Bisa diubah bila stok fisik di cabang berbeda.</p>
        </div>

        {/* Product cards — 2 kolom, ringkas, ramah HP */}
        <div className="grid grid-cols-2 gap-2.5">
          {PARENT_FILLINGS.map((p) => {
            const pPar = par[p.id] || 0, pSisa = sisa[p.id] || 0, def = kirimDefault(p.id)
            const qty = qtyOf(p.id)
            const enough = def === 0
            const fill = pPar > 0 ? Math.min(100, Math.round((pSisa / pPar) * 100)) : 0
            const dec = () => setQty(p.id, String(Math.max(0, qty - 1)))
            const inc = () => setQty(p.id, String(qty + 1))
            const t = THEME[p.id] || DEFAULT_THEME
            return (
              <div key={p.id} className={`rounded-2xl border-2 ${t.bd} bg-surface-container-lowest flex flex-col overflow-hidden`}>
                {/* Pita nama berwarna — kontras tinggi */}
                <div className={`${t.hd} px-3 py-2 flex items-center justify-between gap-1`}>
                  <h3 className={`font-bold text-[15px] leading-tight flex items-center gap-1.5 min-w-0 ${t.tx}`}><Icon name="kebab_dining" className={`!text-[18px] shrink-0 ${t.ic}`} /> <span>{p.name}</span></h3>
                  {enough
                    ? <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">Cukup</span>
                    : <span className="bg-white/80 text-on-surface text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border border-black/10">Kirim</span>}
                </div>
                <div className="p-3 pt-2.5 flex flex-col">
                {/* Standar vs Sisa */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-surface-container rounded-lg py-1.5 text-center"><p className="text-[9px] text-on-surface-variant uppercase leading-none">Standar</p><p className="font-headline-md text-headline-md text-on-surface leading-none mt-1">{pPar}</p></div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg py-1.5 text-center"><p className="text-[9px] text-amber-700 uppercase leading-none">Sisa toko</p><p className="font-headline-md text-headline-md text-amber-800 leading-none mt-1">{pSisa}</p></div>
                </div>
                {/* Bar terisi */}
                <div className="h-1.5 rounded-full bg-surface-container overflow-hidden mt-2"><div className={`h-full rounded-full ${fill >= 60 ? 'bg-green-500' : fill >= 30 ? 'bg-amber-500' : 'bg-error'}`} style={{ width: `${fill}%` }} /></div>
                {/* Stepper jumlah kirim */}
                <div className="rounded-xl bg-primary-fixed/50 p-2 mt-2">
                  <div className="flex items-center justify-between mb-1 text-[10px]">
                    <span className="font-bold text-primary uppercase">Kirim</span>
                    <span className="text-on-surface-variant">saran {def}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={dec} className="w-9 h-12 rounded-lg bg-surface border border-outline flex items-center justify-center active:scale-90 shrink-0"><Icon name="remove" className="!text-[20px]" /></button>
                    <input inputMode="numeric" size={1} value={qty ? qty.toLocaleString('id-ID') : ''} onChange={(e) => setQty(p.id, e.target.value)} placeholder="0" className="flex-1 min-w-0 h-12 px-1 text-center rounded-lg border-2 border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[20px] leading-none font-bold bg-surface tabular-nums" />
                    <button onClick={inc} className="w-9 h-12 rounded-lg bg-primary text-on-primary flex items-center justify-center active:scale-90 shrink-0"><Icon name="add" className="!text-[20px]" /></button>
                  </div>
                </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* History */}
        <section className="space-y-2">
          <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="history" className="text-primary" /> Kiriman Hari Ini</h2>
          {todays.length === 0 ? (
            <p className="text-label-md text-on-surface-variant italic px-1">Belum ada kiriman untuk cabang ini.</p>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 divide-y divide-outline-variant/30">
              {todays.map((s) => {
                const st = STATUS[s.status] || STATUS.menunggu
                return (
                  <div key={s.id} className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-label-lg">{s.parentName} · {s.qty} pcs</p>
                      <p className="text-label-md text-on-surface-variant">{fmtTime(s.createdAt)}</p>
                    </div>
                    <span className={`${st.cls} px-3 py-1 rounded-full text-[11px] font-bold`}>{st.label}{s.status === 'selisih' ? ` ${s.selisih}` : ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        {pending && <p className="max-w-2xl mx-auto text-label-md text-on-surface-variant text-center mb-2 flex items-center justify-center gap-1.5"><Icon name="hourglass_top" className="!text-[16px] text-amber-600" /> Sudah ada kiriman menunggu konfirmasi kasir di Opening Day.</p>}
        <button onClick={kirim} disabled={totalKirim === 0 || pending} className="max-w-2xl mx-auto w-full min-h-[52px] bg-primary text-on-primary rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-40">
          <Icon name={pending ? 'hourglass_top' : 'send'} /> {pending ? 'Menunggu konfirmasi kasir' : `Buat Kiriman → Opening Day Cabang${totalKirim > 0 ? ` (${totalKirim} pcs)` : ''}`}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-on-surface text-surface px-5 py-3 rounded-full shadow-xl flex items-center gap-2 font-label-lg whitespace-nowrap">
          <Icon name="check_circle" fill className="!text-[20px] text-green-400" /> {toast}
        </div>
      )}
    </div>
  )
}
