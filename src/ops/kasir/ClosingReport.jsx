import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PARENT_FILLINGS, BRANCHES, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, channelTotals, finalizeClosing, endDay } from '../../store/day.js'
import { createDeposit } from '../../store/deposits.js'
import { upsertStockDay, hasStockDay } from '../../store/stockdaily.js'
import { upsertSalesDay } from '../../store/salesdaily.js'
import { getOrders } from '../../store/orders.js'
import { clearKasirBranch } from './kasirSession.js'
import { flush, pendingCount, subscribe as subscribeOutbox } from '../../store/outbox.js'

// Tanggal: input <date> pakai YYYY-MM-DD; laporan disimpan DD/MM/YYYY.
const pad = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const isoToDDMM = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

// Step 1A.14 — CLS-06 Laporan Tutup Hari. UI ported from Stitch
// "daily_closing_report_corney_pos" (left nav drawer + footer stripped).
// KASIR-facing: wage-deduction shown as neutral "Nilai selisih stok" (Owner
// dashboard labels it Potongan gaji). Sending finalizes + closes the day.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const CH = [
  { id: 'tunai', label: 'Tunai', icon: 'payments', cls: 'bg-surface-container' },
  { id: 'qris_midtrans', label: 'Midtrans', icon: 'account_balance', cls: 'bg-blue-50 text-blue-700' },
  { id: 'qris_gopay', label: 'GoPay', icon: 'account_balance_wallet', cls: 'bg-green-50 text-green-700' },
  { id: 'gofood', label: 'GoFood', icon: 'delivery_dining', cls: 'bg-orange-50 text-orange-700' },
  { id: 'grabfood', label: 'Grab', icon: 'moped', cls: 'bg-green-50 text-green-800' },
]

export default function ClosingReport() {
  const day = useDay()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  // Status kirim laporan: idle → syncing (mengirim/menunggu jaringan) → done (benar2 sampai server).
  const [phase2, setPhase2] = useState('idle')
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pending, setPending] = useState(0)

  // Pantau koneksi + antrean outbox (status kirim saat offline).
  useEffect(() => {
    const upd = () => setOnline(navigator.onLine)
    window.addEventListener('online', upd); window.addEventListener('offline', upd)
    const off = subscribeOutbox(() => setPending(pendingCount()))
    return () => { window.removeEventListener('online', upd); window.removeEventListener('offline', upd); off() }
  }, [])
  // Saat 'syncing': beri jeda agar enqueue (dynamic import) mendarat, lalu dorong;
  // tandai 'done' begitu antrean BENAR-BENAR kosong (laporan sampai server).
  useEffect(() => {
    if (phase2 !== 'syncing') return
    let settled = false
    const finish = () => { if (!settled && pendingCount() === 0) { settled = true; setPhase2('done') } }
    const off = subscribeOutbox(finish)
    const t = setTimeout(() => { flush().finally(finish) }, 700)
    return () => { off(); clearTimeout(t) }
  }, [phase2])
  // Langkah 5 — tanggal laporan. Default hari ini; izinkan hari ini & kemarin
  // (untuk closing lewat tengah malam), tolak masa depan & tanggal yang sudah ada.
  const nowD = new Date()
  const todayISO = toISO(nowD)
  const yISO = toISO(new Date(nowD.getTime() - 86400000))
  // Tanggal dipilih di Langkah 1 (Request Belanja) → dibaca di sini.
  const dateISO = day?.reportDate || todayISO

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />
  if (!day.closing?.recon || !day.closing?.reconcile || !day.closing?.urgent) return <Navigate to="/ops/kasir/closing/rekon" replace />

  const { total } = channelTotals()
  const omzet = Object.values(total).reduce((s, v) => s + v, 0)
  const txnCount = (day.sales || []).length
  const reconRows = day.closing.recon.rows || []
  const sum = (k) => reconRows.reduce((s, r) => s + (r[k] || 0), 0)
  const patahT = sum('patah'), garansiT = sum('garansi'), promoT = sum('promo'), hilangT = sum('hilang')
  const selisihStok = day.closing.payroll?.potongTotal ?? 0 // value of (patah+garansi+hilang) — Owner reads as deduction
  const selisihKas = day.closing.reconcile?.selisih ?? 0
  const urgentT = day.closing.urgent?.total ?? 0
  const refundT = day.closing.refund?.total ?? 0
  const gajiT = day.closing.gaji?.total ?? 0
  // Uang tunai: hasil jualan tunai − semua uang keluar dari laci = yang disetor.
  const tunaiSales = total.tunai || 0
  const setoran = day.closing.reconcile?.setoran ?? (tunaiSales - urgentT - refundT - gajiT)
  const anomali = selisihKas !== 0 || hilangT > 0

  // Validasi tanggal laporan.
  const tglDDMM = isoToDDMM(dateISO)
  const dateFuture = dateISO > todayISO
  const dateTooOld = dateISO < yISO
  const dateDup = hasStockDay(tglDDMM, day.branchId)
  const dateOk = !dateFuture && !dateTooOld && !dateDup

  function kirim() {
    if (!dateOk) return
    // Tulis ke Laporan Stok Owner (1 sumber) sesuai TANGGAL yang dipilih kasir.
    const v = {}
    PARENT_FILLINGS.forEach((p) => {
      const r = reconRows.find((x) => x.parentId === p.id) || {}
      // opening (saat rekon) = sisa kemarin + barang datang. Pisahkan dua kolom itu
      // untuk Master Laporan: datang dari kiriman (stockArrivalLog), kemarin = sisanya.
      const datang = day.stockArrivalLog?.[p.id]?.datang || 0
      const kemarin = Math.max(0, (r.opening || 0) - datang)
      v[p.id] = { datang, kemarin, terjual: r.sold || 0, patah: r.patah || 0, garansi: r.garansi || 0, free: r.promo || 0, aktual: r.sisaBagus || 0 }
    })
    upsertStockDay({ tgl: tglDDMM, branchId: day.branchId, v })
    // Variant terjual: agregasi qty dari penjualan walk-in + online (cabang ini).
    const variants = {}
    ;(day.sales || []).forEach((s) => (s.lines || []).forEach((l) => { if (l.menuId) variants[l.menuId] = (variants[l.menuId] || 0) + (l.qty || 0) }))
    const onlineOrders = getOrders().filter((o) => o.branchId === day.branchId && o.paid && new Date(o.createdAt).getTime() >= (day.startedAt || 0))
    onlineOrders.forEach((o) => (o.lines || []).forEach((l) => { if (l.menuId) variants[l.menuId] = (variants[l.menuId] || 0) + (l.qty || 0) }))
    const onlineAmt = onlineOrders.reduce((s, o) => s + (o.total || 0), 0)
    // Pemakaian SAUS: hitung porsi corndog yg pakai tiap saus (walk-in + online) →
    // untuk Analisa Bahan vs Jual. Saus di tiap line: array {id} atau string id.
    const sauces = { tomat: 0, sambal: 0, keju: 0, mayo: 0 }
    const tallySauce = (lines) => (lines || []).forEach((l) => (l.sauces || []).forEach((s) => { const id = typeof s === 'string' ? s : s?.id; if (id != null && sauces[id] != null) sauces[id] += (l.qty || 1) }))
    ;(day.sales || []).forEach((s) => tallySauce(s.lines))
    onlineOrders.forEach((o) => tallySauce(o.lines))
    // Jam paling ramai (dari timestamp transaksi) — untuk Laporan Keuangan & Dashboard.
    const peakHour = (() => {
      const b = {}
      ;(day.sales || []).forEach((s) => { if (!s.ts) return; const h = new Date(s.ts).getHours(); b[h] = (b[h] || 0) + 1 })
      const top = Object.entries(b).sort((x, y) => y[1] - x[1])[0]
      if (!top) return null
      const h = Number(top[0]); return `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`
    })()
    upsertSalesDay({ tgl: tglDDMM, branchId: day.branchId, variants, channels: { ...total }, source: { online: onlineAmt, walkin: Math.max(0, omzet - onlineAmt) }, potongan: { urgent: urgentT, refund: refundT, gaji: gajiT }, kasAktual: day.closing.reconcile?.kasPenjualanTunai ?? null, trx: txnCount, peakHour, sauces, belanja: day.closing.belanja || [] })

    finalizeClosing({
      ts: day.startedAt, tgl: tglDDMM, omzet, txnCount, channels: total,
      selisihStok, selisihKas, urgent: urgentT, refund: refundT, gaji: gajiT,
      patah: patahT, garansi: garansiT, promo: promoT, hilang: hilangT,
      payroll: day.closing.payroll, sisaBagus: day.closing.recon.sisaBagus,
    })
    // Declare the cash deposit (kasir side) so Operasional can collect it (OPS-04).
    // Setoran = kas penjualan (tunai − urgent − refund − gaji), modal awal disisihkan.
    if (setoran > 0) {
      createDeposit({ branchId: day.branchId, branchName: branch.name, amount: setoran, tgl: tglDDMM, rincian: { tunai: tunaiSales, urgent: urgentT, refund: refundT, gaji: gajiT, urgentItems: (day.closing.urgent?.items || []).map((it) => ({ amount: it.amount, reason: it.reason })) } })
    }
    setPhase2('syncing')
  }
  function selesai() {
    endDay()
    clearKasirBranch()
    navigate('/ops/kasir/login', { replace: true })
  }

  const Tile = ({ span = 'col-span-12 md:col-span-6 lg:col-span-4', children }) => (
    <div className={`${span} bg-white p-6 rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-surface-variant`}>{children}</div>
  )

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container px-margin-page h-[72px] flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/ops/kasir/closing/tunai')}><Icon name="arrow_back" /></button>
          <h1 className="font-headline-lg text-headline-lg">Laporan Tutup Hari</h1>
          <span className="text-label-md font-label-md bg-on-primary-container/10 px-3 py-1 rounded-full border border-on-primary-container/20">Langkah 5/5</span>
        </div>
        <div className="text-right">
          <p className="font-label-lg text-label-lg">{branch.name}</p>
          <p className="text-label-md opacity-90">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-margin-page space-y-gutter-grid max-w-7xl mx-auto w-full">
          {/* Konfirmasi tanggal (diatur di Langkah 1 — Request Belanja) */}
          <div className={`rounded-xl p-4 flex items-center justify-between gap-3 border-2 ${dateOk ? 'bg-secondary-container/20 border-secondary-container' : 'bg-error-container border-error/40'}`}>
            <div className="flex items-center gap-3">
              <Icon name="event" className="text-primary" />
              <div>
                <p className="font-label-md text-on-surface-variant">Tanggal laporan</p>
                <p className="font-headline-md text-headline-md text-on-surface">{tglDDMM}</p>
              </div>
            </div>
            {dateOk ? (
              <span className="text-green-700 font-label-md flex items-center gap-1"><Icon name="check_circle" fill className="text-base" /> siap</span>
            ) : (
              <button onClick={() => navigate('/ops/kasir/closing/belanja')} className="text-primary font-bold underline underline-offset-4 text-label-md">{dateDup ? 'Tanggal sudah ada — ubah di Langkah 1' : 'Perbaiki tanggal di Langkah 1'}</button>
            )}
          </div>

          {/* Anomaly callout */}
          {anomali ? (
            <div className="bg-error-container border-l-8 border-error p-4 rounded-xl flex items-center gap-4">
              <Icon name="warning" fill className="text-error" />
              <span className="font-label-lg text-on-error-container">Perlu dicek: {selisihKas !== 0 ? `kas selisih ${fmtRp(selisihKas)}` : ''}{selisihKas !== 0 && hilangT > 0 ? ' · ' : ''}{hilangT > 0 ? `${hilangT} porsi hilang` : ''}.</span>
            </div>
          ) : (
            <div className="bg-green-100 border-l-8 border-green-500 p-4 rounded-xl flex items-center gap-4">
              <Icon name="check_circle" fill className="text-green-700" />
              <span className="font-label-lg text-green-900">Mantap! Tidak ada anomali hari ini. Data tersinkron sempurna.</span>
            </div>
          )}

          <div className="grid grid-cols-12 gap-gutter-grid">
            {/* Hero: Omzet */}
            <div className="col-span-12 lg:col-span-8 bg-white p-8 rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-surface-variant relative overflow-hidden">
              <p className="text-on-surface-variant font-label-lg mb-2">Omzet Hari Ini</p>
              <h2 className="font-display-lg text-display-lg text-primary mb-6">{fmtRp(omzet)}</h2>
              <div className="flex flex-wrap gap-2">
                {CH.filter((c) => total[c.id] > 0).map((c) => (
                  <span key={c.id} className={`${c.cls} px-3 py-1.5 rounded-full text-label-md flex items-center gap-2`}>
                    <Icon name={c.icon} className="text-[18px]" /> {c.label} {fmtRp(total[c.id])}
                  </span>
                ))}
                {omzet === 0 && <span className="text-on-surface-variant italic">Belum ada penjualan.</span>}
              </div>
              <div className="absolute -right-12 -bottom-12 opacity-5 pointer-events-none"><Icon name="trending_up" className="!text-[240px]" /></div>
            </div>

            {/* Jumlah transaksi */}
            <Tile span="col-span-12 md:col-span-6 lg:col-span-4">
              <div className="flex flex-col justify-center items-center text-center h-full">
                <Icon name="receipt" className="text-secondary !text-[40px] mb-2" />
                <p className="text-on-surface-variant font-label-md">Jumlah transaksi</p>
                <p className="font-display-md text-display-md text-on-surface">{txnCount}</p>
              </div>
            </Tile>

            {/* Selisih kas */}
            <Tile>
              <div className="flex justify-between items-start mb-4">
                <p className="text-on-surface-variant font-label-md">Selisih kas</p>
                <span className={`px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider ${selisihKas === 0 ? 'bg-green-100 text-green-800' : 'bg-error-container text-on-error-container'}`}>{selisihKas === 0 ? 'Pas' : 'Selisih'}</span>
              </div>
              <p className="font-headline-lg text-headline-lg text-on-surface">{selisihKas > 0 ? '+' : ''}{fmtRp(selisihKas)}</p>
              <p className={`text-label-md mt-2 flex items-center gap-1 ${selisihKas === 0 ? 'text-green-600' : 'text-error'}`}>
                <Icon name={selisihKas === 0 ? 'verified' : 'error'} className="text-[16px]" /> {selisihKas === 0 ? 'Kas pas' : 'Wajib alasan'}
              </p>
            </Tile>

            {/* Uang tunai disetor — hasil jualan tunai dikurangi semua uang keluar dari laci */}
            <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-surface-variant flex flex-col">
              <p className="text-on-surface-variant font-label-md mb-3 flex items-center gap-2"><Icon name="account_balance_wallet" className="text-primary" /> Uang Tunai Disetor</p>
              <div className="space-y-1.5 text-label-md text-on-surface-variant">
                <div className="flex justify-between"><span>Hasil jualan tunai</span><span className="font-bold text-on-surface">{fmtRp(tunaiSales)}</span></div>
                <div className="flex justify-between"><span>− Uang Urgent</span><span>{fmtRp(urgentT)}</span></div>
                <div className="flex justify-between"><span>− Uang balik ke pembeli</span><span>{fmtRp(refundT)}</span></div>
                <div className="flex justify-between"><span>− Uang harian karyawan</span><span>{fmtRp(gajiT)}</span></div>
              </div>
              <div className="flex justify-between items-center border-t-2 border-outline-variant pt-2 mt-2">
                <span className="font-label-lg text-on-surface">= Disetor</span>
                <span className="font-headline-lg text-headline-lg text-primary">{fmtRp(setoran)}</span>
              </div>
              {selisihKas !== 0 && (
                <p className="text-label-md text-error mt-2 flex items-center gap-1"><Icon name="warning" className="text-base" /> Uang fisik beda {selisihKas > 0 ? '+' : ''}{fmtRp(selisihKas)} dari seharusnya.</p>
              )}
            </div>

            {/* Susut stok */}
            <Tile>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center"><Icon name="inventory" className="text-error" /></div>
                <div>
                  <p className="text-on-surface-variant font-label-md">Hilang (tak terjelaskan)</p>
                  <p className="font-headline-lg text-headline-lg text-on-surface">{hilangT} porsi</p>
                </div>
              </div>
            </Tile>

            {/* Nilai selisih stok (neutral — Owner reads as wage deduction) */}
            <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-surface-variant flex items-center justify-between">
              <div>
                <p className="text-on-surface-variant font-label-md mb-1">Nilai selisih stok</p>
                <p className="font-headline-lg text-headline-lg text-error">{fmtRp(selisihStok)}</p>
              </div>
              <p className="text-label-md text-on-surface-variant text-right">patah {patahT} · garansi {garansiT} · hilang {hilangT}</p>
            </div>

            {/* Gratis-gratis */}
            <div className="col-span-12 bg-surface-container-low p-6 rounded-xl border border-outline-variant flex flex-wrap gap-12">
              <div className="flex items-center gap-3">
                <Icon name="redeem" fill className="text-secondary-container" />
                <div><p className="text-on-surface-variant font-label-md">Gratis promo</p><p className="font-headline-md text-headline-md text-on-surface">{promoT} porsi</p></div>
              </div>
              <div className="flex items-center gap-3 border-l border-outline-variant pl-12">
                <Icon name="verified_user" fill className="text-primary" />
                <div><p className="text-on-surface-variant font-label-md">Gratis garansi</p><p className="font-headline-md text-headline-md text-on-surface">{garansiT} porsi</p></div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col md:flex-row gap-4 pt-6 pb-10">
            <button onClick={kirim} disabled={!dateOk || phase2 !== 'idle'} className="flex-1 min-h-[52px] bg-primary text-white font-label-lg rounded-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-40 disabled:hover:scale-100">
              <Icon name="send" /> Kirim Laporan (tgl {tglDDMM}) &amp; Tutup Hari
            </button>
            <button onClick={() => window.print()} className="min-h-[52px] px-8 bg-surface-container-high text-on-surface font-label-lg rounded-xl flex items-center justify-center gap-3 hover:bg-surface-variant transition-colors border border-outline-variant">
              <Icon name="print" /> Cetak Struk Ringkasan
            </button>
          </div>
        </div>
      </main>

      {phase2 !== 'idle' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full max-w-md rounded-xl p-8 text-center shadow-[0_16px_32px_rgba(26,26,26,0.12)]">
            {phase2 === 'done' ? (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><Icon name="check_circle" fill className="text-green-600 !text-[48px]" /></div>
                <h3 className="font-headline-lg text-headline-lg mb-2">Laporan Terkirim!</h3>
                <p className="text-on-surface-variant mb-8">Hari ini selesai direkap &amp; dikirim ke Owner. Sisa bagus jadi "sisa kemarin" untuk Opening besok.</p>
                <button onClick={selesai} className="w-full min-h-[52px] bg-primary text-white font-label-lg rounded-xl">Selesai</button>
              </>
            ) : !online ? (
              <>
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6"><Icon name="wifi_off" className="text-amber-600 !text-[40px]" /></div>
                <h3 className="font-headline-lg text-headline-lg mb-2">Menunggu jaringan internet…</h3>
                <p className="text-on-surface-variant mb-3">Sambungkan ke internet sebentar ya — <b>cek koneksimu</b>. Begitu online, laporan otomatis terkirim.</p>
                <p className="text-[13px] text-green-800 bg-green-50 rounded-lg py-2 px-3 mb-5 flex items-center justify-center gap-1.5"><Icon name="verified_user" fill className="!text-[16px] text-green-600" /> Tenang — laporan sudah <b>AMAN tersimpan</b>, tidak akan hilang.</p>
                <div className="flex items-center justify-center gap-2 mb-6 text-on-surface-variant"><div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /><span className="text-label-md">{pending} data menunggu terkirim…</span></div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => flush()} className="w-full min-h-[48px] bg-primary text-white font-label-lg rounded-xl flex items-center justify-center gap-2"><Icon name="sync" /> Coba kirim lagi</button>
                  <button onClick={selesai} className="w-full min-h-[44px] text-on-surface-variant text-label-md underline underline-offset-2">Tutup hari dulu (terkirim otomatis saat online &amp; login lagi)</button>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
                <h3 className="font-headline-lg text-headline-lg mb-2">Mengirim laporan…</h3>
                <p className="text-on-surface-variant">Sebentar ya, sedang menyimpan ke server.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
