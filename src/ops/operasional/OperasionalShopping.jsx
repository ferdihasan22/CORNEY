import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES } from '../../data/menu.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { useShoppingItems } from '../../store/useShoppingItems.js'
import { useOpsBelanja } from '../../store/useOpsBelanja.js'
import { OPS_ITEMS, toggleOpsItem, setOpsQty, toggleOpsRemember, addCustomOpsItem, clearOpsBelanja, opsBelanjaList, opsTotalCount } from '../../store/opsbelanja.js'
import { createSupplierRequest } from '../../store/supplierReq.js'
import { useSupplierReq } from '../../store/useSupplierReq.js'
import { useSupplierFulfilled } from '../../store/useSupplierFulfilled.js'

// 2.4 — OPS-03 Rekap Request Belanja (LIVE dari checklist closing kasir).
// Kasir isi belanjaan saat closing → tersimpan di salesdaily.belanja per cabang
// (= request untuk besok). Operasional (Riski) melihat rekap, MENAMBAH belanjaan
// PER CABANG (pilih cabang → centang + jumlah), lalu menyalin untuk diteruskan
// ke PWA Supplier.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const nameOf = (id) => (BRANCHES.find((b) => b.id === id)?.name || id).replace('CORNEY ', '')
const dnum = (t) => { const [d, m, y] = (t || '').split('/'); return Number(y) * 10000 + Number(m) * 100 + Number(d) }
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const REQ_STATUS = { baru: { label: 'Terkirim', cls: 'bg-blue-100 text-blue-700' }, diproses: { label: 'Diproses supplier', cls: 'bg-amber-100 text-amber-700' }, selesai: { label: 'Selesai', cls: 'bg-green-100 text-green-700' } }

export default function OperasionalShopping() {
  const navigate = useNavigate()
  const sales = useSalesDaily() || []
  const shopItems = useShoppingItems() || []
  const supReq = useSupplierReq() || []
  const supFul = useSupplierFulfilled() || []
  useOpsBelanja() // re-render saat tambahan operasional berubah
  const [justSent, setJustSent] = useState(false)
  const [custom, setCustom] = useState('')
  const [showKasir, setShowKasir] = useState(false) // grup item kasir (lupa pesan)
  const [opsBranch, setOpsBranch] = useState(BRANCHES[0]?.id) // cabang aktif utk tambahan

  const itemName = (id) => shopItems.find((i) => i.id === id)?.name || id

  // Cabang+tanggal yang SUDAH dikirim (dari request/log supplier) → cegah kirim ganda.
  const sentSet = new Set()
  supReq.forEach((o) => sentSet.add(`${o.branchId}|${o.tgl || ''}`))
  supFul.forEach((e) => sentSet.add(`${e.branchId}|${e.tgl || ''}`))

  // Request terbaru per cabang = belanja closing terakhir (kasir) + tambahan operasional.
  const latestByBranch = {}
  sales.forEach((r) => { const cur = latestByBranch[r.branchId]; if (!cur || dnum(r.tgl) > dnum(cur.tgl)) latestByBranch[r.branchId] = r })
  const reqByBranch = BRANCHES.map((b) => {
    const row = latestByBranch[b.id]
    const kasir = Object.entries(row?.belanja || {}).filter(([, q]) => q > 0).map(([id, q]) => ({ id, name: itemName(id), qty: q }))
    const ops = opsBelanjaList(b.id)
    return { branchId: b.id, branchName: nameOf(b.id), tgl: row?.tgl, kasir, ops, sudahKirim: sentSet.has(`${b.id}|${row?.tgl || ''}`) }
  })
  const withKasir = reqByBranch.filter((r) => r.kasir.length > 0)
  const belum = reqByBranch.length - withKasir.length
  const adaIsi = reqByBranch.filter((r) => r.kasir.length > 0 || r.ops.length > 0)
  const toSend = adaIsi.filter((r) => !r.sudahKirim) // hanya yang belum dikirim

  const opsAddedHere = opsBelanjaList(opsBranch)
  const opsMap = Object.fromEntries(opsAddedHere.map((o) => [o.id, o]))
  const customHere = opsAddedHere.filter((o) => o.id.startsWith('ops-'))
  const totalOps = opsTotalCount()

  // Kirim rekap ke PWA Supplier — HANYA cabang yang belum dikirim (cegah ganda).
  const kirim = () => {
    const branches = toSend.map((r) => ({
      branchId: r.branchId, branchName: r.branchName, tgl: r.tgl,
      items: [...r.kasir.map((it) => ({ id: it.id, name: it.name, qty: it.qty, src: 'kasir' })), ...r.ops.map((it) => ({ id: it.id, name: it.name, qty: it.qty, src: 'ops' }))],
    }))
    if (!createSupplierRequest({ branches })) return
    // Bersihkan tambahan operasional non-"ingat" pada cabang yang dikirim.
    toSend.forEach((r) => clearOpsBelanja(r.branchId))
    setJustSent(true); setTimeout(() => setJustSent(false), 2500)
  }
  const submitCustom = () => { addCustomOpsItem(opsBranch, custom); setCustom('') }

  // Item kasir (shopping.js) yang belum ada di OPS_ITEMS — untuk "kasir lupa pesan".
  const kasirItems = shopItems.filter((i) => !OPS_ITEMS.some((o) => o.id === i.id))

  // Kartu item bawaan/kasir: centang + stepper −/+ + Ingat (semua per cabang).
  const ItemCard = (m) => {
    const it = opsMap[m.id]
    const on = it != null
    const qty = it?.qty
    const remember = it?.remember
    return (
      <div key={m.id} className={`rounded-xl border-2 p-2.5 transition-all ${remember ? 'border-amber-400 bg-amber-50' : on ? 'border-primary bg-primary-fixed/40' : 'border-outline-variant/40 bg-surface-container-lowest'}`}>
        <div className="flex items-center gap-2">
          <button onClick={() => toggleOpsItem(opsBranch, m.id, m.name)} className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-primary text-on-primary' : 'border-2 border-outline-variant text-transparent'}`}><Icon name="check" className="!text-[18px]" /></button>
          <span className="flex-1 font-label-md leading-tight min-w-0">{m.name}</span>
        </div>
        {on && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 justify-end">
              <button onClick={() => setOpsQty(opsBranch, m.id, m.name, qty - 1)} className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center active:scale-90 shrink-0"><Icon name="remove" className="!text-[18px]" /></button>
              <input inputMode="numeric" value={qty} onChange={(e) => setOpsQty(opsBranch, m.id, m.name, e.target.value.replace(/\D/g, ''))} className="w-10 h-8 text-center rounded-lg border border-primary outline-none font-bold bg-surface min-w-0" size={1} />
              <button onClick={() => setOpsQty(opsBranch, m.id, m.name, qty + 1)} className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center active:scale-90 shrink-0"><Icon name="add" className="!text-[18px]" /></button>
            </div>
            <button onClick={() => toggleOpsRemember(opsBranch, m.id, m.name)} className={`w-full h-7 rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold ${remember ? 'bg-amber-400 text-amber-950' : 'bg-surface-container-high text-on-surface-variant'}`}><Icon name={remember ? 'bookmark' : 'bookmark_border'} fill={remember} className="!text-[15px]" /> {remember ? 'Diingat tiap hari' : 'Ingat data ini'}</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-28">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/operasional')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="shopping_cart" /> Rekap Request Belanja</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Operasional CORNEY</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        <div className="bg-secondary-fixed/30 border border-secondary-fixed rounded-xl p-3 flex items-center gap-2 text-on-secondary-fixed-variant">
          <Icon name="groups" className="!text-[20px]" />
          <p className="text-label-md"><strong>{withKasir.length} cabang</strong> punya request kasir{belum > 0 && <> · <strong>{belum} belum</strong></>}</p>
        </div>

        {toSend.length === 0 ? (
          <div className="bg-surface-container-low rounded-2xl p-6 text-center text-on-surface-variant border border-outline-variant/30">
            <Icon name={adaIsi.length > 0 ? 'check_circle' : 'receipt_long'} className="!text-5xl opacity-30" />
            <p className="mt-2 font-label-lg">{adaIsi.length > 0 ? 'Semua request sudah dikirim.' : 'Belum ada request belanja.'}</p>
            <p className="text-label-md opacity-70">{adaIsi.length > 0 ? 'Lihat di Riwayat Terkirim di bawah.' : 'Muncul setelah kasir mengisi belanjaan saat closing, atau setelah kamu menambah di bawah.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="storefront" className="!text-[20px] text-primary" /> Request per Cabang <span className="text-label-md text-on-surface-variant font-normal">(belum dikirim)</span></h2>
            {toSend.map((r) => (
              <div key={r.branchId} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-[0_4px_16px_rgba(26,26,26,0.06)]">
                <h3 className="font-headline-md text-headline-md mb-2 flex items-center gap-2 flex-wrap"><Icon name="storefront" className="!text-[18px] text-primary" /> {r.branchName} {r.tgl && <span className="text-label-md text-on-surface-variant font-normal">· closing {r.tgl}</span>}</h3>
                <div className="space-y-1">
                  {r.kasir.map((it) => <div key={it.id} className="flex justify-between text-label-lg"><span className="text-on-surface-variant">{it.name}</span><span className="font-bold">{it.qty}</span></div>)}
                  {r.ops.map((it) => <div key={it.id} className="flex justify-between text-label-lg"><span className="text-on-surface-variant flex items-center gap-1"><span className="text-[10px] font-bold uppercase bg-primary-fixed text-primary px-1.5 py-0.5 rounded">+ops</span> {it.name}</span><span className="font-bold">{it.qty}</span></div>)}
                </div>
                {r.kasir.length === 0 && r.ops.length > 0 && <p className="text-[11px] text-on-surface-variant/70 mt-2">Cabang ini belum kirim request kasir — baru tambahan operasional.</p>}
              </div>
            ))}
          </div>
        )}

        {/* ── TAMBAHAN OPERASIONAL (Riski) — PER CABANG ─ */}
        <section className="space-y-3 pt-2">
          <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="add_shopping_cart" className="text-primary" /> Tambahan Operasional</h2>
          <p className="text-label-md text-on-surface-variant -mt-1">Pilih cabang, centang yang perlu dibeli & isi jumlahnya. Item rutin (mis. Tepung) tekan <span className="text-amber-700 font-bold">🔖 Ingat data ini</span> → jumlahnya tersimpan & muncul otomatis tiap hari (tak ikut terhapus saat Kosongkan).</p>

          {/* Pilih cabang */}
          <div className="flex gap-2 flex-wrap">
            {BRANCHES.map((b) => {
              const n = opsBelanjaList(b.id).length
              return (
                <button key={b.id} onClick={() => setOpsBranch(b.id)} className={`px-4 py-2 rounded-full font-label-md flex items-center gap-1.5 ${opsBranch === b.id ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant'}`}>{nameOf(b.id)}{n > 0 && <span className={`text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full ${opsBranch === b.id ? 'bg-on-primary text-primary' : 'bg-primary text-on-primary'}`}>{n}</span>}</button>
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-label-md text-on-surface-variant">Tambahan untuk <strong className="text-on-surface">{nameOf(opsBranch)}</strong></p>
            {opsAddedHere.length > 0 && <button onClick={() => clearOpsBelanja(opsBranch)} className="text-label-md text-error underline underline-offset-2">Kosongkan</button>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {OPS_ITEMS.map(ItemCard)}
          </div>

          {/* Item custom cabang ini */}
          {customHere.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {customHere.map((o) => (
                <div key={o.id} className={`rounded-xl border-2 p-2.5 ${o.remember ? 'border-amber-400 bg-amber-50' : 'border-primary bg-primary-fixed/40'}`}>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-label-md leading-tight min-w-0">{o.name}</span>
                    <button onClick={() => setOpsQty(opsBranch, o.id, o.name, 0)} className="w-7 h-7 rounded-lg bg-error-container text-error flex items-center justify-center shrink-0"><Icon name="close" className="!text-[18px]" /></button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => setOpsQty(opsBranch, o.id, o.name, o.qty - 1)} className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center active:scale-90 shrink-0"><Icon name="remove" className="!text-[18px]" /></button>
                      <input inputMode="numeric" value={o.qty} onChange={(e) => setOpsQty(opsBranch, o.id, o.name, e.target.value.replace(/\D/g, ''))} className="w-10 h-8 text-center rounded-lg border border-primary outline-none font-bold bg-surface min-w-0" size={1} />
                      <button onClick={() => setOpsQty(opsBranch, o.id, o.name, o.qty + 1)} className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center active:scale-90 shrink-0"><Icon name="add" className="!text-[18px]" /></button>
                    </div>
                    <button onClick={() => toggleOpsRemember(opsBranch, o.id, o.name)} className={`w-full h-7 rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold ${o.remember ? 'bg-amber-400 text-amber-950' : 'bg-surface-container-high text-on-surface-variant'}`}><Icon name={o.remember ? 'bookmark' : 'bookmark_border'} fill={o.remember} className="!text-[15px]" /> {o.remember ? 'Diingat tiap hari' : 'Ingat data ini'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Item kasir — kalau kasir lupa pesan (disembunyikan dulu) */}
          <div className="pt-1">
            <button onClick={() => setShowKasir((v) => !v)} className="w-full py-2.5 rounded-xl border border-dashed border-outline-variant text-on-surface-variant font-label-lg flex items-center justify-center gap-2 active:scale-[.99] bg-surface-container-lowest">
              <Icon name={showKasir ? 'expand_less' : 'add'} /> {showKasir ? 'Tutup item kasir' : 'Tambahkan item kasir (jika kasir lupa pesan)'}
            </button>
            {showKasir && (
              <div className="mt-2 space-y-2">
                <p className="text-label-md text-on-surface-variant flex items-start gap-1.5"><Icon name="info" className="!text-[16px] shrink-0 mt-0.5" /> Item yang biasanya dipesan kasir. Pakai ini hanya kalau kasir <b>lupa</b> mencentangnya saat closing.</p>
                <div className="grid grid-cols-2 gap-2">
                  {kasirItems.map(ItemCard)}
                </div>
              </div>
            )}
          </div>

          {/* Tambah item lain ke cabang ini */}
          <div className="flex gap-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitCustom()} placeholder={`Tambah belanjaan lain untuk ${nameOf(opsBranch)}…`} className="flex-1 h-11 px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface min-w-0" />
            <button onClick={submitCustom} disabled={!custom.trim()} className="px-4 rounded-xl bg-primary text-on-primary font-label-lg flex items-center gap-1 active:scale-95 disabled:opacity-40 shrink-0"><Icon name="add" /> Tambah</button>
          </div>
        </section>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900">
          <Icon name="info" className="!text-[18px] shrink-0 mt-0.5" />
          <p className="text-label-md leading-snug">Tekan <strong>Kirim ke Supplier</strong> → request (kasir + tambahanmu, per cabang) langsung masuk ke <strong>PWA Supplier</strong> untuk diproses (dicentang / ditandai stok kosong).</p>
        </div>

        {/* ── Riwayat Terkirim (per cabang) ── */}
        {supReq.length > 0 && (
          <section className="space-y-2 pt-2">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="history" className="text-primary" /> Riwayat Terkirim</h2>
            {supReq.map((o) => {
              const st = REQ_STATUS[o.status] || REQ_STATUS.baru
              return (
                <div key={o.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0_4px_16px_rgba(26,26,26,0.06)] overflow-hidden">
                  <div className="bg-surface-container-low px-4 py-2.5 flex items-center justify-between gap-2 border-b border-outline-variant/30">
                    <div className="min-w-0">
                      <p className="font-label-lg flex items-center gap-1.5 min-w-0"><Icon name="storefront" className="!text-[16px] text-primary" /> {o.branchName}{o.tgl && <span className="text-label-md text-on-surface-variant font-normal">· {o.tgl}</span>}</p>
                      <p className="text-[11px] text-on-surface-variant">dikirim {fmtTime(o.createdAt)}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="p-3 space-y-1">
                    {o.items.map((it) => (
                      <div key={it.uid} className="flex justify-between text-label-md">
                        <span className="text-on-surface-variant flex items-center gap-1 min-w-0">{it.src === 'ops' && <span className="text-[9px] font-bold uppercase bg-primary-fixed text-primary px-1 py-0.5 rounded">+ops</span>}<span className="truncate">{it.name}</span></span>
                        <span className="font-bold shrink-0">{it.reqQty ?? it.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        <button onClick={kirim} disabled={toSend.length === 0} className={`max-w-2xl mx-auto w-full min-h-[52px] rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-40 ${justSent ? 'bg-green-600 text-white' : 'bg-primary text-on-primary'}`}>
          <Icon name={justSent ? 'check' : 'send'} /> {justSent ? 'Terkirim ke Supplier' : toSend.length === 0 ? 'Semua sudah dikirim' : `Kirim ke Supplier (${toSend.length} cabang)`}
        </button>
      </div>
    </div>
  )
}
