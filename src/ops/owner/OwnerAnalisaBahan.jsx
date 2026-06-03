import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES, SAUCES } from '../../data/menu.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { salesInPeriod } from '../../store/aggregate.js'
import { useAnalisa } from '../../store/useAnalisa.js'
import { MATERIALS, batasOf, setBatas, terpakaiOf, unitDipakaiOf } from '../../store/analisa.js'

// 3.4 — §7.1.1 Analisa Bahan vs Penjualan (LIVE dari Master Laporan).
// terpakai (porsi) = penjualan varian glaze/kentang / jumlah corndog ber-saus.
// unit dipakai = berapa kali item dicentang di checklist belanja kasir (closing).
// Owner set "batas aman" (porsi wajar per 1 unit). porsi/unit < batas → indikasi bocor.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name || id

export default function OwnerAnalisaBahan() {
  const navigate = useNavigate()
  useSalesDaily(); useAnalisa() // ikut Master Laporan + config batas aman
  const [period, setPeriod] = useState('Bulan')
  const [branchId, setBranchId] = useState('all')
  const [showDetail, setShowDetail] = useState(false) // tabel detail disembunyikan dulu
  const bid = branchId === 'all' ? undefined : branchId
  const rows = salesInPeriod(period, bid)

  const items = MATERIALS.map((m) => {
    const terjual = terpakaiOf(m, rows) // porsi varian/saus terjual (Master Laporan)
    const unit = unitDipakaiOf(m, rows) // unit dibeli/dipakai (checklist belanja)
    const takaran = batasOf(m.id) // 1 unit = berapa porsi (diset Owner)
    const kapasitas = unit * takaran // porsi yang SEHARUSNYA bisa dibuat dari yg dibeli
    const ratio = kapasitas > 0 ? terjual / kapasitas : null
    const status = ratio == null ? 'nodata' : ratio >= 0.9 ? 'ok' : ratio >= 0.75 ? 'warn' : 'bad'
    const selisih = kapasitas - terjual // porsi "tidak terjual" (kemungkinan bocor)
    return { m, terjual, unit, takaran, kapasitas, selisih, status }
  })
  const flagged = items.filter((x) => x.status === 'bad').length

  // Indikator "pesan terlalu cepat": saldo berjalan per bahan per cabang (urut tanggal).
  // Kalau pesan lagi padahal saldo perkiraan masih ≥ 1 unit (takaran) → tandai.
  const bq = (belanja, shop) => (!belanja ? 0 : Array.isArray(belanja) ? (belanja.includes(shop) ? 1 : 0) : (belanja[shop] || 0))
  const dnum = (t) => { const [d, m, y] = (t || '').split('/'); return Number(y) * 10000 + Number(m) * 100 + Number(d) }
  const tooSoon = {} // `${rowId}|${materialId}` -> perkiraan porsi yang masih ada saat pesan
  const byBranch = {}
  rows.forEach((r) => { (byBranch[r.branchId] = byBranch[r.branchId] || []).push(r) })
  Object.values(byBranch).forEach((brs) => {
    const sorted = [...brs].sort((a, b) => dnum(a.tgl) - dnum(b.tgl))
    MATERIALS.forEach((m) => {
      const tak = batasOf(m.id)
      let saldo = 0
      sorted.forEach((r) => {
        const restock = bq(r.belanja, m.shop)
        if (restock > 0 && tak > 0 && saldo >= tak) tooSoon[`${r.id}|${m.id}`] = Math.round(saldo)
        saldo += restock * tak
        saldo -= terpakaiOf(m, [r])
        if (saldo < 0) saldo = 0
      })
    })
  })
  const tooSoonCount = Object.keys(tooSoon).length

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center gap-3 shadow-md">
        <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md">Analisa Bahan vs Jual</h1>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-5 space-y-4">
        {/* Filter periode + cabang */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="bg-surface-container-highest rounded-full p-1 flex">
            {['Bulan', 'Minggu', 'Hari'].map((p) => <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-full text-label-md ${period === p ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>{p}</button>)}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[['all', 'Semua'], ...BRANCHES.map((b) => [b.id, b.name.replace('CORNEY ', '')])].map(([id, lbl]) => (
              <button key={id} onClick={() => setBranchId(id)} className={`px-3 py-1.5 rounded-full text-label-md ${branchId === id ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant'}`}>{lbl}</button>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-blue-900">
          <Icon name="lightbulb" className="!text-[18px] shrink-0 mt-0.5" />
          <p className="text-label-md leading-snug">Kasir request belanja <b>hanya saat stok menipis/habis</b> (untuk dipakai besoknya) — ini <b>sinyal beli-ulang</b>, bukan catatan harian. Jadi baca <b>per Bulan</b>: total beli-ulang sebulan ≈ total terpakai sebulan. Selisih <b>kecil = wajar</b>; <b>besar & berulang</b> = baru dicurigai.{period === 'Hari' && <span className="block mt-1 font-bold text-blue-700">⚠ Periode "Hari" kurang tepat untuk analisa bahan. Pilih "Bulan".</span>}</p>
        </div>

        <div className={`rounded-xl p-3 flex items-start gap-2 ${flagged > 0 ? 'bg-error-container text-on-error-container' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          <Icon name={flagged > 0 ? 'warning' : 'verified'} fill className="!text-[18px] shrink-0 mt-0.5" />
          <p className="text-label-md leading-snug">{flagged > 0 ? <><strong>{flagged} bahan</strong> kapasitasnya jauh di atas yang terjual — banyak porsi dibeli tapi tak terjual. <strong>Indikasi dibawa pulang/terbuang</strong>, perlu dicek.</> : 'Pemakaian bahan masih wajar terhadap penjualan tercatat.'}</p>
        </div>

        {/* Kartu analisa per bahan — visual & bahasa sederhana */}
        {items.map(({ m, terjual, unit, takaran, kapasitas, selisih, status }) => {
          const pctSold = kapasitas > 0 ? Math.min(100, Math.round((terjual / kapasitas) * 100)) : 0
          const tone = status === 'bad' ? { strip: 'bg-error-container', pill: 'bg-error text-on-error', bar: 'bg-error', vb: 'bg-error-container text-on-error-container' }
            : status === 'warn' ? { strip: 'bg-secondary-container/50', pill: 'bg-secondary-container text-on-secondary-container', bar: 'bg-amber-500', vb: 'bg-amber-50 text-amber-900 border border-amber-200' }
            : status === 'ok' ? { strip: 'bg-green-100', pill: 'bg-green-600 text-white', bar: 'bg-green-500', vb: 'bg-green-50 text-green-800 border border-green-200' }
            : { strip: 'bg-surface-container', pill: 'bg-surface-variant text-on-surface-variant', bar: 'bg-outline', vb: 'bg-surface-container text-on-surface-variant' }
          const label = status === 'bad' ? 'Perlu Dicek' : status === 'warn' ? 'Pantau' : status === 'ok' ? 'Aman' : 'Belum ada'
          return (
            <div key={m.id} className={`bg-surface-container-lowest rounded-2xl border-2 ${m.bd} shadow-[0_4px_16px_rgba(26,26,26,0.06)] overflow-hidden`}>
              {/* Pita judul (warna khas tiap bahan) + badge status */}
              <div className={`${m.hd} px-4 py-2.5 flex items-center justify-between`}>
                <h3 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name={m.icon} className={m.ic} /> {m.name}</h3>
                <span className={`${tone.pill} px-3 py-1 rounded-full text-[11px] font-bold uppercase`}>{label}</span>
              </div>

              <div className="p-4">
                {status === 'nodata' ? (
                  <p className="text-label-md text-on-surface-variant bg-surface-container rounded-lg px-3 py-3 text-center">Belum ada di checklist belanja periode ini — belum bisa dihitung.</p>
                ) : (
                  <>
                    {/* Dua angka besar: Dibeli vs Terjual */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-container rounded-xl p-3 text-center">
                        <p className="text-[11px] text-on-surface-variant uppercase flex items-center justify-center gap-1"><Icon name="shopping_cart" className="!text-[14px]" /> Dibeli</p>
                        <p className="font-headline-lg text-headline-lg leading-none mt-1">{unit} <span className="text-label-md font-normal">{m.unitLabel}</span></p>
                        <p className="text-[11px] text-on-surface-variant mt-1">cukup utk <b className="text-on-surface">{kapasitas} porsi</b></p>
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                        <p className="text-[11px] text-green-700 uppercase flex items-center justify-center gap-1"><Icon name="kebab_dining" className="!text-[14px]" /> Terjual</p>
                        <p className="font-headline-lg text-headline-lg text-green-800 leading-none mt-1">{terjual}</p>
                        <p className="text-[11px] text-on-surface-variant mt-1">porsi</p>
                      </div>
                    </div>

                    {/* Bar + persen */}
                    <div className="mt-3">
                      <div className="h-3 bg-surface-container rounded-full overflow-hidden"><div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pctSold}%` }} /></div>
                      <p className="text-[11px] text-on-surface-variant mt-1 text-center">{pctSold}% dari yang dibeli laku terjual</p>
                    </div>

                    {/* Kesimpulan 1 kalimat */}
                    <div className={`${tone.vb} rounded-xl px-3 py-2.5 mt-3 flex items-start gap-2`}>
                      <Icon name={status === 'bad' ? 'warning' : status === 'warn' ? 'visibility' : 'verified'} fill className="!text-[18px] shrink-0 mt-0.5" />
                      <p className="text-label-md leading-snug">
                        {status === 'ok' && <>Aman — hampir semua yang dibeli terjual.</>}
                        {status === 'warn' && <><b>{selisih} porsi</b> dibeli tapi belum terjual. Masih wajar, tapi pantau.</>}
                        {status === 'bad' && <><b>{selisih} porsi</b> dibeli tapi <b>tidak terjual</b>. Perlu dicek — kemungkinan dibawa pulang / terbuang.</>}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Atur takaran */}
              <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-low/40 flex items-center justify-between gap-2">
                <span className="text-label-md text-on-surface-variant flex items-center gap-1.5"><Icon name="tune" className="!text-[16px] text-primary" /> 1 {m.unitLabel} jadi berapa porsi?</span>
                <span className="flex items-center gap-1"><input inputMode="numeric" value={takaran} onChange={(e) => setBatas(m.id, e.target.value.replace(/\D/g, ''))} className="w-16 h-9 text-center rounded-lg border border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold bg-surface" /> <span className="text-label-md text-on-surface-variant">porsi</span></span>
              </div>
            </div>
          )
        })}

        {/* Tombol buka/tutup tabel detail (default tertutup biar tidak penuh) */}
        <button onClick={() => setShowDetail((v) => !v)} className="w-full py-3 rounded-xl border border-outline-variant text-on-surface-variant font-label-lg flex items-center justify-center gap-2 active:scale-[.99] bg-surface-container-lowest">
          <Icon name={showDetail ? 'expand_less' : 'expand_more'} /> {showDetail ? 'Sembunyikan detail' : 'Lihat detail (kalender belanja & saus harian)'}
        </button>

        {showDetail && (<>
        {/* Kalender Request Belanja — tanggal berapa saja diminta + jumlahnya */}
        <section>
          <h2 className="font-headline-md text-headline-md flex items-center gap-2 mb-2"><Icon name="calendar_month" className="text-primary" /> Kalender Request Belanja</h2>
          <p className="text-label-md text-on-surface-variant mb-2">Tanggal kasir mencentang belanja + jumlahnya. Total di bawah = "unit dipakai" di kartu atas. {tooSoonCount > 0 ? <span className="text-error font-bold">🔴 {tooSoonCount} sel merah = pesan lagi padahal stok lama seharusnya masih ada (cek!).</span> : <span className="text-green-700">Tidak ada pesanan yang terlalu cepat.</span>}</p>
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            <table className="text-[11px] border-collapse min-w-max">
              <thead><tr className="bg-primary text-on-primary">
                <th className="px-3 py-2 text-left border-r border-white/20 sticky left-0 bg-primary">Tanggal</th>
                <th className="px-3 py-2 text-left border-r border-white/20">Cabang</th>
                {MATERIALS.map((m) => <th key={m.id} className="px-2 py-2 text-center border-l border-white/20 whitespace-nowrap">{m.name.replace('Glaze ', 'Glz ').replace('Saus ', 'Ss ').replace(' Coating', '')}</th>)}
              </tr></thead>
              <tbody>
                {(() => {
                  const tot = {}; MATERIALS.forEach((m) => (tot[m.id] = 0))
                  const body = rows.map((r, ri) => {
                    MATERIALS.forEach((m) => (tot[m.id] += bq(r.belanja, m.shop)))
                    return (
                      <tr key={r.id} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                        <td className={`px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40 sticky left-0 ${ri % 2 ? 'bg-surface-container-low' : 'bg-surface-container-lowest'}`}>{r.tgl}</td>
                        <td className="px-3 py-2 text-primary font-bold whitespace-nowrap border-r border-outline-variant/40">{branchName(r.branchId).replace('CORNEY ', '')}</td>
                        {MATERIALS.map((m) => { const q = bq(r.belanja, m.shop); const ts = tooSoon[`${r.id}|${m.id}`]; return <td key={m.id} title={ts != null ? `Pesan lagi padahal ±${ts} porsi seharusnya masih ada` : undefined} className={`px-2 py-2 text-center border-l border-outline-variant/20 tabular-nums ${ts != null ? 'bg-error-container text-error font-bold' : q > 0 ? 'font-bold text-primary' : 'text-on-surface-variant/40'}`}>{q > 0 ? (ts != null ? `⚠${q}` : `✓${q}`) : '–'}</td> })}
                      </tr>
                    )
                  })
                  return (<>
                    {rows.length === 0 && <tr><td colSpan={2 + MATERIALS.length} className="px-3 py-4 text-center text-on-surface-variant">Belum ada data periode ini.</td></tr>}
                    {body}
                    {rows.length > 0 && (
                      <tr className="bg-surface-container-high font-bold border-t-2 border-outline-variant">
                        <td className="px-3 py-2.5 sticky left-0 bg-surface-container-high border-r border-outline-variant/40" colSpan={2}>TOTAL unit</td>
                        {MATERIALS.map((m) => <td key={m.id} className="px-2 py-2.5 text-center tabular-nums text-primary">{tot[m.id] || '–'}</td>)}
                      </tr>
                    )}
                  </>)
                })()}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pemakaian saus per hari (data mentah untuk Owner) */}
        <section>
          <h2 className="font-headline-md text-headline-md flex items-center gap-2 mb-2"><Icon name="water_drop" className="text-primary" /> Pemakaian Saus per Hari</h2>
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            <table className="w-full text-[12px] border-collapse min-w-max">
              <thead><tr className="bg-primary text-on-primary">
                <th className="px-3 py-2 text-left border-r border-white/20">Tanggal</th>
                <th className="px-3 py-2 text-left border-r border-white/20">Cabang</th>
                {SAUCES.map((s) => <th key={s.id} className="px-3 py-2 text-right border-l border-white/20 whitespace-nowrap">{s.name}</th>)}
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={2 + SAUCES.length} className="px-3 py-4 text-center text-on-surface-variant">Belum ada data periode ini.</td></tr>}
                {rows.map((r, ri) => (
                  <tr key={r.id} className={ri % 2 ? 'bg-surface-container-low' : ''}>
                    <td className="px-3 py-2 font-bold whitespace-nowrap border-r border-outline-variant/40">{r.tgl}</td>
                    <td className="px-3 py-2 text-primary font-bold whitespace-nowrap border-r border-outline-variant/40">{branchName(r.branchId).replace('CORNEY ', '')}</td>
                    {SAUCES.map((s) => <td key={s.id} className="px-3 py-2 text-right border-l border-outline-variant/20 tabular-nums">{(r.sauces?.[s.id] || 0) || '–'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>)}

        <p className="text-[12px] text-on-surface-variant/70 leading-relaxed flex items-start gap-1.5"><Icon name="info" className="!text-[16px] shrink-0 mt-0.5" /> Analisa ini <strong>indikasi</strong>, bukan bukti. "Unit dipakai" = berapa kali item dicentang di checklist belanja kasir. Atur <strong>batas aman</strong> tiap bahan di kartunya. Saus terisi otomatis dari pilihan saus pembeli (walk-in & online).</p>
      </main>
    </div>
  )
}
