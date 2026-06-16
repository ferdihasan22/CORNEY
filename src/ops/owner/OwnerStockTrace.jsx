import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES } from '../../data/menu.js'
import { useProduction } from '../../store/useProduction.js'
import { useShipments } from '../../store/useShipments.js'
import { useOpname } from '../../store/useOpname.js'
import { useStockDaily } from '../../store/useStockDaily.js'
import { useAudits } from '../../store/useAudits.js'
import { useSupplierFulfilled } from '../../store/useSupplierFulfilled.js'
import { useAppConfig } from '../../store/useAppConfig.js'
import { stocktraceBaselineMs, setAppConfigField } from '../../store/appconfig.js'
import { traceStock, biggestLeak, STAGES, purchaseCheck, KEJU_YIELD_LO, KEJU_YIELD_HI } from '../../store/stocktrace.js'

// OWN — Pelacakan Stok versi AWAM. Tidak ada istilah teknis: cuma "berapa hilang,
// di mana, siapa yang ditanya". Tabel angka disembunyikan (opsional).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const PERIODS = [['today', 'Hari ini'], ['7d', '7 hari'], ['30d', '30 hari'], ['all', 'Semua']]
const short = (n) => (n || '').replace('CORNEY ', '')

// Penjelasan tiap tahap dalam bahasa sehari-hari.
const PLAIN = {
  hilangProduksi: { tempat: 'Gudang / Freezer', kapan: 'sebelum dikirim ke cabang', sebab: 'Jumlah hasil bikinan tidak cocok saat dihitung ulang.', siapa: 'Orang Produksi', tindak: 'Tanya bagian Produksi — apakah ada yang rusak/terbuang & tidak dicatat.' },
  hilangTransit: { tempat: 'Saat Pengiriman', kapan: 'dari gudang ke cabang', sebab: 'Kasir menerima lebih sedikit dari yang dikirim.', siapa: 'Operasional', tindak: 'Cek pengiriman & tanya Operasional — apakah ada yang tercecer.' },
  hilangKasir: { tempat: 'Di Cabang', kapan: 'saat jualan', sebab: 'Sisa barang di cabang kurang dari yang seharusnya.', siapa: 'Kasir cabang', tindak: 'Tanya Kasir — kemungkinan salah hitung, lupa catat, atau terjual tanpa dicatat.' },
}

export default function OwnerStockTrace() {
  const navigate = useNavigate()
  const production = useProduction() || []
  const shipments = useShipments() || []
  const opname = useOpname() || []
  const stockDaily = useStockDaily() || []
  const audits = useAudits() || []
  const fulfilled = useSupplierFulfilled() || []
  useAppConfig() // subscribe → re-render saat baseline (Bersihkan) berubah
  const baseline = stocktraceBaselineMs()
  const [period, setPeriod] = useState('all')
  const [branchSel, setBranchSel] = useState('all')
  const [showTable, setShowTable] = useState(false)

  const branches = branchSel === 'all' ? BRANCHES : BRANCHES.filter((b) => b.id === branchSel)
  const { branches: rows, grand } = useMemo(
    () => traceStock({ production, shipments, opname, stockDaily, audits, branches, period, baseline }),
    [production, shipments, opname, stockDaily, audits, branches, period, baseline]
  )
  const totalHilang = grand.hilangProduksi + grand.hilangTransit + grand.hilangKasir
  const culprit = biggestLeak(grand)

  // Cek kewajaran belanja bahan baku vs terjual (informatif, bukan auto-potong).
  const terjual = rows.reduce((t, br) => { br.parents.forEach((p) => { if (p.adaClosing) t[p.parent] = (t[p.parent] || 0) + p.terjual }); return t }, {})
  const cek = useMemo(
    () => purchaseCheck({ fulfilled, period, branchId: branchSel === 'all' ? null : branchSel, terjual, baseline }),
    [fulfilled, period, branchSel, baseline, terjual.mozza, terjual.sosis, terjual.jumbo, terjual.mix]
  )

  // Daftar masalah dalam kalimat sederhana (terbesar dulu).
  const masalah = []
  rows.forEach((br) => br.parents.forEach((p) => {
    STAGES.forEach((s) => { const qty = p[s.key]; if (qty > 0) masalah.push({ branch: short(br.branchName), isian: p.name, qty, stageKey: s.key, stage: s }) })
  }))
  masalah.sort((a, b) => b.qty - a.qty)

  // Alarm "rusak saat pisah" berlebihan per cabang (informatif, BUKAN hilang):
  // menyala bila susutPisah > 10% produksi DAN ≥ 10 pcs → cek proses/penyalahgunaan.
  const RUSAK_ALARM_RATIO = 0.10
  const RUSAK_ALARM_MIN = 10
  const rusakAlarm = rows
    .map((br) => ({ branch: short(br.branchName), pisah: br.totals.susutPisah, prod: br.totals.produksi, pct: br.totals.produksi > 0 ? Math.round((br.totals.susutPisah / br.totals.produksi) * 100) : 0 }))
    .filter((x) => x.pisah >= RUSAK_ALARM_MIN && x.prod > 0 && x.pisah / x.prod > RUSAK_ALARM_RATIO)
    .sort((a, b) => b.pisah - a.pisah)

  // "Bersihkan" = set titik mulai = hari ini (awal hari). Tak menghapus data sumber.
  const clearedDate = baseline ? new Date(baseline).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
  const doClear = () => { if (window.confirm('Bersihkan Pelacakan Stok agar mulai fresh?\n\nSemua selisih/“barang hilang” SEBELUM hari ini akan disembunyikan. Data laporan keuangan & stok TIDAK terhapus — hanya tampilan pelacakan yang di-reset. Bisa dikembalikan kapan saja lewat "Tampilkan semua".')) setAppConfigField('stocktrace_cleared_at', new Date().toISOString()) }
  const undoClear = () => setAppConfigField('stocktrace_cleared_at', '')

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-teal-700 text-white px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="travel_explore" fill /> Pelacakan Stok</h1>
        <button onClick={doClear} title="Bersihkan pelacakan (mulai fresh)" className="ml-auto flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-full px-3 h-9 font-label-md text-label-md active:scale-95">
          <Icon name="mop" className="!text-[18px]" /> Bersihkan
        </button>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-5">
        {/* Filter */}
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)} className={`px-3.5 py-1.5 rounded-full text-label-md font-bold transition-all ${period === k ? 'bg-teal-700 text-white shadow' : 'bg-surface-container text-on-surface-variant'}`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setBranchSel('all')} className={`px-3.5 py-1.5 rounded-full text-label-md font-bold transition-all ${branchSel === 'all' ? 'bg-primary text-on-primary shadow' : 'bg-surface-container text-on-surface-variant'}`}>Semua Cabang</button>
            {BRANCHES.map((b) => (
              <button key={b.id} onClick={() => setBranchSel(b.id)} className={`px-3.5 py-1.5 rounded-full text-label-md font-bold transition-all ${branchSel === b.id ? 'bg-primary text-on-primary shadow' : 'bg-surface-container text-on-surface-variant'}`}>{short(b.name)}</button>
            ))}
          </div>
        </div>

        {/* Status "dibersihkan" — baseline aktif */}
        {baseline > 0 && (
          <div className="rounded-2xl bg-teal-50 border border-teal-200 p-3 flex items-center gap-2.5">
            <Icon name="mop" className="text-teal-700 !text-[20px] shrink-0" />
            <p className="flex-1 text-[13px] text-teal-900 leading-snug">Pelacakan dibersihkan — hanya menampilkan data <b>sejak {clearedDate}</b>. Data sebelumnya disembunyikan (tidak dihapus).</p>
            <button onClick={undoClear} className="shrink-0 text-teal-800 font-bold text-label-md underline underline-offset-2 active:scale-95">Tampilkan semua</button>
          </div>
        )}

        {/* Jawaban besar */}
        {totalHilang === 0 ? (
          <section className="rounded-3xl p-6 bg-green-50 border-2 border-green-300 text-center">
            <Icon name="verified" fill className="text-green-600 text-[56px]" />
            <p className="font-headline-lg text-headline-lg text-green-800 mt-1">Stok Aman 👍</p>
            <p className="text-on-surface-variant mt-1">Tidak ada barang yang hilang di periode ini. Semua cocok dari produksi sampai terjual.</p>
          </section>
        ) : (
          <section className="rounded-3xl p-6 bg-rose-50 border-2 border-rose-300 text-center">
            <Icon name="report" fill className="text-rose-600 text-[56px]" />
            <p className="font-headline-lg text-headline-lg text-rose-800 mt-1">{totalHilang} pcs hilang</p>
            <p className="text-on-surface-variant mt-1">Paling banyak hilang di tahap <b className={culprit.cls}>{PLAIN[culprit.key].tempat}</b>.<br />Yang perlu ditanya: <b>{culprit.who}</b>.</p>
          </section>
        )}

        {/* Perjalanan stok — 3 langkah, langkah bocor menyala merah */}
        <section>
          <p className="text-label-md text-on-surface-variant mb-2 text-center">Perjalanan stok corndog kamu:</p>
          <div className="flex items-stretch justify-between gap-1">
            {STAGES.map((s, idx) => {
              const v = grand[s.key]
              const bad = v > 0
              return (
                <Fragment key={s.key}>
                  <div className={`flex-1 rounded-2xl p-3 text-center border-2 ${bad ? s.bg : 'bg-green-50 border-green-200'}`}>
                    <Icon name={s.icon} fill className={`text-3xl ${bad ? s.cls : 'text-green-600'}`} />
                    <p className="text-[12px] font-bold leading-tight mt-1">{PLAIN[s.key].tempat}</p>
                    {bad ? <p className="text-[12px] font-bold text-error mt-0.5">{v} hilang</p> : <p className="text-[11px] text-green-600 mt-0.5">aman ✓</p>}
                  </div>
                  {idx < STAGES.length - 1 && <div className="flex items-center text-on-surface-variant/40"><Icon name="chevron_right" /></div>}
                </Fragment>
              )
            })}
          </div>
        </section>

        {/* Daftar masalah dalam kalimat */}
        {masalah.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="format_list_bulleted" className="text-primary" /> Rincian barang hilang</h2>
            {masalah.map((m, i) => {
              const pl = PLAIN[m.stageKey]
              return (
                <div key={i} className={`rounded-2xl border-2 p-4 ${m.stage.bg}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-white/70`}><Icon name={m.stage.icon} fill className={`text-2xl ${m.stage.cls}`} /></div>
                    <div className="flex-1">
                      <p className="font-bold text-on-surface leading-snug"><span className="text-error">{m.qty} pcs {m.isian}</span> hilang di <b>{m.branch}</b></p>
                      <p className="text-[13px] text-on-surface-variant mt-0.5">📍 {pl.tempat} — {pl.kapan}.</p>
                      <p className="text-[13px] text-on-surface-variant mt-0.5">❓ {pl.sebab}</p>
                      <p className={`text-[13px] mt-1.5 font-bold ${m.stage.cls} flex items-start gap-1`}><Icon name="campaign" className="!text-[16px] mt-0.5" /> {pl.tindak}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {rusakAlarm.length > 0 && (
          <section className="space-y-2">
            {rusakAlarm.map((a, i) => (
              <div key={i} className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center shrink-0"><Icon name="warning" fill className="text-2xl text-amber-600" /></div>
                <div className="flex-1">
                  <p className="font-bold text-amber-900 leading-snug">Rusak saat pisah tinggi di <b>{a.branch}</b>: <span className="text-error">{a.pisah} pcs</span> (≈{a.pct}% dari produksi)</p>
                  <p className="text-[13px] text-amber-900/80 mt-0.5">Wajar bila sesekali, tapi angka segini perlu dicek — proses pemisahan kurang hati-hati atau perlu ditanyakan ke produksi.</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {grand.susut > 0 && (
          <p className="text-[12px] text-on-surface-variant flex items-start gap-1.5 bg-surface-container-low rounded-xl p-3"><Icon name="info" className="!text-[16px] mt-0.5 shrink-0" /> Catatan: ada <b>{grand.susut} pcs</b> susut produksi yang <b>sudah dilaporkan</b>{grand.susutPisah > 0 ? <> — termasuk <b>{grand.susutPisah} pcs rusak saat memisahkan stok freezer</b></> : <> (rusak/gagal saat bikin)</>} — ini <b>wajar</b>, bukan termasuk barang hilang.</p>
        )}

        {/* Cek kewajaran belanja bahan baku */}
        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="shopping_cart_checkout" className="text-primary" /> Belanja vs Terjual — Wajar?</h2>
          <p className="text-[12px] text-on-surface-variant -mt-1">Apakah bahan baku yang dibeli masuk akal dibanding yang laku terjual.</p>

          {/* KEJU (balok → mozza, rentang 75–85) */}
          <div className={`rounded-2xl border-2 p-4 ${cek.keju.status.ok === false ? 'border-error/40 bg-error-container/20' : cek.keju.status.ok === null ? 'border-outline-variant/40 bg-surface-container-low' : 'border-green-200 bg-green-50/50'}`}>
            <div className="flex items-center justify-between">
              <p className="font-bold flex items-center gap-2"><Icon name="crop_square" className="text-amber-600" /> Keju Mozza (balok)</p>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cek.keju.status.cls}`}>{cek.keju.status.lbl}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-[13px]">
              <div className="bg-white/60 rounded-xl px-3 py-2"><p className="text-on-surface-variant text-[11px]">Dibeli</p><p className="font-bold text-headline-md tabular-nums">{cek.keju.dibeli} <span className="text-[11px] font-normal">balok</span></p></div>
              <div className="bg-white/60 rounded-xl px-3 py-2"><p className="text-on-surface-variant text-[11px]">Terpakai (terjual+mix)</p><p className="font-bold text-headline-md tabular-nums">{cek.keju.terpakai} <span className="text-[11px] font-normal">mozza</span></p></div>
            </div>
            <p className="text-[12px] text-on-surface-variant mt-2">{cek.keju.dibeli} balok ≈ bisa bikin <b>{cek.keju.kapasitasLo}–{cek.keju.kapasitasHi} mozza</b> (1 balok = {KEJU_YIELD_LO}–{KEJU_YIELD_HI} pcs).
              {cek.keju.status.ok === false && <span className="text-error font-bold"> Terjual lebih banyak dari yang bisa dibuat — cek apakah ada balok tak tercatat atau hitungan janggal.</span>}</p>
          </div>

          {/* SOSIS REGULER & JUMBO (1:1) */}
          {[{ k: 'sosisReg', nama: 'Sosis Reguler', isian: 'sosis', icon: 'lunch_dining' }, { k: 'sosisJumbo', nama: 'Sosis Jumbo', isian: 'jumbo', icon: 'lunch_dining' }].map(({ k, nama, isian, icon }) => {
            const d = cek[k]
            return (
              <div key={k} className={`rounded-2xl border-2 p-4 ${d.status.ok === false ? 'border-error/40 bg-error-container/20' : d.status.ok === null ? 'border-outline-variant/40 bg-surface-container-low' : 'border-green-200 bg-green-50/50'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold flex items-center gap-2"><Icon name={icon} className="text-orange-600" /> {nama}</p>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${d.status.cls}`}>{d.status.lbl}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-[13px]">
                  <div className="bg-white/60 rounded-xl px-3 py-2"><p className="text-on-surface-variant text-[11px]">Dibeli</p><p className="font-bold text-headline-md tabular-nums">{d.dibeli} <span className="text-[11px] font-normal">pcs</span></p></div>
                  <div className="bg-white/60 rounded-xl px-3 py-2"><p className="text-on-surface-variant text-[11px]">Terpakai (terjual{k === 'sosisReg' ? '+mix' : ''})</p><p className="font-bold text-headline-md tabular-nums">{d.terpakai} <span className="text-[11px] font-normal">{isian}</span></p></div>
                </div>
                {d.status.ok === false && <p className="text-[12px] text-error font-bold mt-2">Terjual lebih banyak dari yang dibeli — cek apakah ada pembelian tak tercatat atau hitungan janggal.</p>}
              </div>
            )
          })}

          {cek.mixTerjual > 0 && (
            <p className="text-[12px] text-on-surface-variant flex items-start gap-1.5 bg-surface-container-low rounded-xl p-3"><Icon name="info" className="!text-[16px] mt-0.5 shrink-0" /> <span><b>{cek.mixTerjual} Mix</b> terjual. Tiap Mix memakai <b>½ mozza + ½ sosis reguler</b>, jadi sudah ikut dihitung di "Terpakai" di atas (Mix bukan barang hilang).</span></p>
          )}
          <p className="text-[11px] text-on-surface-variant/80 flex items-start gap-1.5 px-1"><Icon name="lightbulb" className="!text-[15px] mt-0.5 shrink-0" /> "Terpakai" boleh sedikit lebih besar dari "Dibeli" kalau pakai stok freezer lama — itu wajar. Yang perlu dicurigai cuma kalau selisihnya jauh ("Janggal").</p>
        </section>

        {/* Tabel angka — opsional, default tertutup */}
        <div>
          <button onClick={() => setShowTable((v) => !v)} className="w-full flex items-center justify-center gap-2 text-on-surface-variant text-label-md py-2 hover:text-primary">
            <Icon name={showTable ? 'expand_less' : 'expand_more'} /> {showTable ? 'Sembunyikan' : 'Lihat'} tabel angka lengkap
          </button>
          {showTable && rows.map((br) => (
            <section key={br.branchId} className="space-y-2 mb-4">
              <h3 className="font-label-lg font-bold flex items-center gap-2"><Icon name="storefront" className="!text-[18px] text-primary" /> {short(br.branchName)}</h3>
              <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
                <table className="text-[12px] border-collapse min-w-max">
                  <thead>
                    <tr className="bg-surface-container text-on-surface-variant text-[10px] uppercase">
                      <th className="px-3 py-2 text-left sticky left-0 bg-surface-container z-10 border-r border-outline-variant/30">Isian</th>
                      <th className="px-2 py-2 text-center">Dibuat</th>
                      <th className="px-2 py-2 text-center">Dikirim</th>
                      <th className="px-2 py-2 text-center">Diterima</th>
                      <th className="px-2 py-2 text-center">Terjual</th>
                      <th className="px-2 py-2 text-center">Sisa seharusnya</th>
                      <th className="px-2 py-2 text-center">Sisa nyata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {br.parents.map((p, i) => (
                      <tr key={p.parent} className={i % 2 ? 'bg-surface-container-low' : ''}>
                        <td className={`px-3 py-1.5 font-bold whitespace-nowrap sticky left-0 z-10 border-r border-outline-variant/30 ${i % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'}`}>{p.name}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{p.produksi || '–'}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{p.kirim || '–'}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{p.adaKonfirmasi ? p.diterima : '–'}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{p.adaClosing ? p.terjual : '–'}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-on-surface-variant">{p.adaClosing ? p.seharusnya : '–'}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums font-bold">{p.adaClosing ? p.aktual : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
