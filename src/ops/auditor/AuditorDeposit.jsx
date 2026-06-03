import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtRp } from '../../data/menu.js'
import { useDeposits } from '../../store/useDeposits.js'
import { auditorVerify } from '../../store/deposits.js'

// 3.2 — AUD-01 Terima & Verifikasi Setoran. Ported from Stitch
// "receive_verify_deposit_auditor_mobile". Auditor recounts physical, matches vs
// what Operasional received → cocok/selisih → lapor ke Owner.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const CHAIN = [['Kasir', 'point_of_sale'], ['Operasional', 'local_shipping'], ['Auditor', 'verified'], ['Owner', 'star']]

export default function AuditorDeposit() {
  const navigate = useNavigate()
  const deposits = useDeposits() || []
  const [amounts, setAmounts] = useState({})
  const [notes, setNotes] = useState({})

  const pending = deposits.filter((d) => d.status !== 'menunggu' && d.forwarded && !d.auditedAt)
  const done = deposits.filter((d) => d.auditedAt)
  const setAmt = (id, v) => setAmounts((m) => ({ ...m, [id]: v.replace(/\D/g, '') }))
  const verify = (d) => { const raw = amounts[d.id]; if (raw == null || raw === '') return; auditorVerify(d.id, Number(raw), notes[d.id] || ''); setAmounts((m) => { const n = { ...m }; delete n[d.id]; return n }) }
  // Jalur cepat: uang pas → verifikasi langsung pakai jumlah yang diterima Operasional.
  const verifyPas = (d) => { auditorVerify(d.id, d.opsAmount ?? d.kasirAmount, notes[d.id] || ''); setAmounts((m) => { const n = { ...m }; delete n[d.id]; return n }) }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/auditor')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="verified" /> Verifikasi Setoran</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Auditor</p></div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-5">
        {/* Money chain indicator */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 flex items-center justify-between">
          {CHAIN.map(([lbl, ic], i) => (
            <div key={lbl} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${i === 2 ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}><Icon name={ic} className="!text-[18px]" /></div>
                <span className={`text-[10px] ${i === 2 ? 'font-bold text-primary' : 'text-on-surface-variant'}`}>{lbl}</span>
              </div>
              {i < 3 && <div className={`w-5 h-0.5 mx-0.5 ${i < 2 ? 'bg-primary' : 'bg-outline-variant'}`} />}
            </div>
          ))}
        </div>

        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md">Menunggu Verifikasi {pending.length > 0 && <span className="bg-primary text-on-primary text-[12px] font-bold min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full align-middle">{pending.length}</span>}</h2>
          {pending.length === 0 ? (
            <div className="bg-surface-container-low rounded-2xl p-6 text-center text-on-surface-variant border border-outline-variant/30"><Icon name="verified" className="!text-5xl opacity-30" /><p className="mt-2 font-label-lg">Tidak ada setoran menunggu.</p><p className="text-label-md opacity-70">Muncul setelah Operasional meneruskan setoran.</p></div>
          ) : pending.map((d) => {
            const raw = amounts[d.id] ?? ''
            const has = raw !== ''
            const diff = has ? Number(raw) - (d.opsAmount ?? d.kasirAmount) : null
            return (
              <div key={d.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0_4px_16px_rgba(26,26,26,0.08)] overflow-hidden">
                <div className="bg-surface-container-low px-5 py-3 flex justify-between items-center border-b border-outline-variant/30"><span className="font-label-lg text-on-surface-variant flex items-center gap-2"><Icon name="storefront" className="!text-[18px] text-primary" /> {d.branchName}</span><span className="text-label-md text-on-surface-variant">{fmtTime(d.confirmedAt)}</span></div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-container rounded-xl p-3"><p className="text-[10px] uppercase text-on-surface-variant">Laporan cabang (kasir)</p><p className="font-headline-md text-on-surface mt-1">{fmtRp(d.kasirAmount)}</p></div>
                    <div className="bg-surface-container rounded-xl p-3"><p className="text-[10px] uppercase text-on-surface-variant">Diterima Operasional</p><p className="font-headline-md text-on-surface mt-1">{fmtRp(d.opsAmount ?? d.kasirAmount)}</p></div>
                  </div>
                  {/* Jalur cepat — uang pas (tidak perlu ketik) */}
                  <button onClick={() => verifyPas(d)} className="w-full min-h-[56px] bg-green-600 text-white rounded-xl font-headline-md flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md">
                    <Icon name="check_circle" fill /> Uang Pas — Cocok {fmtRp(d.opsAmount ?? d.kasirAmount)}
                  </button>
                  <div className="flex items-center gap-3 text-on-surface-variant/60"><div className="flex-1 h-px bg-outline-variant" /><span className="text-label-md">atau kalau jumlahnya beda</span><div className="flex-1 h-px bg-outline-variant" /></div>
                  <div>
                    <span className="font-label-md text-on-surface-variant uppercase tracking-tight">Hitung ulang fisik (Auditor)</span>
                    <div className="relative mt-1"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-headline-md text-on-surface-variant">Rp</span><input inputMode="numeric" value={raw ? Number(raw).toLocaleString('id-ID') : ''} onChange={(e) => setAmt(d.id, e.target.value)} placeholder="0" className="w-full h-[60px] pl-12 pr-4 rounded-xl border-2 border-primary focus:ring-4 focus:ring-primary/10 outline-none font-display-md text-display-md bg-surface" /></div>
                  </div>
                  <div className={`p-3 rounded-xl flex items-center justify-center gap-2 font-label-lg ${!has ? 'bg-surface-container text-on-surface-variant' : diff === 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-error-container text-on-error-container border border-error/20'}`}>
                    {!has ? <span>Masukkan hasil hitung fisik</span> : diff === 0 ? <><Icon name="check_circle" fill className="!text-[20px]" /> <span className="font-bold">Cocok</span></> : <><Icon name="report" fill className="!text-[20px]" /> <span className="font-bold uppercase">Selisih {diff > 0 ? '+' : ''}{fmtRp(diff)}</span></>}
                  </div>
                  <input value={notes[d.id] || ''} onChange={(e) => setNotes((m) => ({ ...m, [d.id]: e.target.value }))} placeholder="Catatan auditor (opsional)" className="w-full h-11 px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface text-label-md" />
                  <button onClick={() => verify(d)} disabled={!has} className="w-full min-h-[52px] bg-primary text-on-primary rounded-xl font-headline-md flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-40"><Icon name="send" /> Lapor ke Owner</button>
                </div>
              </div>
            )
          })}
        </section>

        {done.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-headline-md text-headline-md">Sudah Diverifikasi</h2>
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 divide-y divide-outline-variant/30">
              {done.map((d) => (
                <div key={d.id} className="p-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0"><div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${d.auditorStatus === 'cocok' ? 'bg-green-100 text-green-700' : 'bg-error-container text-error'}`}><Icon name={d.auditorStatus === 'cocok' ? 'check' : 'warning'} fill={d.auditorStatus !== 'cocok'} /></div><div className="min-w-0"><p className="font-label-lg truncate">{d.branchName}</p><p className="text-label-md text-on-surface-variant">{d.auditorStatus === 'cocok' ? <span className="text-green-600 font-bold italic">Cocok</span> : <span className="text-error font-bold italic">Selisih {d.auditorSelisih > 0 ? '+' : ''}{fmtRp(d.auditorSelisih)}</span>} · {fmtTime(d.auditedAt)}</p></div></div>
                  <p className="font-headline-md shrink-0">{fmtRp(d.auditorAmount)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
