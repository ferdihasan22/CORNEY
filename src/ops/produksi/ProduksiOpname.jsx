import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS } from '../../data/menu.js'
import { useFreezer } from '../../store/useFreezer.js'
import { useOpname } from '../../store/useOpname.js'
import { submitOpname } from '../../store/opname.js'
import { createFreezerCorrection } from '../../store/freezerCorrections.js'

// 2.5 — PRD-04 Opname Freezer (Produksi). Hitung ulang fisik vs sistem → catat
// selisih (Anomali Owner). Sisa TIDAK langsung diubah: tiap selisih → diajukan
// sbg koreksi sisa → persetujuan Owner (konsisten dgn aturan ubah-sisa).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const nameOf = (id) => (BRANCHES.find((b) => b.id === id)?.name || id || '').replace('CORNEY ', '')
const COLOR = {
  mozza: { bd: 'border-amber-300', tx: 'text-amber-800', bg: 'bg-amber-50' },
  sosis: { bd: 'border-orange-300', tx: 'text-orange-800', bg: 'bg-orange-50' },
  jumbo: { bd: 'border-rose-300', tx: 'text-rose-800', bg: 'bg-rose-50' },
  mix: { bd: 'border-violet-300', tx: 'text-violet-800', bg: 'bg-violet-50' },
}

export default function ProduksiOpname() {
  const navigate = useNavigate()
  const freezer = useFreezer() || {}
  const history = useOpname() || []
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('corney_opname_mode') || 'isi' } catch { return 'isi' } }) // 'isi' | 'mingguan' (disimpan)
  const pickMode = (k) => { setMode(k); try { localStorage.setItem('corney_opname_mode', k) } catch { /* noop */ } }
  const [fisik, setFisik] = useState({})
  const [toast, setToast] = useState('')

  const branch = BRANCHES.find((b) => b.id === branchId)
  const sysOf = (p) => ((freezer[branchId] || {})[p] || { sisa: 0 }).sisa

  useEffect(() => { setFisik({}) }, [branchId]) // kosongkan → produksi hitung sendiri
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t) }, [toast])

  const setF = (p, v) => setFisik((m) => ({ ...m, [p]: Math.max(0, Number(String(v).replace(/\D/g, '')) || 0) }))
  const renderStepper = (id) => {
    const raw = fisik[id]
    const val = raw || 0
    return (
      <div className="flex items-center gap-1 px-1">
        <button onClick={() => setF(id, val - 1)} className="w-9 h-10 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center active:scale-90 shrink-0"><Icon name="remove" className="!text-[18px]" /></button>
        <input inputMode="numeric" value={raw ?? ''} placeholder="0" onChange={(e) => setF(id, e.target.value)} className="flex-1 min-w-0 h-10 text-[20px] text-center rounded-lg border-2 border-primary font-bold bg-surface px-1" size={1} />
        <button onClick={() => setF(id, val + 1)} className="w-9 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center active:scale-90 shrink-0"><Icon name="add" className="!text-[18px]" /></button>
      </div>
    )
  }
  const allCounted = PARENT_FILLINGS.every((p) => fisik[p.id] != null)
  // Jadwal opname MINGGUAN: 7 hari sejak opname mingguan TERAKHIR cabang ini.
  // Hanya lihat mode 'mingguan' → tak bentrok dgn opname "Setiap Isi".
  const fmtDay = (d) => d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long' })
  const weekly = (() => {
    const wk = (history || []).filter((h) => h.branchId === branchId && h.mode === 'mingguan').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    if (!wk[0]) return { never: true }
    const last = new Date(wk[0].createdAt)
    const next = new Date(last.getTime() + 7 * 86400000)
    return { last, next, days: Math.ceil((next - new Date()) / 86400000) }
  })()
  const save = () => {
    if (!allCounted) return
    const rows = PARENT_FILLINGS.map((p) => ({ parent: p.id, parentName: p.name, sys: sysOf(p.id), fisik: fisik[p.id] }))
    submitOpname({ branchId, branchName: branch?.name, mode, rows })
    // Sisa tidak diubah langsung — tiap selisih diajukan sbg koreksi → approval Owner.
    let n = 0
    rows.forEach((r) => { if (r.fisik !== r.sys) { createFreezerCorrection({ branchId, branchName: branch?.name, parent: r.parent, parentName: r.parentName, current: r.sys, proposed: r.fisik, reason: `Opname ${mode === 'mingguan' ? 'mingguan' : 'isi ulang'}` }); n++ } })
    setToast(n > 0 ? `Opname tersimpan · ${n} koreksi sisa diajukan ke Owner` : 'Opname tersimpan · semua cocok')
  }

  const branchHist = history.filter((h) => h.branchId === branchId)

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-28">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/produksi')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="inventory_2" /> Opname Freezer</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Produksi</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Langkah 1: cabang + mode */}
        <div>
          <p className="font-label-lg mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[13px] font-bold">1</span> Cabang mana?</p>
          <div className="grid grid-cols-2 gap-3">
            {BRANCHES.map((b) => (
              <button key={b.id} onClick={() => setBranchId(b.id)} className={`h-16 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-[16px] transition-all active:scale-95 ${branchId === b.id ? 'border-primary bg-primary text-on-primary shadow-md' : 'border-outline-variant bg-surface-container-lowest text-on-surface'}`}>
                <Icon name={branchId === b.id ? 'check_circle' : 'storefront'} fill={branchId === b.id} /> {nameOf(b.id)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 bg-secondary-container text-on-secondary-container rounded-xl px-3 py-2">
            <span className="font-bold flex items-center gap-2 min-w-0"><Icon name="storefront" className="!text-[18px] shrink-0" /> Opname: {nameOf(branchId).toUpperCase()}</span>
            <div className="flex bg-on-secondary-container/10 rounded-full p-0.5 shrink-0">
              {[['isi', 'Setiap Isi'], ['mingguan', 'Mingguan']].map(([k, lbl]) => (
                <button key={k} onClick={() => pickMode(k)} className={`px-3 py-1 rounded-full text-[12px] font-bold ${mode === k ? 'bg-on-secondary-container text-secondary-container' : ''}`}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Jadwal / info mode */}
        {mode === 'mingguan' ? (
          weekly.never ? (
            <div className="rounded-xl px-3 py-2.5 border bg-blue-50 border-blue-100 text-blue-900 flex items-start gap-2"><Icon name="event_upcoming" className="!text-[18px] shrink-0 mt-0.5" /><p className="text-label-md leading-snug">Opname mingguan <b>pertama</b> untuk cabang ini — lakukan sekarang. Jadwal berikutnya otomatis <b>7 hari</b> setelah ini.</p></div>
          ) : (
            <div className={`rounded-xl px-3 py-2.5 border flex items-start gap-2 ${weekly.days <= 0 ? 'bg-error-container border-error/30 text-error' : weekly.days <= 1 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-100 text-blue-900'}`}>
              <Icon name={weekly.days <= 0 ? 'event_busy' : 'event_available'} fill className="!text-[18px] shrink-0 mt-0.5" />
              <p className="text-label-md leading-snug">{weekly.days <= 0 ? <><b>Jatuh tempo opname mingguan!</b> (jadwal {fmtDay(weekly.next)})</> : <>Opname mingguan berikutnya: <b>{fmtDay(weekly.next)}</b> ({weekly.days} hari lagi)</>}. Terakhir: {fmtDay(weekly.last)}.</p>
            </div>
          )
        ) : (
          <div className="rounded-xl px-3 py-2 bg-surface-container text-on-surface-variant text-label-md flex items-center gap-2"><Icon name="info" className="!text-[16px]" /> Mode <b>Setiap Isi</b>: opname dilakukan tiap kali mengisi stok (tanpa jadwal tetap).</div>
        )}

        {/* Langkah 2: hitung fisik (2 kolom berwarna) */}
        <div>
          <p className="font-label-lg mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[13px] font-bold">2</span> Hitung fisik di freezer</p>
          <div className="grid grid-cols-2 gap-3">
            {PARENT_FILLINGS.map((p) => {
              const sys = sysOf(p.id); const counted = fisik[p.id] != null; const sel = (fisik[p.id] || 0) - sys
              const c = COLOR[p.id] || { bd: 'border-outline-variant/40', tx: 'text-on-surface', bg: 'bg-surface-container-lowest' }
              return (
                <div key={p.id} className={`rounded-2xl border-2 p-3 ${counted && sel !== 0 ? 'border-amber-400' : c.bd} ${c.bg}`}>
                  <h3 className={`font-black text-[18px] leading-tight ${c.tx}`}>{p.name}</h3>
                  <p className="text-[11px] text-on-surface-variant mb-2">sistem: <b className="text-on-surface">{sys}</b></p>
                  <div className="bg-white/70 border border-primary/30 rounded-xl py-2">
                    <p className="text-[11px] font-bold text-on-surface-variant text-center mb-1">Hitung fisik</p>
                    {renderStepper(p.id)}
                  </div>
                  <p className={`text-center text-[12px] font-bold mt-2 ${!counted ? 'text-on-surface-variant/60' : sel === 0 ? 'text-green-600' : sel < 0 ? 'text-error' : 'text-amber-700'}`}>{!counted ? 'belum dihitung' : sel === 0 ? 'Cocok ✓' : `Selisih ${sel > 0 ? '+' : ''}${sel}`}</p>
                </div>
              )
            })}
          </div>
          <p className="text-[12px] text-on-surface-variant italic px-1 mt-2">Selisih minus → kemungkinan pengambilan tak tercatat. Disimpan → diajukan ke Owner untuk disetujui.</p>
        </div>

        {branchHist.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="history" className="text-primary" /> Riwayat Opname</h2>
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 divide-y divide-outline-variant/30">
              {branchHist.slice(0, 8).map((h) => (
                <div key={h.id} className="p-3 flex items-center justify-between">
                  <div><p className="font-label-lg">{fmtTime(h.createdAt)} · {h.mode === 'isi' ? 'Setiap Isi' : 'Mingguan'}</p></div>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${h.totalSelisih === 0 ? 'bg-green-100 text-green-700' : 'bg-error-container text-on-error-container'}`}>{h.totalSelisih === 0 ? 'Cocok' : `Selisih ${h.totalSelisih}`}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        <button onClick={save} disabled={!allCounted} className="max-w-2xl mx-auto w-full min-h-[52px] bg-primary text-on-primary rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-40"><Icon name="save" /> {allCounted ? 'Simpan Opname' : 'Hitung semua isian dulu'}</button>
      </div>

      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-on-surface text-surface px-5 py-3 rounded-full shadow-xl flex items-center gap-2 font-label-lg whitespace-nowrap"><Icon name="check_circle" fill className="!text-[20px] text-green-400" /> {toast}</div>}
    </div>
  )
}
