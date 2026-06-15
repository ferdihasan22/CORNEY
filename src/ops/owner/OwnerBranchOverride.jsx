import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useMaster } from '../../store/useMaster.js'
import { setBranchOverride } from '../../store/master.js'

// 2.3 — Override Harga/Menu per Cabang (BranchProduct). Owner mengubah harga Walk-in
// (kasir) & Online (customer) dan/atau menyembunyikan menu per cabang. Pakai DRAFT
// lokal + tombol SIMPAN (jelas & tak menyimpan per-ketik): perubahan baru dikirim ke
// server saat Simpan ditekan → kasir/customer lihat setelahnya.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const sVal = (v) => (v != null ? String(v) : '')

export default function OwnerBranchOverride() {
  const navigate = useNavigate()
  const master = useMaster()
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const [draft, setDraft] = useState({}) // { menuId: { price, onlinePrice, off } } (string)
  const [saved, setSaved] = useState(false)

  const menus = (master?.menus || []).filter((m) => m.active)
  const ov = (master?.branchOverrides || {})[branchId] || {}

  // Muat draft dari override tersimpan SAAT GANTI CABANG (bukan tiap master berubah,
  // supaya editan yang sedang diketik tak terhapus oleh hydrate realtime).
  useEffect(() => {
    const cur = (master?.branchOverrides || {})[branchId] || {}
    const d = {}
    ;(master?.menus || []).forEach((m) => { const o = cur[m.id] || {}; d[m.id] = { price: sVal(o.price), onlinePrice: sVal(o.onlinePrice), off: !!o.off } })
    setDraft(d)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  const setField = (id, key, val) => setDraft((dd) => ({ ...dd, [id]: { ...(dd[id] || {}), [key]: val } }))
  const dOf = (id) => draft[id] || { price: '', onlinePrice: '', off: false }

  // Apakah baris berubah dari yang tersimpan?
  const rowDirty = (m) => { const o = ov[m.id] || {}; const d = dOf(m.id); return d.price !== sVal(o.price) || d.onlinePrice !== sVal(o.onlinePrice) || !!d.off !== !!o.off }
  const dirty = menus.some(rowDirty)

  const save = () => {
    if (!dirty) return
    menus.forEach((m) => { if (rowDirty(m)) setBranchOverride(branchId, m.id, { price: dOf(m.id).price, onlinePrice: dOf(m.id).onlinePrice, off: dOf(m.id).off }) })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-28">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Harga & Menu per Cabang</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3 h-12 font-label-lg outline-none">
          {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900"><Icon name="info" className="!text-[18px] shrink-0 mt-0.5" /><p className="text-label-md leading-snug"><b>Walk-in</b> = harga di kasir. <b>Online</b> = harga di app Customer. Kosongkan = pakai harga master. Online kosong = ikut harga walk-in. <b>Tekan Simpan</b> agar berlaku.</p></div>

        <div className="space-y-2">
          {menus.map((m) => {
            const d = dOf(m.id)
            const off = !!d.off
            return (
              <div key={m.id} className={`bg-surface-container-lowest rounded-2xl p-4 border-2 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center gap-3 ${rowDirty(m) ? 'border-amber-300' : 'border-outline-variant/40'} ${off ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <h3 className="font-headline-md text-headline-md leading-tight">{m.name}</h3>
                  <p className="text-[11px] text-on-surface-variant">Master walk-in {fmtRp(m.price)} · online {m.onlinePrice != null ? fmtRp(m.onlinePrice) : '(= walk-in)'}{rowDirty(m) && <span className="text-amber-700 font-bold"> · belum disimpan</span>}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 leading-none">Walk-in</p>
                    <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-on-surface-variant">Rp</span>
                      <input inputMode="numeric" value={d.price} onChange={(e) => setField(m.id, 'price', e.target.value.replace(/\D/g, ''))} placeholder={String(m.price)} className="w-24 h-9 pl-7 pr-2 rounded-lg border border-outline focus:border-primary outline-none text-label-md bg-surface" /></div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase mb-0.5 leading-none">Online</p>
                    <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-on-surface-variant">Rp</span>
                      <input inputMode="numeric" value={d.onlinePrice} onChange={(e) => setField(m.id, 'onlinePrice', e.target.value.replace(/\D/g, ''))} placeholder={m.onlinePrice != null ? String(m.onlinePrice) : String(m.price)} className="w-24 h-9 pl-7 pr-2 rounded-lg border border-outline focus:border-primary outline-none text-label-md bg-surface" /></div>
                  </div>
                </div>
                <button onClick={() => setField(m.id, 'off', !off)} title={off ? 'Aktifkan' : 'Sembunyikan'} className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${off ? 'bg-error-container text-error' : 'bg-green-100 text-green-700'}`}>
                  <Icon name={off ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
            )
          })}
        </div>
      </main>

      {/* Tombol Simpan (sticky) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        {dirty && <p className="max-w-2xl mx-auto text-center text-[12px] text-amber-700 font-bold mb-2 flex items-center justify-center gap-1"><Icon name="info" className="!text-[15px]" /> Ada perubahan harga belum disimpan</p>}
        <button onClick={save} disabled={!dirty} className="max-w-2xl mx-auto w-full min-h-[52px] rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-40 bg-primary text-on-primary">
          <Icon name={saved ? 'check_circle' : 'save'} /> {saved ? 'Tersimpan!' : dirty ? 'Simpan Perubahan' : 'Tersimpan'}
        </button>
      </div>
    </div>
  )
}
