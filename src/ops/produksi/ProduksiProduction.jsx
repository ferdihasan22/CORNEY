import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PARENT_FILLINGS, BRANCHES } from '../../data/menu.js'
import { useProduction } from '../../store/useProduction.js'
import { addProduction } from '../../store/production.js'
import { addFreezerStock } from '../../store/freezer.js'
import { useFreezer } from '../../store/useFreezer.js'

// 2.5 — PRD-01 Catat Hasil Produksi. Satu layar: pilih cabang → isi jumlah JADI
// (& rusak) untuk SEMUA isian sekaligus → Catat. Hasil "jadi" menambah stok
// freezer cabang itu. Sengaja besar & bahasa sederhana (operasi lulusan SD).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
// Aman-null: tanpa cabang terpilih (mis. sehabis Mulai Bersih, BRANCHES=[]) id bisa
// undefined → JANGAN .replace pada undefined (dulu bikin crash "Cannot read 'replace'").
const nameOf = (id) => (BRANCHES.find((b) => b.id === id)?.name || id || '').replace('CORNEY ', '')
// Warna khas per isian agar mudah dibedakan.
const COLOR = {
  mozza: { bd: 'border-amber-300', tx: 'text-amber-800', bg: 'bg-amber-50' },
  sosis: { bd: 'border-orange-300', tx: 'text-orange-800', bg: 'bg-orange-50' },
  jumbo: { bd: 'border-rose-300', tx: 'text-rose-800', bg: 'bg-rose-50' },
  mix: { bd: 'border-violet-300', tx: 'text-violet-800', bg: 'bg-violet-50' },
}

export default function ProduksiProduction() {
  const navigate = useNavigate()
  const log = useProduction() || []
  const freezer = useFreezer() || {}
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const [rows, setRows] = useState({}) // { parentId: { jadi, susut } }
  const [toast, setToast] = useState('')

  const get = (id, k) => rows[id]?.[k] || 0
  const setQty = (id, k, v) => setRows((r) => ({ ...r, [id]: { ...r[id], [k]: Math.max(0, v) } }))
  const sisaNow = (id) => (freezer[branchId]?.[id]?.sisa) ?? 0
  const anyInput = PARENT_FILLINGS.some((p) => get(p.id, 'jadi') > 0 || get(p.id, 'susut') > 0)

  const save = () => {
    if (!anyInput) return
    const b = BRANCHES.find((x) => x.id === branchId)
    const done = []
    PARENT_FILLINGS.forEach((p) => {
      const jadi = get(p.id, 'jadi'); const susut = get(p.id, 'susut')
      if (jadi <= 0 && susut <= 0) return
      addProduction({ branchId, branchName: b?.name, parent: p.id, parentName: p.name, jadi, susut, alasan: '' })
      if (jadi > 0) { addFreezerStock(branchId, p.id, jadi); done.push(`${p.name} +${jadi}`) }
    })
    setToast(`Masuk freezer ${nameOf(branchId)}: ${done.join(', ') || '(tidak ada)'}`)
    setRows({})
    setTimeout(() => setToast(''), 3200)
  }

  const renderStepper = (id, k, big) => {
    const val = get(id, k)
    const sz = big ? 'w-9 h-10' : 'w-8 h-9'
    const f = big ? 'h-10 text-[20px]' : 'h-9 text-[16px]'
    return (
      <div className="flex items-center gap-1 px-1">
        <button onClick={() => setQty(id, k, val - 1)} className={`${sz} rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center active:scale-90 shrink-0`}><Icon name="remove" className="!text-[18px]" /></button>
        <input inputMode="numeric" value={val || ''} placeholder="0" onChange={(e) => setQty(id, k, Number(e.target.value.replace(/\D/g, '')) || 0)} className={`flex-1 min-w-0 ${f} text-center rounded-lg border-2 ${big ? 'border-primary' : 'border-outline-variant'} font-bold bg-surface px-1`} size={1} />
        <button onClick={() => setQty(id, k, val + 1)} className={`${sz} rounded-lg ${big ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'} flex items-center justify-center active:scale-90 shrink-0`}><Icon name="add" className="!text-[18px]" /></button>
      </div>
    )
  }

  // Belum ada cabang (mis. sehabis Mulai Bersih / sebelum Owner menambah cabang) →
  // tampilkan pesan ramah, JANGAN render form (yang butuh cabang terpilih).
  if (BRANCHES.length === 0) {
    return (
      <div className="bg-background text-on-surface min-h-screen flex flex-col items-center justify-center p-8 text-center gap-3">
        <Icon name="storefront" className="!text-[56px] text-on-surface-variant/50" />
        <p className="font-headline-md text-headline-md">Belum ada cabang</p>
        <p className="text-on-surface-variant max-w-sm">Produksi dicatat per cabang. Minta <b>Owner</b> menambahkan cabang dulu di Kelola Cabang, lalu buka layar ini lagi.</p>
        <button onClick={() => navigate('/ops/produksi')} className="mt-2 h-11 px-6 rounded-xl bg-primary text-on-primary font-bold active:scale-95 flex items-center gap-2"><Icon name="arrow_back" /> Kembali</button>
      </div>
    )
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-28">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/produksi')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="factory" /> Catat Hasil Produksi</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Produksi · isi semua sekaligus</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Langkah 1: pilih cabang */}
        <div>
          <p className="font-label-lg mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[13px] font-bold">1</span> Untuk cabang mana?</p>
          <div className="grid grid-cols-2 gap-3">
            {BRANCHES.map((b) => (
              <button key={b.id} onClick={() => setBranchId(b.id)} className={`h-16 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-[16px] transition-all active:scale-95 ${branchId === b.id ? 'border-primary bg-primary text-on-primary shadow-md' : 'border-outline-variant bg-surface-container-lowest text-on-surface'}`}>
                <Icon name={branchId === b.id ? 'check_circle' : 'storefront'} fill={branchId === b.id} /> {nameOf(b.id)}
              </button>
            ))}
          </div>
          <div className="mt-2 bg-secondary-container text-on-secondary-container rounded-xl px-3 py-2.5 text-center font-bold flex items-center justify-center gap-2"><Icon name="storefront" className="!text-[18px]" /> Mencatat untuk: {nameOf(branchId).toUpperCase()}</div>
        </div>

        {/* Langkah 2: isi jumlah tiap isian */}
        <div>
          <p className="font-label-lg mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[13px] font-bold">2</span> Berapa yang jadi hari ini?</p>
          <div className="grid grid-cols-2 gap-3">
            {PARENT_FILLINGS.map((p) => {
              const jadi = get(p.id, 'jadi')
              const c = COLOR[p.id] || { bd: 'border-outline-variant/40', tx: 'text-on-surface', bg: 'bg-surface-container-lowest' }
              return (
                <div key={p.id} className={`rounded-2xl border-2 p-3 ${jadi > 0 ? 'border-green-500' : c.bd} ${c.bg}`}>
                  <h3 className={`font-black text-[18px] leading-tight ${c.tx}`}>{p.name}</h3>
                  <p className="text-[11px] text-on-surface-variant mb-2">freezer: <b className="text-on-surface">{sisaNow(p.id)}</b>{jadi > 0 && <span className="text-green-700 font-bold"> → {sisaNow(p.id) + jadi}</span>}</p>
                  <div className="bg-white/70 border border-green-300 rounded-xl py-2">
                    <p className="text-[11px] font-bold text-green-700 text-center mb-1 flex items-center justify-center gap-1"><Icon name="add_circle" fill className="!text-[14px]" /> Jadi</p>
                    {renderStepper(p.id, 'jadi', true)}
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] text-on-surface-variant text-center mb-1 flex items-center justify-center gap-1"><Icon name="dangerous" className="!text-[13px] text-error" /> Rusak</p>
                    {renderStepper(p.id, 'susut', false)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Riwayat */}
        {log.length > 0 && (
          <section className="space-y-2 pt-2">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="history" className="text-primary" /> Riwayat Produksi</h2>
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 divide-y divide-outline-variant/30">
              {log.slice(0, 12).map((b) => (
                <div key={b.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0"><p className="font-label-lg truncate">{b.parentName} · <span className="text-green-700">+{b.jadi}</span>{b.susut > 0 && <span className="text-error"> · rusak {b.susut}</span>}</p><p className="text-label-md text-on-surface-variant">{b.branchName ? `${b.branchName.replace('CORNEY ', '')} · ` : ''}{fmtTime(b.createdAt)}</p></div>
                  <Icon name="ac_unit" className="text-blue-500 shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Tombol simpan (sticky) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        <button onClick={save} disabled={!anyInput} className="max-w-2xl mx-auto w-full min-h-[56px] bg-primary text-on-primary rounded-2xl font-bold text-[17px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-40">
          <Icon name="ac_unit" /> Catat & Masukkan ke Freezer {nameOf(branchId)}
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
