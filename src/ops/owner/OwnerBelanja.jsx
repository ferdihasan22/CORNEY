import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { salesInPeriod } from '../../store/aggregate.js'
import { useShoppingItems } from '../../store/useShoppingItems.js'
import { useSupplierPrices } from '../../store/useSupplierPrices.js'
import { priceOfSup, prevOfSup, trendOfSup } from '../../store/supplierPrices.js'
import { useSupplierFulfilled } from '../../store/useSupplierFulfilled.js'
import { setOutside } from '../../store/supplierFulfilled.js'
import { OPS_ITEMS } from '../../store/opsbelanja.js'

// 3.4 — OWN Belanjaan. Daftar harga semua item (indikator naik/turun dari
// update harga Supplier) + tabel per hari × cabang × item yang dipesan
// (sumber: checklist belanja kasir di Master Laporan / salesdaily).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const nameOf = (id) => (BRANCHES.find((b) => b.id === id)?.name || id).replace('CORNEY ', '')
const dnum = (t) => { const [d, m, y] = (t || '').split('/'); return Number(y) * 10000 + Number(m) * 100 + Number(d) }

export default function OwnerBelanja() {
  const navigate = useNavigate()
  useSalesDaily(); useSupplierPrices()
  const shopItems = useShoppingItems() || []
  const fulfilled = useSupplierFulfilled() || []
  const [period, setPeriod] = useState('Bulan')
  const [branchId, setBranchId] = useState('all')
  const [mode, setMode] = useState('diminta') // 'diminta' (kasir) | 'dipenuhi' (supplier)
  const [showHarga, setShowHarga] = useState(false) // panel harga (collapsible)
  const [openG, setOpenG] = useState({}) // grup tanggal+cabang yang dibuka
  const [edit, setEdit] = useState({}) // { 'entryId|uid': {qty, harga} } form beli di luar
  const toggleG = (k) => setOpenG((m) => ({ ...m, [k]: !m[k] }))
  const bid = branchId === 'all' ? undefined : branchId

  const itemName = (id) => shopItems.find((i) => i.id === id)?.name || OPS_ITEMS.find((o) => o.id === id)?.name || id

  // Daftar item untuk panel harga (kasir + ops, dedup).
  const allItems = [...shopItems.map((i) => ({ id: i.id, name: i.name })), ...OPS_ITEMS.filter((o) => !shopItems.some((i) => i.id === o.id))]
  const naikCount = allItems.filter((i) => trendOfSup(i.id) === 'naik').length
  const turunCount = allItems.filter((i) => trendOfSup(i.id) === 'turun').length

  // Tabel: ekspansi belanja kasir per (tgl, cabang, item).
  const rows = salesInPeriod(period, bid)
  const lines = []
  rows.forEach((r) => Object.entries(r.belanja || {}).forEach(([id, qty]) => {
    if (!qty) return
    const harga = priceOfSup(id)
    lines.push({ tgl: r.tgl, branchId: r.branchId, id, name: itemName(id), qty, harga, sub: harga * qty })
  }))
  lines.sort((a, b) => dnum(b.tgl) - dnum(a.tgl) || a.name.localeCompare(b.name))
  const grand = lines.reduce((s, l) => s + l.sub, 0)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)

  // ── DIPENUHI (dari log Supplier) ──
  const entryDate = (e) => { if (e.tgl) { const [d, m, y] = e.tgl.split('/'); return new Date(Number(y), Number(m) - 1, Number(d)) } return new Date(e.at) }
  const inPeriod = (dt) => { const t = new Date(); if (period === 'Hari') return dt.toDateString() === t.toDateString(); if (period === 'Minggu') { const diff = (t - dt) / 86400000; return diff >= 0 && diff < 7 } return dt.getMonth() === t.getMonth() && dt.getFullYear() === t.getFullYear() }
  const fLines = []
  fulfilled.forEach((e) => {
    if (bid && e.branchId !== bid) return
    if (!inPeriod(entryDate(e))) return
    e.items.forEach((it) => fLines.push({ tgl: e.tgl || (e.at || '').slice(0, 10), branchId: e.branchId, name: it.name, reqQty: it.reqQty, qty: it.ready ? it.qty : 0, ready: it.ready, harga: it.price, sub: it.ready ? it.price * it.qty : 0 }))
  })
  fLines.sort((a, b) => dnum(b.tgl) - dnum(a.tgl) || a.name.localeCompare(b.name))
  const fGrand = fLines.reduce((s, l) => s + l.sub, 0)
  const fQty = fLines.reduce((s, l) => s + l.qty, 0)

  // Item KOSONG (supplier tak punya) → kandidat beli di luar.
  const kosongList = []
  fulfilled.forEach((e) => {
    if (bid && e.branchId !== bid) return
    if (!inPeriod(entryDate(e))) return
    e.items.forEach((it) => { if (!it.ready) kosongList.push({ entryId: e.id, uid: it.uid, tgl: e.tgl || (e.at || '').slice(0, 10), branchId: e.branchId, name: it.name, reqQty: it.reqQty, price: it.price, luar: it.luar || null }) })
  })
  const totalLuar = kosongList.reduce((s, k) => s + (k.luar ? k.luar.qty * k.luar.harga : 0), 0)
  const ditangani = kosongList.filter((k) => k.luar).length

  const startEdit = (k) => setEdit((m) => ({ ...m, [`${k.entryId}|${k.uid}`]: { qty: String(k.reqQty || 1), harga: k.price ? String(k.price) : '' } }))
  const setEditField = (key, f, v) => setEdit((m) => ({ ...m, [key]: { ...m[key], [f]: v.replace(/\D/g, '') } }))
  const saveLuar = (k) => { const key = `${k.entryId}|${k.uid}`; const e = edit[key]; setOutside(k.entryId, k.uid, { qty: Number(e?.qty) || 0, harga: Number(e?.harga) || 0 }); setEdit((m) => { const n = { ...m }; delete n[key]; return n }) }

  // Kelompokkan baris per (tanggal + cabang) untuk tampilan accordion (anti-memanjang).
  const groupBy = (arr) => {
    const g = {}
    arr.forEach((l) => { const k = `${l.tgl}|${l.branchId}`; if (!g[k]) g[k] = { key: k, tgl: l.tgl, branchId: l.branchId, items: [], total: 0, qty: 0, kosong: 0 }; g[k].items.push(l); g[k].total += l.sub || 0; g[k].qty += l.qty || 0; if (l.ready === false) g[k].kosong++ })
    return Object.values(g)
  }
  const gDiminta = groupBy(lines)
  const gDipenuhi = groupBy(fLines)

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="shopping_basket" /> Belanjaan</h1>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-5 space-y-5">
        {/* ── Daftar Harga (collapsible) + badge naik/turun ── */}
        <section className="space-y-2">
          <button onClick={() => setShowHarga((v) => !v)} className="w-full bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-4 flex items-center justify-between gap-2 active:scale-[.99] transition-all text-left">
            <div className="min-w-0">
              <span className="font-headline-md text-headline-md flex items-center gap-2 flex-wrap"><Icon name="sell" className="text-primary" /> Harga Item Supplier
                {(naikCount > 0 || turunCount > 0) && (
                  <span className="flex items-center gap-1">
                    {naikCount > 0 && <span className="flex items-center bg-error-container text-error text-[11px] font-bold px-1.5 py-0.5 rounded-full"><Icon name="trending_up" className="!text-[13px]" />{naikCount}</span>}
                    {turunCount > 0 && <span className="flex items-center bg-green-100 text-green-700 text-[11px] font-bold px-1.5 py-0.5 rounded-full"><Icon name="trending_down" className="!text-[13px]" />{turunCount}</span>}
                  </span>
                )}
              </span>
              <p className="text-label-md text-primary mt-0.5 flex items-center gap-1"><Icon name="touch_app" className="!text-[15px]" /> {showHarga ? 'Klik untuk tutup' : 'Klik di sini untuk lihat harga bahan baku'}</p>
            </div>
            <Icon name={showHarga ? 'expand_less' : 'expand_more'} className="text-on-surface-variant shrink-0" />
          </button>
          {showHarga && (<>
          <p className="text-label-md text-on-surface-variant">Harga & arah perubahan terbaru (diisi Supplier di "Atur Harga").</p>
          <div className="grid grid-cols-2 gap-2">
            {allItems.map((it) => {
              const harga = priceOfSup(it.id)
              const prev = prevOfSup(it.id)
              const trend = trendOfSup(it.id)
              return (
                <div key={it.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-3">
                  <p className="font-label-md leading-tight truncate">{it.name}</p>
                  {harga > 0 ? (
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-headline-md text-headline-md">{fmtRp(harga)}</span>
                      {trend && <span className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${trend === 'naik' ? 'bg-error-container text-error' : 'bg-green-100 text-green-700'}`}><Icon name={trend === 'naik' ? 'trending_up' : 'trending_down'} className="!text-[14px]" /> {trend}</span>}
                    </div>
                  ) : <p className="text-label-md text-amber-700 font-bold mt-1">belum diatur</p>}
                  {trend && prev != null && <p className="text-[10px] text-on-surface-variant mt-0.5">dari {fmtRp(prev)}</p>}
                </div>
              )
            })}
          </div>
          </>)}
        </section>

        {/* ── Tabel per hari × cabang × item dipesan ── */}
        <section className="space-y-2">
          <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="table_chart" className="text-primary" /> Yang Dipesan</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="bg-surface-container-highest rounded-full p-1 flex">
              {['Bulan', 'Minggu', 'Hari'].map((p) => <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-full text-label-md ${period === p ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>{p}</button>)}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[['all', 'Semua'], ...BRANCHES.map((b) => [b.id, nameOf(b.id)])].map(([id, lbl]) => (
                <button key={id} onClick={() => setBranchId(id)} className={`px-3 py-1.5 rounded-full text-label-md ${branchId === id ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant'}`}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Toggle sumber: Diminta (kasir) vs Dipenuhi (supplier) */}
          <div className="bg-surface-container-highest rounded-full p-1 flex w-max">
            {[['diminta', 'Diminta (Kasir)'], ['dipenuhi', 'Dipenuhi (Supplier)']].map(([k, lbl]) => (
              <button key={k} onClick={() => setMode(k)} className={`px-4 py-1.5 rounded-full text-label-md ${mode === k ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`}>{lbl}</button>
            ))}
          </div>

          {mode === 'diminta' ? (
            <div className="space-y-2">
              {gDiminta.length === 0 ? (
                <p className="text-center text-on-surface-variant py-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/40">Belum ada belanjaan pada periode ini.</p>
              ) : gDiminta.map((g) => {
                const open = openG[g.key]
                return (
                  <div key={g.key} className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden">
                    <button onClick={() => toggleG(g.key)} className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left active:bg-surface-container">
                      <div className="min-w-0">
                        <p className="font-label-lg flex items-center gap-1.5 flex-wrap"><Icon name="storefront" className="!text-[16px] text-primary" /> {nameOf(g.branchId)} <span className="text-on-surface-variant font-normal">· {g.tgl}</span></p>
                        <p className="text-label-md text-on-surface-variant">{g.items.length} item · {g.qty} qty{g.total > 0 ? ` · ${fmtRp(g.total)}` : ''}</p>
                      </div>
                      <Icon name={open ? 'expand_less' : 'expand_more'} className="text-on-surface-variant shrink-0" />
                    </button>
                    {open && (
                      <div className="border-t border-outline-variant/30 divide-y divide-outline-variant/20">
                        {g.items.map((l, i) => (
                          <div key={i} className="px-4 py-2 flex justify-between gap-2 text-label-md">
                            <span className="text-on-surface-variant min-w-0 truncate">{l.name}</span>
                            <span className="shrink-0 tabular-nums"><b className="text-on-surface">{l.qty}</b>{l.harga > 0 ? ` × ${fmtRp(l.harga)} = ${fmtRp(l.sub)}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {grand > 0 && <div className="flex justify-between items-center bg-surface-container-high rounded-xl px-4 py-3 font-bold"><span>TOTAL ({totalQty} qty)</span><span className="text-primary">{fmtRp(grand)}</span></div>}
            </div>
          ) : (
            <div className="space-y-2">
              {gDipenuhi.length === 0 ? (
                <p className="text-center text-on-surface-variant py-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/40">Belum ada pesanan yang diselesaikan Supplier pada periode ini.</p>
              ) : gDipenuhi.map((g) => {
                const open = openG[g.key]
                return (
                  <div key={g.key} className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden">
                    <button onClick={() => toggleG(g.key)} className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left active:bg-surface-container">
                      <div className="min-w-0">
                        <p className="font-label-lg flex items-center gap-1.5 flex-wrap"><Icon name="storefront" className="!text-[16px] text-primary" /> {nameOf(g.branchId)} <span className="text-on-surface-variant font-normal">· {g.tgl}</span></p>
                        <p className="text-label-md text-on-surface-variant">{g.items.length} item{g.kosong > 0 ? <span className="text-error font-bold"> · {g.kosong} kosong</span> : ''} · {fmtRp(g.total)}</p>
                      </div>
                      <Icon name={open ? 'expand_less' : 'expand_more'} className="text-on-surface-variant shrink-0" />
                    </button>
                    {open && (
                      <div className="border-t border-outline-variant/30 divide-y divide-outline-variant/20">
                        {g.items.map((l, i) => (
                          <div key={i} className={`px-4 py-2 flex justify-between gap-2 text-label-md ${!l.ready ? 'bg-error-container/30' : ''}`}>
                            <span className="text-on-surface-variant min-w-0 truncate">{l.name} <span className="text-[11px] text-on-surface-variant/60">(diminta {l.reqQty})</span></span>
                            <span className="shrink-0 tabular-nums">{l.ready ? <><b className="text-on-surface">{l.qty}</b>{l.harga > 0 ? ` = ${fmtRp(l.sub)}` : ''}</> : <span className="text-error font-bold">kosong</span>}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {fGrand > 0 && <div className="flex justify-between items-center bg-surface-container-high rounded-xl px-4 py-3 font-bold"><span>TOTAL DIPENUHI ({fQty} qty)</span><span className="text-primary">{fmtRp(fGrand)}</span></div>}
            </div>
          )}
          <p className="text-[11px] text-on-surface-variant/70 leading-relaxed flex items-start gap-1.5"><Icon name="info" className="!text-[16px] shrink-0 mt-0.5" /> {mode === 'diminta' ? 'Diminta: checklist belanja kasir saat closing (Master Laporan).' : 'Dipenuhi: hasil akhir setelah Supplier proses (qty disesuaikan, item kosong tidak terpenuhi). Tercatat saat Supplier "Tandai Selesai".'} Harga dari "Atur Harga" Supplier.</p>
        </section>

        {/* ── Beli di Luar (item supplier kosong) ── */}
        {kosongList.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="shopping_bag" className="text-amber-600" /> Beli di Luar <span className="text-on-surface-variant font-normal">({ditangani}/{kosongList.length})</span></h2>
            <p className="text-label-md text-on-surface-variant -mt-1">Item yang ditandai <b className="text-error">stok kosong</b> oleh supplier. Catat di sini kalau kamu membelinya di luar.</p>
            {kosongList.map((k) => {
              const key = `${k.entryId}|${k.uid}`
              const e = edit[key]
              return (
                <div key={key} className={`rounded-2xl border p-3 ${k.luar ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-label-lg leading-tight">{k.name}</p>
                      <p className="text-label-md text-on-surface-variant">{nameOf(k.branchId)}{k.tgl ? ` · ${k.tgl}` : ''} · diminta {k.reqQty}</p>
                    </div>
                    {!k.luar && !e && <button onClick={() => startEdit(k)} className="shrink-0 h-9 px-3 rounded-lg bg-amber-500 text-white font-label-md flex items-center gap-1 active:scale-95"><Icon name="add_shopping_cart" className="!text-[16px]" /> Beli di luar</button>}
                  </div>
                  {k.luar ? (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-green-200">
                      <p className="text-label-md text-green-800 font-bold flex items-center gap-1"><Icon name="check_circle" fill className="!text-[16px]" /> {k.luar.qty} × {fmtRp(k.luar.harga)} = {fmtRp(k.luar.qty * k.luar.harga)}</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => startEdit(k)} className="h-8 px-2.5 rounded-lg bg-surface-container-high text-on-surface-variant text-label-md flex items-center gap-1"><Icon name="edit" className="!text-[15px]" /> Ubah</button>
                        <button onClick={() => setOutside(k.entryId, k.uid, null)} className="h-8 px-2.5 rounded-lg bg-error-container text-error flex items-center"><Icon name="close" className="!text-[16px]" /></button>
                      </div>
                    </div>
                  ) : e ? (
                    <div className="flex items-end gap-2 mt-2">
                      <div className="flex-1 min-w-0"><label className="text-[10px] uppercase text-on-surface-variant">Jumlah</label><input inputMode="numeric" value={e.qty} onChange={(ev) => setEditField(key, 'qty', ev.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline bg-surface font-bold min-w-0" size={1} /></div>
                      <div className="flex-1 min-w-0"><label className="text-[10px] uppercase text-on-surface-variant">Harga satuan</label><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-label-md">Rp</span><input inputMode="numeric" value={e.harga ? Number(e.harga).toLocaleString('id-ID') : ''} onChange={(ev) => setEditField(key, 'harga', ev.target.value)} placeholder="0" className="w-full h-10 pl-8 pr-2 text-right rounded-lg border border-primary bg-surface font-bold min-w-0" size={1} /></div></div>
                      <button onClick={() => saveLuar(k)} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-bold flex items-center gap-1 active:scale-95 shrink-0"><Icon name="check" /> Simpan</button>
                    </div>
                  ) : null}
                </div>
              )
            })}
            <div className="flex justify-between items-center bg-surface-container rounded-xl p-3">
              <span className="text-label-md text-on-surface-variant">Total beli di luar ({period.toLowerCase()})</span>
              <span className="font-headline-md text-amber-700">{fmtRp(totalLuar)}</span>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
