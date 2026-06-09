import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PARENT_FILLINGS, BRANCHES } from '../../data/menu.js'
import { useFreezer } from '../../store/useFreezer.js'
import { useProduction } from '../../store/useProduction.js'
import { damageFreezer } from '../../store/freezer.js'
import { addProduction } from '../../store/production.js'

// PRD — Catat Rusak Stok Freezer. Untuk stok yang SUDAH di freezer lalu rusak (mis.
// pecah saat memisahkan yang nempel). Beda dari "Rusak" di Catat Produksi (itu rusak
// SAAT BIKIN, tak pernah masuk freezer). Di sini: sisa freezer LANGSUNG berkurang +
// dicatat sebagai susut wajar (fromFreezer) → di laporan = susut, BUKAN barang hilang.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
// Aman-null (cabang bisa kosong sehabis Mulai Bersih) → jangan .replace pada undefined.
const nameOf = (id) => (BRANCHES.find((b) => b.id === id)?.name || id || '').replace('CORNEY ', '')
const COLOR = {
  mozza: { bd: 'border-amber-300', tx: 'text-amber-800', bg: 'bg-amber-50' },
  sosis: { bd: 'border-orange-300', tx: 'text-orange-800', bg: 'bg-orange-50' },
  jumbo: { bd: 'border-rose-300', tx: 'text-rose-800', bg: 'bg-rose-50' },
  mix: { bd: 'border-violet-300', tx: 'text-violet-800', bg: 'bg-violet-50' },
}
const KATEGORI = ['Nempel/pisah', 'Jatuh', 'Gosong', 'Lain']

export default function ProduksiRusak() {
  const navigate = useNavigate()
  const freezer = useFreezer() || {}
  const log = useProduction() || []
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const [rows, setRows] = useState({}) // { parentId: qtyRusak }
  const [kategori, setKategori] = useState('Nempel/pisah')
  const [teks, setTeks] = useState('')
  const [toast, setToast] = useState('')

  const sisaNow = (id) => (freezer[branchId]?.[id]?.sisa) ?? 0
  const get = (id) => rows[id] || 0
  // Clamp ke [0, sisa] → tak bisa merusak lebih dari yang ada di freezer.
  const setQty = (id, v) => setRows((r) => ({ ...r, [id]: Math.max(0, Math.min(sisaNow(id), Math.round(v))) }))
  const anyInput = PARENT_FILLINGS.some((p) => get(p.id) > 0)

  const save = () => {
    if (!anyInput) return
    const b = BRANCHES.find((x) => x.id === branchId)
    const done = []
    PARENT_FILLINGS.forEach((p) => {
      const rusak = Math.min(get(p.id), sisaNow(p.id))
      if (rusak <= 0) return
      damageFreezer(branchId, p.id, rusak) // sisa freezer langsung turun (+ sinkron server)
      addProduction({ branchId, branchName: b?.name, parent: p.id, parentName: p.name, jadi: 0, susut: rusak, fromFreezer: true, kategori, alasan: teks })
      done.push(`${p.name} −${rusak}`)
    })
    setToast(`Rusak tercatat di ${nameOf(branchId)}: ${done.join(', ') || '(tidak ada)'}`)
    setRows({}); setTeks('')
    setTimeout(() => setToast(''), 3200)
  }

  const renderStepper = (id) => {
    const val = get(id)
    const max = sisaNow(id)
    return (
      <div className="flex items-center gap-1 px-1">
        <button onClick={() => setQty(id, val - 1)} className="w-8 h-10 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center active:scale-90 shrink-0"><Icon name="remove" className="!text-[18px]" /></button>
        <input inputMode="numeric" value={val || ''} placeholder="0" onChange={(e) => setQty(id, Number(e.target.value.replace(/\D/g, '')) || 0)} className="flex-1 min-w-0 w-full h-10 text-[18px] text-center rounded-lg border-2 border-error/60 font-bold bg-surface px-0.5" />
        <button onClick={() => setQty(id, val + 1)} disabled={val >= max} className="w-8 h-10 rounded-lg bg-error text-on-error flex items-center justify-center active:scale-90 shrink-0 disabled:opacity-30"><Icon name="add" className="!text-[18px]" /></button>
      </div>
    )
  }

  // Belum ada cabang (mis. sehabis Mulai Bersih) → pesan ramah, jangan render form.
  if (BRANCHES.length === 0) {
    return (
      <div className="bg-background text-on-surface min-h-screen flex flex-col items-center justify-center p-8 text-center gap-3">
        <Icon name="storefront" className="!text-[56px] text-on-surface-variant/50" />
        <p className="font-headline-md text-headline-md">Belum ada cabang</p>
        <p className="text-on-surface-variant max-w-sm">Stok freezer dicatat per cabang. Minta <b>Owner</b> menambahkan cabang dulu, lalu buka layar ini lagi.</p>
        <button onClick={() => navigate('/ops/produksi')} className="mt-2 h-11 px-6 rounded-xl bg-primary text-on-primary font-bold active:scale-95 flex items-center gap-2"><Icon name="arrow_back" /> Kembali</button>
      </div>
    )
  }

  const rusakLog = log.filter((b) => b.fromFreezer)

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-28">
      <header className="sticky top-0 z-40 bg-error text-on-error px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/produksi')} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="dangerous" fill /> Catat Rusak Freezer</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Stok freezer yang rusak (mis. saat dipisah)</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-[12px] text-amber-900 flex items-start gap-2">
          <Icon name="info" fill className="!text-[16px] mt-0.5 shrink-0 text-amber-600" />
          <p>Pakai ini hanya untuk stok yang <b>sudah ada di freezer</b> lalu rusak (mis. pecah saat memisahkan yang nempel). Sisa freezer akan <b>langsung berkurang</b> & tercatat sebagai <b>susut wajar</b> (bukan barang hilang).</p>
        </div>

        {/* Langkah 1: pilih cabang */}
        <div>
          <p className="font-label-lg mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-error text-on-error flex items-center justify-center text-[13px] font-bold">1</span> Freezer cabang mana?</p>
          <div className="grid grid-cols-2 gap-3">
            {BRANCHES.map((b) => (
              <button key={b.id} onClick={() => setBranchId(b.id)} className={`h-16 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-[16px] transition-all active:scale-95 ${branchId === b.id ? 'border-error bg-error text-on-error shadow-md' : 'border-outline-variant bg-surface-container-lowest text-on-surface'}`}>
                <Icon name={branchId === b.id ? 'check_circle' : 'storefront'} fill={branchId === b.id} /> {nameOf(b.id)}
              </button>
            ))}
          </div>
        </div>

        {/* Langkah 2: alasan */}
        <div>
          <p className="font-label-lg mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-error text-on-error flex items-center justify-center text-[13px] font-bold">2</span> Kenapa rusak?</p>
          <div className="flex flex-wrap gap-2">
            {KATEGORI.map((k) => (
              <button key={k} onClick={() => setKategori(k)} className={`px-3 h-9 rounded-full border-2 font-bold text-[13px] active:scale-95 ${kategori === k ? 'border-error bg-error text-on-error' : 'border-outline-variant bg-surface-container-lowest text-on-surface'}`}>{k}</button>
            ))}
          </div>
          <input value={teks} onChange={(e) => setTeks(e.target.value)} placeholder="Catatan (opsional), mis. nempel parah di rak bawah" className="w-full h-11 mt-2 px-3 rounded-xl border border-outline focus:border-error focus:ring-1 focus:ring-error outline-none text-label-md bg-surface-container-lowest" />
        </div>

        {/* Langkah 3: jumlah rusak per isian */}
        <div>
          <p className="font-label-lg mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-error text-on-error flex items-center justify-center text-[13px] font-bold">3</span> Berapa yang rusak?</p>
          <div className="grid grid-cols-2 gap-3">
            {PARENT_FILLINGS.map((p) => {
              const rusak = get(p.id)
              const sisa = sisaNow(p.id)
              const c = COLOR[p.id] || { bd: 'border-outline-variant/40', tx: 'text-on-surface', bg: 'bg-surface-container-lowest' }
              return (
                <div key={p.id} className={`rounded-2xl border-2 p-3 ${rusak > 0 ? 'border-error' : c.bd} ${c.bg}`}>
                  <h3 className={`font-black text-[18px] leading-tight ${c.tx}`}>{p.name}</h3>
                  <p className="text-[11px] text-on-surface-variant mb-2">freezer: <b className="text-on-surface">{sisa}</b>{rusak > 0 && <span className="text-error font-bold"> → {Math.max(0, sisa - rusak)}</span>}</p>
                  <div className="bg-white/70 border border-error/30 rounded-xl py-2">
                    <p className="text-[11px] font-bold text-error text-center mb-1 flex items-center justify-center gap-1"><Icon name="dangerous" fill className="!text-[14px]" /> Rusak</p>
                    {renderStepper(p.id)}
                  </div>
                  {sisa === 0 && <p className="text-[10px] text-on-surface-variant text-center mt-1">freezer kosong</p>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Riwayat rusak */}
        {rusakLog.length > 0 && (
          <section className="space-y-2 pt-2">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="history" className="text-error" /> Riwayat Rusak</h2>
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 divide-y divide-outline-variant/30">
              {rusakLog.slice(0, 12).map((b) => (
                <div key={b.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0"><p className="font-label-lg truncate">{b.parentName} · <span className="text-error">−{b.susut}</span>{b.kategori && <span className="text-on-surface-variant"> · {b.kategori}</span>}</p><p className="text-label-md text-on-surface-variant truncate">{b.branchName ? `${b.branchName.replace('CORNEY ', '')} · ` : ''}{fmtTime(b.createdAt)}{b.alasan ? ` · ${b.alasan}` : ''}</p></div>
                  <Icon name="dangerous" className="text-error shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Tombol simpan (sticky) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        <button onClick={save} disabled={!anyInput} className="max-w-2xl mx-auto w-full min-h-[56px] bg-error text-on-error rounded-2xl font-bold text-[17px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-40">
          <Icon name="dangerous" fill /> Catat Rusak & Kurangi Freezer
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-on-surface text-surface px-5 py-3 rounded-full shadow-xl flex items-center gap-2 font-label-lg max-w-[90vw] text-center">
          <Icon name="check_circle" fill className="!text-[20px] text-green-400 shrink-0" /> {toast}
        </div>
      )}
    </div>
  )
}
