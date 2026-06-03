import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtRp } from '../../data/menu.js'
import { useDeposits } from '../../store/useDeposits.js'
import { confirmDeposit, forwardDeposits } from '../../store/deposits.js'

// 2.4 — OPS-04 Ambil Setoran Tunai. Ported from Stitch
// "collect_cash_deposit_operasional_mobile", made mobile-first (sidebar stripped).
// 2-sided confirm: kasir DECLARES (status menunggu), operasional COUNTS the cash &
// confirms → cocok / selisih. Then forward up to Auditor/Owner.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const fmtTime = (iso) => {
  try { return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export default function OperasionalSetoran() {
  const navigate = useNavigate()
  const deposits = useDeposits() || []
  const [amounts, setAmounts] = useState({}) // per-deposit received input

  const pending = deposits.filter((d) => d.status === 'menunggu')
  const collected = deposits.filter((d) => d.status !== 'menunggu')
  const unforwarded = collected.filter((d) => !d.forwarded)
  const totalUnforwarded = unforwarded.reduce((s, d) => s + (d.opsAmount || 0), 0)

  const setAmt = (id, v) => setAmounts((m) => ({ ...m, [id]: v.replace(/\D/g, '') }))
  const confirm = (d) => {
    const raw = amounts[d.id]
    if (raw == null || raw === '') return
    confirmDeposit(d.id, Number(raw))
    setAmounts((m) => { const n = { ...m }; delete n[d.id]; return n })
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/operasional')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div>
            <h1 className="font-headline-lg text-headline-lg leading-none">Ambil Setoran Tunai</h1>
            <p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Operasional</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-6">
        {/* PENDING — to confirm */}
        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="schedule" className="text-primary" /> Menunggu Konfirmasi {pending.length > 0 && <span className="bg-primary text-on-primary text-[12px] font-bold min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full">{pending.length}</span>}</h2>

          {pending.length === 0 ? (
            <div className="bg-surface-container-low rounded-2xl p-6 text-center text-on-surface-variant border border-outline-variant/30">
              <Icon name="check_circle" className="!text-5xl opacity-30" />
              <p className="mt-2 font-label-lg">Tidak ada setoran menunggu.</p>
              <p className="text-label-md opacity-70">Setoran muncul setelah kasir menutup hari.</p>
            </div>
          ) : (
            pending.map((d) => {
              const raw = amounts[d.id] ?? ''
              const has = raw !== ''
              const diff = has ? Number(raw) - d.kasirAmount : null
              return (
                <div key={d.id} className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-outline-variant/30 overflow-hidden">
                  <div className="bg-surface-container-low px-5 py-3 flex justify-between items-center border-b border-outline-variant/30">
                    <span className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="storefront" className="!text-[20px] text-primary" /> {d.branchName}</span>
                    {d.tgl ? <span className="bg-primary text-on-primary text-label-md font-bold px-3 py-1 rounded-full flex items-center gap-1"><Icon name="event" className="!text-[16px]" /> {d.tgl}</span> : <span className="text-label-md text-on-surface-variant">{fmtTime(d.createdAt)}</span>}
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Rincian Cash Bersih Sistem (dari Master Laporan) */}
                    {d.rincian && (
                      <div className="bg-surface-container rounded-xl px-4 py-3 text-label-md">
                        <p className="font-label-md text-on-surface-variant uppercase tracking-tight mb-2">Rincian setoran (dari laporan kasir)</p>
                        <div className="space-y-1 text-on-surface-variant">
                          <div className="flex justify-between"><span>Hasil jualan tunai</span><span className="font-bold text-on-surface">{fmtRp(d.rincian.tunai)}</span></div>
                          <div className="flex justify-between"><span>− Uang Urgent</span><span>{fmtRp(d.rincian.urgent)}</span></div>
                          {d.rincian.urgentItems?.length > 0 && (
                            <ul className="ml-3 mb-1 space-y-0.5">
                              {d.rincian.urgentItems.map((u, i) => (
                                <li key={i} className="flex justify-between text-[11px] text-on-surface-variant/80"><span className="truncate pr-2">• {u.reason || 'tanpa keterangan'}</span><span className="shrink-0">{fmtRp(u.amount)}</span></li>
                              ))}
                            </ul>
                          )}
                          <div className="flex justify-between"><span>− Uang harian karyawan</span><span>{fmtRp(d.rincian.gaji)}</span></div>
                          <div className="flex justify-between"><span>− Uang balik ke pembeli</span><span>{fmtRp(d.rincian.refund)}</span></div>
                          <div className="flex justify-between border-t border-outline-variant pt-1 mt-1 font-bold text-on-surface"><span>= Harus disetor</span><span className="text-primary">{fmtRp(d.kasirAmount)}</span></div>
                        </div>
                      </div>
                    )}
                    {/* Kasir declared */}
                    <div>
                      <span className="font-label-md text-on-surface-variant uppercase tracking-tight">Kasir menyatakan (uang yang disetor)</span>
                      <div className="bg-surface-container rounded-xl px-5 py-4 mt-1">
                        <p className="font-display-md text-display-md text-on-surface leading-none">{fmtRp(d.kasirAmount)}</p>
                        <p className="text-label-md text-on-surface-variant mt-2 flex items-center gap-1.5"><Icon name="check_circle" fill className="text-green-600 !text-[16px]" /> Cash Bersih Sistem · terverifikasi POS</p>
                      </div>
                    </div>
                    {/* Operasional input */}
                    <div>
                      <span className="font-label-md text-on-surface-variant uppercase tracking-tight">Operasional menerima (hitung fisik)</span>
                      <div className="relative mt-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-headline-md text-on-surface-variant">Rp</span>
                        <input inputMode="numeric" value={raw ? Number(raw).toLocaleString('id-ID') : ''} onChange={(e) => setAmt(d.id, e.target.value)} placeholder="0" className="w-full h-[64px] pl-12 pr-4 rounded-xl border-2 border-primary focus:ring-4 focus:ring-primary/10 outline-none font-display-md text-display-md bg-surface" />
                      </div>
                    </div>
                    {/* Live status */}
                    <div className={`p-3 rounded-xl flex items-center justify-center gap-2 font-label-lg ${!has ? 'bg-surface-container text-on-surface-variant' : diff === 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-error-container text-on-error-container border border-error/20'}`}>
                      {!has ? (
                        <span>Masukkan jumlah uang yang diterima</span>
                      ) : diff === 0 ? (
                        <><Icon name="check_circle" fill className="!text-[20px]" /> <span className="font-bold">Jumlah Cocok</span></>
                      ) : (
                        <><Icon name="report" fill className="!text-[20px]" /> <span className="font-bold uppercase">Selisih {diff > 0 ? '+' : ''}{fmtRp(diff)}</span></>
                      )}
                    </div>
                    <button onClick={() => confirm(d)} disabled={!has} className="w-full min-h-[52px] bg-primary text-on-primary rounded-xl font-headline-md flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-40">
                      <Icon name="handshake" /> Konfirmasi Terima Setoran
                    </button>
                  </div>
                </div>
              )
            })
          )}

          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 flex gap-3 items-start">
            <Icon name="info" className="text-primary shrink-0" />
            <p className="text-label-md text-on-surface-variant leading-relaxed">Serah-terima tidak bisa sepihak. Tiap titik perpindahan uang punya konfirmasi 2 sisi agar selisih bisa ditelusuri.</p>
          </div>
        </section>

        {/* COLLECTED — history + forward */}
        {collected.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="inventory_2" className="text-primary" /> Setoran Terkumpul</h2>
            {/* Riwayat 2 kolom */}
            <div className="grid grid-cols-2 gap-2">
              {collected.map((d) => (
                <div key={d.id} className={`bg-surface-container-lowest rounded-xl border p-3 shadow-sm ${d.status === 'cocok' ? 'border-green-200' : 'border-error/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${d.status === 'cocok' ? 'bg-green-100 text-green-700' : 'bg-error-container text-on-error-container'}`}><Icon name={d.status === 'cocok' ? 'check' : 'warning'} fill={d.status !== 'cocok'} className="!text-[18px]" /></div>
                    <div className="min-w-0">
                      <p className="font-label-md font-bold truncate leading-tight">{d.branchName.replace('CORNEY ', '')}</p>
                      <p className="text-[10px] text-on-surface-variant">{d.tgl || fmtTime(d.confirmedAt)}</p>
                    </div>
                  </div>
                  <p className="font-headline-md text-headline-md text-on-surface text-right leading-none">{fmtRp(d.opsAmount)}</p>
                  <p className="text-[10px] text-right mt-1">{d.status === 'cocok' ? <span className="text-green-600 font-bold">Cocok</span> : <span className="text-error font-bold">Selisih {d.selisih > 0 ? '+' : ''}{fmtRp(d.selisih)}</span>}{d.forwarded && ' · diteruskan'}</p>
                </div>
              ))}
            </div>
            {/* Teruskan — full width */}
            <div className="bg-surface-container p-4 rounded-2xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-label-lg text-on-surface-variant">Belum diteruskan:</span>
                <span className="font-display-md text-on-surface">{fmtRp(totalUnforwarded)}</span>
              </div>
              <button onClick={forwardDeposits} disabled={unforwarded.length === 0} className="w-full bg-on-surface text-surface py-4 rounded-xl font-label-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40">
                <Icon name="forward" /> Teruskan {fmtRp(totalUnforwarded)} ke Auditor/Owner
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
