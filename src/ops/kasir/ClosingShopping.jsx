import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BRANCHES } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, setReportDate, saveClosingBelanja } from '../../store/day.js'
import { useShoppingItems } from '../../store/useShoppingItems.js'
import { hasStockDay } from '../../store/stockdaily.js'

const pad = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const isoToDDMM = (iso) => { const [y, m, d] = (iso || '').split('-'); return d ? `${d}/${m}/${y}` : '' }

// 1A — CLS-00 Request Belanja Besok (langkah pertama tutup toko, opsional).
// Kasir centang item yg perlu dibeli besok + jumlah Kotak + catatan → teks
// siap-salin untuk ditempel/di-screenshot ke grup WA. Daftar item dikelola Owner.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function ClosingShopping() {
  const day = useDay()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  const items = useShoppingItems() || []
  const [picked, setPicked] = useState(() => ({})) // { itemId: jumlah }
  const [kotak, setKotak] = useState(0)
  const [notes, setNotes] = useState('')
  const [copied, setCopied] = useState(false)

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />

  // Tanggal laporan (digabung di sini, langkah paling awal). Disimpan di day store,
  // dipakai saat Kirim di Langkah 5. Izin hari ini/kemarin, tolak masa depan & dobel.
  const nowD = new Date()
  const todayISO = toISO(nowD)
  const yISO = toISO(new Date(nowD.getTime() - 86400000))
  const dateISO = day.reportDate || todayISO
  const tglDDMM = isoToDDMM(dateISO)
  const dateFuture = dateISO > todayISO
  const dateTooOld = dateISO < yISO
  const dateDup = hasStockDay(tglDDMM, day.branchId)
  const dateOk = !dateFuture && !dateTooOld && !dateDup

  const toggle = (id) => setPicked((p) => { const n = { ...p }; if (n[id] != null) delete n[id]; else n[id] = 1; return n })
  const setQty = (id, q) => setPicked((p) => ({ ...p, [id]: Math.max(1, q) }))
  const pickedItems = items.filter((i) => picked[i.id] != null)

  const buildText = () => {
    const lbl = (() => { try { return new Date(dateISO).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) } catch { return tglDDMM } })()
    const lines = [`*Belanja Besok — ${branch.name}*`, lbl, '']
    if (pickedItems.length) pickedItems.forEach((i) => lines.push(`✅ ${i.name} × ${picked[i.id]}`))
    else lines.push('(belum ada item dicentang)')
    if (kotak > 0) lines.push('', `📦 Kotak: ${kotak}`)
    if (notes.trim()) lines.push('', `📝 ${notes.trim()}`)
    lines.push('', '#CeritanyaBersamaCorney')
    return lines.join('\n')
  }
  const salin = async () => { try { await navigator.clipboard.writeText(buildText()); setCopied(true); setTimeout(() => setCopied(false), 2200) } catch { /* clipboard blocked */ } }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-28">
      <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md flex items-center gap-3 px-4 sm:px-margin-page h-[64px]">
        <button onClick={() => navigate('/ops/kasir/jualan')} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <div className="flex-1">
          <h1 className="font-headline-md text-headline-md leading-tight">Tutup Toko — Request Belanja Besok</h1>
          <p className="text-label-md opacity-90">{branch.name} · Langkah 1/5 · opsional</p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-6 space-y-4">
        {/* Tanggal laporan — DIISI DI SINI (langkah paling awal). */}
        <div className="bg-secondary-container/30 border-2 border-secondary-container rounded-2xl p-5">
          <p className="font-display-md text-display-md text-primary text-center uppercase tracking-wide flex items-center justify-center gap-2"><Icon name="warning" fill /> PASTIKAN JANGAN SALAH TANGGAL!</p>
          <p className="text-center text-on-surface-variant mt-1 mb-4">Laporan masuk ke <b>tanggal yang kamu pilih</b>, bukan jam sistem. Kalau tutup lewat tengah malam, pilih tanggal jualannya.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <label className="font-label-lg text-on-surface-variant">Tanggal Laporan:</label>
            <input type="date" value={dateISO} min={yISO} max={todayISO} onChange={(e) => setReportDate(e.target.value)} className="h-[56px] px-4 rounded-xl border-2 border-primary text-headline-md font-bold text-on-surface outline-none bg-white" />
            <div className="flex gap-2">
              <button onClick={() => setReportDate(todayISO)} className={`px-4 py-2.5 rounded-xl font-label-lg ${dateISO === todayISO ? 'bg-primary text-on-primary' : 'border-2 border-primary text-primary'}`}>Hari ini ({isoToDDMM(todayISO)})</button>
              <button onClick={() => setReportDate(yISO)} className={`px-4 py-2.5 rounded-xl font-label-lg ${dateISO === yISO ? 'bg-primary text-on-primary' : 'border-2 border-primary text-primary'}`}>Kemarin ({isoToDDMM(yISO)})</button>
            </div>
          </div>
          <div className="text-center mt-3">
            {dateDup ? <p className="text-error font-bold flex items-center justify-center gap-1"><Icon name="block" className="text-base" /> Tanggal {tglDDMM} sudah ada laporannya — pilih tanggal lain.</p>
              : dateFuture ? <p className="text-error font-bold">Tidak boleh tanggal yang belum terjadi.</p>
              : dateTooOld ? <p className="text-error font-bold">Hanya boleh hari ini atau kemarin.</p>
              : <p className="text-green-700 font-bold flex items-center justify-center gap-1"><Icon name="check_circle" fill className="text-base" /> Laporan akan masuk ke tanggal {tglDDMM}.</p>}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900">
          <Icon name="info" className="!text-[18px] shrink-0 mt-0.5" />
          <p className="text-label-md leading-snug">Centang barang yang perlu <b>dibeli besok</b>, isi jumlah <b>Kotak</b> & catatan, lalu <b>Salin</b> teksnya dan tempel/kirim ke <b>grup WA</b> (boleh juga di-screenshot). Boleh dilewati kalau tidak ada.</p>
        </div>

        {/* Checklist item */}
        <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] overflow-hidden">
          <div className="px-4 py-2.5 bg-surface-container-low font-label-lg flex items-center justify-between"><span>Daftar Belanja</span><span className="text-label-md text-on-surface-variant">{pickedItems.length} dipilih</span></div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3">
            {items.map((it) => {
              const qty = picked[it.id]
              const on = qty != null
              return (
                <div key={it.id} className={`rounded-xl border transition-colors ${on ? 'border-primary bg-primary-fixed' : 'border-outline-variant'}`}>
                  <button onClick={() => toggle(it.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left active:scale-[.99]">
                    <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary text-white' : 'border-outline'}`}>{on && <Icon name="check" className="!text-[18px]" />}</span>
                    <span className={`font-label-md leading-tight ${on ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{it.name}</span>
                  </button>
                  {on && (
                    <div className="flex items-center justify-end gap-2 px-3 pb-2.5">
                      <span className="text-[11px] text-on-surface-variant">jumlah</span>
                      <button onClick={() => setQty(it.id, qty - 1)} className="w-7 h-7 rounded-lg bg-surface border border-outline flex items-center justify-center active:scale-90"><Icon name="remove" className="!text-[16px]" /></button>
                      <input inputMode="numeric" value={qty} onChange={(e) => setQty(it.id, Number(String(e.target.value).replace(/\D/g, '')) || 1)} className="w-9 h-7 text-center rounded-lg border border-outline outline-none font-bold text-[13px] bg-surface" />
                      <button onClick={() => setQty(it.id, qty + 1)} className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center active:scale-90"><Icon name="add" className="!text-[16px]" /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Kotak + catatan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-4">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase flex items-center gap-1"><Icon name="inventory_2" className="!text-[16px]" /> Jumlah Kotak Kemasan</label>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setKotak((k) => Math.max(0, k - 1))} className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center active:scale-90"><Icon name="remove" /></button>
              <input inputMode="numeric" value={kotak || ''} onChange={(e) => setKotak(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))} placeholder="0" className="flex-1 h-11 text-center rounded-xl border border-outline focus:border-primary outline-none font-headline-md bg-surface" />
              <button onClick={() => setKotak((k) => k + 1)} className="w-11 h-11 rounded-xl bg-primary-container text-white flex items-center justify-center active:scale-90"><Icon name="add" /></button>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-4">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase">Catatan (bebas)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="mis. minta dikirim pagi" className="w-full mt-2 px-3 py-2 rounded-xl border border-outline focus:border-primary outline-none bg-surface resize-none" />
          </div>
        </div>

        {/* Preview teks */}
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/30 p-4">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase mb-2">Pratinjau teks (untuk grup WA)</p>
          <pre className="text-[12px] whitespace-pre-wrap font-sans text-on-surface leading-snug">{buildText()}</pre>
          <button onClick={salin} className={`mt-3 w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] ${copied ? 'bg-green-600 text-white' : 'bg-secondary-container text-on-secondary-container'}`}>
            <Icon name={copied ? 'check' : 'content_copy'} /> {copied ? 'Tersalin — tinggal tempel ke grup WA' : 'Salin Teks Belanja'}
          </button>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-bright/95 backdrop-blur-md border-t border-outline-variant z-40">
        <button onClick={() => { if (!dateOk) return; saveClosingBelanja(picked); navigate('/ops/kasir/closing/rekon') }} disabled={!dateOk} className="max-w-2xl mx-auto w-full min-h-[52px] bg-primary text-on-primary rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg disabled:opacity-40">
          Lanjut: Rekonsiliasi Stok (tgl {tglDDMM}) <Icon name="chevron_right" />
        </button>
      </div>
    </div>
  )
}
