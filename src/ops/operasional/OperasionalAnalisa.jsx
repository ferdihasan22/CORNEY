import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES } from '../../data/menu.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { salesInPeriod } from '../../store/aggregate.js'
import { useAnalisa } from '../../store/useAnalisa.js'
import { MATERIALS, batasOf, terpakaiOf, unitDipakaiOf } from '../../store/analisa.js'

// Analisa Bahan vs Jual — versi OPERASIONAL (LIHAT SAJA, tidak bisa ubah takaran).
// UI sengaja simpel & bahasa mudah (operasional lulusan SMP). Tujuannya: tahu bahan
// mana yang janggal → menegur/menanyakan ke kasir. Takaran tetap diatur Owner.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name || id || ''

export default function OperasionalAnalisa() {
  const navigate = useNavigate()
  useSalesDaily(); useAnalisa()
  const [period, setPeriod] = useState('Bulan')
  const [branchId, setBranchId] = useState(BRANCHES[0]?.id)
  const rows = salesInPeriod(period, branchId)

  const items = MATERIALS.map((m) => {
    const terjual = terpakaiOf(m, rows)
    const unit = unitDipakaiOf(m, rows)
    const takaran = batasOf(m.id)
    const kapasitas = unit * takaran
    const ratio = kapasitas > 0 ? terjual / kapasitas : null
    const status = ratio == null ? 'nodata' : ratio >= 0.9 ? 'ok' : ratio >= 0.75 ? 'warn' : 'bad'
    const selisih = kapasitas - terjual
    return { m, terjual, unit, takaran, kapasitas, selisih, status }
  })
  const perluCek = items.filter((x) => x.status === 'bad')

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col pb-10">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-5 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/operasional')} className="w-10 h-10 rounded-full bg-on-primary-container/10 hover:bg-on-primary-container/20 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <div><h1 className="font-headline-lg text-headline-lg leading-none flex items-center gap-2"><Icon name="science" /> Cek Bahan vs Jualan</h1><p className="font-label-md opacity-90 mt-1 uppercase tracking-wider">Operasional · lihat saja</p></div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Pilih cabang + periode (simpel) */}
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {BRANCHES.map((b) => (
              <button key={b.id} onClick={() => setBranchId(b.id)} className={`px-4 py-2 rounded-full font-label-md ${branchId === b.id ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant'}`}>{b.name.replace('CORNEY ', '')}</button>
            ))}
          </div>
          <div className="bg-surface-container-highest rounded-full p-1 flex w-max">
            {['Bulan', 'Minggu'].map((p) => <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-full text-label-md ${period === p ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`}>{p} ini</button>)}
          </div>
        </div>

        {/* Ringkasan besar */}
        <div className={`rounded-2xl p-4 flex items-start gap-3 ${perluCek.length > 0 ? 'bg-error-container text-on-error-container' : 'bg-green-100 text-green-800'}`}>
          <Icon name={perluCek.length > 0 ? 'campaign' : 'verified'} fill className="!text-[28px] shrink-0" />
          <div>
            <p className="font-headline-md text-headline-md leading-tight">{perluCek.length > 0 ? `${perluCek.length} bahan perlu ditanya ke kasir` : 'Semua bahan wajar'}</p>
            <p className="text-label-md mt-0.5">{perluCek.length > 0 ? 'Lihat yang berwarna merah di bawah, lalu tanyakan baik-baik ke kasir cabang ini.' : `Cabang ${branchName(branchId).replace('CORNEY ', '')}, ${period.toLowerCase()} ini.`}</p>
          </div>
        </div>

        {/* Kartu per bahan — 2 kolom, ringkas */}
        <div className="grid grid-cols-2 gap-3">
          {items.map(({ m, terjual, unit, kapasitas, selisih, status }) => (
            <div key={m.id} className={`bg-surface-container-lowest rounded-2xl border-2 ${m.bd} shadow-[0_4px_16px_rgba(26,26,26,0.06)] overflow-hidden flex flex-col`}>
              <div className={`${m.hd} px-3 py-2 flex items-center justify-between gap-1`}>
                <h3 className="font-bold text-[14px] leading-tight flex items-center gap-1.5 min-w-0"><Icon name={m.icon} className={`!text-[18px] shrink-0 ${m.ic}`} /> <span>{m.name}</span></h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${status === 'bad' ? 'bg-error text-on-error' : status === 'warn' ? 'bg-secondary-container text-on-secondary-container' : status === 'ok' ? 'bg-green-600 text-white' : 'bg-surface-variant text-on-surface-variant'}`}>{status === 'bad' ? 'Cek' : status === 'warn' ? 'Pantau' : status === 'ok' ? 'Aman' : '—'}</span>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                {status === 'nodata' ? (
                  <p className="text-label-md text-on-surface-variant">Belum ada data.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 text-center">
                      <div className="bg-surface-container rounded-lg py-1.5"><p className="text-[9px] uppercase text-on-surface-variant leading-none">Dibeli</p><p className="font-headline-md text-headline-md leading-none mt-1">{unit}</p><p className="text-[9px] text-on-surface-variant mt-0.5">{m.unitLabel}·≈{kapasitas}p</p></div>
                      <div className="bg-green-50 rounded-lg py-1.5"><p className="text-[9px] uppercase text-green-700 leading-none">Terjual</p><p className="font-headline-md text-headline-md text-green-800 leading-none mt-1">{terjual}</p><p className="text-[9px] text-on-surface-variant mt-0.5">porsi</p></div>
                    </div>
                    {status === 'bad'
                      ? <p className="text-[11px] font-bold text-error bg-error-container rounded-lg px-2 py-1.5 mt-2 leading-snug"><Icon name="campaign" className="!text-[14px] align-middle" /> {selisih} porsi tak terjual → tanya kasir!</p>
                      : status === 'warn'
                      ? <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-2 leading-snug">{selisih} porsi belum terjual — pantau.</p>
                      : <p className="text-[11px] text-green-800 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 mt-2 leading-snug"><Icon name="check_circle" fill className="!text-[14px] align-middle" /> Aman.</p>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-on-surface-variant/70 leading-relaxed flex items-start gap-1.5"><Icon name="info" className="!text-[16px] shrink-0 mt-0.5" /> Ini cuma <b>petunjuk</b>, bukan tuduhan. Kalau ada yang merah, <b>tanya baik-baik</b> ke kasir — mungkin ada sebab wajar (banyak gratis, salah hitung). Takaran porsi diatur Owner; di sini kamu hanya melihat.</p>
      </main>
    </div>
  )
}
