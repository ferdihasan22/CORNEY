import { useState, useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, PARENT_FILLINGS } from '../../data/menu.js'
import { useAudits } from '../../store/useAudits.js'
import { submitAudit } from '../../store/audits.js'
import { getState, subscribe, PHASE, soldByParent, breakageByParent } from '../../store/day.js'
import { latestSisaByBranch } from '../../store/aggregate.js'

// 2.4 — OPS-02 Audit Lapangan (LIVE dari sumber kebenaran).
// Operasional menghitung FISIK stok di freezer cabang, lalu sistem otomatis
// membandingkan dengan angka yang SEHARUSNYA ada. Dua mode otomatis:
//  • DADAKAN (kasir sedang jualan): sisa real-time = stok awal − terjual − patah
//    (dari sesi kasir hari ini). Inti audit dadakan: fisik < sistem = mencurigakan.
//  • SETELAH TUTUP: pakai Sisa Aktual closing terakhir (Master Laporan / stockdaily).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const nameOf = (id) => (BRANCHES.find((b) => b.id === id)?.name || id).replace('CORNEY ', '')

export default function OperasionalAudit() {
  const navigate = useNavigate()
  const audits = useAudits() || []
  const day = useSyncExternalStore(subscribe, getState) // sesi kasir live (perangkat ini)
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const [fisik, setFisik] = useState({})
  const [note, setNote] = useState('')
  const [toast, setToast] = useState('')

  // ── Tentukan mode + angka sistem (sisa yang SEHARUSNYA ada) ─────────────
  const liveOn = !!day && day.branchId === branchId && (day.phase === PHASE.SELLING || day.phase === PHASE.CLOSING) && day.stock
  const sold = liveOn ? soldByParent() : {}
  const broke = liveOn ? breakageByParent() : {}
  const closing = !liveOn ? latestSisaByBranch(branchId) : null
  const mode = liveOn ? 'live' : closing ? 'closing' : 'none'
  const sisaSistem = (p) => liveOn ? (day.stock?.[p] ?? 0) : (closing?.[p] ?? 0)

  // Prefill hitungan fisik = angka sistem tiap ganti cabang/mode.
  useEffect(() => {
    const init = {}
    PARENT_FILLINGS.forEach((p) => { init[p.id] = String(sisaSistem(p.id)) })
    setFisik(init)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, mode, day?.stock])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])

  const setF = (p, v) => setFisik((m) => ({ ...m, [p]: v.replace(/\D/g, '') }))
  const rowOf = (p) => {
    const sys = sisaSistem(p.id)
    const has = fisik[p.id] !== '' && fisik[p.id] != null
    const phys = has ? Number(fisik[p.id]) : sys
    const selisih = phys - sys // <0 kurang (mencurigakan), >0 lebih
    return { sys, phys, has, selisih, status: selisih === 0 ? 'cocok' : selisih < 0 ? 'kurang' : 'lebih' }
  }

  const adaBeda = PARENT_FILLINGS.filter((p) => rowOf(p).selisih !== 0).length
  const adaKurang = PARENT_FILLINGS.filter((p) => rowOf(p).selisih < 0).length

  const submit = () => {
    const rows = PARENT_FILLINGS.map((p) => {
      const r = rowOf(p)
      return { parent: p.id, parentName: p.name, sys: { sisa: r.sys, patah: 0, hilang: 0 }, riil: { sisa: r.phys, patah: 0, hilang: 0 } }
    })
    const tag = mode === 'live' ? `[Audit DADAKAN · kasir sedang jualan]` : closing ? `[Setelah tutup · closing ${closing.tgl}]` : '[Tanpa data sistem]'
    submitAudit({ branchId, branchName: nameOf(branchId), rows, note: note.trim() ? `${tag} ${note.trim()}` : tag })
    setToast('Hasil audit dikirim ke Owner')
    setNote('')
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-28">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/operasional')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="fact_check" /> Audit Lapangan</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Operasional · cek fisik vs sistem</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Pilih cabang — chip */}
        <div className="flex gap-2 flex-wrap">
          {BRANCHES.map((b) => (
            <button key={b.id} onClick={() => setBranchId(b.id)} className={`px-4 py-2 rounded-full font-label-md ${branchId === b.id ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant'}`}>{nameOf(b.id)}</button>
          ))}
        </div>

        {/* Banner mode */}
        {mode === 'live' ? (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4">
            <p className="font-headline-md text-headline-md text-blue-900 flex items-center gap-2"><Icon name="bolt" fill className="!text-[22px] text-blue-600" /> Audit Dadakan</p>
            <p className="text-label-md text-blue-900/90 mt-1 leading-snug">Kasir <b>sedang jualan</b> di {nameOf(branchId)}. Angka sistem = <b>sisa yang harusnya ada di freezer sekarang</b> (stok awal − terjual − patah). Hitung fisiknya, lalu cocokkan.</p>
          </div>
        ) : mode === 'closing' ? (
          <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-4">
            <p className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="event_available" className="text-primary" /> Setelah Tutup</p>
            <p className="text-label-md text-on-surface-variant mt-1 leading-snug">Tidak ada sesi jualan aktif. Pembanding = <b>Sisa Aktual closing terakhir</b> (tgl {closing.tgl}) dari Master Laporan.</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900">
            <p className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="help" className="text-amber-600" /> Belum Ada Data Sistem</p>
            <p className="text-label-md mt-1 leading-snug">Cabang ini belum punya sesi jualan / closing. Kamu masih bisa catat hitungan fisik lalu kirim ke Owner.</p>
          </div>
        )}

        {/* Ringkasan */}
        <div className={`rounded-2xl p-4 flex items-start gap-3 ${adaKurang > 0 ? 'bg-error-container text-on-error-container' : adaBeda > 0 ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-green-100 text-green-800'}`}>
          <Icon name={adaKurang > 0 ? 'campaign' : adaBeda > 0 ? 'visibility' : 'verified'} fill className="!text-[28px] shrink-0" />
          <div>
            <p className="font-headline-md text-headline-md leading-tight">{adaKurang > 0 ? `${adaKurang} isian KURANG dari seharusnya` : adaBeda > 0 ? `${adaBeda} isian beda (lebih)` : 'Semua cocok dengan sistem'}</p>
            <p className="text-label-md mt-0.5">{adaKurang > 0 ? (mode === 'live' ? 'Stok fisik lebih sedikit dari yang seharusnya → bisa jadi ada penjualan tak tercatat / dibawa. Tanya kasir.' : 'Fisik lebih sedikit dari closing. Telusuri.') : adaBeda > 0 ? 'Fisik lebih banyak — mungkin lupa catat / salah hitung.' : 'Hitungan fisikmu sama dengan catatan sistem.'}</p>
          </div>
        </div>

        {/* Kartu hitung fisik — 2 kolom */}
        <div className="grid grid-cols-2 gap-3">
          {PARENT_FILLINGS.map((p) => {
            const r = rowOf(p)
            const tone = r.status === 'kurang' ? 'border-error/50' : r.status === 'lebih' ? 'border-amber-300' : 'border-green-200'
            return (
              <div key={p.id} className={`bg-surface-container-lowest rounded-2xl border-2 ${tone} shadow-[0_4px_16px_rgba(26,26,26,0.06)] p-3 flex flex-col`}>
                <h3 className="font-headline-md text-headline-md leading-tight">{p.name}</h3>
                {/* Harusnya ada */}
                <div className="mt-2 bg-surface-container rounded-xl px-3 py-2 text-center">
                  <p className="text-[10px] uppercase text-on-surface-variant leading-none">Harusnya ada</p>
                  <p className="font-display-md text-display-md leading-none mt-1">{r.sys}</p>
                  {mode === 'live' && <p className="text-[9px] text-on-surface-variant mt-1 leading-tight">awal {day.openingStock?.[p.id] ?? 0} − jual {sold[p.id] || 0} − patah {broke[p.id] || 0}</p>}
                </div>
                {/* Hitung fisik */}
                <label className="text-[10px] uppercase text-on-surface-variant mt-2 mb-0.5 ml-0.5">Hitung fisik (freezer)</label>
                <input inputMode="numeric" value={fisik[p.id] ?? ''} onChange={(e) => setF(p.id, e.target.value)} className="w-full h-12 text-center rounded-xl border-2 border-primary focus:ring-4 focus:ring-primary/10 outline-none font-headline-lg text-headline-lg bg-surface min-w-0" size={1} />
                {/* Status selisih */}
                <div className={`mt-2 rounded-lg px-2 py-1.5 text-center text-[12px] font-bold ${r.status === 'cocok' ? 'bg-green-50 text-green-700' : r.status === 'kurang' ? 'bg-error-container text-error' : 'bg-amber-50 text-amber-800'}`}>
                  {r.status === 'cocok' ? <><Icon name="check" className="!text-[15px] align-middle" /> Cocok</> : r.status === 'kurang' ? <><Icon name="south" className="!text-[14px] align-middle" /> Kurang {Math.abs(r.selisih)}</> : <><Icon name="north" className="!text-[14px] align-middle" /> Lebih {r.selisih}</>}
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <label className="text-[11px] font-bold text-on-surface-variant uppercase ml-1">Catatan audit</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Temuan di lapangan, alasan selisih…" className="w-full mt-1 px-4 py-3 rounded-xl border border-outline focus:border-primary outline-none bg-surface resize-none" />
        </div>

        {audits.length > 0 && (
          <section className="space-y-2 pt-2">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="history" className="text-primary" /> Riwayat Audit</h2>
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 divide-y divide-outline-variant/30">
              {audits.slice(0, 8).map((a) => (
                <div key={a.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0"><p className="font-label-lg truncate">{a.branchName}{a.note?.startsWith('[Audit DADAKAN') ? ' · dadakan' : ''}</p><p className="text-label-md text-on-surface-variant">{fmtTime(a.createdAt)}</p></div>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase shrink-0 ${a.allCocok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{a.allCocok ? 'Cocok' : 'Ada selisih'}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-[12px] text-on-surface-variant/70 leading-relaxed flex items-start gap-1.5"><Icon name="info" className="!text-[16px] shrink-0 mt-0.5" /> Audit dadakan live terbaca saat kasir & operasional di <b>perangkat yang sama</b> (Fase 1). Antar-perangkat butuh server (TAHAP 4) — sementara otomatis pakai closing terakhir. Operasional <b>mengusulkan</b>; eksekusi koreksi tetap Owner.</p>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        <button onClick={submit} className="max-w-2xl mx-auto w-full min-h-[52px] bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg">
          <Icon name="send" /> Laporkan Hasil Audit ke Owner
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
